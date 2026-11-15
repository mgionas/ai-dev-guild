import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  THRESHOLDS,
  compute,
  findMergeTime,
  loadRecords,
  median,
  p90,
  parseArgs,
  parseBranch,
  parseCiLedger,
  parseDay,
  parseDecision,
  parseFindings,
  parseRecheck,
  parseTokenReport,
  suggest,
} from "./flow-stats.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "flow-stats.mjs");
const at = (day, hour = 9) => Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

// --- small helpers -------------------------------------------------------------------------

test("parseDay accepts a real day and refuses one that does not exist", () => {
  assert.equal(parseDay("2026-02-28"), Date.UTC(2026, 1, 28));
  assert.equal(parseDay("2026-02-31"), null); // Date.UTC alone would roll this into March
  assert.equal(parseDay("2026-2-3"), null);
  assert.equal(parseDay(20260203), null);
  assert.equal(parseDay(undefined), null);
});

test("median and p90: none is null, odd and even sets, nearest rank", () => {
  assert.equal(median([]), null);
  assert.equal(median([4]), 4);
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([1, 2, 3, 10]), 2.5);
  assert.equal(p90([]), null);
  assert.equal(p90([7]), 7);
  assert.equal(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9); // rank ceil(9.0) = 9, a measured value
  assert.equal(p90([10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]), 10); // rank ceil(9.9) = 10
});

// --- parsers -------------------------------------------------------------------------------

const TABLE = `| # | Severity | Where | What is wrong | How to see it | Test |
| - | -------- | ----- | ------------- | ------------- | ---- |
`;

test("parseFindings reads both severity spellings and the reviewers", () => {
  const text = `# Findings\n\n**Head reviewed:** abc   **Reviewers:** security, code-reviewer\n\n${TABLE}| 1 | critical | a | x | y | z |
| 2 | Blocker | a | x | y | z |
| 3 | high | a | x | y | z |
| 4 | important | a | x | y | z |
| 5 | medium | a | x | y | z |
| 6 | low | a | x | y | z |
| 7 | minor | a | x | y | z |
`;
  const parsed = parseFindings(text);
  assert.deepEqual(parsed.reviewers, ["security", "code-reviewer"]);
  assert.deepEqual(
    parsed.findings.map((f) => f.severity),
    ["critical", "critical", "high", "high", "medium", "low", "low"],
  );
  assert.equal(parsed.unrecognized, 0);
});

test("parseFindings: should-fix counts as medium and note as low", () => {
  const parsed = parseFindings(`${TABLE}| 1 | should-fix | a | x | y | z |
| 2 | **Note** | a | x | y | z |
| 3 | Should-Fix | a | x | y | z |
`);
  assert.deepEqual(
    parsed.findings.map((f) => f.severity),
    ["medium", "low", "medium"],
  );
  assert.equal(parsed.unrecognized, 0);
});

test("parseFindings: a Claim: cell marks a claim that did not hold, bold or not", () => {
  const parsed = parseFindings(`${TABLE}| 1 | high | a | Claim: tests pass | y | z |
| 2 | high | a | **Claim:** the input is checked | y | z |
| 3 | high | a | The claim: is not first | y | z |
| 4 | high | a | claim: lower case is not the marker | y | z |
`);
  assert.deepEqual(
    parsed.findings.map((f) => f.claim),
    [true, true, false, false],
  );
});

test("parseFindings: an unknown severity is counted apart, never ranked", () => {
  const parsed = parseFindings(`${TABLE}| 1 | urgent | a | x | y | z |
| 2 | | a | x | y | z |
| 3 | low | a | x | y | z |
`);
  assert.equal(parsed.unrecognized, 2);
  assert.deepEqual(parsed.findings.map((f) => f.severity), ["low"]);
  // Object.prototype names are unknown severities, not a way to a ranking.
  assert.equal(parseFindings(`${TABLE}| 1 | constructor | a | x | y | z |\n`).findings.length, 0);
});

test("parseFindings: an escaped pipe stays in its cell; no table and no reviewers is empty, not a crash", () => {
  const parsed = parseFindings(`${TABLE}| 1 | low | a | Claim: a \\| b | y | z |\n`);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].claim, true);
  assert.deepEqual(parseFindings("nothing here"), { reviewers: [], findings: [], unrecognized: 0 });
  assert.deepEqual(parseFindings("**Reviewers:** <roles>\n").reviewers, []); // the template's placeholder
});

