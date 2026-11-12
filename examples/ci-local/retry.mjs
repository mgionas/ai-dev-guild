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
 *   otherwise be hidden by retrying only the ones it caught. Turborepo prints each line with a
 *   `<package>:<task>: ` prefix unless `--log-prefix=none` is given, so a pattern anchored at the
 *   start of the line must allow for it.
 *
 * Nothing is retried either when the log has an "Unhandled Errors" section, or when Turborepo's
 * `Failed:` line (or a "command finished with error" line) names a package with no failed test file:
 * those are failures the retry of one flaky file would hide.
 * - `command`: what to run when the log has no Turborepo prefixes (one runner at the repository
 *   root); `{files}` becomes the failed files, as the runner printed them.
 * - `packageCommand`: what to run for a log whose lines carry the prefix. The runner prints each
 *   path relative to its own package, so the retry runs in that package: `{package}` becomes the
 *   package's name, `{files}` its failed files. The package's folder is found from the workspace's
 *   `package.json` files, and "touched by the branch" is judged on the path from the repository
 *   root (folder plus relative path). A package that cannot be found means no retry.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Terminal colour and cursor codes, which test runners print even into a pipe under `CI=true`. */
const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;

/** Turborepo's prefix on every line of a task's output: `<package>:<task>: `. Absent with `--log-prefix=none`. */
const TURBO_PREFIX = /^(\S+?):[\w-]+: /;

/** The runner's heading for errors raised outside any test file: `Unhandled Errors`, or `Unhandled Error`. */
const UNHANDLED = /\bunhandled errors?\b/i;

/** Turborepo's closing summary of failed tasks: `Failed:    pkg-a#test, pkg-b#test`. */
const FAILED_TASKS = /\bFailed:\s+(\S.*)$/;

/**
 * Reads the failed test files out of a step's log, and every failure that names no file.
 *
 * @param {string} log - the whole log.
 * @param {{pattern: RegExp, summary: RegExp}} spec - the step's retry settings.
 * @returns {{files: {pkg: string | null, file: string}[], prefixed: boolean, reported: number | null, unhandled: boolean, unnamed: string[]}} each file once in first-seen order with the package its line named (null without a prefix); whether any line of the log carried a prefix; the runner's own count (null when its summary line is missing); whether an unhandled-error section is present; and the packages the build tool reports as failed that have no named file ("?" when the log cannot say which package a named file belongs to).
 */
