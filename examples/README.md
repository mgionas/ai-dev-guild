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
| [`skills/new-module`](skills/new-module/SKILL.md) | A backend of modules that each own their data | one entry point, limits keyed by who they refuse, retention, tests at the boundary |
| [`ci-local/`](ci-local) | Node.js 22 or later | the strict local check: a pure `classify()` for affected or full, the build tool's selection checked, clean env, log per step, one verdict line; tests that pin the step list against the workflow; optional flake retry and file-change probe |
| [`system-map/`](system-map/README.md) | Node.js 22 or later, one dependency (`yaml`) | the system map check: facts read from an OpenAPI document, route files and SQL migrations; refuses what no feature describes; a baseline that only shrinks |

A good project skill is the order to do things in, plus every trap that cost someone a review
round, each with the reason. Write it after the second time a reviewer finds the same thing.