test("parseRecheck reads the count, and null when the line is missing", () => {
  assert.equal(parseRecheck("# Re-check\n\n**New problems:** 0\n"), 0);
  assert.equal(parseRecheck("**New problems:** 12"), 12);
  assert.equal(parseRecheck("New problems: 3"), null);
  assert.equal(parseRecheck("**New problems:** none"), null);
});

test("parseDecision reads the title's day and the answer", () => {
  const head = "# Decisions needed: retention (2026-01-10)\n\n";
  assert.deepEqual(parseDecision(head), { date: "2026-01-10", badTitleDate: false, answered: null });
  assert.deepEqual(parseDecision(`${head}**Answered:** 2026-01-11, accept all\n`).answered, {
    date: "2026-01-11",
    kind: "all",
    changed: 0,
  });
  assert.deepEqual(parseDecision(`${head}**Answered:** 2026-01-14, changed 2\n`).answered, {
    date: "2026-01-14",
    kind: "changed",
    changed: 2,
  });
  // "changed 0" changed nothing: it is the same as accepting all.
  assert.equal(parseDecision(`${head}**Answered:** 2026-01-14, changed 0\n`).answered.kind, "all");
  assert.deepEqual(parseDecision("no title"), { date: null, badTitleDate: false, answered: null });
  assert.equal(parseDecision("# Decisions needed: x (2026-13-40)\n").date, null);
});

test("parseTokenReport reads the median and the shares, and skips rows that are no share", () => {
  const parsed = parseTokenReport(`# Token review

**Tokens per task (median):** 1,250,000

| Model | Share |
| --- | --- |
| Big | 62% |
| Middle | 30 |
| Small | 8.5% |
| Broken | n/a |
`);
  assert.equal(parsed.perTaskMedian, 1250000);
  assert.equal(parsed.rejected, 1);
  assert.deepEqual(parsed.byModel, [
    { model: "Big", share: 62 },
    { model: "Middle", share: 30 },
    { model: "Small", share: 8.5 },
  ]);
  assert.deepEqual(parseTokenReport("nothing"), { perTaskMedian: null, byModel: [], rejected: 0 });
});

test("parseCiLedger keeps real runs and counts the rest as malformed", () => {
  const parsed = parseCiLedger(
    [
      '{"date":"2026-01-05","result":"pass","flaky":false}',
      '{"date":"2026-01-06","result":"fail","flaky":false}',
      '{"date":"2026-01-07","result":"pass","flaky":true}',
      "not json",
      '{"date":"2026-01-08","result":"maybe","flaky":false}',
      '{"date":"2026-01-09","result":"pass"}',
      '{"date":"2026-13-09","result":"pass","flaky":false}',
      '{"date":"2026-01-10","result":"fail","flaky":true}', // flaky means every failure passed on retry
      "[1]",
      "null",
      '{"__proto__":{"result":"pass"},"date":"2026-01-11"}',
      "",
    ].join("\n"),
  );
  assert.equal(parsed.runs.length, 3);
  assert.equal(parsed.malformed, 8);
});

test("parseBranch reads a plain branch name from the header only", () => {
  assert.equal(parseBranch("# Brief\n\n**Branch:** task/alpha-1\n"), "task/alpha-1");
  assert.equal(parseBranch("**Branch:** `feat/x`\n"), "feat/x");
  assert.equal(parseBranch("# Brief\n\nno line"), null);
  assert.equal(parseBranch("**Branch:** --upload-pack=evil"), null); // it goes to git and gh as an argument
  assert.equal(parseBranch(`${"line\n".repeat(25)}**Branch:** late`), null);
});

test("findMergeTime matches the branch as a whole name, and takes the first time", () => {
  const log = [
    { time: 300, text: "Merge pull request #3 from org/feat/x2\n" },
    { time: 200, text: "Merge pull request #2 from org/feat/x\n" },
    { time: 100, text: "docs: mention feat/x again" },
  ];
  assert.equal(findMergeTime(log, "feat/x"), 100);
  assert.equal(findMergeTime(log, "feat/x2"), 300);
  assert.equal(findMergeTime(log, "feat/y"), null);
  assert.equal(findMergeTime([{ time: 1, text: "Merge feat/xy" }], "feat/x"), null);
  assert.equal(findMergeTime([{ time: 1, text: "Merge afeat/x" }], "feat/x"), null);
  // A name with regular-expression characters is matched as text.
  assert.equal(findMergeTime([{ time: 1, text: "Merge feat/aXb" }], "feat/a.b"), null);
});

// --- thresholds ----------------------------------------------------------------------------

