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

## Count the runs one change gets

List every place the suite runs for a change: the git hooks, the local check, remote CI on the pull
request, and remote CI on the main branch after the merge. Give each place that needs a full run
one, and no place a second. One project found a single pull request running its unit tests four
times on one machine: a local `--full`, the pre-push hook, remote CI on a self-hosted runner on the
same machine, and remote CI on main. The overlap caused load failures that were not defects.

- **A git hook holds fast checks only:** the tool version, refusing a push to the main branch,
  format, protected files and text checks. Typecheck, the test suites and module-boundary checks run
  in the local check and in remote CI, not in a hook.
- **Remote CI on main after a merge stays.** It catches a merge that went in out of date.
- **A step that merges the main branch in stops when the merge fails.** A script or queue that
  runs `git merge origin/main` before checking a branch reads the merge's exit code. On failure it
  lists the unmerged files (`git diff --name-only --diff-filter=U`; an empty list means the merge
  failed for another reason, so print git's message) and stops with a failure. When branches share
  one checkout, it runs `git merge --abort` first, so the next branch starts from a clean tree.
  With one worktree per branch, leave the conflict in place for someone to resolve. A step that
  carries on runs the build and the tests over conflict markers, and nothing may notice. Files that
  only grow at the bottom (a decision index and its log, a changelog) conflict on every pair of
  parallel branches: whoever resolves keeps both sides, the base branch's lines first and then the
  branch's, and keeps an index in the same order as the entries it lists. Where entries are
  numbered, the branch's entries take the next numbers after the base branch's, and every reference
  to them changes too. If the merge commit goes through a hook that lints or type-checks with
  types, install the way `run-task` step 1 does (lock file frozen, install scripts off) and build first,
  because in an unbuilt worktree the hook cannot resolve the workspace's own types; give it a
  bigger heap if a large merge runs it out of memory. Never skip the hook.
- **One heavy run at a time on a machine, across sessions.** This is a rule with a check before you
  start, not a lock. If a self-hosted runner shares this machine (the project's CI environment
  page names each runner's machine), ask the CI host
  whether a run is in progress or queued (for GitHub,
  `gh run list --repo <owner/repo> --status in_progress --limit 1` and the same with
  `--status queued`) and start only if both printed nothing. Read the output, not the exit code.
  A queued run takes the machine as soon as a runner is free. Hosted runners don't load this
  machine, so their runs don't count. On a self-hosted machine any push that starts remote CI (to
  a branch with an open pull request, or a merge into the main branch) runs here, so it is a heavy
  run too: a session that has asked for the machine, or is waiting for another session's "done",
  holds those pushes and merges as well as its local runs. Also look for other sessions' test containers
  (`docker ps`) and other projects' test runners (`ps`). A CI job running on this machine shows as
  the runner's worker process (GitHub: `Runner.Worker`), a local signal that needs no API access.
  Match it by its fixed process name (`pgrep -x Runner.Worker`), not by command line: Linux's `pgrep -f`
  leaves out only itself, so a waiting shell whose command names the worker matches and waits for
  ever. Honour a pause file too (a path the project names), which the owner or a controller creates
  to hold every heavy run until they remove it. When other agent sessions share the
  machine and can message each other, tell them before you start, and if one is running its own
  heavy run, wait for its "done". Do all of this immediately before each heavy run, not once per
  session: runners take jobs at any moment, so a check made at the start of the day is out of date
  by the time you run. The check does not cover git hooks, which is one more reason they stay
  light.
- **A loop that waits for a quiet machine must not wait on itself, or on other waiters.** Run the
  wait as its own command and the heavy run as the next one. In `wait-quiet && run-tests` the
  waiting shell's own command line names the test tool, so a `ps` check sees "busy" for ever. That
  is not enough on its own: every other agent's waiting shell names the tool too, so two waiters
  each see the other as busy and neither starts. Never match a test tool by its command line alone.
  Match the program that runs it: list `ps -eo comm=,args=`, keep the lines whose first field, by
  its last path part, is the runtime (`node`, for example; macOS prints the full path there, and
  Linux cuts it to 15 characters), and grep only those for the tool. A shell waiting with `sh -c`
  is then left out, and a tool started through a package-manager script is found by its runtime
  child. A wait written in the runtime itself (`node -e …`) would still match: write it as a shell
  script. Or look at the containers the tools start instead of processes. Name each busy signal:
  CI runs in progress or queued, the runner's worker process, the pause file, the named test tools
  run by their runtime, and the containers those tools start (Testcontainers and its reaper, for
  example). Never "any container that is not
  ours": another project's always-on container keeps the loop waiting for hours. Call the machine quiet only after
  two checks in a row, about 30 seconds apart. Give the loop a time limit; when it runs out, report
  what kept it busy instead of starting anyway. A hung process left by an earlier run blocks every
  wait the same way: name it in the report, and stop it only if you started it, by its PID.
- **Heavy runs go in one queue, not one wait per agent.** Agents that each wait for a quiet
  machine are all released at the same moment and start together. When a controller hands out the
  work and has several heavy runs to do, it runs them one after another itself, or gives agents
  their turn one at a time; its agents never wait on their own for a quiet machine. Waiting for
  another session's "done" (above) is for sessions with no controller between them.

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
  request into the main branch, the narrow local run is safe before that pull request, and a local
  `--full` just before opening one only repeats the run CI is about to do. A merge that no remote CI
  checks (into a long-lived feature or milestone branch, a release cut by hand) runs with `--full`.
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
  Under a monorepo build tool the runner prints each path relative to its package, so retry inside
  that package, and judge "touched" by the path from the repository root; when the package or its
  folder cannot be found, retry nothing.

## Running it

Run it once, on the final commit of the task, after the fix rounds are over. Never run two heavy
suites at once on a shared machine, even in different checkouts: they compete for the same cores,
and a database or container they share turns that into failures. Check what is already running
before you start. If a run is killed with exit code 143, check whether some agent ran `pkill -f`
before you blame the machine's load. A test that times out only on CI is a question about the
machine first: count the processes per core before you raise a timeout. Before you call a test
flaky, rule out two causes that look like one: another process already holding a port the test or
its runner binds (a dev server, another checkout's run), and a hung process from an earlier run
holding a port, a lock or a database.

Paste the summary in the report: the mode line, each step's line and the verdict.

## Setting it up

The ai-dev-guild repository has a starting point in `examples/ci-local`
(<https://github.com/mgionas/ai-dev-guild/tree/main/examples/ci-local>). Copy the folder into your
project as `scripts/ci-local/` (or adjust the first line of `ESCALATE`).

The script is not part of the plugin, and this skill never downloads it. Ask the user to
copy the folder into the project from the release that matches the installed plugin; the steps are
in [Copy a script into your project](https://github.com/mgionas/ai-dev-guild/blob/main/docs/copy-a-script.md#local-ci). Once it is in
the project it is the project's code: read it and review it like any other change before it runs.

- `ci-local.mjs` is the runner: a step list with whole-repository and affected commands, a pure
  `classify()` that decides the scope from the changed files, a check of the build tool's own
  selection, a cleaned environment with the smallest runner's limits, a log per step (its tail is
  printed when the step fails) and the verdict line. Flags: `--full`, `--base <ref>`, `--dry-run`,
  `--out <dir>`, and `--record <file>`, which appends one line per run to the file (use
  `.work/ci-runs.jsonl`; the `flow-stats` skill counts it); an unknown flag is refused, never ignored.
- `ci-local.test.mjs` pins the step list in the test itself and compares it with the workflow file
  the project keeps (the example reads `fixtures/ci.yml`; point it at your own). The workflow
  installs, then calls the script with `--full`, so the list lives in one place. `dry-run.test.mjs`
  runs the script in throwaway repositories and checks what it says.
- Optional, each its own module with its own tests, and off unless a flag turns it on: `--retry`
  (`retry.mjs`) for the flake retry above, and `--probe` (`probe.mjs`), which fails a step that
  leaves the working tree different from before it ran and names the files. A step opts in to the
  retry with a `retry` entry that says how to read the failed files from its log; the retry
  refuses to run when the runner's own count of failures differs from the files it found, and for a log with
  Turborepo's package prefixes the step's `packageCommand` runs once per package. The script
  always works from the repository root, wherever it is started.

Replace the steps with your CI workflow's, point the affected commands at your build tool, and keep
the pinned list in the test in step with them.
