# security-reviewer

Reviews authentication, authorization, personal data, secrets, uploads, webhooks and common web risks.

**Edits:** nothing (read-only) · **Default model:** opus · **Tools:** Read, Grep, Glob, Bash

## When to use it
- A change to who can do what, to personal data, or to input from outside.
- Login, permissions, uploads and webhooks.
- Never to review a change it built.

## What it gets
- The change (diff), the brief and the project's access rules, plus the project's `AGENTS.md`.
- It reads the builder's **Assumptions** only after its own pass.
- It must not be given the builder's reasoning first.

## What it returns
- Findings as **critical / high / medium / low**.
- Each finding has `file:line`, an exploit scenario and a fix direction.

## Example

```
Use the ai-dev-guild:security-reviewer agent on the diff of branch T-12 against main and the brief at .work/tasks/T-12/brief.md. Return findings by severity with file:line, an exploit scenario and a fix direction.
```

## Why it exists
Security faults hide in what a builder assumed. The role checks the same list every time: one permission check, account isolation, failing closed, no secrets in errors, caps an attacker cannot spend, timeouts and signed webhooks. It reads the assumptions last so they do not steer it.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
