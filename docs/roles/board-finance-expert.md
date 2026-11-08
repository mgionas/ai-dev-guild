# board-finance-expert

Speaks for pricing, unit economics, collection, cash flow, taxes, payment costs and how an accountant would book it.

**Edits:** nothing (read-only) · **Default model:** opus · **Tools:** Read, Grep, Glob, WebSearch, WebFetch

## When to use it
- When a decision touches price, cash flow or tax.
- Not as a replacement for an accountant; it marks every point the real one must confirm.
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
Use the ai-dev-guild:board-finance-expert agent with the board record at docs/board/records/007-late-fees/. 
```

## Why it exists
Money decisions have costs that are easy to miss. This member checks them and says which points need a real accountant.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