const ZERO = {
  reviewed: 0, secondRound: 0, rechecks: 0, newBreakage: 0, findings: 0, critical: 0, reports: 0,
  didNotHold: 0, ciRuns: 0, flaky: 0, medianWait: null, strongShare: null, medianDays: null, p90Days: null,
};
const ids = (raw) => suggest(raw).map((s) => s.id);

// For each rule: raw numbers exactly at the limit, and the smallest step past it.
const EDGES = [
  ["second-round", { reviewed: 10, secondRound: 2 }, { reviewed: 10, secondRound: 3 }],
  ["new-breakage", { rechecks: 10, newBreakage: 1 }, { rechecks: 9, newBreakage: 1 }],
  ["critical", { findings: 20, critical: 3 }, { findings: 20, critical: 4 }],
  ["claims", { reports: 20, didNotHold: 1 }, { reports: 19, didNotHold: 1 }],
  ["flaky", { ciRuns: 10, flaky: 1 }, { ciRuns: 9, flaky: 1 }],
  ["owner-wait", { medianWait: 2 }, { medianWait: 2.5 }],
  ["strong-model", { strongShare: 50 }, { strongShare: 50.5 }],
  ["slow-tail", { medianDays: 2, p90Days: 6 }, { medianDays: 2, p90Days: 6.5 }],
];

test("every threshold: exactly at the limit is not crossed, past it is", () => {
  assert.deepEqual(EDGES.map(([id]) => id), THRESHOLDS.map((t) => t.id), "one edge case per rule, in table order");
  for (const [id, atLimit, past] of EDGES) {
    assert.deepEqual(ids({ ...ZERO, ...atLimit }), [], `${id}: at the limit must not be crossed`);
    assert.deepEqual(ids({ ...ZERO, ...past }), [id], `${id}: past the limit must be crossed`);
  }
});

test("a rule with nothing to divide by is not crossed and does not crash", () => {
  assert.deepEqual(suggest(ZERO), []);
  // A median of zero days: every task ended the day it began, so a tail cannot be judged.
  assert.deepEqual(ids({ ...ZERO, medianDays: 0, p90Days: 4 }), []);
});

test("a suggestion carries the table's words and starts as proposed", () => {
  const [one] = suggest({ ...ZERO, reports: 10, didNotHold: 2 });
  assert.deepEqual(one, {
    id: "claims",
    measure: "reports with a claim that did not hold",
    value: "2 of 10 reports (20%)",
    threshold: "> 5% of reports",
    skill: "run-task",
    text: "The reviewer re-runs one claimed test per task; reports paste their output.",
    status: "proposed",
  });
});

test("suggestions are ranked by how far past the limit, at most three, equal ranks in table order", () => {
  const raw = {
    ...ZERO,
    reviewed: 10, secondRound: 5, //   50% of a 20% limit: 2.5 times
    rechecks: 10, newBreakage: 5, //   50% of a 10% limit: 5 times
    findings: 10, critical: 4, //      40% of 15%: 2.67 times
    reports: 10, didNotHold: 5, //     50% of 5%: 10 times
    ciRuns: 10, flaky: 5, //           50% of 10%: 5 times, ties with new-breakage
    medianWait: 3, //                  1.5 times
  };
  assert.deepEqual(ids(raw), ["claims", "new-breakage", "flaky"]);
  assert.equal(THRESHOLDS.length, 8);
  assert.deepEqual(ids({ ...raw, ciRuns: 0, flaky: 0 }), ["claims", "new-breakage", "critical"]);
});

// --- compute -------------------------------------------------------------------------------

const task = (over = {}) => ({
  id: "t",
  start: at("2026-03-02"),
  times: { brief: at("2026-03-02"), report: null, findings1: null, lastFix: null, last: at("2026-03-02"), merged: null },
  findingFiles: [],
  rechecks: [],
  hasReport: false,
  ...over,
});
const records = (over = {}) => ({ tasks: [], decisions: [], ci: null, tokens: [], problems: [], ...over });
const opts = { project: "p", generated: "2026-03-31" };

test("with no records every section is null and says why in gaps, nothing is guessed", () => {
  const out = compute(records(), opts);
  assert.deepEqual(
    { ...out, gaps: undefined },
    {
      meta: { project: "p", generated: "2026-03-31", from: "2026-03-31", to: "2026-03-31", tasks: 0 },
      time: null, review: null, fixRounds: null, claims: null, ci: null, questions: null, tokens: null,
      gaps: undefined,
      suggestions: [],
    },
  );
  for (const part of ["time:", "review, fixRounds:", "claims:", "ci:", "questions:", "tokens:"])
    assert.ok(out.gaps.some((g) => g.startsWith(part)), `a gap for ${part}\n${out.gaps.join("\n")}`);
});

