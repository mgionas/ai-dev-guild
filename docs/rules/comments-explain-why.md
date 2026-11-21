# Comments explain why

A good comment tells a colleague what the code cannot: why it is written this way, or what would go wrong if it were changed. Restating the code adds nothing.

**Why:** The code already says what it does. The reason is the part that is lost.

**How to apply:**

- Exported functions and types get a short comment.
- Code that carries a business rule links to where the rule is written.
- A comment never names a plan task, a fix round, a review finding or the number of an owner's
  answer ("added in task 14", "fix round 2"). A newcomer cannot use them, and they pile up: in one
  project about a third of the source lines were comments, much of it plan history. Give the
  reason and link the decision that set it; the history is in git and the plan.
- Enforce it with a check that refuses new task references in source files. Clean old ones only
  when a file is touched anyway, so the rule costs nothing extra.

**Where it lives:** the `architect` and `docs-keeper` roles.

Origin: field-tested.
