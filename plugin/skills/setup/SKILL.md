---
name: setup
description: "Set up a project for the ai-dev-guild loop — an AGENTS.md brief from the template, a CLAUDE.md that imports it, a .work folder for briefs and reports, and the protected-paths list for the guard hook. Use once per project."
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
4. **`.claude/protected-paths`**, one glob per line, read by the optional `ai-dev-guild-guards`
   plugin's hooks. Start with
   `.env`, `.env.*` and `!.env.example`; ask whether there is a folder of applied migrations to add.
5. **A glossary**: ask where the project keeps its terms and business rules, and write that path
   into `AGENTS.md`. If there is none, create `docs/glossary.md` with a heading and a note that only
   the product owner adds terms.

   Also ask: "Squash follow-ups, or fix forward?" Write the answer into `AGENTS.md` under the
   "History" heading. Squash means follow-up commits use `--fixup` and are squashed with
   `rebase -i --autosquash` before the task is reported. Fix forward means new commits, and history
   is never rewritten. With no answer, write fix forward: it never rewrites history.

6. **A stack**: if the repository shows no stack yet (no lock file, no framework config), offer
   the `stack-advice` skill before the first task, and leave the Stack section as `TODO(owner)`.

7. **Where CI runs**: if the project has CI, write its page from `ci-environment-template.md` in
   the `local-ci` skill's folder. Fill what the workflow files say (runner labels, OS, jobs); ask
   the user for cores, memory and who else uses a self-hosted machine, and leave the rest as
   `TODO(owner)`. Link the page from `AGENTS.md`.

8. **A local environment** (optional): if the project has no written local setup (no
   local-development page, no compose file), offer the `local-environment` skill. Advise, do not
   create unless the user says yes; a project with a setup that works keeps it.

9. **Permission rules** in `.claude/settings.json`, merged with what is there. Show the user the
   exact JSON you would add and ask before writing. Never remove a rule the user already has.

   ```json
   {
     "permissions": {
       "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./**/.env)", "Read(./**/.env.*)"],
       "ask": ["Bash(git push *)", "Bash(gh pr merge *)"],
       "allow": ["Edit(./.work/**)"]
     }
   }
   ```

   - The deny rules keep secret files away from the file tools. They do not cover a shell command
     such as `cat .env`, so tell the user they are a first line, not a guarantee.
   - The ask rules stop a push or a merge until the user says yes. Ask the user for the command
     that deploys this project, and add it as one more `ask` rule.
   - Builders write their reports under `.work/`; without the allow rule, the permission system
     can refuse the write. An `Edit` rule covers `Write` too, and a `Write(path)` rule would match
     nothing.
   - A command rule matches the text as written. `git -C . push` is not caught by
     `Bash(git push *)`, so these rules are a prompt, not a wall. Tell the user.
   - Check the syntax against the current documentation before writing:
     https://code.claude.com/docs/en/permissions.

10. **Worktrees.** If `.gitignore` does not ignore `.claude/worktrees/`, offer to add that line.
   Advise in one sentence: where the app lets you choose where worktrees go, a folder outside the
   project keeps them away from committed config.

11. **Check the guard hooks**, only if the user has installed `ai-dev-guild-guards`. Run this
    command with the Bash tool:

    ```
    pkill -f ai-dev-guild-probe-no-such-process
    ```

    The bash guard refuses a pattern kill, so it must come back refused. If it runs anyway, it
    matches no process and harms nothing. Never probe with a write to a protected file. In a
    session that started before the plugin was installed the hooks are not loaded yet, so a run
    that is not refused means "not running yet": say so, and repeat the check in step 12's new
    session. Record `guards: running` or `guards: not running`.

12. **Start a new session.** Claude Code reads plugins, project agents, project skills, permission
    rules and hooks only when a session starts. Whatever was installed, copied or written during
    this setup does nothing until then. Tell the user plainly, and give the check to run in the new
    session: `/ai-dev-guild:run-task` resolves (or `/run-task`, where the folders were copied), and
    the `pkill` probe above is refused.

Finish with a short list of what you created, what still says `TODO(owner)`, the guard result
(`guards: running`, `guards: not running`, or not installed), and the last line: start a new
session, then run the check from step 12.
