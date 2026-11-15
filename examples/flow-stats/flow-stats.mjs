#!/usr/bin/env node
/**
 * Example flow statistics: counts what the agent workflow left in a project's `.work` folder and
 * writes one JSON file: how long tasks take, what review found, how many fix rounds, how often CI
 * failed for real or only by load, how long questions waited, where the tokens went, and at most
 * three suggestions for the thresholds that were crossed. A page can embed that file as its data.
 *
 * Usage: node flow-stats.mjs --root <project> --out <file.json> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                            [--no-gh] [--strong-model <substring>]
 *
 * It reads and counts; it never asks a model and never guesses. A record that is missing gives
 * `null` and a line in `gaps`, so a gap shows on the page as "not found" instead of as a zero. It
 * writes only `--out`. Everything it reads is data: file text is parsed with patterns, never run,
 * and no path is built from file content.
 *
 * The folder layout and the output fields are in README.md beside this file. Copy the folder into
 * your project, keep the parsers, and change THRESHOLDS to the rules you want.
 */
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE =
  "Usage: node flow-stats.mjs --root <project> --out <file.json> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--no-gh] [--strong-model <substring>]";

const DAY_MS = 86_400_000;
/** A file larger than this is skipped with a gap: it is no report, and reading it all would only cost memory. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Severities as written in findings files. The second spelling is accepted so older files still count. */
const SEVERITIES = new Map([
  ["critical", "critical"],
  ["high", "high"],
  ["medium", "medium"],
  ["low", "low"],
  ["blocker", "critical"],
  ["important", "high"],
  ["minor", "low"],
]);

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

/**
 * A calendar day as UTC milliseconds, or null. The round trip refuses a day that does not exist
 * (2026-02-31), which `Date.UTC` alone would roll into March.
 *
 * @param {unknown} text - a `YYYY-MM-DD` string.
 * @returns {number | null} midnight UTC of that day.
 */
export function parseDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const ms = Date.UTC(+text.slice(0, 4), +text.slice(5, 7) - 1, +text.slice(8, 10));
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== text ? null : ms;
}

/** The UTC day of a time, so two machines in different zones put a task on the same day. */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Median of numbers, null for none: the middle one, or the mean of the two middle ones.
 *
 * @param {number[]} values - the samples.
 * @returns {number | null} the median.
 */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The 90th percentile by nearest rank, null for none. Nearest rank always returns a value that was
 * measured, which is easier to explain than an interpolated one.
 *
 * @param {number[]} values - the samples.
 * @returns {number | null} the value at rank ceil(0.9 * n).
 */
export function p90(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.9) - 1];
}

/** Days between two times, or null when either is missing or the order is wrong (file times can lie). */
/** A batch's wait in days: null with no real title date or answer date, and when the answer came first. */
const waitOf = (d) => (d.badTitleDate || !d.answered?.date ? null : span(parseDay(d.date), parseDay(d.answered.date)));

const span = (from, to) => (from == null || to == null || to < from ? null : (to - from) / DAY_MS);

/** Cells of one Markdown table row; an escaped `\|` stays inside its cell. */
function cells(line) {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((cell) => cell.replaceAll("\\|", "|").trim());
}

/** Rows of the first table whose header holds every wanted column; `index` maps a column name to its position. */
function tableRows(text, wanted) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith("|")) continue;
    const head = cells(lines[i]).map((cell) => cell.toLowerCase());
    const index = new Map(wanted.map((name) => [name, head.indexOf(name)]));
    if ([...index.values()].some((at) => at === -1)) continue;
    const rows = [];
    for (let j = i + 1; j < lines.length && lines[j].trim().startsWith("|"); j += 1) {
      const row = cells(lines[j]);
      if (row.every((cell) => /^:?-+:?$/.test(cell))) continue; // the separator line
      rows.push(row);
    }
    return { index, rows };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Parsers: text in, plain data out. A value that cannot be read is null, never a guess.
// ---------------------------------------------------------------------------------------------

/**
 * Reads a findings file: its reviewers and its findings. A finding whose "What is wrong" cell starts
 * with `Claim:` is a builder claim that did not hold. A severity this script does not know is
 * counted in `unrecognized` and left out of every count, because ranking it would be a guess.
 *
 * @param {string} text - the file.
 * @returns {{reviewers: string[], findings: {severity: string, claim: boolean}[], unrecognized: number}} what it holds.
 */
