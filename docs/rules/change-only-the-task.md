# Change only what the task needs

Each line you change should be explainable by the task. Leave neighbouring code as it is, even when you would have written it differently. If you see a problem elsewhere, write it under **Noticed** with `file:line` instead of fixing it.

**Why:** Reviewers look hardest at what the task is about; a side edit slips past them. One of the most damaging slips seen was a clean-up that quietly rewrote a decision the owner had made.

**How to apply:**

- Do remove what your own change made pointless, like an import nothing uses any more.
- The controller moves Noticed items to a carried list, so they are scheduled, not lost.
- Refactoring is fine when it is the task, and then the brief lists what may be moved.

**Where it lives:** every builder role; the report template.

Origin: field-tested.
