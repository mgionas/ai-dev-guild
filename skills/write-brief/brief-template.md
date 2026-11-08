# Task <id>: <one-line title>

**Goal:** <one sentence>

**Role:** builder | money-specialist | db-migrations | fixer   **Model:** <haiku | sonnet | opus, and why if not the default>

## Scope

- May change: <files and folders>
- Must not touch: <files and folders>
- Public interfaces it may call: <list>

## Read first

- `AGENTS.md` (lines <a–b>)
- <spec or plan section, with line range>
- <glossary entries for the terms this task uses>

## Acceptance criteria

1. <a check someone else could run>
2. …

## Tests

- Covering tests: <existing test files for this area>
- New tests go: <beside the file they test, or the project's rule>
- Guard tests to run: <boundary check, protected-paths check, docs index, system map, …>
- Commands: <exact test, lint, typecheck commands>

## Owner's answers

> <question> — "<answer, quoted>" (<date>)

## House rules

- Never kill processes by pattern. Stop only a process you started, by its PID.
- Others may share this checkout: commit by path (`git commit -m "…" -- <paths>`).
- Change only what this task needs. List Assumptions and Noticed. Build nothing not asked for.
- No personal data in code, fixtures, logs or commits.

## Report

Write `.work/tasks/<id>/report.md` with these headings:

- **Done** — what changed, by file.
- **Evidence** — each command you ran and its pasted output.
- **Assumptions** — each choice the brief left open: what you chose, the other reading, why.
- **Noticed** — problems outside the task, with `file:line`, not fixed.
- **Questions** — what only a person can decide.
