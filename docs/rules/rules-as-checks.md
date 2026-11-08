# Turn a repeated mistake into a check

When review catches the same mistake twice, make a machine catch it next time: a hook, a lint rule,
a test or a CI step. Write the rule down too, but do not rely on the words alone.

**Why:** A rule in prose is read once and forgotten under pressure; a check runs every time. Agents
in particular follow a refusal they hit far better than a paragraph they skimmed.

**How to apply:**

- A hook for commands and files (this plugin's `bash-guard` and `guard-paths` are examples).
- A lint rule or a test for code patterns, with a case that proves it fails.
- See a new check fail before you trust it.
- Keep the prose short: the rule, the reason, and which check enforces it.

**Where it lives:** the guard hooks; [mistakes that keep happening](../mistakes.md).

Origin: field-tested.
