#!/usr/bin/env node
import Snowbase from "../src/Snowbase.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";

const args = process.argv.slice(2);
const cmd = args[0];
function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + 1,
            );
    }
  }

  return matrix[b.length][a.length];
}

function suggestCommand(input, commands) {
  let best = null;
  let distance = Infinity;

  for (const command of commands) {
    const d = levenshtein(input, command);

    if (d < distance) {
      distance = d;
      best = command;
    }
  }

  return distance <= 3 ? best : null;
}

let helpMessage = `
${chalk.bold("SNOWBASE COMMANDS")}
  ${chalk.blue("init")}  Load the directory and create the database file

  ${chalk.blue("inspect")}  Inspect the database file

  ${chalk.blue("backup")}  Creates a backup of the database file

  ${chalk.blue("restore")}  Restore the database file

  ${chalk.blue("clear")}  Clear the database file

  ${chalk.blue("get")}  Get the value of a key

  ${chalk.blue("set")}  Set the value of a key

  ${chalk.blue("remove")}  Remove a key from the database

${chalk.blue("has")}  Check if a key exists in the database

  ============================================================
${chalk.bold("COMPILER OPTION")}

  ${chalk.blue("--baseDir")} The directory where the database is located. Default: ./snowbase

  ${chalk.blue("--encryption")} Enables encryption. Default: false

  ${chalk.blue("--secret")} The secret key for encryption. Default: ""

  ${chalk.blue("--logging")} Enables logging. Default: false

  ${chalk.blue("--backup")} Enables backup. Default: false

  ${chalk.blue("--restoreFile")} The backup file to restore. Default: ""
  
${chalk.bold("EXAMPLE")}
  ${chalk.yellow('snowbase init --baseDir "./snowbase" --encryption --secret "mysecret" --logging --backup')}
  `;
if (!cmd) {
  console.log(helpMessage);
}

