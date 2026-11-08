# Choose the model on purpose

Light work on the light model, judgement on the strongest: haiku for lookups and exactly specified edits, sonnet for briefed builds, fixes, QA and docs, opus for security, architecture, money and concurrency.

**Why:** Defaulting every agent to the strongest model multiplied cost several times over with no gain on mechanical work. Defaulting everything to the light model misses the hard findings.

**How to apply:**

- Each role file carries a default `model:`.
- State a reason when you override it.

**Where it lives:** the role files; the `run-task` skill.

Origin: field-tested.
