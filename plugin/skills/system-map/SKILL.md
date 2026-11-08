---
name: system-map
description: "Keep a system map — which feature owns each API operation, screen, table, folder and job — current with every change, guarded by a check that refuses anything new and undescribed. Use when a project wants one, and on every change in a project that has one."
---

A system map answers "what is this for, and what else does it touch?" in plain words. It stays
true only if the code is read, never retyped, and a check refuses drift.

No script ships with this skill: the check depends on how your code declares routes, screens
and tables. It describes what to build and the rules that keep the map true.

## The shape

- **Read from the code:** the list of API operations, screens, tables, folders and jobs comes from
  the code itself (route files, schema, folder tree), never typed by hand.
- **Written by people:** a features file per area says, in the product owner's words, which feature
  each item belongs to, and which outside systems and services each feature uses.
- **A baseline that only shrinks:** items that existed before the map are listed as undescribed.
  The check fails if the list grows; describing an item takes it off.

## The check refuses

- an operation, screen or table no feature describes;
- a new folder with source files and no stated job (a folder `AGENTS.md`, or a line in the map);
- a background job whose start function has no comment;
- an outside system or service nothing uses.

## The rule for every change

Update the map in the same change, run the check yourself, and paste its output in the report.
If the check also runs inside the test suite, know what it sees: a version that reads only staged
or committed files can pass before `git add` where the command line fails.
