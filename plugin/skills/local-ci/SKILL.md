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
- **`--full` where nothing else runs the full suite.** If remote CI runs every step on each pull
  request into the main branch, the narrow local run is safe before that pull request. A merge
  that no remote CI checks (into a long-lived feature or milestone branch, a release cut by hand)
  runs with `--full`.
- **No other shortcuts.** Nothing lets you leave out a named step or cut one short. When a step
  fails, the rest still run, so a single run shows every problem.
- **Every step says what happened:** ran in full, ran on the affected part, or skipped and why. The
  verdict line names the mode. A skip never reads as a pass.
- **No cache.** Build and test caches are off, so an old success cannot be replayed as a new one.
- **A clean environment.** Set `CI=true`; remove local database URLs, tokens and other secrets; make
  sure no watcher, editor or format-on-save hook touches the files while it runs.
- **A log per step, and one verdict.** Logs go to a folder outside the checkout (or a git-ignored
  one). The summary ends with `HEAD <sha> — overall: PASS (<mode>)` or `FAIL (<mode>)`. If that
  line is missing, the run did not finish.
- **A retry only for tests the branch did not touch.** When a step fails solely on test files the
  branch never changed, run just those files once more. If they pass, mark the step
  `PASS-on-retry`, list them as flaky, and open a task for each. If any failing file was changed by
  the branch, retry nothing.

## Running it

Run it once, on the final commit of the task, after the fix rounds are over. Never run two heavy
suites at once on a shared machine, even in different checkouts: they compete for the same cores,
and a database or container they share turns that into failures. Check what is already running
before you start. If a run is killed with exit code 143, check whether some agent ran `pkill -f`
before you blame the machine's load.

Paste the summary in the report: the mode line, each step's line and the verdict.

## Setting it up

The ai-dev-guild repository has a small starting point at
<https://github.com/mgionas/ai-dev-guild/blob/main/examples/ci-local/ci-local.mjs>: a step list
with whole-repository and affected commands, the escalation list, a cleaned environment, a log per
step and the verdict line. Copy it into your project, replace its steps with your CI workflow's,
point the affected commands at your build tool, and add the test that compares the two lists.
