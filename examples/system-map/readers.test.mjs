import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import readOpenApi from "./readers/openapi.mjs";
import readRoutes from "./readers/routes.mjs";
import readSql from "./readers/sql.mjs";
import { runCheck } from "./check.mjs";
import { project } from "./fixture.mjs";

function folder(files) {
  const dir = mkdtempSync(join(tmpdir(), "reader-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}
const ids = (list) => list.map((x) => x.id);

// OpenAPI
test("openapi: reads METHOD /path for each method and ignores path-level keys", async () => {
  const dir = folder({ "api.json": JSON.stringify({ paths: { "/a": { parameters: [], get: {}, delete: {} }, "/b/{id}": { patch: { tags: ["b"] } } } }) });
  const found = await readOpenApi(dir, { file: "api.json" });
  assert.deepEqual(ids(found), ["GET /a", "DELETE /a", "PATCH /b/{id}"]);
  assert.equal(found[2].tag, "b");
});
test("openapi: a missing file, bad JSON and a document with no paths each refuse with the file name", async () => {
  const dir = folder({ "bad.json": "{", "none.json": "{}" });
  await assert.rejects(readOpenApi(dir, { file: "missing.json" }), /missing\.json: cannot read/);
  await assert.rejects(readOpenApi(dir, { file: "bad.json" }), /bad\.json: cannot read/);
  await assert.rejects(readOpenApi(dir, { file: "none.json" }), /none\.json: no "paths"/);
});
test("openapi: a path called __proto__ or constructor is data, not a lookup", async () => {
  const dir = folder({ "api.json": '{"paths":{"__proto__":{"get":{}},"constructor":{"post":{}}}}' });
  assert.deepEqual(ids(await readOpenApi(dir, { file: "api.json" })).sort(), ["GET __proto__", "POST constructor"]);
});

// Routes
test("routes: the folder of each matching file is the screen, the top folder is /", async () => {
  const dir = folder({ "app/page.tsx": "", "app/a/b/page.tsx": "", "app/a/layout.tsx": "", "app/node_modules/x/page.tsx": "" });
  const found = await readRoutes(dir, { root: "app", pattern: "^page\\.tsx$" });
  assert.deepEqual(ids(found).sort(), ["/", "/a/b"]);
  assert.equal(found[0].site, "app");
});
test("routes: a missing folder, a bad pattern and no match each refuse", async () => {
  const dir = folder({ "app/readme.md": "" });
  await assert.rejects(readRoutes(dir, { root: "nope", pattern: "x" }), /nope: cannot read the route folder/);
  await assert.rejects(readRoutes(dir, { root: "app", pattern: "(" }), /app: the file name pattern .* is not a regular expression/);
  await assert.rejects(readRoutes(dir, { root: "app", pattern: "^page$" }), /app: no file matches/);
});

// SQL
const sql = (text) => readSql(folder({ "m/0001.sql": text }), { dir: "m" });
test("sql: create, rename (keeping the schema) and drop are replayed in file order", async () => {
  const dir = folder({
    "m/0001.sql": "CREATE TABLE IF NOT EXISTS a (id int); CREATE TABLE public.b (id int); CREATE TABLE c (id int);",
    "m/0002.sql": 'ALTER TABLE a RENAME TO a2; ALTER TABLE public.b RENAME TO b2; DROP TABLE IF EXISTS c, nothing;',
  });
  assert.deepEqual(ids(await readSql(dir, { dir: "m" })), ["a2", "public.b2"]);
});
test("sql: quotes and case are ignored in names; temp tables are not tables", async () => {
  assert.deepEqual(ids(await sql('CREATE TABLE "Invoice" (id int); CREATE TEMP TABLE t (id int);')), ["invoice"]);
});
test("sql: comments, strings and $$ blocks cannot hide or fake a statement", async () => {
  const text = `-- CREATE TABLE ghost (id int);
/* DROP TABLE real; */
CREATE TABLE real (note text DEFAULT 'DROP TABLE real; -- not a comment');
CREATE FUNCTION f() RETURNS void AS $body$ BEGIN CREATE TABLE inner_t (id int); END $body$ LANGUAGE plpgsql;`;
  assert.deepEqual(ids(await sql(text)), ["real"]);
});
test("sql: harmless TABLE statements and a column called table are accepted", async () => {
  const text = `CREATE TABLE t (id int, "table" text);
ALTER TABLE t ADD COLUMN x int;
ALTER TABLE t RENAME COLUMN x TO y;
COMMENT ON TABLE t IS 'x';
GRANT SELECT ON TABLE t TO reader;
CREATE INDEX i ON t ("table");`;
  assert.deepEqual(ids(await sql(text)), ["t"]);
});
test("sql: a statement it does not understand that mentions TABLE refuses with the file name", async () => {
  await assert.rejects(sql("CREATE FOREIGN TABLE f (id int) SERVER s;"), /m\/0001\.sql: a statement that mentions TABLE is not understood/);
  await assert.rejects(sql("CREATE TABLE t (id int); ALTER TABLE t SET SCHEMA other;"), /m\/0001\.sql: .*not understood/);
});
test("sql: a rename or drop of a table nothing created refuses", async () => {
  await assert.rejects(sql("ALTER TABLE ghost RENAME TO g2;"), /m\/0001\.sql: renames the table ghost/);
  await assert.rejects(sql("DROP TABLE ghost;"), /m\/0001\.sql: drops the table ghost/);
});
test("sql: an unfinished string, comment or $$ block refuses", async () => {
  await assert.rejects(sql("CREATE TABLE t (a text DEFAULT 'x);"), /m\/0001\.sql: a string is never closed/);
  await assert.rejects(sql("/* oops"), /comment is never closed/);
  await assert.rejects(sql("SELECT $a$ x"), /block is never closed/);
});
test("sql: a missing folder and a folder with no .sql file refuse", async () => {
  const dir = folder({ "m/readme.md": "" });
  await assert.rejects(readSql(dir, { dir: "nope" }), /nope: cannot read the migrations folder/);
  await assert.rejects(readSql(dir, { dir: "m" }), /m: no \.sql file/);
});

// The project's own reader
const own = (reader) => project({
  "system-map.config.json": JSON.stringify({ operations: { reader: "./own.mjs", file: "x" }, screens: { reader: "routes", root: "app", pattern: "^page\\.tsx$" }, tables: { reader: "sql", dir: "migrations" } }),
  "own.mjs": reader,
});
test("a project's own reader returns { id } and is handed its options", async () => {
  const { problems, summary } = await runCheck({ config: own('export default async (root, options) => [{ id: "GET /books" }, { id: "POST /books" }, { id: "GET /health" }, { id: options.file }];') });
  assert.match(problems.join("\n"), /The operation x belongs to no feature/);
  assert.equal(summary, undefined);
});
test("a project's own reader that returns the wrong shape, or throws, or is missing, refuses", async () => {
  assert.match((await runCheck({ config: own('export default async () => ["GET /books"];') })).problems[0], /must return a list of \{ id/);
  assert.match((await runCheck({ config: own('export default async () => { throw new Error("no schema file"); };') })).problems[0], /operations: no schema file/);
  assert.match((await runCheck({ config: own('export default async () => [{ id: "a" }, { id: "a" }];') })).problems[0], /the same id twice/);
  assert.match((await runCheck({ config: own("export const x = 1;") })).problems[0], /must export a default function/);
  assert.match((await runCheck({ config: project({ "system-map.config.json": JSON.stringify({ operations: { reader: "./gone.mjs" } }) }) })).problems[0], /operations: /);
});
