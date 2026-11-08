# stack-advisor

Proposes the tools and online services a project should start with, and how to build and test on
them.

**Edits:** writes one proposal file (`docs/stack.md`) · **Default model:** opus · **Tools:** Read, Grep, Glob, Write, WebSearch, WebFetch

## When to use it

- A project has no stack yet, and the person building it is not sure where to start.
- Before adding a hosted service to an existing project (a new database, email, payments).
- Not to reopen choices already made, unless the brief asks.
- Usually through the [`stack-advice`](../../plugin/skills/stack-advice/SKILL.md) skill, which asks the user the questions first.

## What it gets

- `.work/stack/brief.md`: the project in the user's words, where the users are, the budget to start, who builds it, and what is already chosen.
- The project's `AGENTS.md` and existing config, if there are any.
- Never account details, keys or personal data.

## What it returns

- `docs/stack.md`: one row per layer (recommended, alternative, why, free tier with link and date, paid step, regions, lock-in).
- How to build and test: local, a preview per change, database branches, staging with fake data, production.
- Monthly cost at three sizes, decisions for the user as a batch, and every source with its date.
- **Assumptions** about the project and **Questions** only the user can answer.

## Example

```
Use the ai-dev-guild:stack-advisor agent with the brief at .work/stack/brief.md. Write docs/stack.md.
```

## Why it exists
It runs on opus because a wrong stack is expensive to undo once code and data depend on it.

Newcomers lose days choosing between services, or pick one that is not available in their country
or has no way to test safely. This role checks current plans and regions online, prefers open
standards so nothing traps the project, and leaves every decision and every sign-up to the user.

Origin: new.