export function parseFailures(log, { pattern, summary }) {
  const files = new Map();
  const filePackages = new Set();
  let prefixed = false;
  const failedPackages = new Set();
  let reported = null;
  let unhandled = false;
  let failedTasks = 0;
  for (const raw of log.replace(ANSI, "").split("\n")) {
    const line = raw.trimEnd();
    const prefix = TURBO_PREFIX.exec(line);
    if (prefix) prefixed = true;
    if (UNHANDLED.test(line)) unhandled = true;
    const named = pattern.exec(line);
    if (named) {
      const entry = { pkg: prefix?.[1] ?? null, file: named[1].replace(/^\.\//, "") };
      files.set(`${entry.pkg}\0${entry.file}`, entry);
      filePackages.add(entry.pkg);
    }
    const count = summary.exec(line);
    if (count) reported = (reported ?? 0) + Number(count[1]);
    if (prefix && /command finished with error/.test(line)) failedPackages.add(prefix[1]);
    const failed = FAILED_TASKS.exec(line);
    if (failed) {
      for (const task of failed[1].split(",")) {
        failedTasks += 1;
        failedPackages.add(task.trim().split("#")[0]);
      }
    }
  }
  // A failed package with no named file is a failure the parser cannot explain. A log without
  // prefixes cannot tell packages apart, so there more than one failed task is unexplained too.
  const unnamed = filePackages.has(null)
    ? failedTasks > 1 ? ["?"] : []
    : [...failedPackages].filter((name) => !filePackages.has(name));
  return { files: [...files.values()], prefixed, reported, unhandled, unnamed };
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
 * @param {{files: {pkg: string | null, file: string}[], prefixed: boolean, reported: number | null, unhandled: boolean, unnamed: string[]}} failures - from {@link parseFailures}.
 * @param {ReadonlySet<string> | null} touched - the branch's changed paths; null when unknown.
 * @param {(path: string) => boolean} exists - whether a repository-relative file exists.
 * @param {(pkg: string) => string | null} [folderOf] - the repository-relative folder of a workspace package ("" for the root), or null when it is unknown or ambiguous.
 * @returns {{files: string[] | null, runs: {pkg: string | null, files: string[]}[], note: string}} the files to run again (as paths from the repository root) and, per package, the names the runner printed; or null and the reason.
 */
export function planRetry(failures, touched, exists, folderOf = () => null) {
  const no = (note) => ({ files: null, runs: [], note: `not retried: ${note}` });
  if (touched === null) return no("could not work out which files the branch touched");
  if (failures.files.length === 0) return no("no failing test file found in the log");
  if (failures.reported === null) return no("the log has no failed-file count to check against");
  if (failures.unhandled) return no("the log has an unhandled error section");
  if (failures.unnamed.length > 0)
    return no(`${failures.unnamed.join(", ")} failed without naming a test file`);
  if (failures.reported !== failures.files.length)
    return no(`the runner reports ${failures.reported} failed, ${failures.files.length} named`);
  const paths = [];
  const runs = new Map();
  for (const { pkg, file } of failures.files) {
    // The name goes into a shell command line, so only plain path characters are accepted.
    if (!/^[\w@./-]+$/.test(file)) return no(`${file} has characters a command line cannot carry safely`);
    if (pkg === null && failures.prefixed) return no(`${file} has no package prefix while other lines do`);
    if (pkg !== null && !/^[\w@./-]+$/.test(pkg)) return no(`${pkg} has characters a command line cannot carry safely`);
    const folder = pkg === null ? "" : folderOf(pkg);
    if (folder === null) return no(`the folder of package ${pkg} is not known`);
    const path = folder === "" ? file : `${folder}/${file}`;
    if (!exists(path)) return no(`${path} is not a path from the repository root`);
    if (branchTouched(path, touched)) return no(`${path} is in the branch's change`);
    paths.push(path);
    if (!runs.has(pkg)) runs.set(pkg, { pkg, files: [] });
    runs.get(pkg).files.push(file);
  }
  return { files: paths, runs: [...runs.values()], note: `retrying ${paths.length} file(s) the branch did not touch` };
}

/**
 * Finds each workspace package's folder from the tracked and untracked `package.json` files: the
 * package's `name` is the key. A name two folders claim is left out, so it counts as unknown.
 *
 * @param {string} root - the checkout.
 * @param {(args: string[]) => string | null} [git] - git's stdout or null on failure; replaceable in tests.
 * @param {(path: string) => string | null} [read] - a file's text relative to `root`, or null; replaceable in tests.
 * @returns {(pkg: string) => string | null} the lookup: the folder relative to the root ("" for the root itself), or null.
 */
export function packageFolders(
  root,
  git = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return result.status === 0 ? result.stdout : null;
  },
  read = (path) => {
    try {
      return readFileSync(join(root, path), "utf8");
    } catch {
      return null;
    }
  },
) {
  const listing = git(["-c", "core.quotePath=false", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*package.json"]);
  const folders = new Map();
  const ambiguous = new Set();
  for (const path of (listing ?? "").split("\0").filter(Boolean)) {
    if (path !== "package.json" && !path.endsWith("/package.json")) continue;
    let name;
    try {
      name = JSON.parse(read(path) ?? "").name;
    } catch {
      continue;
    }
    if (typeof name !== "string") continue;
    const folder = path === "package.json" ? "" : path.slice(0, -"/package.json".length);
    if (folders.has(name)) ambiguous.add(name);
    folders.set(name, folder);
  }
  return (pkg) => (folders.has(pkg) && !ambiguous.has(pkg) ? folders.get(pkg) : null);
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
 * Says whether `base` and HEAD are one commit (or cannot be compared). On the base itself the
 * branch has no commits, so nothing would count as touched and every failure would look like a flake.
 *
 * @param {string} root - the checkout.
 * @param {string} base - the commit the branch left the main branch at.
 * @returns {boolean} true when they are the same commit or git could not compare them.
 */
export function sameCommit(root, base) {
  const rev = (ref) => {
    const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "";
  };
  const [resolved, head] = [rev(base), rev("HEAD")];
  return resolved === "" || head === "" || resolved === head;
}

/**
 * Runs a failed step's retry, if the plan allows one.
 *
 * @param {{root: string, base: string | undefined, step: object, logText: string, env: object, run?: Function, touched?: Function, exists?: Function, folderOf?: Function, sameCommit?: Function}} ctx - the checkout, the base (undefined in a full run with no merge base), the step with its `retry` settings, its log, and the environment. `run`, `touched`, `exists`, `folderOf` and `sameCommit` are replaceable in tests.
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
  if (base && (ctx.sameCommit ?? sameCommit)(root, base))
    return { cleared: false, flakes: [], note: "not retried: the base is the same commit as HEAD, so no change could count as touched", output: "" };
  const touched = base ? (ctx.touched ?? touchedFiles)(root, base) : null;
  const exists = ctx.exists ?? ((path) => existsSync(join(root, path)));
  const plan = planRetry(parseFailures(logText, step.retry), touched, exists, ctx.folderOf ?? packageFolders(root));
  if (plan.files === null) return { cleared: false, flakes: [], note: plan.note, output: "" };
  let output = "";
  for (const { pkg, files } of plan.runs) {
    const template = pkg === null ? step.retry.command : step.retry.packageCommand;
    if (typeof template !== "string")
      return { cleared: false, flakes: [], note: "not retried: the step has no packageCommand for a prefixed log", output: "" };
    const command = template.replaceAll("{package}", pkg ?? "").replaceAll("{files}", files.join(" "));
    const result = run(command);
    output += `$ ${command}\n${result.output}\n`;
    if (result.code !== 0) return { cleared: false, flakes: [], note: "retry failed: the step stays FAIL", output };
  }
  return { cleared: true, flakes: plan.files, note: "retry passed", output };
}
