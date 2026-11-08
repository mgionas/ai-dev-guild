---
name: write-brief
description: "Write a task brief file a fresh agent can work from alone — goal, scope, files, acceptance criteria, the covering tests and the repo's guard tests, the owner's answers and the report path. Use before dispatching any builder or fixer."
argument-hint: "<task id>"
---

A fresh agent knows only what the brief says. Write it to `.work/tasks/<id>/brief.md` from
`brief-template.md` in this skill's folder.

A good brief:

- **States the goal in one sentence**, then the scope: the files and folders the agent may change,
  and what it must not touch.
- **Names the acceptance criteria** as checks someone else could run.
- **Names the covering tests**: which existing test files cover this area, and where new tests go.
- **Names the repo's guard tests**: the checks that catch rule breaks the agent will not think of
  (boundary rules, protected files, a docs index, a system map). An agent cannot run a check it
  does not know exists.
- **Gives the owner's answers** to this task's questions, quoted, with the date.
- **Points to long documents by line range**, never "read the plan". A 400 KB plan read by every
  agent is the most expensive line in a brief.
- **Carries the house rules** (no pattern kills, commit by path, scope, assumptions, nothing
  unasked).
- **Gives the report path and its headings**: `.work/tasks/<id>/report.md`, with the headings from
  `report-template.md` in this skill's folder copied into the brief, since the agent cannot see the
  plugin's files.

Before you send it, read it as the agent will: is there a choice it must make that you could make
now? Make it, or make it a question for the owner.
