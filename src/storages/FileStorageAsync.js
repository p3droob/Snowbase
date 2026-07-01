import { writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import { stat, mkdir, readdir, unlink, copyFile } from "node:fs/promises";
import { read, write, randomId5 } from "../helpers/utilsAsync.js";
import { encrypt, decrypt } from "../helpers/crypto.js";
import { resolve, join } from "path";

/**
 * @fileoverview FileStorage is a storage class that stores data in a file.
 * @class FileStorage
 */
export default class FileStorageAsync {
  /**
   * @description Creates a new instance of FileStorage.
   * @param {Object} options - Options for the FileStorage.
   * @param {string} options.baseDir - The base directory for the database.
   * @param {boolean} [options.encryption] - Whether to encrypt the data.
   * @param {string} [options.secret] - The secret key for encryption.
   * @param {boolean} [options.backup] - Whether to backup the data.
   * @param {boolean} [options.logging] - Whether to log the data.
   * @param {*} options.error - Function to handle errors.
   * @param {function(...any): void} options.emit - Function to emit events.
   * @param {function(string, any): void} options.log - Function to log the data.
   * @memberof FileStorage
   * @constructor
   */
  constructor({
    baseDir,
    encryption = false,
    secret = "",
    backup = false,
    logging = false,
    error,
    emit,
    log,
  }) {
    this.baseDir = resolve(baseDir) || resolve("./snowbase");
    this.encryption = encryption;
    this.secret = secret;
    this.backup = backup;
    this.logging = logging;
    this._error = error;
    this.emit = emit;
    this._log = log;
    this.path = join(this.baseDir, "snowbase.json");

    if (this.logging) {
      this.logsDir = join(this.baseDir, "logs");
    }
    if (this.backup) {
      this.backupDir = join(this.baseDir, "backups");
    }
    this.path = join(this.baseDir, "snowbase.json");
    if (this.logsDir) this.logsPath = join(this.logsDir, "snowbase.log");

    //Creating directories if they don't exist
    mkdirSync(this.baseDir, { recursive: true });
    if (this.backup && this.backupDir)
      mkdirSync(this.backupDir, { recursive: true }); //only if the user wants backup
    if (this.logging && this.logsDir)
      mkdirSync(this.logsDir, { recursive: true }); //only if the user wants logging

    //Creating the database file if it doesn't exist
    if (!existsSync(this.path)) {
      const initialData = this.encryption
        ? encrypt({}, this.secret)
        : JSON.stringify({});
      writeFileSync(this.path, initialData, "utf8");
      /** @type {Record<string, any>|null} */
      this._cache = {};
      /** @type {import("node:fs").Stats} */
      const stat = statSync(this.path);
      /** @type {number} Last known modification time of the database file */
      this._cacheMtime = stat.mtimeMs;
      /** @type {number} Last known size of the database file */
      this._cacheSize = stat.size;
    } else {
      /** @type {Record<string, any>|null} */
      this._cache = null;
      /** @type {number} */
      this._cacheMtime = 0;
    }
    if (this.logging && this.logsPath && !existsSync(this.logsPath))
      writeFileSync(this.logsPath, "", "utf8");
  }
  /**
   * @returns {Promise<Record<string, any>>} The data from the database
   */
  async readAsync() {
    // Validate cache freshness by comparing file mtime
    const fileStat = await stat(this.path);
    const currentMtime = fileStat.mtimeMs;
    if (
      this._cache !== null &&
      currentMtime === this._cacheMtime &&
      fileStat.size === this._cacheSize
    ) {
      return this._cache;
    }
    const data = await read(
      this.path,
      this._error.bind(this),
      this.encryption,
      this.secret || "",
    );
    if (data === null || Array.isArray(data) || typeof data !== "object") {
      this._error("[INVALID_DATABASE] The database root must be an object.");
    }
    this._cache = data;
    this._cacheMtime = currentMtime;
    this._cacheSize = fileStat.size;
    return data;
  }

  /**
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   */
  async writeAsync(data) {
    await write(
      this.path,
      data,
      this._error.bind(this),
      this.emit.bind(this),
      this.encryption,
      this.secret,
    );
    await this.createBackupAsync();
    this._cache = data;
    this._cacheMtime = (await stat(this.path)).mtimeMs;
  }

  async createBackupAsync() {
    if (!this.backup || !this.backupDir) return;
    const maxBackups = 20;
    const backupDir = this.backupDir || join(this.baseDir, "backups");
    await mkdir(backupDir, { recursive: true });
    //Getting all backup files
    const files = (
      await Promise.all(
        (await readdir(backupDir))
          .filter((f) => f.startsWith("backup_"))
          .map(async (file) => {
            const fullPath = join(backupDir, file);
            const stats = await stat(fullPath);

            return {
              path: fullPath,
              time: stats.mtimeMs,
            };
          }),
      )
    ).sort((a, b) => a.time - b.time);

    if (files.length - maxBackups > 0) {
      for (let i = 0; i < files.length - maxBackups; i++) {
        await unlink(files[i].path);
      }
    }
    //Creates a new backup
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = join(backupDir, `backup_${stamp}-${randomId5()}.json`);

    await copyFile(this.path, backupFile);
    this._log("create backup", { backupFile });
    return backupFile;
  }
}
