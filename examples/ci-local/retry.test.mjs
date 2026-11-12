import assert from "node:assert/strict";
import { test } from "node:test";
import { branchTouched, parseFailures, planRetry, retryStep, touchedFiles } from "./retry.mjs";

const spec = {
  pattern: /^\s*FAIL\s+(\S+\.test\.\w+)/,
  summary: /Test Files\s+.*?(\d+) failed/,
  command: "runner {files}",
};
const log = (...lines) => lines.join("\n");
const exists = () => true;

test("parseFailures reads each failed file once, plus the runner's own count", () => {
  const text = log(
    " FAIL  src/a.test.ts > one",
    " FAIL  src/a.test.ts > two",
    " FAIL  ./src/b.test.ts",
    " Test Files  2 failed | 9 passed (11)",
  );
  assert.deepEqual(parseFailures(text, spec), { files: ["src/a.test.ts", "src/b.test.ts"], reported: 2 });
});

test("parseFailures strips terminal colour codes before matching", () => {
  const text = "\u001B[31m FAIL \u001B[39m src/a.test.ts\n Test Files  1 failed (1)";
  assert.deepEqual(parseFailures(text, spec).files, ["src/a.test.ts"]);
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
  const plan = planRetry({ files: ["src/a.test.ts"], reported: 1 }, new Set(["docs/a.md"]), exists);
  assert.deepEqual(plan.files, ["src/a.test.ts"]);
});

test("planRetry: a file the branch touched is never retried, even beside others", () => {
  const failures = { files: ["src/a.test.ts", "lib/b.test.ts"], reported: 2 };
  const plan = planRetry(failures, new Set(["lib/b.test.ts"]), exists);
  assert.equal(plan.files, null);
  assert.match(plan.note, /lib\/b\.test\.ts is in the branch's change/);
});

test("planRetry: every doubt means no retry", () => {
  const ok = { files: ["src/a.test.ts"], reported: 1 };
  const untouched = new Set(["docs/a.md"]);
  assert.match(planRetry(ok, null, exists).note, /could not work out/);
  assert.match(planRetry({ files: [], reported: 1 }, untouched, exists).note, /no failing test file/);
  assert.match(planRetry({ ...ok, reported: null }, untouched, exists).note, /no failed-file count/);
  assert.match(planRetry({ ...ok, reported: 2 }, untouched, exists).note, /reports 2 failed, 1 named/);
  assert.match(planRetry(ok, untouched, () => false).note, /not a path from the repository root/);
  assert.match(
    planRetry({ files: ["a b.test.ts"], reported: 1 }, untouched, exists).note,
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
    run: () => ({ code: 1, output: "still red" }),
  });
  assert.equal(outcome.cleared, false);
  assert.match(outcome.note, /stays FAIL/);
});

test("retryStep: nothing runs for a touched file, or when there is no base", () => {
  const never = () => assert.fail("the retry must not run");
  const common = { root: "/r", step, logText: failedLog, env: {}, exists, run: never };
  const touchedOutcome = retryStep({ ...common, base: "abc", touched: () => new Set(["src/a.test.ts"]) });
  assert.equal(touchedOutcome.cleared, false);
  assert.match(touchedOutcome.note, /branch's change/);
  const noBase = retryStep({ ...common, base: undefined });
  assert.equal(noBase.cleared, false);
  assert.match(noBase.note, /could not work out/);
});
