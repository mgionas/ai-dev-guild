# money-specialist

Builds and reviews code that computes, stores or moves money: prices, proration, invoices, payments, refunds, balances.

**Edits:** code in the brief's scope (as builder); nothing as reviewer · **Default model:** opus · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- Any change that touches money.
- As the builder, or as the reviewer of a change someone else built.
- Never both on one change. A money change also gets a human review.

## What it gets
- As builder: the brief path, and the project's money rules.
- As reviewer: the diff, the brief and the project's money rules.
- The rules about what is charged, when and to whom belong to the product owner. If they are missing, it asks.
- As reviewer, it must not be given the builder's reasoning.

## What it returns
- As builder: the builder's report (Done, Evidence, Assumptions, Noticed, Questions), plus the list of cases its tests cover.
- As reviewer: findings as **blocker / should-fix / note**, each with `file:line`.

## Example

```
Use the ai-dev-guild:money-specialist agent as reviewer on the diff of branch T-12 against main, with the brief at .work/tasks/T-12/brief.md. Return findings with file:line.
```

## Why it exists
Money bugs are quiet and costly. The role holds the fixed rules: integer minor units stored with their currency code, no assumed country, a written rounding rule, issued records never edited, and edge-case tests first. Keeping builder and reviewer separate stops one mind from checking its own arithmetic.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
