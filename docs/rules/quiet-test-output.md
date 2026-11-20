# Failures in full, passes as a count

When an agent runs tests, it reads each failure in full and the passing tests only as a count. The
full output goes to a log file, and the run prints where.

**Why:** Passing tests are most of a test run's output, and they tell the agent nothing it can act
on. Every line an agent reads costs input tokens, and a long log also pushes the one failing
assertion out of view. The test runners' own options already do this, so no extra tool is needed.

**How to apply:**

- Use the runner's quiet output: a dot or summary reporter, a quiet flag, or no verbose flag.
  Check the option against the installed version first; names change between versions.
- Leave out ordinary console output from passing tests, where the runner can show logs for failing
  tests only. Errors and warnings still show in full, from passing tests too, and so does the
  runner's section for unhandled errors: a run can report every test passed and still fail there.
- The count names how many test files and how many tests ran. Zero tests, or a count that dropped
  against the last run with no reason in the change, is a failure: a bare "passed" can hide a suite
  that never ran.
- Write the full output to a log file outside the checkout (or a git-ignored one) and print its
  path, and keep it until the report is accepted. Nothing is lost: whoever needs a passing test's
  output reads the file.
- Never pipe test output (`| tail`, `| grep`, `| tee`) without `set -o pipefail`. A pipeline reports
  the exit code of its last command, so a failing run reads as a pass. Or write to the file first
  and print the summary from it.
- When many tests fail, show at most ten in full and count the rest; the log has them all.
- Paste the count and the failures as evidence: "unit 212/212 in 31 files", or "2 of 214 failed"
  with each name and assertion. A count is evidence; a report does not need the passing log.
- The local check works the same way per step: one line for a step that passed, and for a step
  that failed the last lines of its log (200 in the guild's example) plus the verdict line.

**Where it lives:** the `builder`, `fixer`, `qa-tester` and `token-optimizer` roles, the
`write-brief` template and the `token-review` skill.

Origin: new.
