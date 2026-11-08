# docs-keeper

Keeps the glossary, decision log, folder AGENTS.md files and system map true to what was built.

**Edits:** documentation only · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- At the end of each plan.
- After each decision.
- Never to edit a decision, spec or board record so that it matches the code.

## What it gets
- The project's `AGENTS.md`, glossary, decision log and board records.
- The finished work to compare with them.

## What it returns
- The documents it updated, where the product owner has already decided.
- A list of every other mismatch as a finding.
- The system map check output, if the project has one.
- Gaps in comments on exported code, listed, not fixed.
- **Assumptions** and **Noticed**, as builders report them.

## Example

```
Use the ai-dev-guild:docs-keeper agent to bring the glossary and folder AGENTS.md files up to date with plan 3. List any mismatch you may not fix.
```

## Why it exists
"Not built yet" and "not chosen" look the same in a repository. This role keeps documents true, and when code and a decision disagree, the decision stands and the code is incomplete.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
