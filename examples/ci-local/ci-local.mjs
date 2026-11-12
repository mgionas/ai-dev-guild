#!/usr/bin/env node
/**
 * Example strict local check: runs your CI steps on the current checkout, to completion, with a
 * log per step and one verdict line at the end. It is the gate a task passes before it merges; CI
 * runs the same script with `--full`, and the test beside it fails when the two stop matching.
 *
 * Usage: node ci-local.mjs [--full] [--base <ref>] [--dry-run] [--out <dir>] [--retry] [--probe]
 *
 * Copy this folder into your project (the test and the optional modules come with it), replace
 * STEPS with your CI workflow's steps in the same order, and point ESCALATE at your own files.
 *
 * By default it runs only what the change can reach since the merge base with origin/main (main
 * when there is no remote ref; the full run when neither exists). The build tool works out which
 * packages changed and which depend on them; this script keeps no map of that. Cheap
 * whole-repository steps always run. The full run happens instead when `--full` is given, when the
 * base cannot be found, when a changed file reaches everything (ESCALATE), or when a changed file
 * is neither in a package nor known to be read by nothing (INERT): an unknown file means "run
 * everything", never "run nothing". A change that touches only inert files skips every package
 * step, said out loud. Every step's line says whether it ran in full, ran on the affected part,
 * or was skipped and why, and the verdict line names the reach, so a narrow run never reads as a
 * full one. `--dry-run` prints that plan and runs nothing.
 *
 * Strict on purpose: no flag skips a named step, one failure never stops later steps, and the
 * environment is cleaned like a CI runner's so local secrets and caches cannot make a step pass
 * here that would fail there. It also runs with the smallest CI runner's limits (SMALLEST_RUNNER).
 *
 * Optional, off unless a flag turns them on: `--retry` (retry.mjs) re-runs the failing test files
 * once when the branch touched none of them; `--probe` (probe.mjs) fails a step that leaves the
 * working tree different from before. Logs go to `--out`, by default a folder in the system's
 * temporary directory, never inside the checkout.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { probeProblem, snapshot } from "./probe.mjs";
import { retryStep } from "./retry.mjs";

/**
 * Replace with your CI steps, in the workflow's order. `run` is the whole-repository command.
 * `affected`, when present, is the same step narrowed by the build tool to what changed since
 * `{base}` and what depends on it (Turborepo: `--filter=...[{base}]`; Nx: `npx nx affected -t test
 * --base={base}`). A step with `when` runs only if a changed file matches it, for a suite your
 * build tool does not track, such as browser tests of one app. A step with neither always runs in
 * full: keep that for cheap checks. `{cores}` becomes SMALLEST_RUNNER.cores; the test steps pass it
 * on to the runner too, because Vitest and Jest size their worker pool to the machine's cores, not
 * to the build tool's concurrency. A step may carry `retry` for the optional flake retry
 * (retry.mjs says what it holds). There is no install step: the workflow installs before it calls this
 * script, and a developer's checkout is already installed.
 */
