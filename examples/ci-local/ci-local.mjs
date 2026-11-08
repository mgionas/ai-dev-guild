#!/usr/bin/env node
/**
 * Example strict local check: runs your CI steps on the current checkout, to completion, with a
 * log per step and one verdict line at the end.
 *
 * Usage: node ci-local.mjs <outdir> [--full] [--base <ref>] [--dry-run]
 *
 * Copy it into your project and replace STEPS with your CI workflow's steps, in the same order.
 * Then add a test that reads the workflow file and fails when the two lists differ: that test is
 * what keeps this script honest.
 *
 * By default it runs only what the change can reach. The base is where this branch left the main
 * branch (`git merge-base HEAD origin/main`, or `--base <ref>`), and the build tool works out which
 * packages changed since then and which depend on them; this script never keeps its own map of
 * that. Cheap whole-repository steps always run. The whole suite runs instead when you pass
 * `--full`, when the base cannot be found, when a changed file reaches everything (the ESCALATE
 * list), or when a changed file is neither in a package nor known to be read by nothing (INERT):
 * an unknown file means "run everything", never "run nothing". Every step's line says whether it
 * ran in full, ran on the affected part, or was skipped and why, and the verdict line names the
 * mode, so a narrow run never reads as a full one. `--dry-run` prints that plan and runs nothing.
 *
 * Strict on purpose: no flag skips a named step, one failure never stops later steps, and the
 * environment is cleaned like a CI runner's so local secrets and caches cannot make a step pass
 * here that would fail there. It also runs with the smallest CI runner's limits (SMALLEST_RUNNER),
 * so a build that needs more memory, or a test that needs spare cores, fails here first.
 *
 * Not included, because they depend on your tools (the local-ci skill describes each): the flake
 * retry; checking that the build tool's own selection is not empty and drops no package; and the
 * guard test that fails when a package reads a file outside itself without declaring it as an
 * input of the task that reads it.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Replace with your CI steps. `run` is the whole-repository command. `affected`, when present, is
 * the same step narrowed by the build tool to what changed since `{base}` and what depends on it
 * (Turborepo: `--filter=...[{base}]`; Nx: `npx nx affected -t test --base={base}`). A step with
 * `when` runs only if a changed file matches it, for a suite your build tool does not track, such
 * as browser tests of one app. A step with neither always runs in full: keep that for cheap checks.
 * `{cores}` becomes SMALLEST_RUNNER.cores; pass it to your test runner too if it starts a worker per
 * core (Vitest and Jest: `--maxWorkers`).
 */
