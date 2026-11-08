---
name: setup
description: Set up a project for the ai-dev-guild loop — an AGENTS.md brief from the template, a CLAUDE.md that imports it, a .work folder for briefs and reports, and the protected-paths list for the guard hook. Use once per project.
disable-model-invocation: true
---

Set up this project for the ai-dev-guild loop. Look before you write: never overwrite a file that
exists. Where one exists, show the user what you would add and ask.

1. **`AGENTS.md`** at the project root, from `AGENTS.template.md` in this skill's folder. Fill what
   you can read from the repository (stack and exact versions from the lock files, commands from the
   scripts, the folder map). Leave every product question as a `TODO(owner)` line, never a guess.
2. **`CLAUDE.md`** with the single line `@AGENTS.md`, so Claude Code and other agents read one set
   of rules. If a `CLAUDE.md` exists, offer to add the line at its top.
3. **`.work/`** with `carried.md` (the list of noticed problems waiting for a task). Ask the user
   whether `.work/` is committed (an audit trail) or git-ignored (scratch). Either works.
4. **`.claude/protected-paths`**, one glob per line, read by this plugin's guard hooks. Start with
   `.env`, `.env.*` and `!.env.example`; ask whether there is a folder of applied migrations to add.
5. **A glossary**: ask where the project keeps its terms and business rules, and write that path
   into `AGENTS.md`. If there is none, create `docs/glossary.md` with a heading and a note that only
   the product owner adds terms.

6. **A stack**: if the repository shows no stack yet (no lock file, no framework config), offer
   the `stack-advice` skill before the first task, and leave the Stack section as `TODO(owner)`.

Finish with a short list of what you created and what still says `TODO(owner)`.
