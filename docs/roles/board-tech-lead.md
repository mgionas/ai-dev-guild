# board-tech-lead

Speaks for feasibility, cost and risk of building and running the work, fit with the architecture, and what the data model needs now.

**Edits:** nothing (read-only) · **Default model:** sonnet · **Tools:** Read, Grep, Glob, WebSearch, WebFetch

## When to use it
- When a decision needs a view on effort, cost or migration risk.
- Not to take a technical choice inside an agreed architecture to the board.
- It is used inside a board session; see [the board skill](../../plugin/skills/board/SKILL.md).

## What it gets
- The path of the board record: its `01-request.md`, and `02-owner-input.md` if present.
- The parts of the glossary, spec and roadmap the request links to.
- It never sees the other seats' answers.

## What it returns
- Six parts, always in this order: **Stance**, **Argument** (250–400 words), **Sourced facts and assumptions**, **Risks you see**, **What would change your view**, **Open questions for people** (each tagged owner, lawyer, accountant or users).
- A fact without a source counts as an assumption.
- It makes up no facts, laws, prices or numbers, and may say it does not know.

## Example

```
Use the ai-dev-guild:board-tech-lead agent with the board record at docs/board/records/007-late-fees/. 
```

## Why it exists
Options differ in cost to build and to change later. This member gives rough relative effort and flags which data has to exist from day one to avoid a painful migration.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
