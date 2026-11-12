# builder

Builds one task from a brief file and writes a report file with evidence.

**Edits:** code in the brief's scope · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- It assumes no country: UTC and IANA time zones, money with its currency code, locale formatting.
- Any implementation task that has a brief.
- One task per agent; split a task that is too large.
- Never use it to review its own work, or to fix review findings (use `fixer`).

## What it gets
- The path of the brief file. The brief is its whole world.
- It then reads the project's `AGENTS.md` (or `CLAUDE.md`), the nearest folder `AGENTS.md` and the glossary.
- The path where it must write its report.
- It must not be given a review's findings to fix; those go to a fresh `fixer`.

## What it returns
- A report file at the path in the brief, under the headings the brief gives, with six parts:
- **Done**: what changed, by file.
- **Evidence**: the commands run and their pasted output. No output, no "done".
- **Tests changed**: any existing test assertion changed or removed, and why.
- **Assumptions**: each choice the brief left open, what it chose, the other reading, and why.
- **Noticed**: problems seen outside the task, with `file:line`, which it did not fix.
- **Questions**: anything only a person can decide.

## What it also does
- If the project builds screens: every state the spec names, with any it could not reach listed, and the accessibility checks (keyboard, focus, labels, contrast).
- Comments on exported code that give the reason, new files in their feature folder, and, if the project has a system map, the map updated in the same change with its check run.

## Example

```
Use the ai-dev-guild:builder agent with the brief at .work/tasks/T-12/brief.md. Write your report to .work/tasks/T-12/report.md.
```

## Why it exists
One fresh agent per task keeps the work inside the brief. It works test first, changes only what the task needs and must paste evidence, so the controller can check the work without redoing it.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
