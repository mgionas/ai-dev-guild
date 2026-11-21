---
name: progress-boards
description: "Keep a roadmap and a QA board current with every change — status per task, and for each update the features it touched and the checks a tester should run. Use in the same turn as every merge, status change or progress report."
---

The owner should see progress without asking, and testers should know what changed and what to
retest. Both go stale the first time they are skipped, so they are updated in the same turn as the
change, unprompted.

## The roadmap

Milestones, and under each its tasks, one per plan task, each with a stage: planned → building →
review → fixing → merged (or waiting on the owner, or paused when nobody is on it). A progress report without a roadmap update is
incomplete, and that includes relaying a parallel agent's result. Mark only what waits on the owner
now as needing the owner.

### Check it against git

Updating by hand is the rule, and under load it gets skipped: merged work keeps showing as being
built, stalled work as active, and a milestone keeps a status nobody has touched for weeks. So after
every merge and every agent hand-back (other than the keeper's own), run the `status-keeper` agent,
and give it the steps still running (it cannot see other agents). Also schedule it once a day, if
the project can run scheduled tasks, so a forgotten run is caught the next morning; with no list of
running work, that run only reports stalled steps. It changes a status only with evidence and
reports each change as "from → to, evidence"; read its report before you send the owner yours.

A status the page stores for a parent (a milestone, an item with steps) is the one that drifts,
because nothing updates it when its children change. Work it out from the children where the page
can, and check it where it cannot.

The `roadmap` skill builds the first version; this skill keeps it current. Refresh the
`project-map` page in the same turn when a merge adds a part, a link or a folder.

## The QA board

One entry per update (a merge, a fix round that changes behaviour, a release): date, title, a
plain summary, the branch or commit, and the features it touched. Each feature gets checks:
title, steps, the test account or role to use. Testers set pass / fail / blocked with a note.

- Reuse a feature's id when a change touches it again; add new checks for a retest.
- Never overwrite a tester's status or note.
- Before writing a batch, list the ids already there and refuse a clash.
- No personal data in checks: test accounts are named by role.

### The published QA board page

The page is the code block in `qa-board-page.md` in this skill's folder: copy it, replace
`{{PROJECT}}` (twice), change nothing else. It has a totals bar, grouping by update or by feature,
filters (result, account, search), and for each check Pass / Fail / Blocked buttons, a note that
saves itself, and who marked it and when.

It reads its rows one of two ways, so it works for every user:

1. **The artifact's database** when the view can run it. Declare
   `{"db": {"rules": [{"path": "", "read": "view", "write": "admin"}, {"path": "checks", "read": "view", "write": "interact"}]}, "user": {"scopes": ["profile"]}}`
   when publishing: testers with at least interact access record results, and only editors change
   updates and features. A tester's result updates the check's document with their id (names are
   looked up when the page draws, never stored). Seed and change updates, features and checks with
   the artifact database tool after publishing, never in the page.
2. **Rows embedded in the page**, when the person does not publish artifacts: write the page as a
   plain file with the `page-data` block filled in. The controls are then read-only and say that
   results are saved only on the published page.

| Collection | Fields |
| --- | --- |
| `updates` | `date` (YYYY-MM-DD), `title`, `summary`, `branch`, `commit`, `features` (feature ids, in display order), `order` |
| `features` | `name`, `area` (a group heading), `where` (where to find it), `order` |
| `checks` | `featureId`, `updateId`, `title`, `steps` (how to test), `account` (the role to test with), `status` (`open` · `pass` · `fail` · `blocked`), `note`, `by` (the tester's user id), `at` (ISO time of the result), `order` |

### How every page looks

All published pages share one design, written out in `page-design.md` in this skill's folder: tokens
for both themes, fonts, status colours, components and layout. Read it before you build or change
a page, start from its tokens, and add no colour or size of your own. If the project already has a
design system or brand, ask the owner whether its pages use the house look or the project's.

## Where they live

Markdown files in the repository (`docs/roadmap.md`, `docs/qa-board.md`) are enough to start and
stay the source of truth. Each also ships as a page (above); keep the same fields either way.
