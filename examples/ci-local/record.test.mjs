// `--record <file>` appends one line per run, in the format flow-stats reads. The lines must be
// exact: flow-stats counts them, so a wrong `flaky` would move a measure without anyone noticing.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseArgs, recordLine } from "./ci-local.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "ci-local.mjs");

test("parseArgs: --record takes a file and refuses to run without one", () => {
  assert.equal(parseArgs(["--record", "/x/ci-runs.jsonl"]).record, "/x/ci-runs.jsonl");
  assert.match(parseArgs(["--record"]).problem, /--record needs a value/);
  assert.equal(parseArgs([]).record, undefined);
});

test("recordLine: a pass, a real failure and a pass-on-retry, dated in UTC", () => {
  const late = new Date("2026-03-04T23:59:59Z");
  assert.equal(recordLine({ failed: false, flakes: [] }, late), '{"date":"2026-03-04","result":"pass","flaky":false}');
  assert.equal(recordLine({ failed: true, flakes: [] }, late), '{"date":"2026-03-04","result":"fail","flaky":false}');
  // Failures cleared on retry: the run passes, and it is the flaky kind.
  assert.equal(recordLine({ failed: false, flakes: ["a.test.ts"] }, late), '{"date":"2026-03-04","result":"pass","flaky":true}');
});

test("recordLine: a failure that was not cleared is never flaky, even when another file was", () => {
  const now = new Date("2026-03-04T00:00:00Z");
  assert.equal(recordLine({ failed: true, flakes: ["a.test.ts"] }, now), '{"date":"2026-03-04","result":"fail","flaky":false}');
});

/** A repository with one commit, and stub tools whose test step fails when `FAIL_TEST` is set. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "ci-record-repo-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.test");
  git("config", "user.name", "t");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.test.ts"), "x\n");
  git("add", ".");
  git("commit", "-qm", "base");
  const bin = mkdtempSync(join(tmpdir(), "ci-record-bin-"));
  writeFileSync(
    join(bin, "npx"),
    `#!/bin/sh\ncase "$*" in *"turbo run test"*) [ -n "$FAIL_TEST" ] && exit 1;; esac\nexit 0\n`,
  );
  writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "npx"), 0o755);
  chmodSync(join(bin, "npm"), 0o755);
  return { dir, bin };
}

function run(extra, env = {}) {
  const { dir, bin } = setup();
  const out = mkdtempSync(join(tmpdir(), "ci-record-out-"));
  const record = join(mkdtempSync(join(tmpdir(), "ci-record-file-")), "ci-runs.jsonl");
  // FAIL_TEST is set in the child only; the cleaned environment keeps it, as it is no secret name.
  const result = spawnSync("node", [script, "--full", "--out", out, "--record", record, ...extra], {
    cwd: dir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env },
    encoding: "utf8",
  });
  return { code: result.status, record };
}

test("a passing run appends one pass line, and a second run appends another", () => {
  const first = run([]);
  assert.equal(first.code, 0);
  const lines = readFileSync(first.record, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), { date: new Date().toISOString().slice(0, 10), result: "pass", flaky: false });
});

test("a failing run appends a fail line that is not flaky", () => {
  const { code, record } = run([], { FAIL_TEST: "1" });
  assert.equal(code, 1);
  const line = JSON.parse(readFileSync(record, "utf8").trim());
  assert.equal(line.result, "fail");
  assert.equal(line.flaky, false);
});

test("a dry run records nothing", () => {
  const { record } = run(["--dry-run"]);
  assert.equal(existsSync(record), false);
});
