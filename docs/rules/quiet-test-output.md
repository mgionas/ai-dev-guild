# Failures in full, passes as a count

When an agent runs tests, it reads each failure in full and the passing tests only as a count. The
full output goes to a log file, and the run prints where.

**Why:** Passing tests are most of a test run's output, and they tell the agent nothing it can act
on. Every line an agent reads costs input tokens, and a long log also pushes the one failing
assertion out of view. The test runners' own options already do this, so no extra tool is needed.

**How to apply:**

- Use the runner's quiet output: a dot or summary reporter, a quiet flag, or no verbose flag.
  Check the option against the installed version's own `--help` or docs first, and write that
  version next to the flags in the brief or role; names change between versions, and a wrong flag
  can turn quiet into verbose or drop the summary.
- Leave out ordinary console output from passing tests, where the runner can show logs for failing
  tests only. Standard error, error and warning output still show in full, from passing tests
  too, and so does the runner's section for unhandled errors: a run can report every test passed
  and still fail there. Prove it once per runner: add a passing test that writes to the error
  output and a failing one, run them, and check both show. Settings that silence passing tests can
  silence their errors too. In Vitest 5, `--silent=passed-only` hides a passing test's
  `console.error`; `--reporter=dot --silent=false` kept it in two projects' probes, while the
  `minimal` reporter hid it on one patch version and kept it on another. Repeat the probe after
  every runner upgrade, patch versions included, and write its date next to the flags.
- Pass the flags to the runner itself, not through a package-manager script. A package manager can
  read a flag such as `--reporter` as its own and refuse the run, and a script that chains two
  commands passes the flags to the last one only. Worse, a forwarded flag can arrive in a form the
  runner ignores while the run still exits 0. Run the exact command once before writing it into a
  brief or a role, and check the output really changed (the dots print, the summary is short), not
  just the exit code.
- Some runners turn quiet on by themselves when they detect an agent. Check what the default does
  as well as the flags you add.
- The count names how many test files and how many tests ran. Zero tests, a missing count, or a
  count that dropped against the last run with no reason in the change, is a failure: a bare
  "passed" can hide a suite that never ran.
- Write the full output to a log file outside the checkout (or a git-ignored one) and print its
  path, and keep it until the report is accepted. Nothing is lost: whoever needs a passing test's
  output reads the file.
- The runner's own files (reports, traces, screenshots, result folders) go there too. Set the
  runner's output folder, or run from a scratch folder: some runners write into the current folder
  and leave files in the checkout.
- Never pipe test output (`| tail`, `| grep`, `| tee`) without `set -o pipefail`. A pipeline reports
  the exit code of its last command, so a failing run reads as a pass. Or write to the file first
  and print the summary from it.
- When many tests fail, show the first ten in full, ordered by file path so two runs compare, and
  list the rest by name only; the log has them all.
- Some output is the result, not noise: mutation-test survivors are always listed in full.
- The evidence is the count of files and tests, every failure in full, the exit code and the log's
  path: "unit 212/212 in 31 files, exit 0, log at <path>", or "2 of 214 failed" with each name and
  assertion. A reviewer who doubts the count reads the log; a report does not need the passing log.
- A local check that already keeps a log per step needs no change: one line for a step that
  passed, and for a step that failed the last lines of its log (200 in the guild's example) plus
  the verdict line. The rule is about how an agent reads it.

**Where it lives:** the `builder`, `fixer`, `qa-tester` and `token-optimizer` roles, the
`write-brief` template and the `token-review` skill.

Origin: new.