export function parseFindings(text) {
  const line = /\*\*Reviewers:\*\*[ \t]*([^\n]*)/.exec(text);
  const reviewers = line
    ? [
        ...new Set(
          line[1]
            .split("**")[0]
            .split(",")
            .map((role) => role.trim().replaceAll("`", ""))
            .filter((role) => role && !/^<.*>$/.test(role)),
        ),
      ]
    : [];
  const table = tableRows(text, ["severity", "what is wrong"]);
  const findings = [];
  let unrecognized = 0;
  for (const row of table?.rows ?? []) {
    const raw = (row[table.index.get("severity")] ?? "").toLowerCase().replace(/[*`_\s]/g, "");
    const severity = SEVERITIES.get(raw);
    if (severity === undefined) {
      unrecognized += 1;
      continue;
    }
    const wrong = (row[table.index.get("what is wrong")] ?? "").replace(/^[*_`\s]+/, "");
    findings.push({ severity, claim: wrong.startsWith("Claim:") });
  }
  return { reviewers, findings, unrecognized };
}

/**
 * Reads a re-check: how many new problems it found.
 *
 * @param {string} text - the file.
 * @returns {number | null} the count, or null when the line is missing (the file then counts for nothing).
 */
export function parseRecheck(text) {
  const match = /\*\*New problems:\*\*[ \t]*(\d+)\b/.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * Reads a decision batch: the day it was asked (the title's date) and, once answered, the day and how.
 * "changed 0" is the same as accepting all, so it reads as `all`.
 *
 * A date of the right shape that is not a real day (`2026-13-45`) is never read as one: the title's
 * gives `date: null` with `badTitleDate: true`, the answer's gives `answered.date: null`. The
 * batch was still answered; only its wait cannot be told.
 *
 * @param {string} text - the file.
 * @returns {{date: string | null, badTitleDate: boolean, answered: null | {date: string | null, kind: "all" | "changed", changed: number}}} the batch.
 */
export function parseDecision(text) {
  const title = /^# Decisions needed:.*\((\d{4}-\d{2}-\d{2})\)[ \t]*$/m.exec(text);
  const date = title && parseDay(title[1]) !== null ? title[1] : null;
  const badTitleDate = title !== null && date === null;
  const answer = /^\*\*Answered:\*\*[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*,[ \t]*(accept all|changed[ \t]+(\d+))/im.exec(text);
  if (!answer) return { date, badTitleDate, answered: null };
  const changed = answer[3] === undefined ? 0 : Number(answer[3]);
  const answeredDate = parseDay(answer[1]) === null ? null : answer[1];
  return { date, badTitleDate, answered: { date: answeredDate, kind: changed > 0 ? "changed" : "all", changed } };
}

/**
 * Reads a token report: the median tokens per task and each model's share in percent.
 *
 * @param {string} text - the file.
 * Only a plain non-negative integer is a token count (digits, with `,`, `_` or a space between
 * groups of three) and only 0 to 100 is a share: `1e99` is not read as 1, and 250% never feeds the
 * strong-model threshold. Whatever else is there is left out and counted in `rejected`.
 *
 * @param {string} text - the file.
 * @returns {{perTaskMedian: number | null, byModel: {model: string, share: number}[], rejected: number}} what it holds, and how many values were left out.
 */
export function parseTokenReport(text) {
  let rejected = 0;
  const line = /\*\*Tokens per task \(median\):\*\*[ \t]*([^\n]*)/.exec(text);
  let perTaskMedian = null;
  if (line) {
    const value = line[1].trim();
    if (/^(?:\d+|\d{1,3}(?:[,_ ]\d{3})+)$/.test(value)) perTaskMedian = Number(value.replace(/[,_ ]/g, ""));
    else rejected += 1;
  }
  const table = tableRows(text, ["model", "share"]);
  const byModel = [];
  for (const row of table?.rows ?? []) {
    const model = row[table.index.get("model")] ?? "";
    const share = /^(\d+(?:\.\d+)?)[ \t]*%?$/.exec(row[table.index.get("share")] ?? "");
    if (!model) continue;
    if (share && Number(share[1]) <= 100) byModel.push({ model, share: Number(share[1]) });
    else rejected += 1;
  }
  return { perTaskMedian, byModel, rejected };
}

/**
 * Reads the CI ledger, one JSON object per line. A line that is not a run is counted as malformed
 * instead of dropped without a word. `flaky` with a failed result contradicts itself, so it is
 * malformed too.
 *
 * @param {string} text - the file.
 * @returns {{runs: {date: string, result: "pass" | "fail", flaky: boolean}[], malformed: number}} the runs.
 */
export function parseCiLedger(text) {
  const runs = [];
  let malformed = 0;
  for (const line of text.split("\n").filter((l) => l.trim())) {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      malformed += 1;
      continue;
    }
    const ok =
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.hasOwn(value, "date") &&
      parseDay(value.date) !== null &&
      Object.hasOwn(value, "result") &&
      (value.result === "pass" || value.result === "fail") &&
      Object.hasOwn(value, "flaky") &&
      typeof value.flaky === "boolean" &&
      !(value.flaky && value.result === "fail");
    if (ok) runs.push({ date: value.date, result: value.result, flaky: value.flaky });
    else malformed += 1;
  }
  return { runs, malformed };
}

/** The branch a brief names in its header, or null. Checked against a plain name so it can go to git and gh as an argument. */
export function parseBranch(text) {
  const head = text.split("\n").slice(0, 20).join("\n");
  const match = /^\*\*Branch:\*\*[ \t]*`?([^\s`]+)`?/m.exec(head);
  return match && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(match[1]) ? match[1] : null;
}

/**
 * When a branch reached the main branch, from the main line's log. A merge commit names the branch
 * in its message; a squash commit may too. The name must stand alone: `feat/x` is not in `feat/x2`
 * or `afeat/x`.
 *
 * @param {{time: number, text: string}[]} log - commits on the main line, with their message text.
 * @param {string} branch - the branch name.
 * @returns {number | null} the commit time in milliseconds, or null.
 */
export function findMergeTime(log, branch) {
  const escaped = branch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // A slash may come before the name (`from owner/feat/x`) but not after it, where it would continue the name.
  const named = new RegExp(`(?<![A-Za-z0-9._-])${escaped}(?![A-Za-z0-9._/-])`);
  const times = log.filter((commit) => named.test(commit.text)).map((commit) => commit.time);
  return times.length ? Math.min(...times) : null;
}

// ---------------------------------------------------------------------------------------------
// Thresholds: the table the skill shows, as data. Crossed means strictly past: exactly at is not.
// ---------------------------------------------------------------------------------------------

/**
 * Each rule reads the counted numbers (`raw`) and returns null when it cannot judge, or how it
 * stands. `over` is the value divided by its limit, so rules of different kinds rank together.
 * Percent rules compare whole numbers (`count * 100 > limit * total`): a share of exactly 20% must
 * not tip over because of a rounding error in a division.
 */
const percentRule = (count, total, limit, noun) =>
  total > 0
    ? {
        crossed: count * 100 > limit * total,
        over: (count * 100) / (limit * total),
        value: `${count} of ${total} ${noun} (${round1((count * 100) / total)}%)`,
      }
    : null;

/**
 * The rules, in the order they rank on a tie.
 *
 * @type {{id: string, measure: string, crossed: string, skill: string, text: string, read: (raw: object) => ({crossed: boolean, over: number, value: string} | null)}[]}
 */
export const THRESHOLDS = [
  {
    id: "second-round",
    measure: "tasks with 2 or more fix rounds",
    crossed: "> 20% of tasks",
    skill: "write-brief, fix-round",
    text: "Name the known traps and the tests to run in each brief; one fresh fixer per round.",
    read: (r) => percentRule(r.secondRound, r.reviewed, 20, "tasks"),
  },
  {
    id: "new-breakage",
    measure: "re-checks that found a new problem",
    crossed: "> 10% of re-checks",
    skill: "fix-round",
    text: "The fixer writes the failing test first; the re-check probes that nothing got looser.",
    read: (r) => percentRule(r.newBreakage, r.rechecks, 10, "re-checks"),
  },
  {
    id: "critical",
    measure: "findings that are critical",
    crossed: "> 15% of findings",
    skill: "review-panel",
    text: "Review the plan (architect or security) before anything is built.",
    read: (r) => percentRule(r.critical, r.findings, 15, "findings"),
  },
  {
    id: "claims",
    measure: "reports with a claim that did not hold",
    crossed: "> 5% of reports",
    skill: "run-task",
    text: "The reviewer re-runs one claimed test per task; reports paste their output.",
    read: (r) => percentRule(r.didNotHold, r.reports, 5, "reports"),
  },
  {
    id: "flaky",
    measure: "local CI runs that failed only on load or timing",
    crossed: "> 10% of runs",
    skill: "local-ci",
    text: "One heavy run at a time, and run only what the change affects.",
    read: (r) => percentRule(r.flaky, r.ciRuns, 10, "runs"),
  },
  {
    id: "owner-wait",
    measure: "median days to answer a batch",
    crossed: "> 2 days",
    skill: "decision-batch",
    text: "Run the question sweep before the build, so answers arrive first.",
    read: (r) =>
      r.medianWait == null
        ? null
        : { crossed: r.medianWait > 2, over: r.medianWait / 2, value: `${round1(r.medianWait)} days` },
  },
  {
    id: "strong-model",
    measure: "token share of the strongest model",
    crossed: "> 50%",
    skill: "token-review",
    text: "Builders and fixers on the middle model; the strongest only for security, money and architecture.",
    read: (r) =>
      r.strongShare == null
        ? null
        : { crossed: r.strongShare > 50, over: r.strongShare / 50, value: `${round1(r.strongShare)}%` },
  },
  {
    id: "slow-tail",
    measure: "slowest tasks",
    crossed: "p90 > 3 × median",
    skill: "write-brief",
    text: "Split the kind of task the slowest tail shows; one task per fresh agent.",
    // With a median of zero days every task finished the day it started; any p90 would be "past 3 times 0".
    read: (r) =>
      r.medianDays == null || r.p90Days == null || r.medianDays <= 0
        ? null
        : {
            crossed: r.p90Days > 3 * r.medianDays,
            over: r.p90Days / (3 * r.medianDays),
            value: `p90 ${round1(r.p90Days)} days, median ${round1(r.medianDays)} days`,
          },
  },
];

/**
 * Every crossed threshold, ranked by how far past its limit, at most three. Equal ranks keep the
 * table's order, so the same numbers always give the same list.
 *
 * @param {object} raw - the counted numbers the rules read (see THRESHOLDS).
 * @returns {{id: string, measure: string, value: string, threshold: string, skill: string, text: string, status: "proposed"}[]} the suggestions.
 */
export function suggest(raw) {
  return THRESHOLDS.map((rule, order) => ({ rule, order, read: rule.read(raw) }))
    .filter((entry) => entry.read?.crossed)
    .sort((a, b) => b.read.over - a.read.over || a.order - b.order)
    .slice(0, 3)
    .map(({ rule, read }) => ({
      id: rule.id,
      measure: rule.measure,
      value: read.value,
      threshold: rule.crossed,
      skill: rule.skill,
      text: rule.text,
      status: "proposed",
    }));
}

// ---------------------------------------------------------------------------------------------
// compute: records in, the output JSON out. Pure, so the tests give it records directly.
// ---------------------------------------------------------------------------------------------

/**
 * Turns what was read into the output document. It counts and divides; a measure with no record
 * behind it is null and adds a line to `gaps`.
 *
 * Records, as the loader builds them:
 * - `tasks`: `{id, start, times: {brief, report, findings1, lastFix, last, merged}, findingFiles: [{reviewers, findings}], rechecks, hasReport}`, times in milliseconds or null. One findings file is one fix round.
 * - `decisions`: `{date, badTitleDate, answered}` as parseDecision gives, with `date` filled in.
 * - `ci`: `{runs, malformed}` or null.
 * - `tokens`: `[{date, perTaskMedian, byModel}]`.
 * - `problems`: gap lines the loader already has (unreadable files, unrecognized severities).
 *
 * @param {object} records - what the loader read.
 * @param {{project: string, generated: string, from?: string, to?: string, strongModel?: string}} options - the period and the labels.
 * @returns {object} the output document.
 */
export function compute(records, options) {
  const { generated, strongModel = "opus" } = options;
  const gaps = [...(records.problems ?? [])];
  const inRange = (day) => (!options.from || day >= options.from) && (!options.to || day <= options.to);

  const tasks = records.tasks
    .filter((t) => t.start != null && inRange(dayOf(t.start)))
    .map((t) => ({ ...t, rounds: t.findingFiles.length, findings: t.findingFiles.flatMap((f) => f.findings) }));
  const decisions = records.decisions.filter((d) => d.date && inRange(d.date));
  const runs = (records.ci?.runs ?? []).filter((run) => inRange(run.date));
  const reports = records.tokens.filter((r) => r.date && inRange(r.date)).sort((a, b) => a.date.localeCompare(b.date));

  const days = [];
  const stage = { building: [], review: [], fixing: [] };
  for (const task of tasks) {
    const t = task.times;
    const total = span(t.brief, t.merged ?? t.last);
    if (total != null) days.push({ task: task.id, days: total });
    const built = span(t.brief, t.report);
    if (built != null) stage.building.push(built);
    // Reviewed with no findings: the review lasted until the merge. With findings: until the first one.
    const reviewed = task.rounds > 0 ? span(t.report, t.findings1) : span(t.report, t.merged);
    if (reviewed != null) stage.review.push(reviewed);
    const fixed = task.rounds > 0 ? span(t.findings1, t.lastFix) : null;
    if (fixed != null) stage.fixing.push(fixed);
  }
  const unmerged = tasks.filter((t) => t.times.merged == null).length;
  if (tasks.length === 0) gaps.push("time: no task folders in this period");
  else if (unmerged > 0)
    gaps.push(`time: merge time not found for ${unmerged} of ${tasks.length} tasks, the last file's time is used instead`);

  const dayValues = days.map((d) => d.days);
  let time = null;
  if (tasks.length > 0) {
    const stages = {};
    for (const name of Object.keys(stage)) {
      const value = median(stage[name]);
      stages[name] = value == null ? null : round1(value);
      if (value == null) gaps.push(`time.stages.${name}: no task has both records`);
    }
    if (dayValues.length === 0) gaps.push("time: no task has a brief and a later file");
    time = {
      medianDays: dayValues.length ? round1(median(dayValues)) : null,
      p90Days: dayValues.length ? round1(p90(dayValues)) : null,
      stages,
      slowest: [...days]
        .sort((a, b) => b.days - a.days || a.task.localeCompare(b.task))
        .slice(0, 3)
        .map((d) => ({ task: d.task, days: round1(d.days) })),
    };
  }

  // A task is reviewable once it has a report or a findings file; without either nothing can be said about it.
  const reviewed = tasks.filter((t) => t.hasReport || t.rounds > 0);
  const findings = reviewed.flatMap((t) => t.findings);
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) bySeverity[finding.severity] += 1;
  const roles = new Map();
  // A file's findings are credited to each reviewer it names: the table does not say who found which.
  for (const file of reviewed.flatMap((t) => t.findingFiles))
    for (const role of file.reviewers) roles.set(role, (roles.get(role) ?? 0) + file.findings.length);

  let review = null;
  let fixRounds = null;
  if (reviewed.length > 0) {
    review = {
      tasks: reviewed.length,
      blocking: reviewed.filter((t) => t.findings.some((f) => f.severity !== "low")).length,
      bySeverity,
      byReviewer: [...roles]
        .map(([role, count]) => ({ role, findings: count }))
        .sort((a, b) => b.findings - a.findings || a.role.localeCompare(b.role)),
    };
    const distribution = { 0: 0, 1: 0, 2: 0, "3+": 0 };
    for (const task of reviewed) distribution[task.rounds >= 3 ? "3+" : task.rounds] += 1;
    const rechecks = reviewed.flatMap((t) => t.rechecks).filter((n) => n != null);
    fixRounds = {
      distribution,
      rechecks: rechecks.length,
      newBreakage: rechecks.filter((n) => n > 0).length,
    };
  } else gaps.push("review, fixRounds: no report or findings files in this period");

  const withReport = tasks.filter((t) => t.hasReport);
  const claims = withReport.length
    ? { reports: withReport.length, didNotHold: withReport.filter((t) => t.findings.some((f) => f.claim)).length }
    : null;
  if (claims === null) gaps.push("claims: no report files in this period");

  let ci = null;
  if (runs.length > 0) {
    const flaky = runs.filter((r) => r.flaky).length;
    const realFailures = runs.filter((r) => r.result === "fail").length;
    ci = { runs: runs.length, pass: runs.length - flaky - realFailures, realFailures, flaky };
  } else gaps.push("ci: no runs recorded in this period");

  let questions = null;
  if (decisions.length > 0) {
    const answered = decisions.filter((d) => d.answered);
    const badAsked = answered.filter((d) => d.badTitleDate).length;
    const badAnswered = answered.filter((d) => d.answered.date === null).length;
    const waits = answered.map(waitOf).filter((w) => w != null);
    const backwards = answered.filter((d) => !d.badTitleDate && d.answered.date !== null && waitOf(d) === null).length;
    if (badAsked > 0) gaps.push(`questions: title date is not a real day in ${badAsked} answered batch(es), the wait is left out`);
    if (badAnswered > 0) gaps.push(`questions: answered date is not a real day in ${badAnswered} answered batch(es), the wait is left out`);
    if (backwards > 0) gaps.push("questions: a batch was answered before it was asked, its wait is left out");
    if (waits.length === 0) gaps.push("questions.medianWaitDays: no answered batch");
    questions = {
      batches: decisions.length,
      answered: answered.length,
      acceptedAll: answered.filter((d) => d.answered.kind === "all").length,
      changed: answered.filter((d) => d.answered.kind === "changed").length,
      medianWaitDays: waits.length ? round1(median(waits)) : null,
    };
  } else gaps.push("questions: no decision batches in this period");

  let tokens = null;
  const latest = reports.at(-1);
  if (latest) {
    if (latest.perTaskMedian == null) gaps.push("tokens.perTaskMedian: the report has no 'Tokens per task (median)' line");
    if (latest.byModel.length === 0) gaps.push("tokens.byModel: the report has no model table");
    if (latest.rejected > 0) gaps.push(`tokens: ${latest.rejected} value(s) in the report are not a plain whole number or a share from 0 to 100, left out`);
    tokens = {
      perTaskMedian: latest.perTaskMedian,
      byModel: [...latest.byModel].sort((a, b) => b.share - a.share || a.model.localeCompare(b.model)),
    };
  } else gaps.push("tokens: no token report in this period");

  const needle = strongModel.toLowerCase();
  const raw = {
    reviewed: reviewed.length,
    secondRound: reviewed.filter((t) => t.rounds >= 2).length,
    rechecks: fixRounds?.rechecks ?? 0,
    newBreakage: fixRounds?.newBreakage ?? 0,
    findings: findings.length,
    critical: bySeverity.critical,
    reports: claims?.reports ?? 0,
    didNotHold: claims?.didNotHold ?? 0,
    ciRuns: ci?.runs ?? 0,
    flaky: ci?.flaky ?? 0,
    medianWait: median(
      decisions.filter((d) => d.answered).map(waitOf).filter((w) => w != null),
    ),
    strongShare: latest?.byModel.length
      ? latest.byModel.filter((m) => m.model.toLowerCase().includes(needle)).reduce((sum, m) => sum + m.share, 0)
      : null,
    medianDays: median(dayValues),
    p90Days: p90(dayValues),
  };

  const everyDay = [
    ...tasks.map((t) => dayOf(t.start)),
    ...decisions.map((d) => d.date),
    ...runs.map((r) => r.date),
    ...reports.map((r) => r.date),
  ].sort();
  return {
    meta: {
      project: options.project,
      generated,
      from: options.from ?? everyDay[0] ?? generated,
      to: options.to ?? generated,
      tasks: tasks.length,
    },
    time,
    review,
    fixRounds,
    claims,
    ci,
    questions,
    tokens,
    gaps,
    suggestions: suggest(raw),
  };
}

