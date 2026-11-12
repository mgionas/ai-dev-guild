import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck } from "./check.mjs";
import { project } from "./fixture.mjs";

const run = (changes) => runCheck({ config: project(changes) });
const refuses = async (changes, text) => {
  const { problems } = await run(changes);
  assert.ok(problems.some((p) => p.includes(text)), `expected a problem with "${text}", got:\n${problems.join("\n")}`);
};
const feature = (extra) => `features:\n  - id: list-books\n    area: catalog\n    name: List books\n    explanation: See the books.\n    status: built\n    operations: ['GET /books']\n    screens: ['/books']\n    tables: [book]\n    decisions: []\n${extra}`;

test("the base project passes", async () => {
  const { problems, summary } = await run({});
  assert.deepEqual(problems, []);
  assert.match(summary, /2 areas, 1 features, 3 operations, 2 screens, 2 tables/);
});

test("the worked example passes", async () => {
  const { problems } = await runCheck({ config: join(import.meta.dirname, "example/system-map.config.json") });
  assert.deepEqual(problems, []);
});

test("an operation no feature claims is refused", () =>
  refuses({ "openapi.json": JSON.stringify({ paths: { "/books": { get: {}, post: {} }, "/health": { get: {} }, "/loans": { post: {} } } }) }, "The operation POST /loans belongs to no feature"));
test("a screen no feature claims is refused", () => refuses({ "app/loans/page.tsx": "" }, "The screen /loans belongs to no feature"));
test("a table no feature claims is refused", () => refuses({ "migrations/0002.sql": "CREATE TABLE loan (id int);" }, "The table loan belongs to no feature"));

test("the baseline lists something that no longer exists", () =>
  refuses({ "docs/system-map/undescribed.yaml": "operations: ['POST /books', 'GET /health', 'GET /gone']\nscreens: ['/']\ntables: [audit_log]\n" }, "lists the operation GET /gone, which no longer exists"));
test("the baseline lists something a feature now claims", () =>
  refuses({ "docs/system-map/undescribed.yaml": "operations: ['POST /books', 'GET /health', 'GET /books']\nscreens: ['/']\ntables: [audit_log]\n" }, "lists the operation GET /books, which a feature now describes"));
test("a baseline name that is also an Object.prototype member is just a missing name", () =>
  refuses({ "docs/system-map/undescribed.yaml": "operations: ['POST /books', 'GET /health']\nscreens: ['/']\ntables: [audit_log, constructor]\n" }, "lists the table constructor, which no longer exists"));

test("a feature naming something that does not exist is refused", async () => {
  await refuses({ "docs/system-map/features/catalog.yaml": feature("").replace("'GET /books'", "'GET /books', 'DELETE /books'") }, 'names the operation DELETE /books, which does not exist');
  await refuses({ "docs/system-map/features/catalog.yaml": feature("").replace("['/books']", "['/books', '/nowhere']") }, "names the screen /nowhere");
  await refuses({ "docs/system-map/features/catalog.yaml": feature("").replace("[book]", "[book, ghost]") }, "names the table ghost");
});

test("a features file whose features belong to another area is refused", () =>
  refuses({ "docs/system-map/features/shelf.yaml": feature("").replace("operations: ['GET /books']", "operations: []").replace("screens: ['/books']", "screens: []").replace("tables: [book]", "tables: []").replace("id: list-books", "id: other") }, 'area is "catalog" but this file belongs to "shelf"'));

test("unknown keys are refused in every file", async () => {
  await refuses({ "docs/system-map/features/catalog.yaml": feature("    operatons: []\n") }, 'unknown key "operatons"');
  await refuses({ "docs/system-map/areas.yaml": BASE_AREAS.replace("buildsOn: []", "buildsOn: []\n    chapter: x") }, 'unknown key "chapter"');
  await refuses({ "docs/system-map/undescribed.yaml": "operations: []\nscreens: []\ntables: []\nextra: []\n" }, 'unknown key "extra"');
  await refuses({ "system-map.config.json": JSON.stringify({ operations: { reader: "openapi", file: "openapi.json", extra: 1 } }) }, 'unknown key "extra"');
});
const BASE_AREAS = "areas:\n  - id: catalog\n    name: Catalog\n    explanation: The books.\n    buildsOn: []\n  - id: shelf\n    name: Shelf\n    explanation: Where they sit.\n    buildsOn: [catalog]\n";

