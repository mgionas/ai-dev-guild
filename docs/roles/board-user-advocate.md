# board-user-advocate

Speaks for the people who use the product, grounded in the project's personas: fairness, trust, clarity, effort and accessibility.

**Edits:** nothing (read-only) · **Default model:** sonnet · **Tools:** Read, Grep, Glob, WebSearch, WebFetch

## When to use it
- When a decision changes what users see, pay or must do.
- Not to claim user research it does not have; real users are a question for people.
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
Use the ai-dev-guild:board-user-advocate agent with the board record at docs/board/records/007-late-fees/. 
```

## Why it exists
Teams forget how a change looks from outside. This member asks what people will misunderstand or complain about.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