test("a task with a brief only: its stages are null with a gap each, its time uses the last file", () => {
  const out = compute(records({ tasks: [task({ times: { ...task().times, last: at("2026-03-04") } })] }), opts);
  assert.equal(out.time.medianDays, 2);
  assert.deepEqual(out.time.stages, { building: null, review: null, fixing: null });
  assert.ok(out.gaps.includes("time.stages.building: no task has both records"));
  assert.ok(out.gaps.some((g) => g.includes("merge time not found for 1 of 1 tasks")));
  assert.equal(out.review, null);
});

test("a merge time ends the task; a task with no findings ends its review there", () => {
  const t = task({
    hasReport: true,
    times: { brief: at("2026-03-02"), report: at("2026-03-03"), findings1: null, lastFix: null, last: at("2026-03-03"), merged: at("2026-03-06") },
  });
  const out = compute(records({ tasks: [t] }), opts);
  assert.equal(out.time.medianDays, 4);
  assert.equal(out.time.stages.building, 1);
  assert.equal(out.time.stages.review, 3);
  assert.equal(out.time.stages.fixing, null);
  assert.equal(out.fixRounds.distribution[0], 1);
  assert.ok(!out.gaps.some((g) => g.includes("merge time not found")));
});

test("stages and slowest tasks: medians of the tasks that have both records, longest first, three at most", () => {
  const mk = (id, days) =>
    task({ id, times: { ...task().times, last: at("2026-03-02") + days * 86_400_000 } });
  const out = compute(records({ tasks: [mk("a", 1), mk("b", 9), mk("c", 3), mk("d", 5)] }), opts);
  assert.deepEqual(out.time.slowest, [
    { task: "b", days: 9 },
    { task: "d", days: 5 },
    { task: "c", days: 3 },
  ]);
  assert.equal(out.time.medianDays, 4);
  assert.equal(out.time.p90Days, 9);
});

test("a time that runs backwards (file times can lie) is left out, not counted as negative", () => {
  const t = task({ times: { ...task().times, last: at("2026-03-01") } });
  const out = compute(records({ tasks: [t] }), opts);
  assert.equal(out.time.medianDays, null);
  assert.ok(out.gaps.includes("time: no task has a brief and a later file"));
});

const finding = (severity, claim = false) => ({ severity, claim });

test("review, fix rounds, claims and the reviewer table are counted from the findings files", () => {
  const a = task({
    id: "a",
    hasReport: true,
    findingFiles: [
      { reviewers: ["sec", "code"], findings: [finding("critical", true), finding("low")] },
      { reviewers: ["code"], findings: [finding("medium")] },
      { reviewers: ["code"], findings: [] },
    ],
    rechecks: [1, 0, 0],
  });
  const b = task({ id: "b", hasReport: true, findingFiles: [{ reviewers: ["code"], findings: [finding("low")] }], rechecks: [0, null] });
  const c = task({ id: "c", hasReport: true });
  const d = task({ id: "d" }); // a brief and nothing else: not reviewable, so not counted
  const out = compute(records({ tasks: [a, b, c, d] }), opts);
  assert.deepEqual(out.review, {
    tasks: 3,
    blocking: 1,
    bySeverity: { critical: 1, high: 0, medium: 1, low: 2 },
    byReviewer: [
      { role: "code", findings: 4 },
      { role: "sec", findings: 2 },
    ],
  });
  assert.deepEqual(out.fixRounds, { distribution: { 0: 1, 1: 1, 2: 0, "3+": 1 }, rechecks: 4, newBreakage: 1 });
  assert.deepEqual(out.claims, { reports: 3, didNotHold: 1 });
});

test("ci counts pass, real failures and flaky runs apart", () => {
  const runs = [
    { date: "2026-03-02", result: "pass", flaky: false },
    { date: "2026-03-03", result: "pass", flaky: true },
    { date: "2026-03-04", result: "fail", flaky: false },
    { date: "2026-03-05", result: "pass", flaky: false },
  ];
  assert.deepEqual(compute(records({ ci: { runs, malformed: 0 } }), opts).ci, { runs: 4, pass: 2, realFailures: 1, flaky: 1 });
});

test("questions: batches, answers, and the median wait in days", () => {
  const decisions = [
    { date: "2026-03-02", answered: { date: "2026-03-03", kind: "all", changed: 0 } },
    { date: "2026-03-05", answered: { date: "2026-03-10", kind: "changed", changed: 1 } },
    { date: "2026-03-06", answered: null },
  ];
  assert.deepEqual(compute(records({ decisions }), opts).questions, {
    batches: 3, answered: 2, acceptedAll: 1, changed: 1, medianWaitDays: 3,
  });
  const none = compute(records({ decisions: [decisions[2]] }), opts);
  assert.equal(none.questions.medianWaitDays, null);
  assert.ok(none.gaps.includes("questions.medianWaitDays: no answered batch"));
});