// ---------------------------------------------------------------------------------------------
// The loader and the command line: the only parts that touch files, git and gh.
// ---------------------------------------------------------------------------------------------

/**
 * Reads the command line. An unknown option is refused rather than ignored: a misspelt flag must
 * not quietly turn into a different run.
 *
 * @param {string[]} argv - the arguments after the script name.
 * @returns {{root?: string, out?: string, from?: string, to?: string, noGh: boolean, strongModel: string, problem: string | null}} the options.
 */
export function parseArgs(argv) {
  const opts = { noGh: false, strongModel: "opus", problem: null };
  const values = new Map([
    ["--root", "root"],
    ["--out", "out"],
    ["--from", "from"],
    ["--to", "to"],
    ["--strong-model", "strongModel"],
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-gh") opts.noGh = true;
    else if (values.has(arg)) {
      const value = argv[(i += 1)];
      if (!value || value.startsWith("-")) return { ...opts, problem: `${arg} needs a value\n${USAGE}` };
      opts[values.get(arg)] = value;
    } else return { ...opts, problem: `unknown argument ${arg}\n${USAGE}` };
  }
  if (!opts.root || !opts.out) return { ...opts, problem: `--root and --out are required\n${USAGE}` };
  for (const key of ["from", "to"])
    if (opts[key] !== undefined && parseDay(opts[key]) === null)
      return { ...opts, problem: `--${key} must be a real day as YYYY-MM-DD\n${USAGE}` };
  if (opts.from && opts.to && opts.from > opts.to) return { ...opts, problem: `--from is after --to\n${USAGE}` };
  return opts;
}

/** True when `path` really lies under `root`, symbolic links resolved: a link must not lead a read out of the project. */
function within(root, path) {
  try {
    const base = realpathSync(root);
    const real = realpathSync(path);
    return real === base || real.startsWith(base + sep);
  } catch {
    return false;
  }
}

/** Entries of a folder as `{name, path, ms}`; symbolic links and anything outside the root are not entries. */
function listFiles(root, dir, kind) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => (kind === "dir" ? e.isDirectory() : e.isFile()))
    .map((e) => ({ name: e.name, path: join(dir, e.name), rel: relative(root, join(dir, e.name)) }))
    .filter((e) => within(root, e.path))
    .map((e) => {
      const stat = lstatSync(e.path);
      // The first write: a birth time when the system keeps one, never later than the last write.
      return { ...e, ms: Math.min(stat.birthtimeMs || Infinity, stat.mtimeMs), size: stat.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The text of a file, or null with a problem line when it is too large to be a report or cannot be
 * read. The line names the file by its path inside the project and quotes no error text, which
 * could carry a path from the machine.
 */
function readText(file, problems) {
  if (file.size > MAX_FILE_BYTES) {
    problems.push(`${file.name}: larger than ${MAX_FILE_BYTES / 1024 / 1024} MiB, not read`);
    return null;
  }
  try {
    return readFileSync(file.path, "utf8");
  } catch {
    problems.push(`${file.rel}: could not be read, left out`);
    return null;
  }
}

/** Reads each file and keeps the ones that could be read, as `{file, text}`: an unreadable record is skipped, not read as empty. */
function readable(files, problems) {
  return files.map((file) => ({ file, text: readText(file, problems) })).filter((e) => e.text !== null);
}

/** The commits on the main line with their messages, or null when `root` is not itself a repository's top folder. */
function mainLineLog(root) {
  const run = (...args) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  const top = run("rev-parse", "--show-toplevel");
  // A project folder inside someone else's repository must not read that repository's history.
  if (top.status !== 0 || realpathSync(top.stdout.trim()) !== realpathSync(root)) return null;
  const branch = ["main", "master"].find((name) => run("rev-parse", "--verify", "--quiet", name).status === 0);
  if (!branch) return null;
  const log = run("log", "--first-parent", "--format=%ct%x1f%s%x1f%b%x1e", branch);
  if (log.status !== 0) return null;
  return log.stdout
    .split("\x1e")
    .map((entry) => entry.trim().split("\x1f"))
    .filter((parts) => parts.length >= 2 && /^\d+$/.test(parts[0]))
    .map((parts) => ({ time: Number(parts[0]) * 1000, text: `${parts[1]}\n${parts[2] ?? ""}` }));
}

/** The merge time `gh` knows for a branch's merged pull request, or null (no gh, no login, no such pull request). */
function ghMergedAt(root, branch) {
  const result = spawnSync("gh", ["pr", "list", "--head", branch, "--state", "merged", "--json", "mergedAt"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  try {
    const times = JSON.parse(result.stdout).map((pr) => Date.parse(pr?.mergedAt)).filter((ms) => !Number.isNaN(ms));
    return times.length ? Math.min(...times) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the `.work` folder of a project into the records `compute` takes. Nothing here guesses: a
 * file that is not there leaves its field null.
 *
 * @param {{root: string, noGh: boolean}} options - the project folder, and whether `gh` may be asked.
 * @returns {object} the records.
 */
export function loadRecords({ root, noGh }) {
  const problems = [];
  const work = join(root, ".work");
  const log = mainLineLog(root);
  const mergeOf = (branch) => {
    if (!branch) return null;
    return (log ? findMergeTime(log, branch) : null) ?? (noGh ? null : ghMergedAt(root, branch));
  };

  const tasks = [];
  for (const dir of listFiles(root, join(work, "tasks"), "dir")) {
    const files = listFiles(root, dir.path, "file");
    if (files.length === 0) continue;
    const named = (pattern) => files.filter((f) => pattern.test(f.name));
    const one = (name) => files.find((f) => f.name === name);
    const findingsRead = readable(named(/^findings-\d+\.md$/), problems).sort(
      (a, b) => Number(a.file.name.match(/\d+/)[0]) - Number(b.file.name.match(/\d+/)[0]),
    );
    const findingsFiles = findingsRead.map((e) => e.file);
    const rechecksRead = readable(named(/^recheck-\d+\.md$/), problems);
    const fixFiles = [...named(/^fix-report(-\d+)?\.md$/), ...rechecksRead.map((e) => e.file)];
    const parsed = findingsRead.map((e) => parseFindings(e.text));
    const unrecognized = parsed.reduce((sum, p) => sum + p.unrecognized, 0);
    if (unrecognized > 0) problems.push(`${dir.name}: ${unrecognized} finding(s) with a severity this script does not know, left out`);
    const rechecks = rechecksRead.map((e) => parseRecheck(e.text));
    if (rechecks.includes(null)) problems.push(`${dir.name}: a re-check has no "New problems" line, left out`);
    const brief = one("brief.md");
    const briefText = brief ? readText(brief, problems) : null;
    const branch = briefText === null ? null : parseBranch(briefText);
    tasks.push({
      id: dir.name,
      start: Math.min(...files.map((f) => f.ms)),
      times: {
        brief: brief?.ms ?? null,
        report: one("report.md")?.ms ?? null,
        findings1: findingsFiles[0]?.ms ?? null,
        lastFix: fixFiles.length ? Math.max(...fixFiles.map((f) => f.ms)) : null,
        last: Math.max(...files.map((f) => f.ms)),
        merged: mergeOf(branch),
      },
      findingFiles: parsed.map((p) => ({ reviewers: p.reviewers, findings: p.findings })),
      rechecks,
      hasReport: Boolean(one("report.md")),
    });
  }
  const decisions = listFiles(root, join(work, "decisions"), "file")
    .filter((f) => f.name.endsWith(".md"))
    .flatMap((f) => {
      const text = readText(f, problems);
      if (text === null) return [];
      // A title date that is no real day keeps the file's day only to place the batch in a period;
      // `badTitleDate` stops it from being used as the day it was asked.
      const parsed = parseDecision(text);
      return [{ ...parsed, date: parsed.date ?? dayOf(f.ms) }];
    });

  const ledgerFile = listFiles(root, work, "file").find((f) => f.name === "ci-runs.jsonl");
  const ledgerText = ledgerFile ? readText(ledgerFile, problems) : null;
  const ci = ledgerText === null ? null : parseCiLedger(ledgerText);
  if (ci && ci.malformed > 0) problems.push(`ci: ${ci.malformed} line(s) in ci-runs.jsonl are not a run, left out`);

  const tokens = listFiles(root, join(work, "token-review"), "file")
    .map((f) => ({ file: f, date: f.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1] ?? null }))
    .filter((e) => e.date && parseDay(e.date) !== null)
    .flatMap((e) => {
      const text = readText(e.file, problems);
      return text === null ? [] : [{ date: e.date, ...parseTokenReport(text) }];
    });

  return { tasks, decisions, ci, tokens, problems };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.problem) {
    console.error(opts.problem);
    return 2;
  }
  const root = resolve(opts.root);
  const records = loadRecords({ root, noGh: opts.noGh });
  const result = compute(records, {
    project: basename(root),
    generated: dayOf(Date.now()),
    from: opts.from,
    to: opts.to,
    strongModel: opts.strongModel,
  });
  const out = resolve(opts.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `${result.meta.tasks} tasks, ${result.suggestions.length} suggestions, ${result.gaps.length} gaps, written to ${out}`,
  );
  return 0;
}

// The tests import from this file, so the run starts only when this file is the one executed.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
