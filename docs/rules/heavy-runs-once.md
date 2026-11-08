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
- Never run two heavy suites at once on a shared machine.

**Where it lives:** the `local-ci`, `write-brief` and `fix-round` skills.

Origin: field-tested.
