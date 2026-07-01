// @ts-check
import assert from "assert";
import { existsSync, rmSync } from "fs";
import Snowbase from "../src/Snowbase.js";

rmSync("./snowbase", { recursive: true, force: true });
let t1 = Date.now();
const db = new Snowbase({
  logging: true,
  backup: true,
});
console.log("Tempo para criar o banco: " + (Date.now() - t1));
console.log(
  `Backup directory: ${db.backup} - ${db.backupDir}\nLogging directory: ${db.logging} - ${db.logsDir}\nLogs path: ${db.logsPath}\nDatabase path: ${db.path}`,
);

assert.strictEqual(
  existsSync(db.path),
  true,
  "O arquivo de banco não foi criado",
);
let t2 = Date.now();
let t3 = Date.now();

db.set("user", {
  age: 30,
  dad: "carl",
  name: "Ada",
  son: {
    John: {
      age: 10,
    },
    Albert: {
      age: 8,
    },
    Lukas: {
      age: 5,
    },
  },
  sons: ["John", "Albert", "Lukas"],
}); //ok
console.log("Tempo para set1: " + (Date.now() - t2));
t2 = Date.now();
db.save("patients", {
  jonh: {
    age: 20,
    name: "John",
    city: "New York",
  },
  albert: {
    age: 31,
    name: "Albert",
    city: "Chicago",
  },
  laura: {
    age: 25,
    name: "Laura",
    city: "Atlanta",
  },
}); //ok
console.log("Tempo para save1: " + (Date.now() - t2));
t2 = Date.now();
db.save("cars", {
  mustang: {
    model: "Mustang",
    year: 1969,
    color: "Red",
  },
  bmw: {
    model: "BMW",
    year: 2020,
    color: "Black",
  },
}); //ok
db.save("users", { pedro: { name: "Pedro" }, laura: { name: "Laura" } });
db.save("animals", { dog: { name: "Duke" }, cat: { name: "Princess" } });

//console.log(db.find("users", (x) => x.key.includes("r")));
//console.log(db.find((x) => x.key.includes("x")));
//console.log(db.all("users", (x) => x.key.includes("r")));
//console.log(db.all("animals", (x) => x.value.name === "Princess"));
console.log("Tempo para save2: " + (Date.now() - t2));
console.log("Tempo para salvar tudo: " + (Date.now() - t3));
//SET
t2 = Date.now();
let g = db.get("user/name");
console.log("Tempo para get1: " + (Date.now() - t2));
//console.log(g);
assert.strictEqual(g, "Ada", "O valor salvo não foi recuperado corretamente");
//console.log(db.get());
//SAVE
assert.strictEqual(
  db.get("user/dad"),
  "carl",
  "O valor salvo não foi recuperado corretamente",
);

//ALL
t2 = Date.now();
const allEntries = db.all();
console.log("Tempo para all1: " + (Date.now() - t2));
assert.ok(
  allEntries.some((entry) => entry.key === "user"),
  "A entrada principal não foi criada",
);
t2 = Date.now();
const allEntries2 = db.all("user", ({ key, value }) => key.includes("son"));
console.log("Tempo para all2: " + (Date.now() - t2));
assert.ok(allEntries2, "n deu visse");
/*console.log(
  "ALL",
  db.all("patients", (a) => a.key.includes("a")),
);
console.log(
  "ALL2",
  db.all((a) => a.key.includes("r")),
);*/
t2 = Date.now();
db.remove("user/name");
console.log("Tempo para remove1: " + (Date.now() - t2));
//REMOVE
assert.strictEqual(
  db.get("user/name"),
  undefined,
  "A remoção não funcionou como esperado",
);

//HAS
t2 = Date.now();
let h = db.has("patients/albert");
console.log("HAS", h);
//console.log("HAS2", db.has("patients/carl"));
console.log("Tempo para has1: " + (Date.now() - t2));
assert.strictEqual(h, true, "O método has não funcionou como esperado");

//COUNT
t2 = Date.now();
let c = db.count();
console.log(
  "COUNT",
  db.count(({ key, value }) => key.includes("c")),
);
console.log("Tempo para count1: " + (Date.now() - t2));
assert.strictEqual(
  c,
  5,
  "O método count não retornou o número correto de entradas",
);
t2 = Date.now();
let c2 = db.count("user");
console.log("Tempo para count2: " + (Date.now() - t2));
assert.strictEqual(
  c2,
  4,
  "O método count não retornou o número correto de entradas para o caminho especificado",
);

//FIND
t2 = Date.now();
/*console.log(
  "FIND",
  db.find(({ key, value }) => key.includes("a")),
);*/
let f = db.find("user/son", ({ key, value }) => key.includes("L"));
console.log("Tempo para find1: " + (Date.now() - t2));
assert.strictEqual(
  f?.key,
  "Lukas",
  "O método find não retornou o valor correto",
);

console.log("Smoke test passed (sync), " + (Date.now() - t1) + "ms");
/*import { stableStringify, normalize } from "../src/helpers/utils.js";
let obj = { b: "a", a: 1 };
console.log(typeof stableStringify(obj));
console.log(normalize(obj));
*/
