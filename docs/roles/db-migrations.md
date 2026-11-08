# db-migrations

Designs schema changes and writes backward-compatible migrations with the tests that prove them.

**Edits:** migrations, schema and their tests · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, Bash

## When to use it
- Any table, column, index or access-policy change.
- Not for application code that only uses the schema; use `builder`.
- Not to rewrite a migration that has been applied anywhere. It adds a new one.

## What it gets
- The brief path.
- The project's `AGENTS.md`, its database folder's `AGENTS.md` and the glossary entry for each table it touches.
- A reviewing `architect` is a different agent; the migration author does not review itself.

## What it returns
- A report as the builder role writes it, with the migration output and the integration test output pasted.
- It follows expand, migrate, contract, and states each new table's retention answer.
- If the project isolates accounts in the database, the report shows a test that one account cannot see another's rows.

## Example

```
Use the ai-dev-guild:db-migrations agent with the brief at .work/tasks/T-14/brief.md. Write your report to .work/tasks/T-14/report.md.
```

## Why it exists
A schema change is hard to undo once it is applied. The role keeps the rules together: never edit an applied migration, keep changes backward compatible, give each table a retention answer, and check indexes with `EXPLAIN` on the real statement.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
