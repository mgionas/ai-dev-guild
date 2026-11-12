---
name: new-module
description: "EXAMPLE (a backend with modules that own their data): add a module — a folder with one public entry point, its own data, limits that cannot become outages, retention for anything that grows, tests at its boundary, and a folder guide that is true. Rewrite for your stack before use."
---

> Example skill. It assumes a backend split into modules that each own their tables and expose one
> entry file. If the project uses a relational database, a job runner or an events table, adapt the
> steps that mention them. Replace the paths and names with your project's.

Reviewed by `architect`; by `db-migrations` for its tables; by `security-reviewer` too if it touches
access, money or personal data. The builder never reviews their own module.

1. **Name it from the glossary.** The module, its entities and its states use agreed terms. A
   concept with no name is a question, not an invention: renaming later touches the schema and
   every caller.
2. **Lay out the folder.** One public entry file and nothing else public; everything behind it in
   feature folders named with the glossary's term for the feature. A new file goes in the feature
   it belongs to, with its test beside it. Other modules import the entry file only, and a
   dependency check enforces it. Do not export a test double, or a lookup that takes any id and
   returns anything: expose the narrow function that does the one thing.
3. **Give it its own data and say who owns it.** Its tables live in its own namespace, written by
   this module only. Put every rule the code believes in the database as well (a constraint, not
   only a type), because a script or a manual session reaches the table without your code. An
   allowed value that nothing can write does not belong in the constraint.
4. **Bound every transaction**, reads included. Set a lock wait and a statement time limit, so one
   stalled request cannot hold every pooled connection and take down unrelated work.
5. **Design each limit by asking who it refuses.** For every cap, rate or budget write down: can a
   stranger fill it cheaply? When it is full, who is refused: the one who filled it, or everyone?
   If everyone, it is an outage waiting for an attacker; make it an alert, or key it by the smaller
   unit (per user, per requester). Then do the multiplication with real numbers; a cost described
   in adjectives hides an error of a hundred times. Never count against a limit work that cannot
   succeed.
6. **Plan retention before the table exists.** Who deletes old rows, how often, and with which
   role? Export a prune function that takes the cutoff as a parameter. A table that only grows
   becomes a full scan, and a full scan under a lock becomes a queue. If the retention period is a
   product or legal question, record it as an open question; do not pick a number.
7. **Let no raw error escape.** Assume any error you did not build contains its inputs (a database
   driver's message may end with every parameter). Recognise the errors you can act on, and wrap
   the rest in your own error carrying a code and nothing else. Read a record with a key from
   outside through a map or an own-property check, never a plain index.
8. **Refuse to start on a configuration that cannot work.** Read the environment once at the wiring
   edge, give every setting a ceiling as well as a floor, and fail at boot for what would otherwise
   stay silently broken. Decide what an unrecognised value means, and make it mean "no".
9. **Test at the boundary.** Unit tests for the pure logic; tests against a real database for
   anything with a transaction, a lock or a constraint. For each guard, remove it on purpose and
   watch its test fail, one test per guard. Assert exact values, not "at least".
10. **Write the folder guide, and make it true.** List the public functions, the events it sends
    and receives, the invariants, each limit with its setting, and every error a function can
    throw. State the rule the module exists to enforce and what would break it. A claim the code
    does not support is worse than none: make the code true first, then soften the sentence.
11. **Update the project map** in the same change if the project has one (`system-map` skill), and
    run its check.
12. **Report** with the build, test and check output pasted.
