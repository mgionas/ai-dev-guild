---
name: system-map
description: "Keep a system map — which feature owns each API operation, screen, table, folder and job — current with every change, guarded by a check that refuses anything new and undescribed. Use when a project wants one, and on every change in a project that has one."
---

A system map answers "what is this for, and what else does it touch?" in plain words. It stays
true only if the code is read, never retyped, and a check refuses drift.

A working starting point for the check lives in the repository, not in the plugin (the listed
plugin ships Markdown only): <https://github.com/mgionas/ai-dev-guild/tree/main/examples/system-map>.
It reads operations from an OpenAPI document, screens from a folder of route files and tables from
SQL migrations, and a project whose code declares them another way writes one small reader. Copy it
into the project, adapt it, and keep the rules below. The starter refuses undescribed operations,
screens and tables; folders, jobs and outside services follow the same idea, but they are rules a
project adds, with a reader of its own, when it needs them. Run it with `--base <ref>` (the branch
the change merges into) in the local gate and in CI: that is what makes a growing baseline fail.

## The shape

- **Read from the code:** the list of API operations, screens, tables, folders and jobs comes from
  the code itself (route files, schema, folder tree), never typed by hand.
- **Written by people:** a features file per area says, in the product owner's words, which feature
  each item belongs to, and which outside systems and services each feature uses.
- **A baseline that only shrinks:** items that existed before the map are listed as undescribed.
  The check fails if the list grows (it compares the file with the base branch's copy, so it needs
  that ref); describing an item takes it off.

## The check refuses

- an operation, screen or table no feature describes;
- a new folder with source files and no stated job (a folder `AGENTS.md`, or a line in the map);
- a background job whose start function has no comment;
- an outside system or service nothing uses.

## The rule for every change

Update the map in the same change, run the check yourself, and paste its output in the report.
If the check also runs inside the test suite, know what it sees: a version that reads only staged
or committed files can pass before `git add` where the command line fails.

## The layout

The starter keeps the map in `docs/system-map/`: `areas.yaml` (id, name, explanation, which areas
each builds on), one `features/<area-id>.yaml` per area (id, name, explanation, status `built`,
`building` or `planned`, and the operations, screens, tables and decisions the feature owns), and
`undescribed.yaml` (the baseline). A feature lives in the file of its area, so two branches
adding features to different areas never edit the same lines. The starter's README has the exact
shape of each file and a small worked example.

## The published page

If the project can publish a page that others open in a browser, the map has one design: the code
block in `system-map-page.md` in this skill's folder. Copy it, replace `{{PROJECT}}` (twice) and
change nothing else. It has a header (what the map is, last refresh, counts, "what changed"), a
search box and four tabs: **Areas** (one card per area with a built, building and planned bar; a
click filters Features), **Features** (cards with status, area, explanation, the operations,
screens and tables the feature owns, and the decisions behind it; filters by area and status),
**System** (every operation, screen and table with the feature that owns it, and the packages if
the project lists any) and **Not yet described** (the baseline).

It reads five documents from its database collection `map`, as the starter's `check.mjs --out
<dir>` writes them (`<name>.json` is the body of the document `<name>`):

| Doc | Fields |
| --- | --- |
| `meta` | `counts{areas,features,built,operations,screens,tables}`; optional `updated`, `latestMigration`, `changes[]` |
| `areas` | `items[{id,name,explanation,buildsOn[],progress}]` (`progress`: `none` · `part` · `all`) |
| `features` | `items[{id,area,name,explanation,status,decisions[],operations[],screens[],tables[]}]` |
| `system` | `packages[{name,kind,folder,uses[]}]`, `operations[{id,method,path,tag}]`, `screens[{site,route}]`, `tables[]` |
| `unclaimed` | `operations[]`, `screens[]`, `tables[]` |

The check writes no date and no change list, so add `updated` (YYYY-MM-DD) and `changes` (a few
plain sentences on what the refresh did) to `meta` when you seed it.

Declare `{"db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}}` when publishing. The
page then holds no rows: after publishing, seed the five documents with the artifact database
tool, and refresh them in the same turn as every change that touches the map (run the check with
`--out`, read the live documents, write the five in one batch pinned to the versions read).

When the person does not publish artifacts, write the page as a plain file with the `page-data`
block filled in (the five documents under their names, every `<` written as `\u003c`) and rewrite
that block on every refresh. The map files stay the source either way.