export const STEPS = [
  { name: "format", run: "npx prettier --check ." },
  {
    name: "lint",
    run: "npx turbo run lint --concurrency={cores}",
    affected: "npx turbo run lint --concurrency={cores} --filter=...[{base}]",
  },
  {
    name: "typecheck",
    run: "npx turbo run typecheck --concurrency={cores}",
    affected:
      "npx turbo run typecheck --concurrency={cores} --filter=...[{base}]",
  },
  {
    name: "test",
    run: "npx turbo run test --concurrency={cores} -- --maxWorkers={cores}",
    affected:
      "npx turbo run test --concurrency={cores} --filter=...[{base}] -- --maxWorkers={cores}",
    retry: {
      // Turborepo prefixes each line with `<package>:<task>: `, so the pattern allows one.
      pattern: /^(?:\S+?:[\w-]+:\s+)?\s*FAIL\s+(?:\|[^|]*\|\s+)?(\S+\.test\.\w+)/,
      summary: /Test Files\s+.*?(\d+) failed/, // matched after the prefix is removed too
      command: "npx vitest run {files}",
      // Vitest prints paths relative to the package, so the retry runs inside that package.
      packageCommand: "npx turbo run test --filter={package} -- {files}",
    },
  },
  {
    name: "build",
    run: "npx turbo run build --concurrency={cores}",
    affected: "npx turbo run build --concurrency={cores} --filter=...[{base}]",
  },
  { name: "e2e", run: "npm run test:e2e", when: /^apps\/web\// },
];

/**
 * Changed files that can reach every package, so the build tool's narrowing cannot be trusted:
 * this script and its modules, the CI workflow, root build configuration, and each file that
 * changes what a whole-repository step does (formatter, lint and compiler config, hooks).
 * Adjust the first line to where you copy this folder.
 */
export const ESCALATE = [
  /^scripts\/ci-local\//,
  /^\.github\/workflows\//,
  /^package\.json$/,
  /^turbo\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^\.nvmrc$/,
  /^\.npmrc$/,
  /^\.prettierrc[^/]*$/,
  /^\.prettierignore$/,
  /^eslint\.config\.[cm]?js$/,
];

/** Folders that hold your packages. A change inside one is the build tool's to narrow. */
const PACKAGES = /^(apps|packages)\//;

/**
 * Changed files outside the packages that nothing tested reads. Anything else outside the packages
 * escalates to the full run. Add a folder here only when you know no package, test or lint rule
 * reads it (dev-only scripts covered by a whole-repository step, for example).
 */
const INERT = [/^docs\//, /^[^/]+\.md$/];

/** A lockfile change that only adds lines is a new dependency; one that alters lines can move every package. */
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

/**
 * The smallest runner your CI uses, copied from the project's "Where CI runs" page. Node sizes its
 * heap from the machine's memory and tools start a worker per core, so a laptop hides limits CI has.
 */
export const SMALLEST_RUNNER = {
  cores: 2,
  heapMb: 2048,
  timeZone: "UTC",
  locale: "C.UTF-8",
};

/** Variables a CI runner would not have. Add your own local-only ones (database URLs, tokens). */
const DROP_ENV = /^(DATABASE_URL.*|NODE_ENV|.*_TOKEN|.*_SECRET)$/;

/**
 * How the build tool's own selection is asked for, to check it against what this script expected.
 * `--dry=json` is Turborepo's; for Nx use `npx nx show projects --affected --base={base}` and a
 * `packagesIn` that reads its answer.
 */
const SELECTION = {
  selected: "npx turbo run build --filter=...[{base}] --dry=json",
  all: "npx turbo run build --dry=json",
};

const USAGE =
  "Usage: node ci-local.mjs [--full] [--base <ref>] [--dry-run] [--out <dir>] [--retry] [--probe]";

const git = (...gitArgs) => {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};

/** Same as {@link git}, but the output is kept as printed: the NUL-separated lists end in a NUL that trim would not remove, and a name may end in a space. */
const gitRaw = (...gitArgs) => {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
};

/**
 * Reads the command line. An unknown option is refused rather than ignored: a misspelt flag must
 * not quietly turn into the default run.
 *
 * @param {string[]} argv - the arguments after the script name.
 * @returns {{full: boolean, dryRun: boolean, retry: boolean, probe: boolean, base?: string, out?: string, problem: string | null}} the options, and a usage message when the line is unusable.
 */
export function parseArgs(argv) {
  const opts = { full: false, dryRun: false, retry: false, probe: false, problem: null };
  const flags = { "--full": "full", "--dry-run": "dryRun", "--retry": "retry", "--probe": "probe" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (Object.hasOwn(flags, arg)) opts[flags[arg]] = true;
    else if (arg === "--base" || arg === "--out") {
      const value = argv[(i += 1)];
      if (!value || value.startsWith("-")) return { ...opts, problem: `${arg} needs a value\n${USAGE}` };
      opts[arg.slice(2)] = value;
    } else return { ...opts, problem: `unknown argument ${arg}\n${USAGE}` };
  }
  return opts;
}

/**
 * Pure scope decision from the changed paths (git is asked elsewhere, so this can be tested on
 * lists). `lockfileChange` is 'added-only' | 'changed' | 'none'; for a changed lockfile anything
 * but 'added-only' means it alters existing lines. `reachesPackages` is false only when every file
 * is inert, the one case package steps may be skipped.
 *
 * @param {string[]} files - every changed path, a rename on both sides.
 * @param {string} [lockfileChange] - what git says about a changed lockfile.
 * @returns {{full: true, why: string} | {full: false, reachesPackages: boolean}} the scope.
 */
export function classify(files, lockfileChange = "none") {
  // An empty list is no proof of nothing to run: `every` on it would be true and skip every package step.
  if (files.length === 0) return { full: true, why: "no changed files to narrow on" };
  for (const file of files) {
    if (ESCALATE.some((pattern) => pattern.test(file)))
      return { full: true, why: `${file} reaches everything` };
    if (LOCKFILES.includes(file)) {
      if (lockfileChange !== "added-only")
        return { full: true, why: `${file} changes existing lines` };
      continue;
    }
    if (!PACKAGES.test(file) && !INERT.some((pattern) => pattern.test(file)))
      return {
        full: true,
        why: `${file} is outside the packages and not known to be inert`,
      };
  }
  // An added-only lockfile is a new dependency: the build tool decides which packages it reaches, so it is no inert file.
  return {
    full: false,
    reachesPackages: files.some(
      (file) => PACKAGES.test(file) || LOCKFILES.includes(file),
    ),
  };
}

/** Workspace packages in a `--dry=json` answer (`//` is the root, not a package). */
const packagesIn = (dry) =>
  Array.isArray(dry?.packages) ? dry.packages.filter((name) => name !== "//") : null;

/**
 * Checks the build tool's answer: package files changed, so an empty or unreadable selection
 * cannot be trusted and means the full run.
 *
 * @param {object | null} selected - the parsed answer for the narrowed selection, null when unreadable.
 * @param {object | null} all - the parsed answer for every package.
 * @returns {{full: true, why: string} | {full: false, reach: string}} what to do, and the reach for the verdict line.
 */
export function judgeSelection(selected, all) {
  const chosen = packagesIn(selected);
  const total = packagesIn(all);
  if (chosen === null || total === null || total.length === 0)
    return { full: true, why: "the build tool's package selection could not be read" };
  if (chosen.length === 0)
    return { full: true, why: "package files changed but the build tool selected no package" };
  if (chosen.some((name) => !total.includes(name)))
    return { full: true, why: "the build tool selected a package it does not list" };
  return { full: false, reach: `${chosen.length} of ${total.length} packages` };
}

/**
 * Last lines of a step's output: on CI the temporary log folder is gone, so a failure must show its own reason.
 *
 * @param {string} text - the output.
 * @param {number} [lines] - how many lines to keep.
 * @returns {string} the last lines.
 */
export const tail = (text, lines = 200) => text.split("\n").slice(-lines).join("\n");

/**
 * Runs one step to completion, logs it, and prints the tail of its output when it fails.
 *
 * @param {{name: string, command: string, env: object, out: string, log?: (line: string) => void}} ctx - what to run and where its log goes.
 * @returns {{code: number, output: string}} the exit code and the logged text.
 */
export function runStep({ name, command, env, out, log = console.log }) {
  const result = spawnSync(command, { shell: true, env, encoding: "utf8", maxBuffer: 1 << 30 });
  const output = `$ ${command}\n${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error}` : ""}`;
  writeFileSync(join(out, `${name}.log`), output);
  // A null status means the step was killed by a signal (or never started): that is a failure, never a pass.
  const code = result.status ?? 1;
  if (code !== 0)
    log(`--- ${name} failed, last lines of its log ---\n${tail(output)}\n--- end of ${name} ---`);
  return { code, output };
}

/** The commit this branch left the main branch at, or null. The flake retry needs it even in a full run. */
function findBase(opts) {
  const refs = opts.base ? [opts.base] : ["origin/main", "main"];
  const base = refs.map((ref) => git("merge-base", "HEAD", ref)).find(Boolean);
  return { base: base ?? null, refs };
}

/** Gathers the changed files from git. Anything uncertain lands on the full run, never on less. */
function chooseScope(opts) {
  if (opts.full) return { full: true, why: "--full" };
  const { base, refs } = findBase(opts);
  if (!base) return { full: true, why: `no merge base with ${refs.join(" or ")}` };
  // Committed changes since the base, plus uncommitted and untracked ones: what the next commit would carry too.
  // --no-renames lists both the old and the new path, so a move out of a package still shows the package path.
  // NUL-separated and unquoted, so a non-ASCII name arrives as it is.
  const committed = gitRaw("-c", "core.quotePath=false", "diff", "--name-only", "-z", "--no-renames", base);
  const untracked = gitRaw("-c", "core.quotePath=false", "ls-files", "-z", "--others", "--exclude-standard");
  if (committed === null || untracked === null)
    return { full: true, why: "git diff failed" };
  const files = [...new Set([...committed.split("\0"), ...untracked.split("\0")])].filter(Boolean);
  let lockfileChange = "none";
  for (const file of files.filter((name) => LOCKFILES.includes(name))) {
    // Without these flags a binary attribute or an external diff tool can hide removed lines.
    const stat = git("diff", "--numstat", "--no-ext-diff", "--no-textconv", "--text", base, "--", file);
    const removed = stat ? stat.split("\t")[1] : undefined;
    if (removed !== "0") {
      lockfileChange = "changed";
      break;
    }
    lockfileChange = "added-only";
  }
  return { base, files, ...classify(files, lockfileChange) };
}

/** Asks the build tool for its selection and checks it; returns the scope, narrowed or not, and the reach. */
function checkSelection(scope, env) {
  const dry = (template) => {
    const result = spawnSync(template.replaceAll("{base}", scope.base), {
      shell: true,
      env,
      encoding: "utf8",
      maxBuffer: 1 << 30,
    });
    try {
      return JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
    } catch {
      return null;
    }
  };
  const verdict = judgeSelection(dry(SELECTION.selected), dry(SELECTION.all));
  return verdict.full ? { scope: { full: true, why: verdict.why }, reach: "" } : { scope, reach: verdict.reach };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.problem) {
    console.error(opts.problem);
    return 2;
  }
  // Every git call below lists paths relative to the working directory, and the probe and the retry
  // read files from it: from a subdirectory they would miss the rest of the repository.
  const top = git("rev-parse", "--show-toplevel");
  if (!top) {
    console.error("not inside a git repository");
    return 2;
  }
  process.chdir(top);
  // Logs stay outside the checkout so a step cannot be fooled by, or dirty, the files it checks.
  const out = resolve(opts.out ?? join(tmpdir(), "ci-local"));
  mkdirSync(out, { recursive: true });
  const summary = join(out, "summary.txt");
  writeFileSync(summary, "");
  const say = (line) => {
    appendFileSync(summary, `${line}\n`);
    console.log(line);
  };

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !DROP_ENV.test(key)),
  );
  Object.assign(env, {
    CI: "true",
    TURBO_FORCE: "true",
    NX_SKIP_NX_CACHE: "true",
    NODE_OPTIONS: `--max-old-space-size=${SMALLEST_RUNNER.heapMb}`,
    TZ: SMALLEST_RUNNER.timeZone,
    LANG: SMALLEST_RUNNER.locale,
    LC_ALL: SMALLEST_RUNNER.locale,
  });

  let scope = chooseScope(opts);
  const retryBase = scope.base ?? (opts.retry ? findBase(opts).base : null);
  // The script's own files escalate by path (ESCALATE); this catches a copy kept somewhere else.
  const root = git("rev-parse", "--show-toplevel");
  const self = root && relative(root, fileURLToPath(import.meta.url)).split("\\").join("/");
  if (!scope.full && self && scope.files.includes(self))
    scope = { full: true, why: `${self} reaches everything` };
  let reach = "no package reached";
  if (!scope.full && scope.reachesPackages) {
    // Check the build tool's answer too: an empty selection while package files changed must not read as a pass.
    ({ scope, reach } = checkSelection(scope, env));
  }
  const shortBase = scope.base?.slice(0, 9);
  say(
    scope.full
      ? `mode: full (${scope.why})`
      : `mode: affected since ${shortBase} (${scope.files.length} changed files, ${reach})`,
  );
  say(
    `limits: ${SMALLEST_RUNNER.cores} cores, heap ${SMALLEST_RUNNER.heapMb} MB, TZ ${SMALLEST_RUNNER.timeZone}, logs in ${out}`,
  );

  // Inert-only change: nothing a package builds or tests reads it, so package steps are skipped, never silently.
  const inertOnly = !scope.full && !scope.reachesPackages;
  const flakes = [];
  let failed = false;
  let skipped = 0;
  for (const step of STEPS) {
    let command = step.run.replaceAll("{cores}", SMALLEST_RUNNER.cores);
    let how = "ran full";
    if (inertOnly && (step.affected || step.when)) {
      skipped += 1;
      say(`${step.name}: skipped (every changed file is inert: it reaches no package)`);
      continue;
    }
    if (!scope.full && step.when && !scope.files.some((file) => step.when.test(file))) {
      skipped += 1;
      say(`${step.name}: skipped (no changed file matches ${step.when})`);
      continue;
    }
    if (!scope.full && step.when) how = `ran (a changed file matches ${step.when})`;
    if (!scope.full && step.affected) {
      command = step.affected
        .replaceAll("{base}", scope.base)
        .replaceAll("{cores}", SMALLEST_RUNNER.cores);
      how = `ran affected since ${shortBase}`;
    }
    if (opts.dryRun) {
      say(`${step.name}: would ${how.replace(/^ran/, "run")} — ${command}`);
      continue;
    }
    const started = Date.now();
    const before = opts.probe ? snapshot(process.cwd()) : null;
    const result = runStep({ name: step.name, command, env, out });
    let code = result.code;
    let label = String(code);
    if (code !== 0 && opts.retry && step.retry) {
      const retried = retryStep({ root: process.cwd(), base: retryBase ?? undefined, step, logText: result.output, env });
      say(`${step.name}: retry — ${retried.note}`);
      if (retried.output) appendFileSync(join(out, `${step.name}.log`), `\n${retried.output}`);
      if (retried.cleared) {
        code = 0;
        label = "PASS-on-retry";
        flakes.push(...retried.flakes);
      }
    }
    if (opts.probe) {
      const problem = probeProblem(before, snapshot(process.cwd()));
      if (problem) {
        appendFileSync(join(out, `${step.name}.log`), `\n${problem}\n`);
        say(`${step.name}: ${problem}`);
        code = 1;
      }
    }
    if (code !== 0) failed = true;
    say(
      `${step.name}: ${how} — ${code === 0 ? label : `exit ${code}`} (${Math.round((Date.now() - started) / 1000)}s)`,
    );
  }

  const head = git("rev-parse", "--short=9", "HEAD") || "unknown";
  const mode = scope.full
    ? "full run"
    : `affected since ${shortBase}: ${reach}, ${skipped} skipped`;
  if (opts.dryRun) {
    say(`HEAD ${head} — dry run (${mode}), nothing ran`);
    return 0;
  }
  if (flakes.length > 0) say(`flakes: ${flakes.join(", ")}`);
  const verdict = failed ? "FAIL" : flakes.length > 0 ? "PASS-on-retry" : "PASS";
  say(`HEAD ${head} — overall: ${verdict} (${mode})`);
  return failed ? 1 : 0;
}

// The tests import from this file, so the run starts only when this file is the one executed.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main());
