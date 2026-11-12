/**
 * Optional part, off unless `--retry` is given: when a step fails only on test files the branch did
 * not touch, run just those files once more. A pass reads `PASS-on-retry` and lists the flaky
 * files; a failure stays a failure. A file the branch touched is never retried, because the branch
 * is the likely cause. The decisions are pure and tested on strings; only `touchedFiles` and
 * `retryStep` use git and processes.
 *
 * A step opts in with `retry: { pattern, summary, command }` in STEPS:
 * - `pattern`: a RegExp, one capture group, matching a line of the log that names a failed test file.
 * - `summary`: a RegExp, one capture group, matching the runner's own count of failed files. The
 *   count must equal the files named, or nothing is retried: a failure the pattern missed would
 *   otherwise be hidden by retrying only the ones it caught.
 * - `command`: what to run; `{files}` becomes the failed files.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Terminal colour and cursor codes, which test runners print even into a pipe under `CI=true`. */
const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;

/**
 * Reads the failed test files out of a step's log.
 *
 * @param {string} log - the whole log.
 * @param {{pattern: RegExp, summary: RegExp}} spec - the step's retry settings.
 * @returns {{files: string[], reported: number | null}} each file once, in first-seen order, and the runner's own count (null when its summary line is missing).
 */
export function parseFailures(log, { pattern, summary }) {
  const files = new Set();
  let reported = null;
  for (const line of log.replace(ANSI, "").split("\n")) {
    const named = pattern.exec(line);
    if (named) files.add(named[1].replace(/^\.\//, ""));
    const count = summary.exec(line);
    if (count) reported = (reported ?? 0) + Number(count[1]);
  }
  return { files: [...files], reported };
}

/**
 * Says whether the branch has a claim on a test file: the file changed, or anything beside it or
 * below it did. A test reads the helpers and fixtures of its own folder, so judging the file alone
 * would call a test a sibling edit broke somebody else's flake.
 *
 * @param {string} path - the test file, relative to the repository root.
 * @param {ReadonlySet<string>} touched - every path the branch changed.
 * @returns {boolean} true when the file or something in its folder changed.
 */
export function branchTouched(path, touched) {
  const folder = path.slice(0, path.lastIndexOf("/") + 1);
  if (touched.has(path)) return true;
  for (const changed of touched) if (changed.startsWith(folder)) return true;
  return false;
}

/**
 * Decides whether a failure may be retried. Anything uncertain means no retry.
 *
 * @param {{files: string[], reported: number | null}} failures - from {@link parseFailures}.
 * @param {ReadonlySet<string> | null} touched - the branch's changed paths; null when unknown.
 * @param {(path: string) => boolean} exists - whether a repository-relative file exists. A name the runner printed relative to some other folder cannot be compared with the changed paths, so it blocks the retry.
 * @returns {{files: string[] | null, note: string}} the files to run again, or null and the reason.
 */
export function planRetry(failures, touched, exists) {
  const no = (note) => ({ files: null, note: `not retried: ${note}` });
  if (touched === null) return no("could not work out which files the branch touched");
  if (failures.files.length === 0) return no("no failing test file found in the log");
  if (failures.reported === null) return no("the log has no failed-file count to check against");
  if (failures.reported !== failures.files.length)
    return no(`the runner reports ${failures.reported} failed, ${failures.files.length} named`);
  for (const file of failures.files) {
    // The name goes into a shell command line, so only plain path characters are accepted.
    if (!/^[\w@./-]+$/.test(file)) return no(`${file} has characters a command line cannot carry safely`);
    if (!exists(file)) return no(`${file} is not a path from the repository root`);
    if (branchTouched(file, touched)) return no(`${file} is in the branch's change`);
  }
  return { files: failures.files, note: `retrying ${failures.files.length} file(s) the branch did not touch` };
}

/**
 * Every path the branch changed since `base`: its commits, uncommitted changes and untracked files.
 * Renames list both names. If git cannot answer, the answer is unknown (null), never "nothing".
 *
 * @param {string} root - the checkout.
 * @param {string} base - the commit the branch left the main branch at.
 * @param {(args: string[]) => string | null} [git] - git's stdout or null on failure; replaceable in tests.
 * @returns {Set<string> | null} repository-relative paths, or null.
 */
export function touchedFiles(
  root,
  base,
  git = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return result.status === 0 ? result.stdout : null;
  },
) {
  // NUL-separated and unquoted: git otherwise prints a non-ASCII name as a quoted escape.
  const plain = ["-c", "core.quotePath=false"];
  const listings = [
    ["diff", "--name-only", "-z", "--no-renames", base],
    ["ls-files", "-z", "--others", "--exclude-standard"],
  ].map((args) => git([...plain, ...args]));
  if (listings.some((listing) => listing === null)) return null;
  return new Set(listings.flatMap((listing) => listing.split("\0")).filter(Boolean));
}

/**
 * Runs a failed step's retry, if the plan allows one.
 *
 * @param {{root: string, base: string | undefined, step: object, logText: string, env: object, run?: Function, touched?: Function, exists?: Function}} ctx - the checkout, the base (undefined in a full run with no merge base), the step with its `retry` settings, its log, and the environment. `run`, `touched` and `exists` are replaceable in tests.
 * @returns {{cleared: boolean, flakes: string[], note: string, output: string}} whether the step passed on retry, the flaky files, a line for the summary, and the retry's own output for the log.
 */
export function retryStep(ctx) {
  const { root, base, step, logText, env } = ctx;
  const run =
    ctx.run ??
    ((command) => {
      const r = spawnSync(command, { shell: true, cwd: root, env, encoding: "utf8", maxBuffer: 1 << 30 });
      return { code: r.status ?? 1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
    });
  const touched = base ? (ctx.touched ?? touchedFiles)(root, base) : null;
  const exists = ctx.exists ?? ((path) => existsSync(join(root, path)));
  const plan = planRetry(parseFailures(logText, step.retry), touched, exists);
  if (plan.files === null) return { cleared: false, flakes: [], note: plan.note, output: "" };
  const command = step.retry.command.replaceAll("{files}", plan.files.join(" "));
  const result = run(command);
  const output = `$ ${command}\n${result.output}`;
  if (result.code !== 0)
    return { cleared: false, flakes: [], note: "retry failed: the step stays FAIL", output };
  return { cleared: true, flakes: plan.files, note: "retry passed", output };
}