test("a missing key is refused", () =>
  refuses({ "docs/system-map/features/catalog.yaml": feature("").replace("    decisions: []\n", "") }, 'missing key "decisions"'));

test("a bad status, a repeated id and a bad area reference are refused", async () => {
  await refuses({ "docs/system-map/features/catalog.yaml": feature("").replace("built", "done") }, "status must be one of");
  await refuses({ "docs/system-map/features/catalog.yaml": feature("") + feature("").replace("features:\n", "") }, 'the feature id "list-books" is already used');
  await refuses({ "docs/system-map/areas.yaml": BASE_AREAS.replace("[catalog]", "[nowhere]") }, 'builds on "nowhere", which is not an area');
});

test("the folder rules: a stray file and an area with no file are refused", async () => {
  await refuses({ "docs/system-map/features/notes.yaml": "features: []\n" }, "not named after an area");
  await refuses({ "docs/system-map/features/shelf.yaml": null }, "features/shelf.yaml: file not found");
});

test("a YAML syntax error names its file", () =>
  refuses({ "docs/system-map/features/catalog.yaml": "features: [\n" }, "docs/system-map/features/catalog.yaml:"));

test("a reader that cannot read stops the check and names the file", async () => {
  const { problems } = await run({ "openapi.json": null });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /operations: openapi\.json: cannot read/);
});

test("--out writes the five documents, the same bytes every time", async () => {
  const config = project({});
  const a = mkdtempSync(join(tmpdir(), "out-a-"));
  const b = mkdtempSync(join(tmpdir(), "out-b-"));
  assert.deepEqual((await runCheck({ config, out: a })).problems, []);
  assert.deepEqual((await runCheck({ config, out: b })).problems, []);
  const names = readdirSync(a).sort();
  assert.deepEqual(names, ["areas.json", "features.json", "meta.json", "system.json", "unclaimed.json"]);
  for (const n of names) assert.equal(readFileSync(join(a, n), "utf8"), readFileSync(join(b, n), "utf8"));
  const read = (n) => JSON.parse(readFileSync(join(a, n), "utf8"));
  assert.deepEqual(read("meta.json").counts, { areas: 2, features: 1, built: 1, operations: 3, screens: 2, tables: 2 });
  assert.deepEqual(read("system.json").operations.map((o) => o.id), ["GET /books", "GET /health", "POST /books"]);
  assert.equal(read("system.json").operations[0].tag, "books");
  assert.deepEqual(read("system.json").packages, []);
  assert.deepEqual(read("unclaimed.json"), { operations: ["GET /health", "POST /books"], screens: ["/"], tables: ["audit_log"] });
  assert.deepEqual(read("areas.json").items.map((i) => i.progress), ["all", "none"]);
});

test("--out writes nothing when the check fails", async () => {
  const out = join(mkdtempSync(join(tmpdir(), "out-c-")), "docs");
  await runCheck({ config: project({ "app/loans/page.tsx": "" }), out });
  assert.throws(() => readdirSync(out));
});

test("the command line exits 1 with the message, 0 when true, 2 on a wrong flag", () => {
  const cli = (args) => spawnSync(process.execPath, [join(import.meta.dirname, "check.mjs"), ...args], { encoding: "utf8" });
  const good = cli(["--config", project({})]);
  assert.equal(good.status, 0);
  assert.match(good.stdout, /system map: ok/);
  const bad = cli(["--config", project({ "app/loans/page.tsx": "" })]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /belongs to no feature/);
  assert.equal(cli(["--nope", "x"]).status, 2);
});
