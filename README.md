<div align="center">
<h1>Snowbase ❄️</h1>
<br>
<img src="./img/snowbase-logo.png" alt="Snowbase logo" width="200" height="200" style="border-radius:35%;border: 4px solid #e7e9ebff;"/>
<p>A lightweight file-based database for Node.js</p>
<a href="https://www.npmjs.com/package/snowbase">
    <img src="https://img.shields.io/npm/v/snowbase?color=blue" alt="Current version"/>
    </a>
    <a href="https://www.npmjs.com/package/snowbase">
    <img
    src="https://packagephobia.com/badge?p=snowbase@6.0.0"
    alt="install size">
    </a>
<a href="https://www.npmjs.com/package/snowbase">
    <img src="https://img.shields.io/npm/dt/snowbase?color=darkcyan" alt="npm downloads"/>
</a>
<img src="https://img.shields.io/npm/l/snowbase" alt="license"/>
<br>
<b>Simple.</b> <b>Fast.</b> <b>Persistent.</b>
</div>

---

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Events](#events)
- [Async API](#async-api)
- [CLI](#cli)
- [License](#license)

## Overview

Snowbase is a simple, fast, and persistent file-based database for Node.js.  
It creates and manages a local JSON file to store your data safely, making it perfect for lightweight applications, prototypes, scripts, and small tools.

No servers. No complex setup. Just storage.

## ✨ Features

- ⚡ Lightweight and easy to use
- 📦 File-based persistence with no external database required
- 🔐 Optional encryption for stored data
- 🧾 Optional logging for operations
- 💾 Automatic backups with versioned files
- ⚙️ Supports both sync and async APIs
- 🧩 Works well for prototypes, local apps, and small projects

## 📥 Installation

```bash
npm install snowbase
```

## Usage

### CommonJS

```js
const Snowbase = require("snowbase");

const db = new Snowbase();

db.on("ready", () => {
  console.log("Database is ready");
});
```

### ES Modules

```js
import Snowbase from "snowbase";

const db = new Snowbase();

db.on("ready", () => {
  console.log("Database is ready");
});

//Multiples database
const db1 = new Snowbase({ baseDir: "storage" });
const db2 = new Snowbase({ baseDir: "database" }); // creates an isolated new Snowbase storage
// You need to specify the baseDir if use the CLI
```

### Basic operations

```js
// Set a value
db.set("user/name", "Pedro");

// Get a value
console.log(db.get("user/name")); // Pedro

// Remove a value
db.remove("user/name");

// Clear the whole database
db.clear();
```

## Configuration

You can configure Snowbase during initialization:

```js
const db = new Snowbase({
  baseDir: "./my-database",
  encryption: true,
  secret: "my-secret",
  logging: true,
  backup: true,
});
```

### Options

- baseDir: directory where the database file will be stored
- encryption: enables encrypted persistence
- secret: secret key used when encryption is enabled
- logging: enables operation logging
- backup: enables automatic backups

## Advanced examples

### Set and save nested data

```js
db.set("patients", {
  john: {
    age: 20,
    name: "John",
    city: "New York",
  },
  albert: {
    age: 31,
    name: "Albert",
    city: "Chicago",
  },
});
```

### Read and query data

```js
console.log(db.get("patients/john/city")); // New York
console.log(db.has("patients/albert")); // true
console.log(db.count("patients")); // 2
```

### Find and remove

```js
const result = db.find("patients", ({ key }) => key.includes("a"));
console.log(result);

db.remove("patients/albert"); // true
db.remove("patients/susy"); // false
```

## Events

Snowbase can emit events for lifecycle and database operations. You can listen to them with the standard EventEmitter API.

```js
const db = new Snowbase();

db.on("ready", () => {
  console.log("Database is ready");
});

db.on("error", (err) => {
  console.error(err.message);
});

db.on("get", (details, timestamp) => {
  console.log("Get event", details, timestamp);
});
```

### Available events

- ready: emitted when the database instance is initialized
- error: emitted when an error occurs; receives an Error object
- get: emitted after a read operation; payload includes the path and the resolved value
- set: emitted after a write operation; payload includes the path, key, and value
- remove: emitted after a remove operation; payload includes the path, removed value, and whether it was removed
- clear: emitted after clearing the database; payload includes the previous data
- \_write: emitted after data is written to disk
- create backup: emitted when a backup file is created

## Async API

For non-blocking operations, use the async version:

```js
import Snowbase from "snowbase/async";

const db = new Snowbase({
  encryption: true,
  secret: "my-secret",
  backup: true,
});

await db.set("user/name", "Pedro");
console.log(await db.get("user/name"));
```

## CLI

Snowbase also includes a CLI for common tasks:

```bash
snowbase init
snowbase inspect
snowbase backup
snowbase restore
snowbase get user/name
snowbase set user/name Pedro
snowbase remove user/name
snowbase clear
snowbase has
```

## License

MIT @ Pedro Henrique Brandão (p3droob)
