---
name: new-migration
description: "EXAMPLE (PostgreSQL with row-level security): add a schema change safely — expand only, an isolation policy on every account-scoped table, a test that proves it, and a retention answer. Rewrite for your stack before use."
---

> Example skill. It assumes PostgreSQL, row-level security, and an app that connects with its own
> role. Replace the paths and names with your project's.

The builder is `db-migrations`; reviewers are `db-migrations` (if not the builder) and `architect`.

1. **Name it from the glossary.** Tables and columns use agreed terms. A missing concept is a
   question, not an invention.
2. **Expand only.** Add tables and nullable columns. Never drop, rename or narrow in the same change.
   Once a migration is applied anywhere it is never edited, only followed.
3. **Generate, then read the SQL.** Generators are usually right, not always.
4. **Isolate account-scoped tables.** In a hand-written migration: grant the app role only what it
   needs (an append-only table gets `SELECT, INSERT`), `ENABLE` **and** `FORCE ROW LEVEL SECURITY`,
   and a policy comparing the row's account id with the session setting.
   `FORCE` matters: without it the table owner skips the policy, and a test that never connects as
   the owner never notices it is missing.
5. **Prove isolation** with an integration test that connects as the app role, writes rows for two
   accounts, and shows each sees only its own. Then remove the policy on purpose and watch the test
   fail.
6. **Answer retention.** Who deletes old rows, and when? A table that only grows becomes a full scan,
   and a full scan under a lock becomes a queue that empties the connection pool.
7. **Check the plan.** Run `EXPLAIN` on the real statements the code sends. Do not infer index use
   from shared counters other sessions also move.
8. **Report** with the migration output and the test output pasted.
