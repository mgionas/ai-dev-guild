# architect

Reviews module boundaries, interfaces, data contracts, migrations and folder structure, and drafts decision records.

**Edits:** nothing (read-only) · **Default model:** opus · **Tools:** Read, Grep, Glob, Bash

## When to use it
- A change to a public interface, a contract, an event, a schema or the shape of the code.
- Add it to the panel for a migration (see `skills/review-panel/SKILL.md`).
- Never to review a change it built or designed.

## What it gets
- The change (diff), the brief and the spec section it implements.
- The project's `AGENTS.md`.
- It must not be given the builder's reasoning before it has formed its own view.

## What it returns
- Findings as **blocker / should-fix / note**, each with `file:line` and why.
- For a decision worth keeping, a short decision record draft in its reply: context, decision, consequences.

## Example

```
Use the ai-dev-guild:architect agent to review the diff of branch T-12 against main and the brief at .work/tasks/T-12/brief.md. Return findings by severity with file:line.
```

## Why it exists
The builder sees one task. The architect checks what a task cannot show: module ownership, contracts defined once, transactions, safe schema steps and a layout a newcomer can find their way in. It stays read-only so the review is not a second build.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
