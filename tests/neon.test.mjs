import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Exercise the real Neon driver's parameter binding and PostgreSQL decoding
// with an HTTP fixture, without needing credentials or sending messages.
const require = createRequire(import.meta.url);
const { neonConfig } = require("@neondatabase/serverless");
const calls = [];
let result;
neonConfig.fetchFunction = async (_url, options) => {
  calls.push(JSON.parse(options.body));
  return new Response(JSON.stringify(result), { status: 200 });
};
process.env.DATABASE_URL = "postgresql://demo:demo@example.neon.tech/neondb?sslmode=require";
const modules = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = name => name.startsWith(".")
    ? load(path.resolve(path.dirname(filename), name + ".ts")) : require(name);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { db, accountByToken, hashToken } = load("lib/db.ts");
const profiles = load("lib/profiles.ts");
const { approveSite } = load("lib/muse-browser.ts");

test("Neon binds SQLite-style placeholders and decodes millisecond timestamps", async () => {
  result = { fields: [{ name: "created_at", dataTypeID: 20 }], rows: [["1791112345678"]], rowCount: 1 };
  const account = await accountByToken("device-token");
  assert.equal(account.created_at, 1791112345678);
  assert.equal(calls.at(-1).query, "SELECT * FROM accounts WHERE device_token_hash = $1");
  assert.deepEqual(calls.at(-1).params, [hashToken("device-token")]);
});

test("empty lookups and affected row counts keep the existing contract", async () => {
  result = { fields: [], rows: [], rowCount: 0 };
  assert.equal(await accountByToken("unknown"), null);
  assert.deepEqual(await db().prepare("SELECT * FROM scores").all(), []);
  result = { fields: [], rows: [], rowCount: 3 };
  assert.deepEqual(await db().prepare("DELETE FROM sightings WHERE me = ? AND other = ?").run("a", "b"), { changes: 3 });
  assert.deepEqual(calls.at(-1).params, ["a", "b"]);
});

test("profiles and match results write to Neon with stable pair ordering", async () => {
  result = { fields: [], rows: [], rowCount: 1 };
  await profiles.saveTasteProfile("Demo", "demo_user", "An unchanged summary.");
  assert.match(calls.at(-1).query, /INSERT INTO taste_profile/);
  assert.deepEqual(calls.at(-1).params, ["Demo", "demo_user", "An unchanged summary."]);
  await profiles.saveMatch(9, 2, 0.8123456789, "Strong overlap");
  assert.deepEqual(calls.at(-1).params, ["2", "9", "0.8123456789", "Strong overlap"]);
});

test("Muse approval waits for an asynchronous database check", async () => {
  let checks = 0;
  const page = {
    getByText: () => ({ first: () => ({ isVisible: async () => false }) }),
    waitForTimeout: async () => {},
  };
  const clicked = await approveSite(page, "demo.example", async () => ++checks === 2, 1000);
  assert.equal(clicked, false);
  assert.equal(checks, 2);
});

test("schema setup has complete statements despite semicolons in comments", () => {
  const schema = readFileSync("database/schema.sql", "utf8");
  const statements = schema.replace(/--[^\r\n]*/g, "").split(";").filter(part => part.trim());
  assert.equal(statements.length, 12);
  assert.ok(statements.every(sql => /^\s*CREATE (TABLE|INDEX|EXTENSION)/.test(sql)));
  assert.match(schema, /embedding VECTOR\(384\)/);
  assert.match(schema, /score DOUBLE PRECISION/);
});
