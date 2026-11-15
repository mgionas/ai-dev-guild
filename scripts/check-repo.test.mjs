/**
 * Tests for scripts/check-repo.mjs. Each one copies the small passing tree in
 * fixtures/repo-good, breaks one thing the way drift really happens, and expects the checker to
 * name it. A check that is removed makes its test fail, because the broken tree then passes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const here = import.meta.dirname;
const checker = join(here, "check-repo.mjs");
const good = join(here, "fixtures", "repo-good");

/** Copies the good tree, lets `mutate` break it, runs the checker and returns what it said. */
function run(mutate) {
  const root = mkdtempSync(join(tmpdir(), "repo-check-"));
  try {
    cpSync(good, root, { recursive: true });
    if (mutate) mutate({
      read: (p) => readFileSync(join(root, p), "utf8"),
      write: (p, text) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text); },
      remove: (p) => rmSync(join(root, p), { recursive: true, force: true }),
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

const agent = (name, model) => `---\nname: ${name}\ndescription: "An agent."\nmodel: ${model}\n---\n\nText.\n`;
const skill = (name) => `---\nname: ${name}\ndescription: "A skill."\n---\n\nText.\n`;

test("the good tree passes", () => {
  const { status, out } = run();
  assert.equal(status, 0, out);
});

test("counts: the roles badge, its alt text and the bold count must equal the agent files", () => {
  fails(({ edit }) => edit("README.md", "badge/roles-2", "badge/roles-3"), /README\.md: roles badge says 3, found 2 agent files/);
  fails(({ edit }) => edit("README.md", 'alt="2 roles"', 'alt="3 roles"'), /README\.md: roles badge text says 3, found 2/);
  fails(({ edit }) => edit("README.md", "- **2 roles**", "- **3 roles**"), /README\.md: "3 roles" but found 2 agent files/);
});

test("counts: the skills badge and the bold counts in both READMEs must equal the skill folders", () => {
  fails(({ edit }) => edit("README.md", "badge/skills-2", "badge/skills-3"), /README\.md: skills badge says 3, found 2 skill folders/);
  fails(({ edit }) => edit("plugin/README.md", "**2 skills**", "**3 skills**"), /plugin\/README\.md: "3 skills" but found 2 skill folders/);
  fails(({ edit }) => edit("plugin/README.md", "**2 roles**", "**3 roles**"), /plugin\/README\.md: "3 roles" but found 2 agent files/);
});

test("lists: a skill folder missing from the skills table, the name lists and plugin/README.md is named in each", () => {
  const { out } = run(({ write }) => write("plugin/skills/three/SKILL.md", skill("three")));
  assert.match(out, /README\.md: skill "three" is not in the skills table/);
  assert.match(out, /README\.md: skill "three" is not in the skills name list/);
  assert.match(out, /plugin\/README\.md: skill "three" is not in the skills list/);
});

test("lists: a name that is no skill is refused in every list", () => {
  fails(({ edit }) => edit("plugin/README.md", "`one`, `two`", "`one`, `two`, `ghost`"), /plugin\/README\.md: the skills list names "ghost", which is no skill folder/);
  fails(({ edit }) => edit("README.md", "`one` · `two`", "`one` · `two` · `ghost`"), /README\.md: the skills name list names "ghost"/);
  fails(({ edit }) => edit("README.md", "| [`two`](plugin/skills/two/SKILL.md) | do two |", "| [`two`](plugin/skills/two/SKILL.md) | do two |\n| [`ghost`](plugin/skills/ghost/SKILL.md) | do none |"), /README\.md: the skills table names "ghost"/);
});

test("lists: an agent missing from docs/roles/README.md, or named there without a file, is reported", () => {
  fails(({ write }) => { write("plugin/agents/gamma.md", agent("gamma", "sonnet")); write("docs/roles/gamma.md", "# Gamma\n"); }, /docs\/roles\/README\.md: agent "gamma" is not listed/);
  fails(({ edit, write }) => { write("docs/roles/delta.md", "# Delta\n"); edit("docs/roles/README.md", "| [beta](beta.md) | Reviews | opus |", "| [beta](beta.md) | Reviews | opus |\n| [delta](delta.md) | Nothing | opus |"); }, /docs\/roles\/README\.md: lists "delta", which is no agent file/);
});

test("names: a frontmatter name must equal the file name or the folder", () => {
  fails(({ edit }) => edit("plugin/agents/alpha.md", "name: alpha", "name: omega"), /plugin\/agents\/alpha\.md: name is "omega", the file is alpha\.md/);
  fails(({ edit }) => edit("plugin/skills/one/SKILL.md", "name: one", "name: uno"), /plugin\/skills\/one\/SKILL\.md: name is "uno", the folder is one/);
});

test("role parity: every agent has a role document and the reverse", () => {
  fails(({ remove, edit }) => { remove("docs/roles/beta.md"); edit("docs/roles/README.md", "[beta](beta.md)", "beta"); }, /plugin\/agents\/beta\.md: has no docs\/roles\/beta\.md/);
  fails(({ write }) => write("docs/roles/stray.md", "# Stray\n"), /docs\/roles\/stray\.md: has no plugin\/agents\/stray\.md/);
});

test("role parity: the model in the frontmatter is the one docs/roles/README.md gives", () => {
  fails(({ edit }) => edit("plugin/agents/beta.md", "model: opus", "model: sonnet"), /plugin\/agents\/beta\.md: model is "sonnet", docs\/roles\/README\.md says "opus"/);
});

test("anchors: a link with #anchor needs a heading with that GitHub anchor in the target", () => {
  fails(({ edit }) => edit("README.md", "(#-skills)", "(#nowhere)"), /README\.md: broken anchor #nowhere in \(this file\)/);
  fails(({ edit }) => edit("README.md", "README.md#build", "README.md#biuld"), /README\.md: broken anchor #biuld in docs\/roles\/README\.md/);
  // The emoji heading's real anchor starts with a hyphen; the text without it must not pass.
  fails(({ edit }) => edit("README.md", "(#-skills)", "(#skills)"), /broken anchor #skills/);
});

test("anchors: a repeated heading gets -1, -2 like GitHub", () => {
  const { status, out } = run(({ edit }) => {
    edit("README.md", "## Living pages", "## Living pages\n\n## Living pages\n\nSee [again](#living-pages-1).");
  });
  assert.equal(status, 0, out);
  fails(({ edit }) => {
    edit("README.md", "## Living pages", "## Living pages\n\n## Living pages\n\nSee [again](#living-pages-2).");
  }, /broken anchor #living-pages-2/);
});

test("references: a file named 'in this skill's folder' or 'in the x skill's folder' must exist", () => {
  fails(({ remove }) => remove("plugin/skills/one/notes.md"), /plugin\/skills\/one\/SKILL\.md: "notes\.md" is not in the one skill's folder/);
  fails(({ remove }) => remove("plugin/skills/two/helper.md"), /plugin\/skills\/one\/SKILL\.md: "helper\.md" is not in the two skill's folder/);
  // A reference split over two lines is still a reference.
  fails(({ remove }) => remove("plugin/skills/two/helper.md"), /plugin\/skills\/two\/SKILL\.md: "helper\.md" is not in the two skill's folder/);
  fails(({ edit }) => edit("plugin/skills/one/SKILL.md", "`two` skill's", "`missing` skill's"), /"helper\.md" is not in the missing skill's folder/);
});
