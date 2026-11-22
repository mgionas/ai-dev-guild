# Where CI runs

CI is a different computer from the one the agent works on. It usually has fewer cores and less
memory, a different operating system and none of the developer machine's leftovers. Most "passes
locally, fails on CI" problems come from that difference, and agents miss it because nothing in
their brief says what CI runs on.

So write it down once, in a page each project keeps (start from
[the template](../plugin/skills/local-ci/ci-environment-template.md)), link it from `AGENTS.md`,
and link it from every brief that touches CI, build config, test timeouts or heavy tests. The
`local-ci` skill then imitates the smallest runner's limits, so the difference shows up on your
machine first.

## What differs, and what to do about it

- **The runtime sizes itself from the machine.** Node picks its default heap from the system's
  memory, and test runners pick one worker per core. A type-aware lint or a production build that
  fits a laptop's heap can run out of memory on a smaller runner. Run locally with CI's heap cap
  (`NODE_OPTIONS=--max-old-space-size=<MB>`) and CI's core count. Set the cap in CI too, on every
  heavy step, rather than relying on the default: a type-aware typecheck ran out of memory (exit
  code 134) on a runner whose default heap was 2 GB. Keep the cap below the runner's memory divided by the processes that run
  at once, or the out-of-memory error becomes the system killing the process (exit code 137).
- **Parallel levels multiply.** A task runner running four packages at once, each starting a test
  worker per core, puts many processes on a two-core runner, and tests that take one second alone
  hit a five-second timeout. Fix the cause: fewer packages at once, heavy packages in their own
  jobs. A longer timeout only hides it.
- **The developer machine has things CI does not.** A browser download cache, a globally installed
  tool, a warm dependency store, an environment variable from a shell profile. CI starts from
  nothing, so a step that needs a download or a system package installs it itself. Operating
  systems differ too: a Linux security policy can block a browser's sandbox that macOS allows.
- **File systems differ.** macOS ignores letter case by default and Linux does not: an import
  spelled with the wrong case passes on a Mac and fails on Linux.
- **Time zone, locale and processor.** CI usually runs in UTC with an English locale, and often on
  x86-64 while developers use ARM. Date tests, number formatting, container images and native
  modules can each behave differently.
- **A step nobody reaches stops working.** When CI stops at the first failure, every later step
  goes unrun for as long as the early one stays red, and quietly breaks. Put independent checks in
  separate jobs, or run every step and report each.
- **Progress you cannot see looks like a hang.** Some task runners group each task's log until it
  ends, so a long suite shows nothing for half an hour. Stream logs on CI (Turborepo:
  `--log-order=stream`).

## Every workflow

- A `timeout-minutes` on every job, so a hung job cannot hold a runner for hours.
- A `concurrency` group with `cancel-in-progress` for branch runs, so a newer push replaces the
  older run instead of queueing behind it. If your runs on the main branch share a cancelling group
  too, two merges that land close together cancel the first merge's run, and the second run covers
  both. Report the first as cancelled, not failed, and read the second.
- Third-party actions pinned to a full commit SHA, with the version in a comment. A tag can be
  moved to different code.
- Know what each setup action caches, and turn off caches you did not choose: some cache
  automatically when they see a package manager field, and can upload far more than you meant.
  Turn such a cache off with the action's own switch: removing the `cache` input is not enough.
- Checks on pull requests into every long-lived branch, not only the main branch. A milestone or
  release branch whose pull requests start no remote CI has only the local check behind it
  (`on: pull_request: branches: [main, 'release/**']`).

## Self-hosted runners

A self-hosted runner is a program on a machine you own that runs whatever a workflow tells it to.

- **Security first.** A job runs as the user that started the runner and can read everything that
  user can: SSH keys, cloud credentials, the agent's own settings, other repositories. Run it under
  a separate user account with nothing else in its home folder, or in a container or virtual
  machine, and prefer ephemeral runners (registered for one job, then removed). GitHub advises
  self-hosted runners only for private repositories: never attach one to a public repository or
  let it run pull requests from forks.
- **A middle option: send outside code to a hosted runner.** If the runner must stay under your own
  account, route the pull requests you trust least, such as automated dependency updates, to a
  hosted runner by their author:

  ```yaml
  runs-on: ${{ github.event.pull_request.user.login == 'dependabot[bot]' && 'ubuntu-latest' || fromJSON('["self-hosted"]') }}
  ```

  Decide by the pull request's author, not by `github.actor` (whoever started this run), so a
  re-run by a maintainer still goes to the hosted runner. This narrows the risk; it does not remove
  it, because your own pull requests still run under your account.
- **Nothing is reset between jobs.** Git-ignored leftovers from the last run (dependencies, build
  output, task-runner caches) stay in the workspace and can make a step pass that would fail from a
  clean start. Clean them at the start of each job.
- **Setup steps can change the host.** A step that enables a tool or installs a package globally
  may write into the owner's own toolchain. Give the runner its own tool installs, and guard
  privileged or OS-specific steps (`if: runner.os == 'Linux'`).
- **One instance runs one job at a time.** Count instances against the jobs a push starts, or runs
  queue.
- **Mixed runners: send the heavy jobs to the strong ones by label.** Throughput comes from the
  number of instances, not the size of the machine, so a weaker machine can still add one. Give the
  strong runners a label (`heavy`, say) and list it in `runs-on` beside `self-hosted`
  (`runs-on: [self-hosted, heavy]`) for the jobs that start containers or run integration suites; the weaker runner takes lint, typecheck with an explicit heap cap,
  unit tests and the jobs that only collect results. On GitHub a label can be added to a registered
  runner through the API (`POST /repos/<owner>/<repo>/actions/runners/<id>/labels` with the body
  `{"labels": ["heavy"]}`, admin access), without registering it again. The cost: when every strong runner is off, those jobs wait in the
  queue, and nothing falls back to the weaker one. When statement timeouts or time-dependent tests
  fail only on the weak runner, run the same job on a strong one before changing code; if it then
  passes, the test is load-sensitive, and that is the thing to fix, not the timeout.
- **A job queued for hours can fail at checkout.** It may fail while cloning, with an authentication
  error (`could not read Username`). Re-run it once before debugging; a failure that repeats on a
  fresh run is the one to read.
- **Cancelling is not instant.** Post steps that have started (cache uploads, cleanup) keep running
  after a cancel. A cancelled run is not a failed one: when it was replaced by a newer run, the
  newer run is the result to read.
- **Put the runner on another machine than the one agents work on.** If agent sessions or other
  projects use the runner's machine too, load-sensitive tests get flaky and parallel pre-push hooks
  time out. The longer reason, and what to do where a second machine is not possible, is in
  [Several agents on one machine](several-agents-one-machine.md).
- **Stopping a runner mid-job ends that job.** The job does not finish: it fails, or hangs until
  the CI host notices the runner is gone. Before you stop or retire one, ask the CI host whether it
  is busy (for GitHub, `gh api repos/<owner>/<repo>/actions/runners` shows `"busy": true`; it needs
  admin access to the repository, and runners registered to an organization are listed under
  `orgs/<org>/actions/runners` instead). Wait for it to go idle, and re-run anything it was
  holding.
- **Disks fill up.** Caches, container images and old workspaces grow on every run. Prune them on a
  schedule.
