---
name: local-ci
description: "Run, or set up, a local check that is as strict as CI — the same steps, no cache, a log for every step and a single verdict line — that runs only what the change can reach, falls back to the full suite when it cannot tell, and says which steps ran, which were skipped and why. Use it as the gate before every merge, and to build that gate when a project lacks one."
---

The point of this check is to find out, before merging, what CI will say. That only works if it
cannot be made easier than CI, and if nothing on your machine can make a failing step look green.
It also has to be cheap enough to run: a suite that cannot load a single changed file proves
nothing about the change, and on a shared machine it slows every other agent down.

## Before a heavy run, write down its scope

A heavy run is the full local check, an integration or database suite, end-to-end tests or
mutation testing. Before starting one, write in the brief or report:

- which packages or areas the change can reach (the changed files, and what depends on them);
- which steps cover those areas, and so which steps will run;
- why, if you are running more than that.

A change to one script and a document reaches no package's tests. A change to a shared library
reaches every package that imports it.

## Know where CI runs

A check run on a developer machine proves what CI will say only if the machine behaves like CI.
CI is usually smaller (fewer cores, less memory), often another operating system, and starts with
none of your caches. Keep the facts in one project page, from `ci-environment-template.md` in this
skill's folder, linked from `AGENTS.md`: each runner's kind, labels, OS, cores, memory, default
heap, jobs at once and what else shares the machine. The guide behind it:
<https://github.com/mgionas/ai-dev-guild/blob/main/docs/where-ci-runs.md>.

## What makes it strict

- **The same steps as CI, in the same order, with the same commands.** Keep a test that reads the CI
  workflow and fails when the local list no longer matches it.
- **Only what the change reaches, decided by tools, not by hand.** By default each step runs on the
  part of the repository the change can reach since the merge base with the main branch. The build
  tool works that out (Turborepo `--filter=...[<base>]` or `--affected`, Nx `nx affected`, Bazel
  queries). Never keep your own list of "which test covers which folder": it goes stale silently.
  Cheap whole-repository checks (format, lint config, link checks, file guards) always run in full.
- **The full run when the narrowing cannot be trusted.** It escalates by itself, and names the file
  that caused it, when the change touches something that reaches everything: CI workflow files, the
  local check itself, root build or compiler config, or a lockfile change that alters existing lines
  (a lockfile change that only adds lines is a new dependency, and stays narrow). If the merge base
  cannot be found, it runs the full suite, never less.
- **An unknown file means the full run.** A changed file outside the packages escalates unless the
  project lists it as read by nothing (documentation, for example). A file nobody has classified
  is assumed to reach everything, never nothing.
- **Files read across package lines are declared where the build tool sees them.** When a
  package's code, tests or lint rules read a file outside the package (a glossary a lint rule
  checks, a generated API document, a compose file a test starts), the build tool cannot know it
  unless told. Declare the file as an input of the task that reads it, in the build tool's own
  config (Turborepo: `"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/<path>"]`), with a comment naming
  the reader. Its cache then sees the file too. Never keep that list in the local check: a
  hand-kept list misses files and the run says PASS. Add a guard test that scans package sources
  for paths outside the package and fails when no declaration covers one; list by hand only the
  files whose paths are built at run time, and have the guard check those too.
- **Suites that read every package declare it.** A guard or architecture suite that scans all
  packages' sources declares them as its inputs, so any source change runs it.
- **Check the build tool's answer too.** Look at its selection before running (Turborepo
  `--dry=json`, Nx `nx show projects --affected`). If the list is empty while package files
  changed, misses a workspace package, or drops one the selection chose, run everything and say why.
- **`--full` where nothing else runs the full suite.** If remote CI runs every step on each pull
  request into the main branch, the narrow local run is safe before that pull request. A merge
  that no remote CI checks (into a long-lived feature or milestone branch, a release cut by hand)
  runs with `--full`.
- **No other shortcuts.** Nothing lets you leave out a named step or cut one short. When a step
  fails, the rest still run, so a single run shows every problem.
- **Every step says what happened:** ran in full, ran on the affected part, or skipped and why. The
  verdict line names the mode and its reach, such as `PASS (affected: 6 of 11 packages; integration
  for api, db)` or `PASS (full run)`. A skip never reads as a pass. A dry run (`--dry-run`) prints
  that plan and runs nothing.
- **No cache.** Build and test caches are off, so an old success cannot be replayed as a new one.
- **CI's limits.** Run with the smallest runner's heap cap (`NODE_OPTIONS=--max-old-space-size=…`),
  its core count for parallel tasks and test workers, and its time zone and locale. A build that
  needs more memory than CI has, or a test that only passes with spare cores, fails here first.
- **A clean environment.** Set `CI=true`; remove local database URLs, tokens and other secrets; make
  sure no watcher, editor or format-on-save hook touches the files while it runs.
- **A log per step, and one verdict.** Logs go to a folder outside the checkout (or a git-ignored
  one). The summary ends with `HEAD <sha> — overall: PASS (<mode>)` or `FAIL (<mode>)`. If that
  line is missing, the run did not finish.
- **A retry only for tests the branch did not touch.** When a step fails solely on test files the
  branch never changed, run just those files once more. If they pass, mark the step
  `PASS-on-retry`, list them as flaky, and open a task for each. If any failing file was changed by
  the branch, retry nothing. Retry nothing either when any other failure is in the log (an
  unhandled error, or a failed package that names no test file), or when the base is HEAD itself.

## Running it

Run it once, on the final commit of the task, after the fix rounds are over. Never run two heavy
suites at once on a shared machine, even in different checkouts: they compete for the same cores,
and a database or container they share turns that into failures. Check what is already running
before you start. If a run is killed with exit code 143, check whether some agent ran `pkill -f`
before you blame the machine's load. A test that times out only on CI is a question about the
machine first: count the processes per core before you raise a timeout.

Paste the summary in the report: the mode line, each step's line and the verdict.

## Setting it up

The ai-dev-guild repository has a starting point at
<https://github.com/mgionas/ai-dev-guild/tree/main/examples/ci-local>. Copy the folder into your
project (as `scripts/ci-local/`, or adjust the first line of `ESCALATE`).

- `ci-local.mjs` is the runner: a step list with whole-repository and affected commands, a pure
  `classify()` that decides the scope from the changed files, a check of the build tool's own
  selection, a cleaned environment with the smallest runner's limits, a log per step (its tail is
  printed when the step fails) and the verdict line. Flags: `--full`, `--base <ref>`, `--dry-run`,
  `--out <dir>`; an unknown flag is refused, never ignored.
- `ci-local.test.mjs` pins the step list in the test itself and compares it with the workflow file
  the project keeps (the example reads `fixtures/ci.yml`; point it at your own). The workflow
  installs, then calls the script with `--full`, so the list lives in one place. `dry-run.test.mjs`
  runs the script in throwaway repositories and checks what it says.
- Optional, each its own module with its own tests, and off unless a flag turns it on: `--retry`
  (`retry.mjs`) for the flake retry above, and `--probe` (`probe.mjs`), which fails a step that
  leaves the working tree different from before it ran and names the files. A step opts in to the
  retry with a `retry` entry that says how to read the failed files from its log; the retry
  refuses to run when the runner's own count of failures differs from the files it found. The script
  always works from the repository root, wherever it is started.

Replace the steps with your CI workflow's, point the affected commands at your build tool, and keep
the pinned list in the test in step with them.
