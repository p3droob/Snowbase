import { encrypt, decrypt } from "./helpers/crypto.js";
import { parsePath, log, getTargetFromData } from "./helpers/utils.js";
import { resolve, join } from "path";
import { EventEmitter } from "events";
import FileStorage from "./storages/FileStorage.js";

/**
 * Snowbase database in JSON, with encription, logging and backup
 * @class Snowbase
 * @extends EventEmitter
 *
 * @example
 * import Snowbase from "snowbase";
 *
 * const db = new Snowbase({
 *  baseDir: "./database"// Default is './snowbase'
 *  encryption: true,
 *  secret: "password123",
 *  logging: true,
 *  backup: true
 * });
 *
 * db.on("ready", () => {
 *   console.log("Database is ready");
 * });
 *
 * db.on("error", (err) => {
 *   console.error(err);
 * });
 * db.set("user/name", "Pedro");
 * console.log(db.get("user/name"))// Pedro
 */

export default class Snowbase extends EventEmitter {
  /**
   * @param {Object} [args]
   * @param {string} [args.baseDir='./snowbase'] - The base directory for the database.
   * @param {boolean} [args.encryption=false] - Enable encryption
   * @param {string} [args.secret] - Encryption secret
   * @param {boolean} [args.logging=false] - Enable logging
   * @param {boolean} [args.backup=false] - Enable backup
   */
  constructor(args = {}) {
    super();
    this.baseDir = args.baseDir ? resolve(args.baseDir) : resolve("./snowbase");
    if (args.encryption === true) {
      if (!args.secret)
        this._error(
          "[INVALID_SECRET] Encryption secret is required when encryption is enabled",
        );
      this.secret = args.secret;
      this.encryption = true;
    } else {
      this.encryption = false;
    }
    if (args.logging == true) {
      this.logsDir = join(this.baseDir, "logs");
      this.logging = true;
    } else this.logging = false;

    if (args.backup == true) {
      this.backupDir = join(this.baseDir, "backups");
      this.backup = true;
    } else this.backup = false;

    this.path = join(this.baseDir, "snowbase.json"); //Default path for the database file
    if (this.logsDir) this.logsPath = join(this.logsDir, "snowbase.log");

    this.storage = new FileStorage({
      baseDir: this.baseDir,
      encryption: this.encryption,
      secret: this.secret || "",
      backup: this.backup,
      logging: this.logging,
      error: this._error.bind(this),
      emit: this.emit.bind(this),
      log: this._log.bind(this),
    });
    this.emit("ready");
  }

  /**
   * @param {any} data
   * @param {string} [secret]
   * @returns {string}
   */
  _encrypt(data, secret) {
    return encrypt(data, secret ? secret : this.secret || "");
  }

  /**
   * @param {string} raw
   * @param {string} [secret]
   * @returns {any}
   */
  _decrypt(raw, secret) {
    return decrypt(raw, secret ? secret : this.secret || "");
  }

  /**
   * @param {any} err
   * @returns {never}
   */
  _error(err) {
    const error = new Error(String(err));
    if (this.listenerCount("error") > 0) this.emit("error", error);
    throw error;
  }

  /**
   * @param {string|undefined|Function} path - Path to parse
   * @returns {string[]} Array of path parts
   */
  _parsePath(path) {
    return parsePath(path, this._error.bind(this));
  }

