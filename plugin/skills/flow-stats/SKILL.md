---
name: flow-stats
description: "Show how this project's agent workflow is going and where it loses time: a script counts the records the loop already writes (briefs, reports, findings, re-checks, decision batches, CI runs, token reports) and a living page shows days per task, findings, fix rounds, CI, questions and tokens, with at most three suggestions tied to the guild's own rules. Use on request, and at the end of each milestone."
argument-hint: "[blank, or a date range]"
---

An agent loop feels fast or slow without anyone knowing why. The records it writes already say:
how long a task took, how many fix rounds it needed, how often CI failed for a real reason, how
long the owner took to answer. This skill counts them with a script, so the numbers are not
guesses, and puts them on one page. The page reports. It never decides: a suggestion becomes a
rule only when the owner accepts it.

## 1. Copy and run the counting script

The ai-dev-guild repository has the script at
<https://github.com/mgionas/ai-dev-guild/tree/main/examples/flow-stats>. Copy the folder into the
project (as `scripts/flow-stats/`), once, like the `local-ci` runner. Run it from the project's
root and keep its output, a JSON file, in `.work/flow-stats/<date>.json`. It reads the records
listed below, writes `null` for a measure it cannot compute, and adds a line to `gaps` saying why.
It holds the threshold table (step 4) as data, and never edits a record.

## 2. Fill gaps, and only gaps

Read the `gaps` the script wrote. For each, look for the record yourself, and fill the value only
when you can name the record it came from, such as a file, a pull request or a log line. Otherwise
leave it as "not found". Never estimate, and never change a number the script counted. A page that
says "not found" is correct; a page with a plausible number nobody can trace is not.

## 3. What each measure means

| Measure | Where it comes from |
| --- | --- |
| Days per task | `.work/tasks/<id>/brief.md` (the first write) to the merge of its branch. The brief names the branch on an optional `**Branch:** <name>` line. The merge comes from `git log` on the main branch, or `gh pr list --head <branch> --state merged` (`--no-gh` skips it). With no merge found, the task's last file is used, and the gap says so. |
| Where time goes | File times in the task folder, so approximate. Building: brief to report. Review: report to `findings-1.md`, or to the merge when there are none. Fixing: `findings-1.md` to the last fix report or re-check. The page shows each stage's median. |
| Findings, by severity and reviewer | The table in each `findings-<n>.md`: its Severity column (`critical`, `high`, `medium`, `low`) and its `**Reviewers:**` line. A task is blocking when it has a critical, high or medium finding. |
| Fix rounds | The number of `findings-<n>.md` files per task, and the `**New problems:** <count>` line of each `recheck-<n>.md`. |
| Claims that did not hold | A finding whose "What is wrong" cell starts with `Claim:`, counted against the task's reports. |
| Local CI | `.work/ci-runs.jsonl`, one line per run, appended by `ci-local.mjs --record .work/ci-runs.jsonl`. A run is flaky when every failure passed on its retry. |
| Questions | `.work/decisions/<file>.md`: the date in the title, and the `**Answered:**` line once the owner has replied. |
| Tokens | `.work/token-review/<date>.md`: the `**Tokens per task (median):**` line and the model share table. |

## 4. The thresholds

A measure that crosses its threshold becomes a suggestion. The table is the script's, shown here
so the owner can read the rule.

| id | measure | crossed when | skill | suggestion |
| --- | --- | --- | --- | --- |
| second-round | tasks with 2 or more fix rounds | > 20% of tasks | write-brief, fix-round | Name the known traps and the tests to run in each brief; one fresh fixer per round. |
| new-breakage | re-checks that found a new problem | > 10% of re-checks | fix-round | The fixer writes the failing test first; the re-check probes that nothing got looser. |
| critical | findings that are critical | > 15% of findings | review-panel | Review the plan (architect or security) before anything is built. |
| claims | reports with a claim that did not hold | > 5% of reports | run-task | The reviewer re-runs one claimed test per task; reports paste their output. |
| flaky | local CI runs that failed only on load or timing | > 10% of runs | local-ci | One heavy run at a time, and run only what the change affects. |
| owner-wait | median days to answer a batch | > 2 days | decision-batch | Run the question sweep before the build, so answers arrive first. |
| strong-model | token share of the strongest model | > 50% | token-review | Builders and fixers on the middle model; the strongest only for security, money and architecture. |
| slow-tail | slowest tasks | p90 > 3 × median | write-brief | Split the kind of task the slowest tail shows; one task per fresh agent. |

The script ranks every crossed threshold by how far past it the value is and keeps the top three.
Do not add a fourth by hand, and do not invent a suggestion the table does not hold.

## 5. Ask once, record what is accepted

Offer the suggestions to the owner in one batch (`decision-batch`), each with its number, its
threshold and the rule it would change. For each one the owner accepts, in the same turn:

1. Write the rule into `AGENTS.md` or the brief template, with the date and the number behind it
   (for example "2026-03-02: 22% of tasks needed two or more fix rounds"), the way `token-review`
   records a rule, so the next session follows it.
2. Set that suggestion's `status` in the data to `accepted`, or `declined`, and leave the rest as
   `proposed`.

A declined suggestion is not offered again until its measure gets worse.

## 6. Publish the page

Build the page from `flow-stats-page.md` in this skill's folder: copy the code block, replace the
placeholders, put the script's output (with your filled gaps) into the data block, and change
nothing else. It uses the house design (`page-design.md` in the `progress-boards` skill's folder).
It needs no artifact database. Publish it where the owner can open it, an artifact or a hosted page,
or write it as a plain file if the person does not publish pages.

Refresh it on request and at the end of each milestone, and republish to the same link, so the
owner's bookmark shows the latest numbers.
