# fixer

Fixes a precise list of review findings in a fresh context and reruns only the tests that cover them.

**Edits:** code and tests named by the findings · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- Every fix round after a review.
- Use it instead of sending the findings back to the original builder.
- Not for new features or for findings that were not written down.

## What it gets
- A findings file and a report path.
- The files each finding names, and the project's `AGENTS.md`.
- It must not be given the builder's reasoning. It starts fresh and has not seen it.

## What it returns
- A report with one entry per finding:
- **Fixed**, with the test that proves it and its pasted output.
- **Not fixed**, with the reason. A finding it disagrees with gets a written reason, never a silent skip.
- **Assumptions** and **Noticed**, as the builder reports them.

## Example

```
Use the ai-dev-guild:fixer agent with the findings file .work/tasks/T-12/findings.md. Write your report to .work/tasks/T-12/fix-report.md.
```

## Why it exists
A resumed builder tends to defend its first answer. A fresh fixer reads only the findings, adds a test that fails without each fix, and runs only the tests that cover the change. The full suite runs once, later, before merge.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
