# Re-checks confirm; they do not reopen

After a fix round, one combined re-check confirms each fix. New non-blocking points go to the carried list. After fix round 2, ask the owner whether to stop.

**Why:** Fix rounds, not builds, were the bottleneck: a re-check that reopens the review can run for many rounds over the same change.

**How to apply:**

- Security and money reviewers re-check their own Critical and High findings.
- Each fix round goes to a fresh fixer, never the builder resumed.

**Where it lives:** the `fix-round` skill.

Origin: field-tested.
