---
name: run-task
description: Run one task through the whole loop — question sweep, brief, a fresh builder, a review panel the builder is not on, fix rounds, confirm-only re-checks, the strict local check, then merge and the progress boards. Use as the controller for any plan task.
argument-hint: "<task id or plan reference>"
---

You are the controller. You do not build and you do not review. You write briefs, dispatch fresh
agents, read their reports, and keep the owner's questions in one place. Keep your own context
small: read reports and findings, not every file the agents read.

The task: $ARGUMENTS

## The loop

1. **Question sweep.** Give the task's plan text to `domain-guardian` and ask for the Gaps only.
   Put every product question into one decision batch (`decision-batch` skill) and ask the owner
   once. The builder starts with the answers, not with the questions.
2. **Brief.** Write `.work/tasks/<id>/brief.md` with the `write-brief` skill. The brief is the
   builder's whole world: complete, with line ranges for any long document it must read.
3. **Build.** Dispatch one fresh `builder` (or `money-specialist`, `db-migrations`) with the brief
   path. One task per agent. Pick the model on purpose (see below).
4. **Read the report.** No pasted evidence means not done: send it back. Move each **Noticed** item
   to the carried list (`.work/carried.md`). Read **Assumptions** first: a product choice in there
   is a question for the owner, not an assumption.
5. **Review.** Choose the panel with the `review-panel` skill. Reviewers get the diff, the brief
   and the project rules, never the builder's reasoning, and run in parallel with separate scopes.
6. **Fix.** Merge the findings into one file and run the `fix-round` skill: a fresh `fixer`, never
   the builder's session resumed.
7. **Re-check.** One combined re-check confirms the fixes. It does not reopen the review. New
   non-blocking points go to the carried list. After fix round 2, ask the owner whether to stop.
8. **Strict local check.** Run the `local-ci` skill on the final head. Full suites run here, once.
9. **Merge**, then update the roadmap and the QA board (`progress-boards` skill) in the same turn,
   and the system map if the project has one (`system-map` skill).

## Choosing a model

| Work | Model |
| --- | --- |
| Lookups, renames, a fix whose exact change is written down | haiku |
| Builders from a clear brief, fixers, QA, domain review, docs, translations, re-checks | sonnet |
| Security, architecture, money, concurrency, access control — building or reviewing | opus |

State the reason when you override a role's default.

## House rules for every agent you dispatch

Put these in every brief, because they were each learned the hard way:

- Never kill processes by pattern (`pkill -f`, `killall`). Stop only your own PID.
- In a shared checkout, commit by path: `git commit -m "…" -- <paths>`.
- Change only what the task needs; list Assumptions and Noticed; build nothing unasked.
- Split a task likely to need more than about 150 turns. An agent near the end of its context
  writes a handover file and stops.
