import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { STEPS } from "./ci-local.mjs";
import { branchTouched, packageFolders, parseFailures, planRetry, retryStep, sameCommit, touchedFiles } from "./retry.mjs";

const spec = {
  pattern: /^\s*FAIL\s+(\S+\.test\.\w+)/,
  summary: /Test Files\s+.*?(\d+) failed/,
  command: "runner {files}",
};
const log = (...lines) => lines.join("\n");
const exists = () => true;
const at = (file, pkg = null) => ({ pkg, file });

test("parseFailures reads each failed file once, plus the runner's own count", () => {
  const text = log(
    " FAIL  src/a.test.ts > one",
    " FAIL  src/a.test.ts > two",
    " FAIL  ./src/b.test.ts",
    " Test Files  2 failed | 9 passed (11)",
  );
  assert.deepEqual(parseFailures(text, spec), {
    files: [at("src/a.test.ts"), at("src/b.test.ts")],
    prefixed: false,
    reported: 2,
    unhandled: false,
    unnamed: [],
  });
});

test("parseFailures strips terminal colour codes before matching", () => {
  const text = "\u001B[31m FAIL \u001B[39m src/a.test.ts\n Test Files  1 failed (1)";
  assert.deepEqual(parseFailures(text, spec).files, [at("src/a.test.ts")]);
});

test("a log with no count has no count", () => {
  assert.equal(parseFailures(" FAIL  src/a.test.ts", spec).reported, null);
});

test("branchTouched: the file, or anything in its folder, counts", () => {
  assert.equal(branchTouched("src/a.test.ts", new Set(["src/a.test.ts"])), true);
  assert.equal(branchTouched("src/a.test.ts", new Set(["src/helper.ts"])), true);
  assert.equal(branchTouched("src/a.test.ts", new Set(["src/fixtures/x.json"])), true);
  assert.equal(branchTouched("src/a.test.ts", new Set(["docs/a.md", "srcx/b.ts"])), false);
});

test("planRetry: untouched files named by the runner's own count are retried", () => {
  const plan = planRetry({ files: [at("src/a.test.ts")], prefixed: false, reported: 1, unhandled: false, unnamed: [] }, new Set(["docs/a.md"]), exists);
  assert.deepEqual(plan.files, ["src/a.test.ts"]);
});

