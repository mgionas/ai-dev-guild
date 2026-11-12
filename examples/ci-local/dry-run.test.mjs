// Runs the real script with --dry-run inside throwaway git repositories, so scope, skips and the
// verdict line are tested as a person sees them. A stub `npx` stands in for the build tool.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "ci-local.mjs");

/** A repository with one commit on `main` and a branch `work` that adds the given files. */
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "ci-local-repo-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.test");
  git("config", "user.name", "t");
  writeFileSync(join(dir, "README.md"), "x\n");
  git("add", ".");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "work");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  git("add", ".");
  git("commit", "-qm", "change");
  return dir;
}

/** Puts a stub `npx` first on PATH that prints the given package lists for the selected and full queries. */
function stubTool(selected, all) {
  const bin = mkdtempSync(join(tmpdir(), "ci-local-bin-"));
  const body = `#!/bin/sh
case "$*" in *--filter*) echo '{"packages":${JSON.stringify(selected)}}';; *) echo '{"packages":${JSON.stringify(all)}}';; esac
`;
  writeFileSync(join(bin, "npx"), body);
  chmodSync(join(bin, "npx"), 0o755);
  return bin;
}

function dryRun(cwd, extra = [], bin = null) {
  const out = mkdtempSync(join(tmpdir(), "ci-local-out-"));
  const env = { ...process.env, PATH: `${bin ? `${bin}:` : ""}${process.env.PATH}` };
  const result = spawnSync("node", [script, "--dry-run", "--out", out, ...extra], { cwd, env, encoding: "utf8" });
  return { code: result.status, text: result.stdout + result.stderr };
}

test("a change only to documents skips every package step and says so", () => {
  const { code, text } = dryRun(repo({ "docs/a.md": "x\n" }));
  assert.equal(code, 0);
  assert.match(text, /mode: affected since \w+ \(1 changed files, no package reached\)/);
  assert.match(text, /lint: skipped \(every changed file is inert/);
  assert.match(text, /format: would run full/);
  assert.match(text, /e2e: skipped/);
  assert.match(text, /dry run \(affected since \w+: no package reached, \d skipped\), nothing ran/);
});

test("an unknown file runs everything, naming the file", () => {
  const { text } = dryRun(repo({ "tools/x.js": "x\n" }));
  assert.match(text, /mode: full \(tools\/x\.js is outside the packages and not known to be inert\)/);
  assert.match(text, /lint: would run full/);
  assert.match(text, /nothing ran/);
  assert.match(text, /dry run \(full run\)/);
});

test("a package change runs the narrowed commands and names the build tool's reach", () => {
  const bin = stubTool(["//", "@a/one"], ["//", "@a/one", "@a/two"]);
  const { text } = dryRun(repo({ "packages/one/src/x.ts": "x\n" }), [], bin);
  assert.match(text, /\(1 changed files, 1 of 2 packages\)/);
  assert.match(text, /lint: would run affected since \w+ — npx turbo run lint --concurrency=2 --filter=\.\.\.\[\w+\]/);
  assert.match(text, /e2e: skipped \(no changed file matches/);
  assert.match(text, /affected since \w+: 1 of 2 packages, 1 skipped/);
});

test("an empty selection from the build tool becomes the full run, never a pass", () => {
  const bin = stubTool(["//"], ["//", "@a/one"]);
  const { text } = dryRun(repo({ "packages/one/src/x.ts": "x\n" }), [], bin);
  assert.match(text, /mode: full \(package files changed but the build tool selected no package\)/);
});

test("a selection nobody can read becomes the full run", () => {
  const { text } = dryRun(repo({ "packages/one/src/x.ts": "x\n" }), [], stubTool([], []));
  assert.match(text, /mode: full/);
});

test("--full and a missing base both give the full run, with the reason", () => {
  const dir = repo({ "docs/a.md": "x\n" });
  assert.match(dryRun(dir, ["--full"]).text, /mode: full \(--full\)/);
  assert.match(dryRun(dir, ["--base", "no-such-ref"]).text, /mode: full \(no merge base with no-such-ref\)/);
});

test("the run states the smallest runner's limits", () => {
  assert.match(dryRun(repo({ "docs/a.md": "x\n" })).text, /limits: 2 cores, heap 2048 MB, TZ UTC/);
});

test("an unknown option exits 2 and runs nothing", () => {
  const result = spawnSync("node", [script, "--skip-lint"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});
