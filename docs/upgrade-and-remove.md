# Upgrade and remove

How to move to a newer version of ai-dev-guild, and how to take it out of a project. Both are
yours to decide: nothing here has to be done in one go.

## Check the installed version

```bash
claude plugin list
```

Each plugin is listed with its version, for example `ai-dev-guild@ai-dev-guild` and
`ai-dev-guild-guards@ai-dev-guild`. The two plugins have separate versions.

## Upgrade

Refresh the marketplace so Claude Code sees the new versions, then update each plugin you use:

```bash
claude plugin marketplace update ai-dev-guild
claude plugin update ai-dev-guild@ai-dev-guild
claude plugin update ai-dev-guild-guards@ai-dev-guild
```

Add `--scope user`, `project` or `local` to `claude plugin update` if the plugin was installed in a
scope other than the default (`user`). Start a new session afterwards: plugins, agents, skills and
hooks load only when a session starts.

If you copied the folders by hand instead ([install.md](install.md)), copy them again and read the
changelog first, since you replace files you may have edited.

After upgrading the main plugin, copy again any example folder you took from the repository (the
local CI runner, `flow-stats`, the system map), from the tag that matches the new version. Each
skill that uses one gives the command. A copied folder is yours and is not updated by the plugin.

## Read what changed

- [CHANGELOG.md](../CHANGELOG.md) lists each version with its date and its entries. The guards
  version is named under the heading where it changed.
- Each version is a tag, `vX.Y.Z`, on GitHub: <https://github.com/mgionas/ai-dev-guild/tags>.
  Compare two of them to see every changed line:
  `https://github.com/mgionas/ai-dev-guild/compare/v0.15.0...v0.16.0`.

## Remove

Uninstall the plugins, then the marketplace if you no longer want it:

```bash
claude plugin uninstall ai-dev-guild@ai-dev-guild
claude plugin uninstall ai-dev-guild-guards@ai-dev-guild
claude plugin marketplace remove ai-dev-guild
```

`claude plugin uninstall` takes `--scope` (default `user`) and `--keep-data`; use the scope the
plugin was installed in. The marketplace command takes `--scope` too. Start a new session to unload them.

Uninstalling does not touch your project. These are what `setup` may have written there. Look at
each one and decide whether to keep it: most are plain project files that are useful without the plugin.

| What                                                            | What it is                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                     | The project brief with the working rules. Agents and people read it; keeping it costs nothing.      |
| `CLAUDE.md`                                                     | The line `@AGENTS.md` (or your file with that line added). Delete only that line if the file is yours. |
| `.claude/settings.json`                                         | The permission rules `setup` added: denied reads of `.env` files, asking before `git push` and `gh pr merge`, and allowing edits under `.work/`. Remove only those lines; they are safe to keep. |
| `.claude/protected-paths`                                       | The list the guards plugin reads. It does nothing once the guards plugin is gone.                   |
| `.work/`                                                        | Briefs, reports, the carried list and the records the loop wrote. It is your audit trail, committed or git-ignored as you chose. |
| `.gitignore` line for `.claude/worktrees/`                      | Keeps agent worktrees out of the repository. Harmless to keep.                                      |
| Docs `setup` wrote (glossary, where CI runs, local environment) | Ordinary project documentation. Keep them or delete the ones you do not use.                        |
| Copied scripts (for example `scripts/ci-local/`)                | Runners you took from the examples. They are yours; if your CI or a git hook calls one, change that first. |
| Pages the loop publishes                                        | Roadmap, QA board and the like live where you published them, not in the plugin.                    |

If you copied the folders by hand, also look in `.claude/agents/`, `.claude/skills/` and
`.claude/hooks/`, and the `hooks` entry in `.claude/settings.json`.
