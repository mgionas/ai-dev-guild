# Commit by path in a shared checkout

When others may work in the same checkout, commit with `git commit -m "…" -- <paths>`, then check `git show --stat HEAD`.

**Why:** `git commit` takes the whole index. A plain commit sweeps in another agent's half-finished staged changes.

**How to apply:**

- Never skip git hooks; the `bash-guard` hook refuses `--no-verify`.

**Where it lives:** every builder role; see [mistakes](../mistakes.md#a-commit-that-sweeps-in-someone-elses-staged-files).

Origin: field-tested.
