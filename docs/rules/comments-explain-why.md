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
- Enforce it with a check the project adds (a lint rule or a CI step): refuse new source lines
  matching words such as `task \d+`, `fix round`, `finding \d+` or `answer \d+`, tuned to how the
  project numbers its tasks. The guild ships no such check; the `architect` proposes it. Say in
  the rule which forms the check catches, so nobody reads "the check passed" as "no plan history
  anywhere".
- Where old references are many, make the check a ratchet: count them per file, refuse any new
  one, and refuse a file whose count goes up. Key the counts by path and follow renames (git's
  rename detection), or a moved file starts again at zero. The count can then only fall, without
  a clean-up pass first. Checking only the lines a change adds works too, if the check can see
  the base it compares with. In CI, fetch the main branch's history (GitHub's `actions/checkout`
  fetches one commit unless given `fetch-depth: 0`, or fetch the base branch yourself), and make
  the step fail when git cannot find the base. Otherwise `git diff <base>...HEAD` fails, and a
  check that ignores the failure gets no lines and passes having read nothing.
- Old references go only where your change already edits the line. List the rest under
  **Noticed** ([change only what the task needs](change-only-the-task.md)), or clean them as a
  task of their own.

**Where it lives:** the `architect` and `docs-keeper` roles.

Origin: field-tested.