const STEPS = [
  { name: "install", run: "npm ci" },
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
    run: "npx turbo run test --concurrency={cores}",
    affected: "npx turbo run test --concurrency={cores} --filter=...[{base}]",
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
 * the CI workflow, this script, and the root build configuration. Add your own.
 */
const ESCALATE = [
  /^\.github\/workflows\//,
  /^package\.json$/,
  /^turbo\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^\.nvmrc$/,
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
const SMALLEST_RUNNER = {
  cores: 2,
  heapMb: 2048,
  timeZone: "UTC",
  locale: "C.UTF-8",
};

/** Variables a CI runner would not have. Add your own local-only ones (database URLs, tokens). */
const DROP_ENV = /^(DATABASE_URL.*|NODE_ENV|.*_TOKEN|.*_SECRET)$/;

const args = process.argv.slice(2);
const outdir = args.find(
  (arg, i) => !arg.startsWith("--") && args[i - 1] !== "--base",
);
if (!outdir) {
  console.error(
    "Usage: node ci-local.mjs <outdir> [--full] [--base <ref>] [--dry-run]   (outdir outside the checkout, or git-ignored)",
  );
  process.exit(2);
}
const git = (...gitArgs) => {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};

/** Decides the mode. Anything uncertain lands on the full run, never on less. */
function chooseScope() {
  if (args.includes("--full")) return { full: true, why: "--full" };
  const baseIndex = args.indexOf("--base");
  const ref = baseIndex === -1 ? "origin/main" : args[baseIndex + 1];
  const base = ref && git("merge-base", "HEAD", ref);
  if (!base)
    return {
      full: true,
      why: `no merge base with ${ref ?? "(missing --base value)"}`,
    };
  const changed = git("diff", "--name-only", base);
  if (changed === null) return { full: true, why: "git diff failed" };
  const files = changed.split("\n").filter(Boolean);
  const root = git("rev-parse", "--show-toplevel");
  const self =
    root && relative(root, resolve(process.argv[1])).split("\\").join("/");
  for (const file of files) {
    if (file === self || ESCALATE.some((pattern) => pattern.test(file)))
      return { full: true, why: `${file} reaches everything` };
    if (LOCKFILES.includes(file)) {
      // Without these flags a binary attribute or an external diff tool can hide removed lines.
      const stat = git(
        "diff",
        "--numstat",
        "--no-ext-diff",
        "--no-textconv",
        "--text",
        base,
        "--",
        file,
      );
      const [, removed] = (stat ?? "0\t1").split("\t");
      if (removed !== "0")
        return { full: true, why: `${file} changes existing lines` };
      continue;
    }
    if (!PACKAGES.test(file) && !INERT.some((pattern) => pattern.test(file)))
      return {
        full: true,
        why: `${file} is outside the packages and not known to be inert`,
      };
  }
  return { full: false, base, files };
}

const out = resolve(outdir);
mkdirSync(out, { recursive: true });
const summary = join(out, "summary.txt");
writeFileSync(summary, "");
const say = (line) => {
  appendFileSync(summary, `${line}\n`);
  console.log(line);
};

const scope = chooseScope();
const shortBase = scope.base?.slice(0, 9);
say(
  scope.full
    ? `mode: full (${scope.why})`
    : `mode: affected since ${shortBase} (${scope.files.length} changed files)`,
);

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
say(
  `limits: ${SMALLEST_RUNNER.cores} cores, heap ${SMALLEST_RUNNER.heapMb} MB, TZ ${SMALLEST_RUNNER.timeZone}`,
);

const dryRun = args.includes("--dry-run");
let failed = false;
let skipped = 0;
for (const step of STEPS) {
  let command = step.run.replaceAll("{cores}", SMALLEST_RUNNER.cores);
  let how = "ran full";
  if (
    !scope.full &&
    step.when &&
    !scope.files.some((file) => step.when.test(file))
  ) {
    skipped += 1;
    say(`${step.name}: skipped (no changed file matches ${step.when})`);
    continue;
  }
  if (!scope.full && step.when)
    how = `ran (a changed file matches ${step.when})`;
  if (!scope.full && step.affected) {
    command = step.affected
      .replaceAll("{base}", scope.base)
      .replaceAll("{cores}", SMALLEST_RUNNER.cores);
    how = `ran affected since ${shortBase}`;
  }
  if (dryRun) {
    say(`${step.name}: would ${how.replace(/^ran/, "run")} — ${command}`);
    continue;
  }
  const started = Date.now();
  const result = spawnSync(command, {
    shell: true,
    env,
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  writeFileSync(
    join(out, `${step.name}.log`),
    `$ ${command}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
  );
  const code = result.status ?? 1;
  if (code !== 0) failed = true;
  say(
    `${step.name}: ${how} — exit ${code} (${Math.round((Date.now() - started) / 1000)}s)`,
  );
}

const head = git("rev-parse", "--short=9", "HEAD") || "unknown";
const mode = scope.full
  ? "full"
  : `affected since ${shortBase}, ${skipped} skipped`;
if (dryRun) {
  say(`HEAD ${head} — dry run (${mode}), nothing ran`);
  process.exit(0);
}
say(`HEAD ${head} — overall: ${failed ? "FAIL" : "PASS"} (${mode})`);
process.exit(failed ? 1 : 0);
