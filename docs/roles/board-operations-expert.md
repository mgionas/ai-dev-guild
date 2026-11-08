# board-operations-expert

Speaks for the people who run the service day to day: staffing, scheduling, service levels, contractors and quality control.

**Edits:** nothing (read-only) · **Default model:** sonnet · **Tools:** Read, Grep, Glob, WebSearch, WebFetch

## When to use it
- When a decision changes how the team works.
- Not for technical feasibility; that is `board-tech-lead`.
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
Use the ai-dev-guild:board-operations-expert agent with the board record at docs/board/records/007-late-fees/. 
```

## Why it exists
A rule that cannot be run on a bad day is not a rule. This member asks whether the team can do it on a normal day and on a bad one.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
