# Examples

These are **not loaded by the plugin.** They are tied to one stack, so they live here as
starting points. Copy one into your project's `.claude/skills/<name>/` and rewrite it for your
stack, your paths and your rules.

| Example | Assumes | Shows |
| --- | --- | --- |
| [`skills/new-migration`](skills/new-migration/SKILL.md) | PostgreSQL with row-level security | expand-only migrations, isolation tests, retention |
| [`skills/new-endpoint`](skills/new-endpoint/SKILL.md) | A TypeScript API with shared schema validation (for example Zod) | contract first, strict input, stable error codes |
| [`skills/new-event`](skills/new-event/SKILL.md) | A transactional outbox in a relational database | events written in the same transaction, idempotent handlers |
| [`skills/new-screen`](skills/new-screen/SKILL.md) | A web front end with a component library and translation files | spec first, every state, gate inside the page |
| [`ci-local/ci-local.mjs`](ci-local/ci-local.mjs) | Node.js 22 or later | the strict local check: affected steps by default, full when needed, clean env, log per step, one verdict line |

A good project skill is the order to do things in, plus every trap that cost someone a review
round, each with the reason. Write it after the second time a reviewer finds the same thing.
