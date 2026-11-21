# Run the heavy checks once, and only where the change reaches

Builders and fixers run only the tests for the code they touched. The heavy checks run a single
time, in the strict local check just before merging, and only on what the change can reach.

**Why:** Rerunning a twenty-minute suite after every small fix on unchanged code was a large share
of the time spent. Running every suite for a change that reaches none of them is the same waste,
and on a machine shared by several agents it starves everyone else's runs.

**How to apply:**

- Briefs name the covering tests, and say which heavy steps the change needs and why.
- Before a heavy run, write down which packages or areas the change can reach and which steps
  cover them. Let the build tool decide what is affected; never keep a hand-written map.
- Run the full suite when the change reaches everything (CI files, the check itself, root config,
  a lockfile change that alters existing lines), when the base cannot be found, and before any
  merge that no remote CI checks.
- A file read across package lines is declared as an input of the task that reads it, in the
  build tool's config, and a guard test enforces that. A changed file nobody has classified runs
  everything.
- Every report says, step by step, what ran, what was skipped and why. A skip never reads as a pass.
- Count the places the suite runs (git hooks, the local check, remote CI on the pull request, remote
  CI on main) and give each one full run, no more. A git hook holds fast checks only.
- Never run two heavy suites at once on a shared machine. Before starting one, check for other
  sessions' runs, and if CI runs on this machine, ask the CI host whether a run is in progress or
  queued. Tell the other sessions you are starting, and wait for a "done" from any that is running
  its own. Repeat the check before each run, since runners take jobs at any moment. When CI runs
  on this machine, any push that starts remote CI, including a merge into main, is a heavy run too:
  hold it while you wait for the machine.
- A wait-until-quiet loop runs as its own command, before the heavy one, and counts only named
  busy signals (CI runs, named test tools, their containers), never "any container not ours". It
  matches a test tool by the program that runs it, never by a command line alone, because other
  agents' waiting shells name the tool too. It needs two quiet checks in a row and a time limit.
- When a controller hands out the work, several heavy runs go in one queue it runs one after
  another, not one wait per agent: waiters released together start together. Waiting for another
  session's "done" is for sessions with no controller between them.

**Where it lives:** the `local-ci`, `write-brief`, `fix-round` and `run-task` skills.

Origin: field-tested.
