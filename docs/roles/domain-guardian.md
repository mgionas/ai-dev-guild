# domain-guardian

Checks specs, plans, screens and code against the project's glossary and business rules, and lists the product questions a task will raise before it is built.

**Edits:** nothing (read-only) · **Default model:** sonnet · **Tools:** Read, Grep, Glob

## When to use it
- On every change before merge.
- On every plan task before the build starts (a question sweep).
- Never to answer the product questions itself; they go to the owner.

## What it gets
- For a review: the change (diff) and the brief. It reads the project's `AGENTS.md`, glossary, business rules and decision log in full.
- For a question sweep: the task's plan text instead of a diff.
- It must not be given the builder's reasoning.

## What it returns
- A review returns **Terms**, **Rules** and **Gaps**. Gaps are questions for the product owner, with a recommended answer where one is reasonable.
- Every finding has a level (**blocker**, **should-fix** or **question**), its `file:line`, the glossary rule involved and the reason.
- A question sweep returns only the Gaps.
- If nothing is wrong, it says so plainly.

## Example

```
Use the ai-dev-guild:domain-guardian agent for a question sweep on the plan text of task T-12 in docs/plans/phase-1.md. Return only the Gaps.
```

## Why it exists
Names and rules drift as soon as several agents write code. This role holds the glossary and rules, and finds the owner's questions before the builder reaches them halfway through a task.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
