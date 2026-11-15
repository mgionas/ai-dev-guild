# flow-stats

Counts what your agent workflow left in the project's `.work` folder and writes one JSON file:
how long tasks take, what review found, how many fix rounds they needed, how often CI failed, how
long questions waited and where the tokens went. It also names the thresholds that were crossed,
three at most, each tied to a guild rule. A page can embed the file as its data.

It only reads and counts. It needs Node.js 22 or later and no packages. It never asks a model, and
it never fills a hole with a guess: a record it cannot find gives `null` and a line in `gaps`.

## Run it

```
node flow-stats.mjs --root <project> --out <file.json>
```

| Option | Meaning |
| --- | --- |
| `--root <folder>` | The project that holds `.work/`. Required. |
| `--out <file>` | Where to write the JSON. Required. It is the only file the script writes. |
| `--from <YYYY-MM-DD>`, `--to <YYYY-MM-DD>` | Count only what falls on or between these days (UTC). Default: everything up to today. |
| `--no-gh` | Do not ask `gh` for merge times (git's log is still read). |
| `--strong-model <text>` | Which models count as "the strongest" for the token threshold: any model whose name contains this text, any case. Default `opus`. |

To record CI runs for it, run your local CI with `node ci-local.mjs --record .work/ci-runs.jsonl`.

## What it reads

| Record | Used for |
| --- | --- |
| `.work/tasks/<id>/brief.md`, with an optional `**Branch:** <name>` line near the top | when a task started, and which branch to look for in git |
| `.work/tasks/<id>/report.md` | a task that has been built and can be reviewed |
| `.work/tasks/<id>/findings-<n>.md`: a table with `Severity` and `What is wrong` columns, and a `**Reviewers:** a, b` line | review counts and fix rounds. Severities are `critical`, `high`, `medium`, `low`; `blocker`, `important` and `minor` count as the first, second and last. A "What is wrong" cell that starts with `Claim:` is a builder claim that did not hold. |
| `.work/tasks/<id>/recheck-<n>.md` with `**New problems:** <count>` | fix rounds that broke something else |
| `.work/tasks/<id>/fix-report.md`, `fix-report-<n>.md` | the end of fixing |
| `.work/decisions/*.md`: title `# Decisions needed: <topic> (<YYYY-MM-DD>)`, and once answered `**Answered:** <YYYY-MM-DD>, accept all` or `, changed <n>` | questions asked, answered and the wait |
| `.work/ci-runs.jsonl`: `{"date":"YYYY-MM-DD","result":"pass"\|"fail","flaky":true\|false}` per line | CI runs. `flaky` is true when every failure passed on retry. |
| `.work/token-review/<YYYY-MM-DD>.md` with `**Tokens per task (median):** <n>` and a `Model` / `Share` table in percent | the tokens (the latest report in the period) |
| git history of the main branch (`main`, else `master`), or `gh pr list` | when a task's branch was merged |

Git is read only when `--root` is itself the top folder of a repository. A merge commit or a squash
commit counts when its message names the branch as a whole name (`feat/x` does not match `feat/x2`).

## The output

`meta` holds the project, the day it was made, the period and the number of tasks. Every other
section is `null` when none of its records exist.

| Field | Meaning |
| --- | --- |
| `time.medianDays`, `time.p90Days` | Days from a task's brief to its merge, or to its last file when no merge is found. |
| `time.stages` | Median days for `building` (brief to report), `review` (report to the first findings, or to the merge when there are none) and `fixing` (first findings to the last fix report or re-check). |
| `time.slowest` | The three slowest tasks. |
| `review.tasks` | Tasks with a report or a findings file. A task with a report and no findings file counts as reviewed with nothing found. |
| `review.blocking` | Tasks with at least one critical, high or medium finding. |
| `review.bySeverity`, `review.byReviewer` | Finding counts. A file's findings are credited to every reviewer it names, so the reviewer counts can add up to more than the findings. |
| `fixRounds.distribution` | Tasks by number of findings files: 0, 1, 2, 3 or more. |
| `fixRounds.rechecks`, `newBreakage` | Re-checks that state a count, and those that found a new problem. |
| `claims` | Reports, and the reports with at least one `Claim:` finding. |
| `ci` | Runs split three ways: `pass`, `realFailures` and `flaky` (they add up to `runs`). |
| `questions` | Batches, answered, accepted whole (`changed 0` counts here), changed, and the median days from asking to answering. |
| `tokens` | Median tokens per task and each model's share. |
| `gaps` | One line for each thing it could not find or had to leave out. Show these; they are the honest part. |
| `suggestions` | Each crossed threshold, ranked by how far past its limit (value divided by limit), at most three. `status` starts as `proposed`. |

The thresholds are the `THRESHOLDS` table in the script. Exactly at a
limit is not crossed. Change the table to your own rules; the tests pin the edges.

## Limits

- Stage times come from file times, so they are approximate. The script uses the first write when
  the system keeps a birth time, and otherwise the last write. A checkout, a copy or an editor that
  rewrites files can move them; a time that would run backwards is left out and listed in `gaps`.
- It counts what was written down. A project that does not save its findings, re-checks or
  ledger will show small numbers or `null`, not a good result. Read a low count next to its `gaps`.
- A finding with a severity it does not know is left out and named in `gaps`.
- The slow-tail rule is skipped when the median is zero days, because every task then ended the day
  it started and a tail cannot be judged.

## Test it

```
node --test 'examples/flow-stats/*.test.mjs'
```

The fixture in `fixtures/project/.work/` is a small made-up project. Its files are committed with
`git add -f` because the repository ignores `.work/`. Run straight on the fixture, every time is
zero days, because a checkout gives every file the same time; the test copies the fixture and sets
the times itself.
