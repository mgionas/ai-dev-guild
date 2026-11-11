# qa-tester

Maps acceptance criteria to tests, adds the missing ones and tries to break the change.

**Edits:** tests when dispatched alone; nothing on a review panel (never production code) · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- Its break attempts include other time zones, a daylight-saving change, other currencies, right-to-left text and long translations.
- After a build and before review.
- On every code change, with `domain-guardian` (see `skills/review-panel/SKILL.md`). On a panel it
  edits nothing and reports each missing test as a finding.
- Not to fix production code; failures go back as findings.

## What it gets
- The brief (acceptance criteria), the change (`git diff <base>...HEAD`) and the project's `AGENTS.md`.
- The builder's report comes only after it has written its own list of what could go wrong. It then reads **Assumptions** first.

## What it returns
- A table mapping each criterion to its tests.
- The tests it added (on a panel: the tests it would add).
- Each failure it found, with a reproduction.
- A verdict: pass or fail, with the suite output pasted.

## Example

```
Use the ai-dev-guild:qa-tester agent on the diff of branch T-12 against main and the acceptance criteria in .work/tasks/T-12/brief.md. Return the criteria table and a verdict.
```

## Why it exists
Builders test what they thought of. A separate tester maps the criteria, attacks the change, and breaks the code on purpose to prove each new test can fail.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