const commands = [
  "init",
  "inspect",
  "backup",
  "restore",
  "clear",
  "get",
  "set",
  "remove",
  "has",
];
if (cmd) {
  let config = {
    baseDir: "./snowbase",
    encryption: false,
    secret: "",
    logging: false,
    backup: false,
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);

    if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
      config[key] = args[++i];
    } else {
      config[key] = true;
    }
  }
  const db = new Snowbase(config);

  switch (cmd) {
    default: {
      console.log(helpMessage);
      const suggestion = suggestCommand(cmd, commands);
      if (suggestion) {
        console.log(`Did you mean ${chalk.blue(suggestion)}?`);
      }
      break;
    }

    case "init": {
      console.log(`Snowbase initialized at ${db.baseDir}`);
      console.log(db.backupDir);
      break;
    }
    case "inspect": {
      const all = db.get();
      let keys = Object.keys(all || {});
      let d = 0;
      if (
        keys.length === 4 &&
        keys.sort().every((v, i) => v === ["data", "iv", "salt", "tag"][i])
      ) {
        d = 1;
        console.log(chalk.blue("Database is encrypted, wait..."));
        try {
          keys = Object.keys(db._decrypt(JSON.stringify(all), config.secret));
        } catch (error) {
          d = -1;
        }
      }
      if (d === 1)
        console.log(chalk.greenBright("Database decrypted successfully"));
      if (d > -1) {
        console.log(`Number of keys: ${keys.length}`);
        console.log("Keys:", keys);
        console.log("Size of database:", JSON.stringify(all).length, " bytes");
      } else
        console.log(
          chalk.red("Decryption failed, please provide a valid secret"),
        );
      break;
    }

    case "backup": {
      const backupFile = db.storage.createBackup();
      if (!backupFile)
        console.log(
          chalk.red(
            "You need to use --backup flag and must have a backup directory",
          ),
        );
      else console.log(`Backup created at ${backupFile}`);
      break;
    }

    case "restore": {
      if (!config.restoreFile) {
        console.log(
          "Usage: snowbase restore --secret <secret, only if needed> --restoreFile <backup-ID>",
        );
        console.log(
          "Example: snowbase restore --secret mysecret123 --restoreFile 2026-06-27T14-30-45-123Z-asf3k",
        );
        break;
      }
      const backupFile = path.join(
        db.storage.backupDir || "./snowbase/backups",
        `backup_${config.restoreFile}.json`,
      );
      if (fs.existsSync(backupFile)) {
        let fileData = fs.readFileSync(backupFile, "utf8");
        fileData = JSON.parse(fileData);
        let keys = Object.keys(fileData || {});
        let d = 0;
        if (
          keys.length === 4 &&
          keys.sort().every((v, i) => v === ["data", "iv", "salt", "tag"][i])
        ) {
          d++;
          console.log(chalk.blue("Database is encrypted, wait..."));
          try {
            fileData = db._decrypt(JSON.stringify(fileData), config.secret);
          } catch (error) {
            d = -1;
          }
        }
        if (d === 1)
          console.log(chalk.greenBright("Database decrypted successfully"));
        if (d > -1) {
          const backupDataRestore = JSON.parse(
            fs.readFileSync(backupFile, "utf8"),
          );

          fs.mkdirSync(db.storage.baseDir, { recursive: true });
          fs.writeFileSync(
            path.join(db.storage.baseDir, "snowbase.json"),
            JSON.stringify(backupDataRestore),
          );
          db.storage._cache = backupDataRestore;
          db.storage._cacheMtime = fs.statSync(backupFile).mtimeMs;
          db.storage._cacheSize = fs.statSync(backupFile).size;
          console.log(`Database restored from ${backupFile}`);
        } else
          console.log(
            chalk.red("Decryption failed, please provide a valid secret"),
            "Example: snowbase restore --secret <secret> --restoreFile <backup-ID>",
          );
      } else {
        console.log(
          chalk.red(
            `Backup file ${backupFile} does not exist. Check the backup ID or if the dir exists`,
          ),
        );
      }
      break;
    }

    case "clear": {
      let all = db.get();
      let keys = Object.keys(all || {});
      let d = 0;
      if (
        keys.length === 4 &&
        keys.sort().every((v, i) => v === ["data", "iv", "salt", "tag"][i])
      ) {
        d = 1;
        console.log(chalk.blue("Database is encrypted, wait..."));
        try {
          all = db._decrypt(JSON.stringify(all), config.secret);
        } catch (error) {
          d = -1;
        }
      }
      if (d === 1)
        console.log(chalk.greenBright("Database decrypted successfully"));
      if (d > -1) {
        db.clear();
        console.log("Database cleared.");
      } else
        console.log(
          chalk.red("Decryption failed, please provide a valid secret"),
        );
      break;
    }

    case "get": {
      let all = db.get();
      let keys = Object.keys(all || {});
      let d = 0;
      if (
        keys.length === 4 &&
        keys.sort().every((v, i) => v === ["data", "iv", "salt", "tag"][i])
      ) {
        d = 1;
        console.log(chalk.blue("Database is encrypted, wait..."));
        try {
          all = db._decrypt(JSON.stringify(all), config.secret);
        } catch (error) {
          d = -1;
        }
      }
      if (d === 1)
        console.log(chalk.greenBright("Database decrypted successfully"));
      if (d > -1) {
        if (!config.key) console.log(all);
        else console.log(db._getTargetFromData(all, config.key));
      } else
        console.log(
          chalk.red("Decryption failed, please provide a valid secret"),
        );
      break;
    }

    case "set": {
      if (!config.key) console.log(db.get());
      else console.log(db.get(config.key));
      break;
    }

    case "remove": {
      let run = db.remove(config.key);
      if (run) console.log(chalk.green("Value removed successfully"));
      else console.log(chalk.red("Value not removed"));
      break;
    }

    case "has": {
      let run = db.has(config.key);
      console.log(run);
      break;
    }
  }
}