test("tokens: the latest report in the period, models by share", () => {
  const tokens = [
    { date: "2026-02-01", perTaskMedian: 1, byModel: [{ model: "Old", share: 100 }] },
    { date: "2026-03-10", perTaskMedian: 500, byModel: [{ model: "Small", share: 20 }, { model: "Big", share: 80 }] },
  ];
  assert.deepEqual(compute(records({ tokens }), { ...opts, from: "2026-03-01" }).tokens, {
    perTaskMedian: 500,
    byModel: [{ model: "Big", share: 80 }, { model: "Small", share: 20 }],
  });
  const noMedian = compute(records({ tokens: [{ date: "2026-03-10", perTaskMedian: null, byModel: [] }] }), opts);
  assert.equal(noMedian.tokens.perTaskMedian, null);
  assert.ok(noMedian.gaps.some((g) => g.startsWith("tokens.perTaskMedian")));
});

test("--strong-model picks the models by name, case-insensitively, and defaults to opus", () => {
  const tokens = [{ date: "2026-03-10", perTaskMedian: 1, byModel: [{ model: "Alpha-Big", share: 60 }, { model: "Beta", share: 40 }] }];
  assert.deepEqual(ids({ ...ZERO }), []);
  assert.deepEqual(compute(records({ tokens }), opts).suggestions, []); // no model named opus
  const out = compute(records({ tokens }), { ...opts, strongModel: "BIG" });
  assert.deepEqual(out.suggestions.map((s) => s.id), ["strong-model"]);
  assert.equal(out.suggestions[0].value, "60%");
});

test("the period keeps only what falls inside it, ends included", () => {
  const mk = (id, day) => task({ id, start: at(day), times: { ...task().times, brief: at(day), last: at(day) } });
  const out = compute(
    records({ tasks: [mk("early", "2026-03-01"), mk("first", "2026-03-02"), mk("last", "2026-03-04"), mk("late", "2026-03-05")] }),
    { ...opts, from: "2026-03-02", to: "2026-03-04" },
  );
  assert.equal(out.meta.tasks, 2);
  assert.equal(out.meta.from, "2026-03-02");
  assert.equal(out.meta.to, "2026-03-04");
});

test("problems the loader found are carried into gaps", () => {
  assert.ok(compute(records({ problems: ["x: left out"] }), opts).gaps.includes("x: left out"));
});

// --- command line --------------------------------------------------------------------------

test("parseArgs: values and flags are read", () => {
  assert.deepEqual(
    parseArgs(["--root", "/p", "--out", "/o.json", "--from", "2026-01-01", "--to", "2026-02-01", "--no-gh", "--strong-model", "big"]),
    { noGh: true, strongModel: "big", problem: null, root: "/p", out: "/o.json", from: "2026-01-01", to: "2026-02-01" },
  );
  const plain = parseArgs(["--root", "/p", "--out", "/o.json"]);
  assert.equal(plain.noGh, false);
  assert.equal(plain.strongModel, "opus");
});

test("parseArgs: a missing, unknown or invalid argument is refused, not ignored", () => {
  assert.match(parseArgs(["--out", "/o"]).problem, /--root and --out are required/);
  assert.match(parseArgs(["--root", "/p"]).problem, /--root and --out are required/);
  assert.match(parseArgs(["--root", "/p", "--out", "/o", "--rooot", "x"]).problem, /unknown argument --rooot/);
  assert.match(parseArgs(["--root", "/p", "--out"]).problem, /--out needs a value/);
  assert.match(parseArgs(["--root", "/p", "--out", "/o", "--from", "2026-02-31"]).problem, /--from must be a real day/);
  assert.match(parseArgs(["--root", "/p", "--out", "/o", "--to", "soon"]).problem, /--to must be a real day/);
  assert.match(parseArgs(["--root", "/p", "--out", "/o", "--from", "2026-03-02", "--to", "2026-03-01"]).problem, /--from is after --to/);
  assert.match(parseArgs(["constructor"]).problem, /unknown argument/);
});

// --- the fixture, end to end ---------------------------------------------------------------

/** Walks a folder and lists every file, so a run can be shown to have left the project as it was. */
const listing = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listing(join(dir, e.name), base) : [join(dir, e.name).slice(base.length)],
  );

