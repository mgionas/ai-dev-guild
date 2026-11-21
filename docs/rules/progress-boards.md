# Update the boards with every change

In the same turn as every merge or status change, update the roadmap and the QA board: what changed, which features it touched, what to retest.

**Why:** Boards go stale the first time they are skipped, and then nobody trusts them. Testers need one place that says what to retest.

**How to apply:**

- Never overwrite a tester's result.
- A progress report without a roadmap update is incomplete.
- After every merge and agent hand-back (not its own), and once a day, the `status-keeper` agent checks the roadmap against git, because updating by hand gets skipped under load.
- A parent's status the page stores on its own (a milestone, an item with steps) is worked out from its children or checked against them.

**Where it lives:** the `progress-boards` skill and the `status-keeper` role.

Origin: field-tested.
