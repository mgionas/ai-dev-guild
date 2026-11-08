---
name: progress-boards
description: Keep a roadmap and a QA board current with every change — status per task, and for each update the features it touched and the checks a tester should run. Use in the same turn as every merge, status change or progress report.
---

The owner should see progress without asking, and testers should know what changed and what to
retest. Both go stale the first time they are skipped, so they are updated in the same turn as the
change, unprompted.

## The roadmap

Milestones, and under each its tasks, one per plan task, each with a stage: planned → building →
review → fixing → merged (or waiting on the owner). A progress report without a roadmap update is
incomplete, and that includes relaying a parallel agent's result. Mark only what waits on the owner
now as needing the owner.

## The QA board

One entry per update (a merge, a fix round that changes behaviour, a release): date, title, a
plain summary, the branch or commit, and the features it touched. Each feature gets checks:
title, steps, the test account or role to use. Testers set pass / fail / blocked with a note.

- Reuse a feature's id when a change touches it again; add new checks for a retest.
- Never overwrite a tester's status or note.
- Before writing a batch, list the ids already there and refuse a clash.
- No personal data in checks: test accounts are named by role.

## Where they live

Markdown files in the repository (`docs/roadmap.md`, `docs/qa-board.md`) are enough to start.
A shared page with its own small database works better once testers mark results; keep the same
fields either way.