  /**
   * @param {string|undefined|Function} path - Path to get target
   * @returns {*} Target value
   */
  _getTarget(path) {
    const parts = this._parsePath(path);
    let current = this.storage.read();
    for (const part of parts) {
      if (
        current == null ||
        typeof current !== "object" ||
        !Object.hasOwn(current, part)
      ) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  /**
   * @param {Object} data - Data to get target from
   * @param {string} path - Path to get target from
   * @returns {*} Target value
   */
  _getTargetFromData(data, path) {
    return getTargetFromData(data, path, this._error.bind(this));
  }

  /**
   * @param {string} operation - Operation to log
   * @param {Object} [details] - Details of the operation
   * @returns {string}
   */
  _log(operation, details) {
    return log(
      operation,
      details,
      this.logsPath || "",
      this.emit.bind(this),
      this.logging,
    );
  }

  /**
   * Gets a value at a specified path
   * @param {string} [path] - Path to get value
   * @returns {*} Value at the specified path
   *
   * @example
   * db.get("user/name"); // returns "Pedro"
   *
   * db.get(); // returns the entire database
   */
  get(path) {
    const data = this.storage.read();
    if (arguments.length === 0) {
      this._log("get", { path: undefined, data });
      return data;
    }
    if (path === undefined) {
      this._error("[INVALID_PATH] Invalid path to get");
    }
    const value = this._getTargetFromData(data, path);
    this._log("get", { path, value });
    return value;
  }

  /**
   * Removes a value at a specified path
   * @param {string} path - Path to remove value
   * @returns {boolean} Returns `true` if the value was removed, `false` otherwise
   *
   * @example
   * db.get("user")// { name: "Pedro" }
   *
   * db.remove("user/name"); // returns true
   *
   * db.remove("user/age"); // returns false
   */
  remove(path) {
    if (path === undefined)
      this._error("[INVALID_PATH] Invalid path to remove");
    const parts = this._parsePath(path);
    const data = this.storage.read();
    let current = data;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (
        current == null ||
        typeof current !== "object" ||
        !Object.hasOwn(current, key)
      ) {
        this._log("remove", { path, value: undefined, removed: false });
        return false; //returns false if the path does not exist
      }
      current = current[key];
    }
    const lastKey = parts[parts.length - 1];
    if (!Object.hasOwn(current, lastKey)) {
      this._log("remove", { path, value: undefined, removed: false });
      return false;
    }
    this._log("remove", { path, value: current[lastKey], removed: true });
    delete current[lastKey];
    this.storage.write(data);
    return true;
  }

  /**
   * Clears the entire database
   * @returns {boolean} Returns `true` if the database was cleared
   *
   * @example
   * db.clear(); // returns true
   */
  clear() {
    const data = this.storage.read();
    this.storage.write({});
    this._log("clear", { value: data });
    return true;
  }

  /**
   * Sets a value at a specified path
   * @param {string} path - Path to set value
   * @param {*} value - Value to set
   * @returns {void}
   *
   * @example
   * db.set("user/name", "Pedro"); // set the value of user/name to "Pedro"
   */
  set(path, value) {
    if (!path) this._error("[MISSING_KEY] Missing key to set");
    if (value === undefined)
      this._error("[MISSING_VALUE] Missing value to set");
    const parts = this._parsePath(path);
    const data = this.storage.read();
    let current = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (current[key] == null || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
    current[parts[parts.length - 1]] = value;
    this.storage.write(data);
    this._log("set", { path, key: parts[parts.length - 1], value });
  }

  /**
   * Alias for set(path, value)
   * @param {string} path - Path to save value
   * @param {*} value - Value to save
   * @returns {void}
   *
   * @example
   * db.save("user/name", "Pedro"); // save the value of user/name to "Pedro"
   */
  save(path, value) {
    return this.set(path, value);
  }

  /**
   * Return all values from a specified path with a filter.
   *
   * If dont provide path, it will search in the entire database.
   * It only search in the first level of the path (if you provide path='/users', it will only search in the users object, not in the nested objects).
   *
   * @param {string|((value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any)} [path] - Path to get all values from or filter function if path is omitted
   * @param {((value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any)} [filter] - Filter to apply to the values
   * @returns {{ key: string; value: any; }[]} Array of key-value pairs
   *
   * @example
   * db.get("users")// { pedro: {name: "Pedro"}, laura: {name: "Laura"}, john: {name: "John"}}
   * db.get("animals")// {dog: {name: "Duke"}, cat: {name: "Princess"}}
   *
   * db.all("users", (x) => x.key.includes("r")) // returns all values with key that includes "r" ( [ { key: "pedro", value: { ... } }, { key: "laura", value: { ... } } ] )
   * db.all((x) => x.key.includes("ani")) // returns all values with key that includes "ani" ( [ { key: "animals", value: { ... } } ] )
   */
  all(path, filter) {
    if (typeof path === "function") {
      filter = path;
      path = undefined;
    }

    if (filter !== undefined && typeof filter !== "function") {
      this._error("[INVALID_FILTER] Filter must be a function");
    }
    let target =
      path !== undefined ? this._getTarget(path) : this.storage.read();
    if (target == null || typeof target !== "object") return [];

    const formatted = Object.entries(target).map(([key, value]) => ({
      key,
      value,
    }));
    return filter ? formatted.filter(filter) : formatted;
  }

  /**
   * Checks if a path exists
   * @param {string} path - Path to check
   * @returns {boolean} Returns `true` if the path exists, `false` otherwise
   *
   * @example
   * db.get("user")// { name: "Pedro" }
   *
   * db.has("user/name"); // true
   *
   * db.has("user/age"); // false
   */
  has(path) {
    if (!path) this._error("[INVALID_PATH] Invalid path to check");
    return this._getTarget(path) !== undefined;
  }

  /**
   * Return the number of values at a specified path
   *
   * If dont provide path, it will search in the entire database.
   * It only search in the first level of the path (if you provide path='/users', it will only search in the users object, not in the nested objects).
   *
   * @param {string|((value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any)} [path] - Path to count values from or filter function if path is omitted
   * @param {(value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any} [filter] - Filter to apply to the values
   * @returns {number} Number of values at the specified path
   *
   * @example
   * db.get("users")// { pedro: {name: "Pedro"}, laura: {name: "Laura"}, john: {name: "John"}}
   *
   * db.count("users"); // 3
   *
   * db.count("users", (x) => x.key.includes("r")); // 2
   */
  count(path, filter) {
    if (path === undefined && filter === undefined) return this.all().length;
    if (typeof path === "function") {
      filter = path;
      path = undefined;
    }
    //how many entries are in the database, with an optional filter function to count only specific entries
    return this.all(path, filter).length;
  }

  /**
   * Return the first value that satisfies the predicate function
   *
   * If dont provide path, it will search in the entire database.
   * It only search in the first level of the path (if you provide path='/users', it will only search in the users object, not in the nested objects).
   *
   * @param {string|((value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any)} [path] - Path to find value in or predicate function if path is omitted
   * @param {(value: { key: string; value: any; }, index: number, array: { key: string; value: any; }[]) => any} [predicate] - Predicate function to apply to the values
   * @returns {{ key: string; value: any; }|null} Value at the specified path
   *
   * @example
   * db.get("users")// { laura: {name: "Laura"}, john: {name: "John"}, pedro: {name: "Pedro"} }
   *
   * db.find("users", (x) => x.key.includes("r")); // { key: "laura", value: { ... } }
   *
   * db.find((x) => x.key.includes("u")); // { key: "user", value: { ... } }
   *
   * db.find((x) => x.key.includes("z")) // null
   */
  find(path, predicate) {
    if (path === undefined && predicate === undefined) {
      return null;
    }
    if (typeof path === "function") {
      predicate = path;
      path = undefined;
    }
    if (typeof predicate !== "function")
      this._error("[INVALID_PREDICATE] Predicate must be a function");
    const data =
      path !== undefined ? this._getTarget(path) : this.storage.read();
    if (data === undefined || typeof data !== "object") return null;
    const entries = Object.entries(data).map(([key, value]) => ({
      key,
      value,
    }));

    return (predicate && entries.find(predicate)) || null;
  }
}