/** Copies the fixture project to a temporary folder and gives every file the time the story needs. */
function copyFixture() {
  const root = mkdtempSync(join(tmpdir(), "flow-stats-project-"));
  cpSync(join(here, "fixtures/project"), root, { recursive: true });
  const times = {
    "alpha-search": { "brief.md": ["2026-01-05", 9], "report.md": ["2026-01-06", 9], "findings-1.md": ["2026-01-07", 9], "fix-report.md": ["2026-01-07", 15], "recheck-1.md": ["2026-01-08", 9], "findings-2.md": ["2026-01-08", 12], "fix-report-2.md": ["2026-01-09", 9], "recheck-2.md": ["2026-01-09", 12] },
    "beta-export": { "brief.md": ["2026-01-06", 9], "report.md": ["2026-01-07", 9], "findings-1.md": ["2026-01-07", 21], "fix-report.md": ["2026-01-08", 9], "recheck-1.md": ["2026-01-08", 21] },
    "gamma-labels": { "brief.md": ["2026-01-08", 9], "report.md": ["2026-01-08", 21] },
    "delta-import": { "brief.md": ["2026-01-09", 9], "report.md": ["2026-01-12", 9], "findings-1.md": ["2026-01-13", 9], "fix-report.md": ["2026-01-13", 15], "recheck-1.md": ["2026-01-14", 9], "findings-2.md": ["2026-01-15", 9], "fix-report-2.md": ["2026-01-16", 9], "recheck-2.md": ["2026-01-17", 9], "findings-3.md": ["2026-01-18", 9], "fix-report-3.md": ["2026-01-19", 9], "recheck-3.md": ["2026-01-21", 9] },
  };
  for (const [name, files] of Object.entries(times))
    for (const [file, [day, hour]] of Object.entries(files)) {
      const when = new Date(at(day, hour));
      utimesSync(join(root, ".work/tasks", name, file), when, when);
    }
  return root;
}

/** Makes the copy a repository whose main line has merge commits for two of the four branches. */
function makeRepo(root) {
  const git = (env, ...args) =>
    spawnSync("git", ["-C", root, ...args], { env: { ...process.env, ...env }, encoding: "utf8" });
  git({}, "init", "-q", "-b", "main");
  git({}, "config", "user.email", "t@example.test");
  git({}, "config", "user.name", "t");
  const merge = (branch, day, hour) => {
    const date = `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
    git({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, "commit", "-q", "--allow-empty", "-m", `Merge pull request #1 from org/${branch}`);
  };
  merge("task/alpha-search", "2026-01-10", 9);
  merge("task/gamma-labels", "2026-01-09", 9);
}

const runCli = (root, extra = []) => {
  const out = join(mkdtempSync(join(tmpdir(), "flow-stats-out-")), "stats.json");
  const result = spawnSync("node", [script, "--root", root, "--out", out, "--no-gh", ...extra], { encoding: "utf8" });
  return { result, out, json: result.status === 0 ? JSON.parse(readFileSync(out, "utf8")) : null };
};

