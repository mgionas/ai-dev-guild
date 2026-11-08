# Evidence before done

A task is done only when its report pastes the output of the tests, typecheck and lint that were run.

**Why:** "Done" without output is a claim. The commonest failure of an AI builder is saying the tests pass when they were never run.

**How to apply:**

- No pasted output means the report goes back.
- After a test passes, break the code once and see the test go red.
- Trust a check only when it ran as CI runs it: fresh build, no local hooks or watchers.

**Where it lives:** the builder and fixer roles; the `local-ci` skill.

Origin: field-tested.
