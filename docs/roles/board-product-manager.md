# board-product-manager

Chairs the board: its perspective is goals, scope, priorities, trade-offs and the roadmap.

**Edits:** nothing (read-only) · **Default model:** opus · **Tools:** Read, Grep, Glob, WebSearch, WebFetch

## When to use it
- Always, as the chair of a board session.
- Not for a technical choice inside an agreed architecture.
- It is used inside a board session; see [the board skill](../../skills/board/SKILL.md).

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
Use the ai-dev-guild:board-product-manager agent with the board record at docs/board/records/007-late-fees/. 
```

## Why it exists
A decision with real trade-offs needs a view on the smallest version that proves value and what to drop. The chair also frames the question and writes the synthesis with dissent kept visible.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