test("planRetry: a file the branch touched is never retried, even beside others", () => {
  const failures = { files: [at("src/a.test.ts"), at("lib/b.test.ts")], prefixed: false, reported: 2, unhandled: false, unnamed: [] };
  const plan = planRetry(failures, new Set(["lib/b.test.ts"]), exists);
  assert.equal(plan.files, null);
  assert.match(plan.note, /lib\/b\.test\.ts is in the branch's change/);
});

test("planRetry: every doubt means no retry", () => {
  const ok = { files: [at("src/a.test.ts")], prefixed: false, reported: 1, unhandled: false, unnamed: [] };
  const untouched = new Set(["docs/a.md"]);
  assert.match(planRetry(ok, null, exists).note, /could not work out/);
  assert.match(planRetry({ files: [], prefixed: false, reported: 1, unhandled: false, unnamed: [] }, untouched, exists).note, /no failing test file/);
  assert.match(planRetry({ ...ok, reported: null }, untouched, exists).note, /no failed-file count/);
  assert.match(planRetry({ ...ok, reported: 2 }, untouched, exists).note, /reports 2 failed, 1 named/);
  assert.match(planRetry(ok, untouched, () => false).note, /not a path from the repository root/);
  assert.match(
    planRetry({ files: [at("a b.test.ts")], prefixed: false, reported: 1, unhandled: false, unnamed: [] }, untouched, exists).note,
    /characters a command line cannot carry/,
  );
});

test("touchedFiles joins commits, uncommitted and untracked paths; a git failure is unknown", () => {
  const answers = [["a.ts\0b.ts\0"], ["c.ts\0"]];
  let i = 0;
  const git = () => answers[i++][0];
  assert.deepEqual([...touchedFiles("/r", "base", git)].sort(), ["a.ts", "b.ts", "c.ts"]);
  let n = 0;
  assert.equal(touchedFiles("/r", "base", () => (n++ === 0 ? "" : null)), null);
});

const step = { name: "test", retry: spec };
const failedLog = log(" FAIL  src/a.test.ts", " Test Files  1 failed (3)");
const folderOf = (pkg) => ({ "@a/one": "packages/one", "@a/two": "packages/two" })[pkg] ?? null;

test("retryStep: a pass on retry clears the step and lists the flake", () => {
  const ran = [];
  const outcome = retryStep({
    root: "/r",
    base: "abc",
    step,
    logText: failedLog,
    env: {},
    touched: () => new Set(["docs/a.md"]),
    exists,
    sameCommit: () => false,
    run: (command) => (ran.push(command), { code: 0, output: "ok" }),
  });
  assert.deepEqual(ran, ["runner src/a.test.ts"]);
  assert.equal(outcome.cleared, true);
  assert.deepEqual(outcome.flakes, ["src/a.test.ts"]);
});

test("retryStep: a failing retry leaves the step failed", () => {
  const outcome = retryStep({
    root: "/r",
    base: "abc",
    step,
    logText: failedLog,
    env: {},
    touched: () => new Set(),
    exists,
    sameCommit: () => false,
    run: () => ({ code: 1, output: "still red" }),
  });
  assert.equal(outcome.cleared, false);
  assert.match(outcome.note, /stays FAIL/);
});

test("retryStep: nothing runs for a touched file, or when there is no base", () => {
  const never = () => assert.fail("the retry must not run");
  const common = { root: "/r", step, logText: failedLog, env: {}, exists, sameCommit: () => false, run: never };
  const touchedOutcome = retryStep({ ...common, base: "abc", touched: () => new Set(["src/a.test.ts"]) });
  assert.equal(touchedOutcome.cleared, false);
  assert.match(touchedOutcome.note, /branch's change/);
  const noBase = retryStep({ ...common, base: undefined });
  assert.equal(noBase.cleared, false);
  assert.match(noBase.note, /could not work out/);
});

// The shipped step's own retry settings, against output kept as Turborepo prints it.
const shipped = STEPS.find((candidate) => candidate.name === "test").retry;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("the shipped pattern reads Turborepo's prefixed lines", () => {
  const failures = parseFailures(fixture("turbo-test-failure.txt"), shipped);
  assert.deepEqual(failures.files, [at("src/a.test.ts", "@a/one")]);
  assert.equal(failures.reported, 1);
  assert.deepEqual(failures.unnamed, []);
  assert.equal(failures.unhandled, false);
});

test("planRetry: a failed package that names no test file blocks the retry", () => {
  const failures = parseFailures(fixture("turbo-two-packages-failure.txt"), shipped);
  assert.deepEqual(failures.files, [at("src/a.test.ts", "@a/one")]);
  assert.deepEqual(failures.unnamed, ["@a/two"]);
  const plan = planRetry(failures, new Set(["docs/x.md"]), exists);
  assert.equal(plan.files, null);
  assert.match(plan.note, /@a\/two failed without naming a test file/);
});

test("planRetry: a task that crashed before the runner started blocks the retry", () => {
  const text = log(
    "@a/one:test:  FAIL  src/a.test.ts > one",
    "@a/one:test:  Test Files  1 failed | 2 passed (3)",
    "@a/two:test: ERROR: command finished with error: command exited (1)",
  );
  const plan = planRetry(parseFailures(text, shipped), new Set(), exists);
  assert.equal(plan.files, null);
  assert.match(plan.note, /@a\/two failed without naming/);
});

test("planRetry: an Unhandled Errors section blocks the retry, with or without a prefix", () => {
  for (const prefix of ["", "@a/one:test: "]) {
    const text = log(
      `${prefix} FAIL  src/a.test.ts > one`,
      `${prefix} Test Files  1 failed | 2 passed (3)`,
      `${prefix}⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯`,
    );
    const plan = planRetry(parseFailures(text, shipped), new Set(), exists);
    assert.equal(plan.files, null);
    assert.match(plan.note, /unhandled error/i);
  }
});

test("planRetry: without prefixes, more than one failed task cannot be explained by the named files", () => {
  const text = log(" FAIL  src/a.test.ts", " Test Files  1 failed (3)", "Failed:    pkg-a#test, pkg-b#test");
  assert.equal(planRetry(parseFailures(text, shipped), new Set(), exists).files, null);
  const one = log(" FAIL  src/a.test.ts", " Test Files  1 failed (3)", "Failed:    pkg-a#test");
  assert.deepEqual(planRetry(parseFailures(one, shipped), new Set(), exists).files, ["src/a.test.ts"]);
});

test("planRetry: a failure line with text before Failed: is still read (review A-H1)", () => {
  const text = log(" FAIL  src/a.test.ts", " Test Files  1 failed (3)", " ERR_TURBO_TASK_FAILURE Failed: pkg-a#test, pkg-b#test");
  const plan = planRetry(parseFailures(text, shipped), new Set(), exists);
  assert.equal(plan.files, null);
  assert.match(plan.note, /failed without naming/);
  const prefixed = log(
    "pkg-a:test:  FAIL  src/a.test.ts",
    "pkg-a:test:  Test Files  1 failed (3)",
    "pkg-b:test: ELIFECYCLE Command failed.",
    " ERR_TURBO_TASK_FAILURE  Failed:    pkg-a#test, pkg-b#test",
  );
  const second = planRetry(parseFailures(prefixed, shipped), new Set(), exists, () => "x");
  assert.equal(second.files, null);
  assert.match(second.note, /pkg-b failed without naming/);
});

// What `--retry` does under Turborepo: the runner prints paths relative to its package.
const prefixedLog = fixture("turbo-test-failure.txt");

test("planRetry: a package-relative failure in an untouched file is retried inside its package", () => {
  const plan = planRetry(parseFailures(prefixedLog, shipped), new Set(["docs/x.md"]), (path) => path === "packages/one/src/a.test.ts", folderOf);
  assert.deepEqual(plan.files, ["packages/one/src/a.test.ts"]);
  assert.deepEqual(plan.runs, [{ pkg: "@a/one", files: ["src/a.test.ts"] }]);
});

test("planRetry: a file touched in its package is not retried, whatever sits at that path in the root", () => {
  // A root file src/a.test.ts exists and is untouched; the failing file is packages/one/src/a.test.ts.
  const rootHasIt = (path) => path === "src/a.test.ts" || path === "packages/one/src/a.test.ts";
  const touched = planRetry(parseFailures(prefixedLog, shipped), new Set(["packages/one/src/a.test.ts"]), rootHasIt, folderOf);
  assert.equal(touched.files, null);
  assert.match(touched.note, /packages\/one\/src\/a\.test\.ts is in the branch's change/);
  const retried = planRetry(parseFailures(prefixedLog, shipped), new Set(), rootHasIt, folderOf);
  assert.deepEqual(retried.files, ["packages/one/src/a.test.ts"]);
});

test("planRetry: a package whose folder is unknown, or a failure with no prefix beside prefixed lines, is not retried", () => {
  const unknown = planRetry(parseFailures(prefixedLog, shipped), new Set(), exists, () => null);
  assert.equal(unknown.files, null);
  assert.match(unknown.note, /folder of package @a\/one is not known/);
  const mixed = log(prefixedLog, " FAIL  src/c.test.ts", " Test Files  1 failed (1)");
  const plan = planRetry(parseFailures(mixed, shipped), new Set(), exists, folderOf);
  assert.equal(plan.files, null);
});

test("retryStep: a prefixed failure runs the package command for that package only", () => {
  const ran = [];
  const outcome = retryStep({
    root: "/r",
    base: "abc",
    step: { name: "test", retry: shipped },
    logText: prefixedLog,
    env: {},
    touched: () => new Set(),
    exists: (path) => path === "packages/one/src/a.test.ts",
    folderOf,
    sameCommit: () => false,
    run: (command) => (ran.push(command), { code: 0, output: "ok" }),
  });
  assert.deepEqual(ran, ["npx turbo run test --filter=@a/one -- src/a.test.ts"]);
  assert.deepEqual(outcome.flakes, ["packages/one/src/a.test.ts"]);
});

test("packageFolders maps a package's name to its folder; a name two folders claim is unknown", () => {
  const files = {
    "package.json": '{"name":"root"}',
    "packages/one/package.json": '{"name":"@a/one"}',
    "packages/two/package.json": '{"name":"dup"}',
    "packages/three/package.json": '{"name":"dup"}',
    "packages/bad/package.json": "{",
    "x-package.json": '{"name":"nope"}',
  };
  const lookup = packageFolders(
    "/r",
    () => `${Object.keys(files).join("\0")}\0`,
    (path) => files[path] ?? null,
  );
  assert.equal(lookup("@a/one"), "packages/one");
  assert.equal(lookup("root"), "");
  assert.equal(lookup("dup"), null);
  assert.equal(lookup("nope"), null);
  assert.equal(lookup("missing"), null);
  assert.equal(packageFolders("/r", () => null)("@a/one"), null);
});

test("retryStep: the base being HEAD means no retry, and the retry never runs", () => {
  const outcome = retryStep({
    root: "/r",
    base: "abc",
    step,
    logText: failedLog,
    env: {},
    touched: () => new Set(),
    exists,
    sameCommit: () => true,
    run: () => assert.fail("the retry must not run"),
  });
  assert.equal(outcome.cleared, false);
  assert.match(outcome.note, /same commit as HEAD/);
});

test("sameCommit: true on the base itself, false for an ancestor, true when git cannot say", () => {
  const dir = mkdtempSync(join(tmpdir(), "ci-local-same-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.test");
  git("config", "user.name", "t");
  git("commit", "-q", "--allow-empty", "-m", "one");
  git("commit", "-q", "--allow-empty", "-m", "two");
  assert.equal(sameCommit(dir, "HEAD"), true);
  assert.equal(sameCommit(dir, "HEAD~1"), false);
  assert.equal(sameCommit(dir, "no-such-ref"), true);
});
