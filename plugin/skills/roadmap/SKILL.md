---
name: roadmap
description: "Build a roadmap anyone can follow from a spec, plan or idea — milestones that each deliver something a user can see, one step per task with a stage (planned, building, review, fixing, merged), what waits on the owner, and what comes later with what is done now to keep room for it. Use at the start of a project or a new phase; the progress-boards skill keeps it current."
argument-hint: "[spec or plan path]"
---

A newcomer's question is "what happens next, and how far along are we?" A roadmap answers it in one
page. Build it once from the plan, then keep it current with every change (`progress-boards`).

## 1. Read what exists

The spec, the plan and the decision log, or the user's description if there is nothing written yet.
If there is no plan, ask the user for the goal of the first version in one sentence, and propose
milestones for them to accept. Never invent scope: what the documents do not say becomes a question.

## 2. Shape it

- **Milestones** each deliver something a user can see or try: "people can sign up", not "auth
  module". Three to seven for a phase. Order them so each one can be shown when it is done.
- **Steps** under each milestone, one per plan task, each small enough for one fresh agent. Each has
  a plain title, a reference to its plan task, and a stage:
  `planned → building → review → fixing → merged`, or `waiting on owner`.
- **Waiting on the owner** is marked on the steps that wait for a decision now, and nowhere else.
- **Later**: things decided but deliberately left out of this phase. For each, one line on what
  this phase does now so it can be added later without a redesign. That line is what keeps "later"
  from becoming "rewrite".

## 3. Write it

Write `docs/roadmap.md`:

```markdown
# Roadmap — <phase name>

Updated <date>: <one sentence on where things stand>

## Now

### M1 <milestone> — <done | active | planned> (<merged>/<total> steps)

| Step | Stage | Plan task | Note |

## Next

## Later

| Item | Why not now | What we do now so it fits later |
```

If the project can publish a page that others open in a browser (for example a hosted page or
an artifact), render the same content there as well, with a progress bar per milestone, and keep
`docs/roadmap.md` as the source.

### How the published page looks

Every roadmap page uses one design: the code block in `roadmap-page.md` in this skill's folder.
Copy it, replace `{{PROJECT}}` (twice) and `{{PHASE}}` (once), and change nothing else: not the
tokens, fonts, lanes, labels or script. The page is:

- a header: eyebrow `<PHASE> · delivery roadmap`, the title `<Project> Roadmap`, a one-line
  headline of where things stand, and the "Last updated" date;
- a **milestone track**: one card per milestone with its code, name, status pill and a progress
  bar ("3 of 7 items done"); clicking a card filters the board to it;
- a legend: done, in progress, planned, pending, and "needs you";
- a **four-lane board** (Completed, In progress, Planned, Pending & backlog) of work items, each
  with a note, its milestone and reference tags, and a red "needs you" mark when it waits on the
  owner; an item with subtasks shows a progress bar and a four-step strip per subtask
  (built, reviewed, fixed, merged).

It reads its rows one of two ways, so it works for every user:

1. **The artifact's database** (the `db` capability) when the view can run it. Declare
   `{"db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}}` when publishing. A status
   change is then a data write, never a republish: seed and update the rows with the artifact
   database tool after publishing, in the same turn as the `docs/roadmap.md` change. Never
   hard-code rows in the page.
2. **Rows embedded in the page**, when the person does not publish artifacts: write the page as a
   plain file with the `page-data` block filled in (the same collections as arrays, each row with
   an `id`), and rewrite that block on every change.

`docs/roadmap.md` stays the source of truth either way.

| Collection / doc | Fields |
| --- | --- |
| `meta/info` (embedded: `meta`, one row with `id: "info"`) | `headline`, `updated` (YYYY-MM-DD) |
| `milestones` | `code`, `name`, `status` (`done` · `active` · `planned` · `pending`), `order`, optional `summary` (shown when the milestone has no items) |
| `items` | `title`, `note`, `milestone` (a milestone's id, or none for backlog), `status` (same four), `order`, `ref` (e.g. `Task 3`, `Later`), `needsOwner` (true when it waits on the owner), optional `subtasks`: `[{title, ref, stage, note}]` with `stage` one of `planned` · `building` · `review` · `fixing` · `done` · `waiting` |

One item per plan task; the owner's open actions are items with `needsOwner: true`; the "Later"
table becomes pending items with `ref: "Later"`.

## 4. Keep it alive

Every merge, stage change or progress report updates the roadmap in the same turn: the step's
stage, the milestone's count, and the "Updated" line. A progress report without a roadmap update is
incomplete. Plain language only, no task jargon, no personal data.
