---
name: new-module
description: "EXAMPLE (a backend with modules that own their data): add a module — a folder with one public entry point, its own data, caps that cannot turn into an outage, cleanup for anything that grows, tests at its boundary, and a folder guide that is true. Rewrite for your stack before use."
---

> Example skill. It assumes a backend split into modules that each own their tables and expose one
> entry file. If the project uses a relational database, a job runner or an events table, adapt the
> steps that mention them. Replace the paths and names with your project's.

Reviewed by `architect`; by `db-migrations` for its tables; by `security-reviewer` too if it touches
access, money or personal data. The builder never reviews their own module.

1. **Name it from the glossary.** The module, its entities and its states all use agreed terms. A
   concept with no name yet is a question for the owner: a wrong name costs a rename across the
   schema and every caller.
2. **Lay out the folder.** One public entry file; everything behind it sits in feature folders named
   with the glossary's term for the feature, each new file next to its test. Other modules reach the
   module through the entry file alone, and a dependency check fails the build when they do not.
   Export narrow functions that do one job. A fake provider or a "fetch anything by id" helper
   does not belong on the entry file: whoever imports it can use it anywhere.
3. **Give it its own data.** Its tables live in a namespace that only this module writes to. Whatever
   the code relies on, the database should refuse as well, with a constraint, because scripts and
   hand-run queries never pass through your code. The reverse also holds: a constraint should list
   only values something can actually write, or it misleads whoever reads the schema.
4. **Bound every transaction**, reads included. A lock wait and a statement time limit stop one
   stuck request from holding a pooled connection and starving unrelated work.
5. **Size each limit by who it turns away.** For every cap, rate or budget, write down two things:
   whether someone with no account can fill it for free, and who is refused once it is full. If the
   answer is "everyone", it is an outage an attacker can trigger. Key it by the smaller unit (per
   user, per requester) or let it raise an alert instead of refusing. Check the sizing with real
   numbers worked out on paper, and never use up budget on requests that were doomed to fail.
6. **Plan retention before the first row.** Decide who deletes old rows, how often and under which
   role, and give that role a pruning function that accepts the cutoff date as a parameter. A table that only grows
   ends up scanned in full, and a full scan inside a lock backs everything up behind it. If the
   length of time to keep rows is a product or legal decision, log it as an unresolved question and choose no figure.
7. **Contain errors and outside input.** Drivers and adapters can echo the query or request that
   failed, parameters included. Wrap anything you cannot act on in your own error that carries a
   code and nothing else. Look up outside strings in a map or with an own-property check, never a
   plain index, and give a value you do not recognise the refusing outcome. Load the environment
   a single time where the app is wired together, bound each setting from above and below, and stop
   startup on a configuration that would otherwise fail unnoticed.
8. **Test at the boundary.** Pure logic gets unit tests; anything involving transactions, locks or
   constraints is tested against a real database. Remove each guard in turn and confirm a test
   fails, with each test removing only the guard it covers. Compare exact values rather than
   lower bounds.
9. **Write the folder guide, and keep it true.** List the public functions, which events go out and
   come in, the invariants, each limit alongside its setting, and all the errors a function may raise. Say
   which property the module protects and which change would remove it. If the guide and the code
   disagree, change the code first, and edit the guide only when the code cannot move. Finish by
   updating the project map if there is one (`system-map` skill), then **report** with the build,
   test and check output pasted.
