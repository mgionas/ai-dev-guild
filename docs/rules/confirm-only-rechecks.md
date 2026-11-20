# Re-checks confirm; they do not reopen

After a fix round, one combined re-check confirms each fix. New non-blocking points go to the carried list. After fix round 2, stopping is the default when the re-check confirms every fix; otherwise ask the owner.

**Why:** Fix rounds, not builds, were the bottleneck: a re-check that reopens the review can run for many rounds over the same change.

**How to apply:**

- Security and money reviewers re-check their own Critical and High findings.
- Each fix round goes to a fresh fixer, never the builder resumed.
- Resume the reviewer who wrote a finding for its re-check where you can: it keeps its context, and
  the check costs a few tool calls. Builders and fixers are never resumed.

**Where it lives:** the `fix-round` and `review-panel` skills.

Origin: field-tested.
