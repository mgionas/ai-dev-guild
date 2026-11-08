---
name: local-ci
description: Run, or set up, a local check that is as strict as CI — the same steps, no shortcuts, no cache, a log for every step and a single verdict line, with a tightly limited retry for flaky tests. Use it as the gate before every merge, and to build that gate when a project lacks one.
---

The point of this check is to find out, before merging, what CI will say. That only works if it
cannot be made easier than CI, and if nothing on your machine can make a failing step look green.

## What makes it strict

- **The same steps as CI, in the same order, with the same commands.** Keep a test that reads the CI
  workflow and fails when the local list no longer matches it.
- **No shortcuts.** Nothing lets you leave out, narrow or cut short any step. When a step fails, the
  rest still run, so a single run shows every problem.
- **No cache.** Build and test caches are off, so an old success cannot be replayed as a new one.
- **A clean environment.** Set `CI=true`; remove local database URLs, tokens and other secrets; make
  sure no watcher, editor or format-on-save hook touches the files while it runs.
- **A log per step, and one verdict.** Logs go to a folder outside the checkout (or a git-ignored
  one). The summary ends with `HEAD <sha> — overall: PASS` or `FAIL`. If that line is missing, the
  run did not finish.
- **A retry only for tests the branch did not touch.** When a step fails solely on test files the
  branch never changed, run just those files once more. If they pass, mark the step
  `PASS-on-retry`, list them as flaky, and open a task for each. If any failing file was changed by
  the branch, retry nothing.

## Running it

Run it once, on the final commit of the task, after the fix rounds are over. Do not start two at
once on a machine where they would share a database or containers. If a run is killed with exit
code 143, check whether some agent ran `pkill -f` before you blame the machine's load.

## Setting it up

The ai-dev-guild repository has a small starting point at
<https://github.com/mgionas/ai-dev-guild/blob/main/examples/ci-local/ci-local.mjs>: a step list, a cleaned
environment, a log per step and the verdict line. Copy it into your project, replace its steps with
your CI workflow's, and add the test that compares the two lists.
