import SnowbaseAsync from "../src/SnowbaseAsync.js";
import assert from "assert";
import { existsSync, rmSync } from "fs";

rmSync("./snowbase", { recursive: true, force: true });
let tx = Date.now();
(async () => {
  let t1 = Date.now();
  const dbA = new SnowbaseAsync({
    logging: true,
    backup: true,
    encryption: true,
    secret: "pass123",
  });

  console.log("Tempo para criar: " + (Date.now() - t1));
  assert.strictEqual(
    existsSync(dbA.path),
    true,
    "O arquivo de banco não foi criado",
  );
  let t2 = Date.now();
  await dbA.set("cars", {
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
  });
  await dbA.save("patients", {
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
  });
  await dbA.set("user", {
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
  });
  await dbA.save("users", {
    pedro: { name: "Pedro" },
    laura: { name: "Laura" },
  });
  await dbA.save("animals", {
    dog: { name: "Duke" },
    cat: { name: "Princess" },
  });
  console.log("Tempo para salvar total: " + (Date.now() - t2));
  t2 = Date.now();

  //console.log(db.find("users", (x) => x.key.includes("r")));
  //console.log(db.find((x) => x.key.includes("x")));
  //console.log(db.all("users", (x) => x.key.includes("r")));
  //console.log(db.all("animals", (x) => x.value.name === "Princess"));

  let g = await dbA.get("user/name");
  console.log("Tempo para get1(async): " + (Date.now() - t2));
  console.log(g);
  assert.strictEqual(
    g,
    "Ada",
    "O valor salvo não foi recuperado corretamente1",
  );
  assert.strictEqual(
    await dbA.get("user/dad"),
    "carl",
    "O valor salvo não foi recuperado corretamente2",
  );
  //ALL
  t2 = Date.now();
  const allEntries = await dbA.all();
  console.log("Tempo para all1(async): " + (Date.now() - t2));
  assert.ok(
    allEntries.some((entry) => entry.key === "user"),
    "A entrada principal(async) não foi criada",
  );
  t2 = Date.now();
  const allEntries2 = await dbA.all("user", ({ key, value }) =>
    key.includes("son"),
  );
  console.log("Tempo para all2(async): " + (Date.now() - t2));
  assert.ok(allEntries2, "n deu visse");
  t2 = Date.now();
  await dbA.remove("user/name");
  console.log("Tempo para remove1(async): " + (Date.now() - t2));
  //REMOVE
  assert.strictEqual(
    await dbA.get("user/name"),
    undefined,
    "A remoção(async) não funcionou como esperado",
  );
  //HAS
  t2 = Date.now();
  let h = await dbA.has("patients/albert");
  console.log("HAS(async)", h);
  console.log("HAS2(async)", await dbA.has("patients/carl"));
  console.log("Tempo para has1(async): " + (Date.now() - t2));
  assert.strictEqual(
    h,
    true,
    "O método has(async) não funcionou como esperado",
  );
  //COUNT
  t2 = Date.now();
  let c = await dbA.count();
  console.log(
    "COUNT(async)",
    await dbA.count(({ key, value }) => key.includes("c")),
  );
  console.log("Tempo para count1: " + (Date.now() - t2));
  console.log("COUNT(async)", c);
  assert.strictEqual(
    c,
    5,
    "O método count(async) não retornou o número correto de entradas",
  );
  t2 = Date.now();
  let c2 = await dbA.count("user");
  console.log("Tempo para count2(async): " + (Date.now() - t2));
  assert.strictEqual(
    c2,
    4,
    "O método count(async) não retornou o número correto de entradas para o caminho especificado",
  );
  //FIND
  t2 = Date.now();
  let f = await dbA.find("user/son", ({ key, value }) => key.includes("L"));
  console.log("Tempo para find1(async): " + (Date.now() - t2));
  assert.strictEqual(
    f?.key,
    "Lukas",
    "O método find(async) não retornou o valor correto",
  );
  console.log("Async test passed, " + (Date.now() - t1) + "ms");
})();
console.log("TIME SPENT: " + (Date.now() - tx));