test("the fixture end to end: git merge times, every section, three ranked suggestions, nothing else written", () => {
  const root = copyFixture();
  makeRepo(root);
  const before = listing(root).filter((p) => !p.startsWith("/.git/"));
  const { result, json } = runCli(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(listing(root).filter((p) => !p.startsWith("/.git/")), before, "the project is read, never written");
  assert.deepEqual(json.meta, { project: json.meta.project, generated: json.meta.generated, from: "2026-01-05", to: json.meta.generated, tasks: 4 });
  assert.deepEqual(json.time, {
    medianDays: 3.8,
    p90Days: 12,
    stages: { building: 1, review: 0.8, fixing: 2.1 },
    slowest: [{ task: "delta-import", days: 12 }, { task: "alpha-search", days: 5 }, { task: "beta-export", days: 2.5 }],
  });
  assert.deepEqual(json.review, {
    tasks: 4,
    blocking: 3,
    bySeverity: { critical: 2, high: 4, medium: 2, low: 3 },
    byReviewer: [{ role: "reviewer-code", findings: 11 }, { role: "reviewer-security", findings: 5 }, { role: "reviewer-tests", findings: 2 }],
  });
  assert.deepEqual(json.fixRounds, { distribution: { 0: 1, 1: 1, 2: 1, "3+": 1 }, rechecks: 6, newBreakage: 3 });
  assert.deepEqual(json.claims, { reports: 4, didNotHold: 2 });
  assert.deepEqual(json.ci, { runs: 9, pass: 5, realFailures: 2, flaky: 2 });
  assert.deepEqual(json.questions, { batches: 2, answered: 2, acceptedAll: 1, changed: 1, medianWaitDays: 2.5 });
  assert.deepEqual(json.tokens, {
    perTaskMedian: 180000,
    byModel: [{ model: "Opus", share: 62 }, { model: "Sonnet", share: 30 }, { model: "Haiku", share: 8 }],
  });
  assert.deepEqual(json.suggestions.map((s) => s.id), ["claims", "new-breakage", "second-round"]);
  assert.ok(json.suggestions.every((s) => s.status === "proposed"));
  assert.deepEqual(json.gaps, [
    "delta-import: 1 finding(s) with a severity this script does not know, left out",
    "ci: 1 line(s) in ci-runs.jsonl are not a run, left out",
    "time: merge time not found for 2 of 4 tasks, the last file's time is used instead",
  ]);
});

test("the same fixture outside a repository: no merge times, so the last file ends each task", () => {
  const { json } = runCli(copyFixture());
  assert.ok(json.gaps.some((g) => g.includes("merge time not found for 4 of 4 tasks")));
  assert.equal(json.time.slowest[0].task, "delta-import");
});

test("--from and --to narrow the run; a period with nothing in it is all nulls and gaps", () => {
  const root = copyFixture();
  assert.equal(runCli(root, ["--from", "2026-01-08", "--to", "2026-01-31"]).json.meta.tasks, 2);
  const empty = runCli(root, ["--from", "2025-01-01", "--to", "2025-01-31"]).json;
  assert.equal(empty.time, null);
  assert.equal(empty.review, null);
  assert.equal(empty.ci, null);
  assert.deepEqual(empty.suggestions, []);
  assert.ok(empty.gaps.length >= 6);
});

test("a project with no .work folder gives nulls and gaps, not a crash", () => {
  const root = mkdtempSync(join(tmpdir(), "flow-stats-bare-"));
  const { result, json } = runCli(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(json.meta.tasks, 0);
  assert.equal(json.questions, null);
  assert.ok(json.gaps.length >= 6);
});

test("a bad command line exits 2 and writes nothing", () => {
  const out = join(mkdtempSync(join(tmpdir(), "flow-stats-out-")), "never.json");
  const result = spawnSync("node", [script, "--out", out], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--root and --out are required/);
  assert.deepEqual(readdirSync(dirname(out)), []);
});

test("files that are links are not read, so a link cannot lead a read out of the project", () => {
  const root = copyFixture();
  const outside = mkdtempSync(join(tmpdir(), "flow-stats-outside-"));
  mkdirSync(join(outside, "stolen"));
  writeFileSync(join(outside, "stolen/brief.md"), "# Brief\n");
  writeFileSync(join(outside, "ci.jsonl"), '{"date":"2026-01-05","result":"pass","flaky":false}\n');
  symlinkSync(join(outside, "stolen"), join(root, ".work/tasks/linked-task"));
  symlinkSync(join(outside, "ci.jsonl"), join(root, ".work/linked.jsonl"));
  const records = loadRecords({ root, noGh: true });
  assert.deepEqual(records.tasks.map((t) => t.id).sort(), ["alpha-search", "beta-export", "delta-import", "gamma-labels"]);
  // Replace the ledger with a link: it is then missing, not read from outside.
  const root2 = copyFixture();
  writeFileSync(join(outside, "ci2.jsonl"), '{"date":"2026-01-05","result":"pass","flaky":false}\n');
  mkdirSync(join(root2, ".work/spare"));
  symlinkSync(join(outside, "ci2.jsonl"), join(root2, ".work/spare/ci-runs.jsonl"));
  assert.equal(loadRecords({ root: root2, noGh: true }).ci.runs.length, 9);
});

// --- fix round 1 ---------------------------------------------------------------------------

test("an unreadable record is a gap that names the file, and the record is skipped", (t) => {
  const root = copyFixture();
  const bad = join(root, ".work/tasks/alpha-search/findings-1.md");
  const ledger = join(root, ".work/ci-runs.jsonl");
  chmodSync(bad, 0o000);
  chmodSync(ledger, 0o000);
  try {
    // Some systems ignore the mode (running as root): there is nothing to prove there.
    try {
      readFileSync(bad);
      t.skip("this system lets the file be read despite mode 000");
      return;
    } catch {}
    const records = loadRecords({ root, noGh: true });
    const alpha = records.tasks.find((x) => x.id === "alpha-search");
    assert.equal(alpha.findingFiles.length, 1, "the unreadable round is skipped, not counted as empty");
    assert.equal(records.ci, null);
    const lines = records.problems.filter((p) => p.includes("could not be read"));
    assert.equal(lines.length, 2);
    assert.ok(lines.some((l) => l.startsWith(".work/tasks/alpha-search/findings-1.md:")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith(".work/ci-runs.jsonl:")), lines.join("\n"));
    assert.ok(!records.problems.join("\n").includes("EACCES"));
    assert.ok(!records.problems.join("\n").includes(root), "a relative path, not the machine's");
    const { result, json } = runCli(root);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(json.gaps.some((g) => g.includes("findings-1.md")));
  } finally {
    chmodSync(bad, 0o644);
    chmodSync(ledger, 0o644);
  }
});

test("parseDecision: a title or answer date that is not a real day is flagged, never read as a day", () => {
  const bad = parseDecision("# Decisions needed: x (2026-13-45)\n\n**Answered:** 2026-01-02, accept all\n");
  assert.equal(bad.date, null);
  assert.equal(bad.badTitleDate, true);
  assert.equal(parseDecision("no title").badTitleDate, false);
  assert.equal(parseDecision("# Decisions needed: x (2026-01-10)\n").badTitleDate, false);
  const worse = parseDecision("# Decisions needed: x (2026-01-10)\n\n**Answered:** 2026-02-31, changed 2\n");
  assert.deepEqual(worse.answered, { date: null, kind: "changed", changed: 2 });
});

test("questions: a batch with a bad title date or answer date gets its own gap, never a silent file-time wait", () => {
  const decisions = [
    // The file time put this batch in the period; its title date is not a day. A wait read from it would be 19 days.
    { date: "2026-03-01", badTitleDate: true, answered: { date: "2026-03-20", kind: "all", changed: 0 } },
    { date: "2026-03-02", badTitleDate: false, answered: { date: null, kind: "all", changed: 0 } },
    { date: "2026-03-05", badTitleDate: false, answered: { date: "2026-03-08", kind: "all", changed: 0 } },
  ];
  const out = compute(records({ decisions }), opts);
  assert.equal(out.questions.answered, 3);
  assert.equal(out.questions.medianWaitDays, 3, "only the sound batch has a wait");
  assert.ok(out.gaps.some((g) => g.includes("title date is not a real day")), out.gaps.join("\n"));
  assert.ok(out.gaps.some((g) => g.includes("answered date is not a real day")), out.gaps.join("\n"));
  assert.ok(!out.gaps.some((g) => g.includes("answered before it was asked")));
});

test("loadRecords: a bad title date keeps the file's day for the period but is flagged", () => {
  const root = copyFixture();
  writeFileSync(
    join(root, ".work/decisions/bad-date.md"),
    "# Decisions needed: x (2026-13-45)\n\n**Answered:** 2026-01-02, accept all\n",
  );
  const found = loadRecords({ root, noGh: true }).decisions.find((d) => d.badTitleDate);
  assert.ok(found, "the batch is read");
  assert.match(found.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("parseTokenReport: only plain integers and shares from 0 to 100 are read, the rest is counted as rejected", () => {
  const report = (median, rows) =>
    parseTokenReport(`**Tokens per task (median):** ${median}\n\n| Model | Share |\n| --- | --- |\n${rows}\n`);
  for (const bad of ["1e99", "1.5", "-3", "12abc", "0x10", "1,2", ""]) {
    const parsed = report(bad, "| Big | 60% |");
    assert.equal(parsed.perTaskMedian, null, bad);
    assert.equal(parsed.rejected, 1, bad);
  }
  for (const [good, value] of [["1,250,000", 1250000], ["1_250_000", 1250000], ["42", 42], ["0", 0]]) {
    const parsed = report(good, "| Big | 60% |");
    assert.equal(parsed.perTaskMedian, value, good);
    assert.equal(parsed.rejected, 0, good);
  }
  const shares = report("5", "| A | 100% |\n| B | 0 |\n| C | 101% |\n| D | 1e3 |\n| E | n/a |");
  assert.deepEqual(shares.byModel, [{ model: "A", share: 100 }, { model: "B", share: 0 }]);
  assert.equal(shares.rejected, 3);
});

test("tokens: rejected values become a gap, and a share above 100 never reaches the strong-model measure", () => {
  const tokens = [{ date: "2026-03-05", perTaskMedian: null, byModel: [{ model: "Big", share: 40 }], rejected: 2 }];
  const out = compute(records({ tokens }), opts);
  assert.ok(out.gaps.some((g) => g.startsWith("tokens:") && g.includes("2")), out.gaps.join("\n"));
});
