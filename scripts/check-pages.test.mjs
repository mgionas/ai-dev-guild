/**
 * Tests for scripts/check-pages.mjs. Each one copies the small passing tree in fixtures/pages-good,
 * breaks one thing a page template can really lose, and expects the checker to name it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const here = import.meta.dirname;
const checker = join(here, "check-pages.mjs");
const good = join(here, "fixtures", "pages-good");
const TEMPLATE = "plugin/skills/demo/demo-page.md";
// The escape the templates teach, built from parts: an editing tool turns a typed one into `<`.
const ESCAPED_LT = String.fromCharCode(92) + "u003c";

function run(mutate) {
  const root = mkdtempSync(join(tmpdir(), "pages-check-"));
  try {
    cpSync(good, root, { recursive: true });
    if (mutate) mutate({
      write: (p, text) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text); },
      edit(p, from, to) {
        const text = readFileSync(join(root, p), "utf8");
        assert.ok(text.includes(from), `fixture ${p} no longer contains ${from}`);
        writeFileSync(join(root, p), text.replace(from, to));
      },
    });
    const result = spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
    return { status: result.status, out: result.stdout + result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function fails(mutate, pattern) {
  const { status, out } = run(mutate);
  assert.equal(status, 1, `expected the checker to fail, it said: ${out}`);
  assert.match(out, pattern);
}

test("the good tree passes", () => {
  const { status, out } = run();
  assert.equal(status, 0, out);
  assert.match(out, /passed/);
});

test("JSON: the data block in the page must parse", () => {
  fails(({ edit }) => edit(TEMPLATE, '{ "title": "", "items": [] }', '{ "title": "", items: [] }'), /demo-page\.md: the data block "page-data" is not valid JSON/);
});

test("JSON: the example data shown in the Markdown must parse", () => {
  fails(({ edit }) => edit(TEMPLATE, '"items": ["one", "two"] }', '"items": ["one", "two", ] }'), /demo-page\.md: the example JSON block .* is not valid JSON/);
});

test("scripts: an inline script with a syntax error is reported", () => {
  fails(({ edit }) => edit(TEMPLATE, "function render() {", "function render( {"), /demo-page\.md: inline script 1 does not parse/);
});

test("run: a script that throws on load is reported, as shipped and with the example", () => {
  fails(({ edit }) => edit(TEMPLATE, 'getElementById("more")', 'getElementById("nope")'), /demo-page\.md: .*the block as shipped.*TypeError/);
});

test("run: an error after the first await is reported", () => {
  fails(({ edit }) => edit(TEMPLATE, "await Promise.resolve(); render();", "await Promise.resolve(); null.boom;"), /demo-page\.md: .*TypeError/);
});

test("run: a click handler that throws is reported, so handlers are exercised", () => {
  fails(({ edit }) => edit(TEMPLATE, 'addEventListener("click", render)', 'addEventListener("click", () => { throw new Error("handler broke"); })'), /handler broke/);
});

test("run: the example data is really put in the page (a bug only filled data meets is found)", () => {
  fails(({ edit }) => edit(TEMPLATE, 'list.append(el("li", item))', 'list.append(el("li", item.nope.deeper))'), /demo-page\.md: .*the example JSON block.*TypeError/);
});

test("data: a template with no example and an empty block needs a fixture, and the fixture is run", () => {
  const withoutExample = ({ edit }) => edit(TEMPLATE, /```json[\s\S]*?```/.exec(readFileSync(join(good, TEMPLATE), "utf8"))[0], "");
  fails(withoutExample, /demo-page\.md: has no example data/);
  const { status, out } = run((api) => { withoutExample(api); api.write("scripts/fixtures/page-data/demo-page.json", '{ "title": "T", "items": ["a"] }'); });
  assert.equal(status, 0, out);
  fails((api) => { withoutExample(api); api.write("scripts/fixtures/page-data/demo-page.json", '{ "title": "T", "items": ["a"'); }, /page-data\/demo-page\.json is not valid JSON/);
});

test("escape text: a template that lost its instruction to write < as the escape is reported", () => {
  fails(({ edit }) => edit(TEMPLATE, "as `" + ESCAPED_LT + "`", "as `<`"), /demo-page\.md: .*no longer says to write every < as/);
});

test("a template file with no HTML code block is reported", () => {
  fails(({ write }) => write(TEMPLATE, "# Demo\n\nWrite `<` as `" + ESCAPED_LT + "`.\n"), /demo-page\.md: no html code block/);
});
