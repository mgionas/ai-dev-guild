# Folder guides hold current rules

An `AGENTS.md` (or any folder guide an agent loads) says what is true and required in that folder
now. Build history, milestone stories and per-migration deploy notes live somewhere else.

**Why:** Every agent that works in a folder loads its guide, on every task. Guides that grow
into notes on how things came to be cost tokens on every task and bury the few rules that matter.

**How to apply:**

- A guide holds the rules, the commands and the traps of its folder as they stand today.
- Deploy notes for a migration sit beside that migration. Build history goes into a history file
  or the plan. A decision goes into the decision log, and the guide links it.
- When a rule stops being true, delete it from the guide; do not mark it as old.
- Look at a guide again once it passes about 600 lines. That is a prompt to read it, not a limit:
  a long guide of current rules is fine, and a short one full of history is not.

**Where it lives:** the setup template's working rules, which builders follow when they edit a
guide; the `docs-keeper` role checks it.

Origin: field-tested (the lesson); the 600-line prompt is new.
