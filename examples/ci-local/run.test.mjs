// Runs the real script, steps and all, with stub `npx` and `npm` commands, to prove the optional
// parts are wired into the run: the flake retry and the file-change probe.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "ci-local.mjs");

/** A repository whose base commit holds a test file and whose branch changes only a document. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "ci-local-repo-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.test");
  git("config", "user.name", "t");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.test.ts"), "x\n");
  git("add", ".");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "work");
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "docs/a.md"), "x\n");
  git("add", ".");
  git("commit", "-qm", "change");
  return dir;
}

/** Stub tools: the formatter writes a file, the first test run fails on one file, the retry passes. */
function stubs() {
  const bin = mkdtempSync(join(tmpdir(), "ci-local-bin-"));
  const tool = (name, body) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  tool(
    "npx",
    `case "$*" in
  *prettier*) echo generated > generated.txt;;
  *"turbo run test"*) echo " FAIL  src/a.test.ts > one"; echo " Test Files  1 failed | 2 passed (3)"; exit 1;;
esac`,
  );
  tool("npm", "exit 0");
  return bin;
}

function run(extra) {
  const bin = stubs();
  const out = mkdtempSync(join(tmpdir(), "ci-local-out-"));
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  const result = spawnSync("node", [script, "--full", "--out", out, ...extra], {
    cwd: repo(),
    env,
    encoding: "utf8",
  });
  return { code: result.status, text: result.stdout + result.stderr };
}

test("without the optional flags, a failing test file fails the run", () => {
  const { code, text } = run([]);
  assert.equal(code, 1);
  assert.match(text, /test: ran full — exit 1/);
  assert.match(text, /overall: FAIL \(full run\)/);
  assert.doesNotMatch(text, /PASS-on-retry/);
});

test("--retry clears a flaky file the branch did not touch and lists it", () => {
  const { code, text } = run(["--retry"]);
  assert.equal(code, 0);
  assert.match(text, /test: retry — retry passed/);
  assert.match(text, /test: ran full — PASS-on-retry/);
  assert.match(text, /flakes: src\/a\.test\.ts/);
  assert.match(text, /overall: PASS-on-retry \(full run\)/);
});

test("--probe fails the step that wrote a file and names it", () => {
  const { code, text } = run(["--retry", "--probe"]);
  assert.equal(code, 1);
  assert.match(text, /format: probe: the step changed the working tree: generated\.txt/);
  assert.match(text, /overall: FAIL/);
});
