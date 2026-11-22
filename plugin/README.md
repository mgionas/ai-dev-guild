# ai-dev-guild

A guild of AI agents for Claude Code: one builds, another inspects, and nothing is done without
proof.

Each task goes to a fresh builder agent with a written brief. A different agent reviews the change,
without seeing the builder's reasoning. A fresh fixer handles any findings, one re-check confirms
them, and the task is done only when the test output is pasted in. Product, business and legal
questions go to you in one batch, each with a recommended answer.

## What you get

- **21 roles** (subagents): builders (builder, fixer, db-migrations),
  inspectors (architect, security-reviewer, domain-guardian, qa-tester, designer, ux-researcher,
  docs-keeper), a board of eight advisors for decisions with real trade-offs, a stack advisor for
  new projects, a token optimizer, and a status keeper that checks the roadmap against git.
- **20 skills**, run as `/ai-dev-guild:<name>`: `setup`, `run-task`, `write-brief`, `review-panel`,
  `fix-round`, `decision-batch`, `board`, `stack-advice`, `roadmap`, `project-map`, `token-review`,
  `design-review`, `research-review`, `local-ci`, `local-environment`, `system-map`,
  `progress-boards`, `analysis-page`, `flow-stats`, `plain-report`.

Start with `/ai-dev-guild:setup` in your project, then `/ai-dev-guild:run-task <a task>`. New to
building? Try `/ai-dev-guild:stack-advice <your idea>` first.

## What it runs, sends and fetches

- **Runs:** nothing by itself. This plugin is roles and skills written in Markdown, and nothing else: no hooks, no MCP servers and no scripts.
- **Asks you to copy:** three skills (`local-ci`, `system-map`, `flow-stats`) need a script that
  is not in the plugin. They ask you to copy it into your project from this repository, at the release
  tag that matches the plugin ([steps](https://github.com/mgionas/ai-dev-guild/blob/main/docs/copy-a-script.md)), and never download it
  themselves. The copy then becomes your project's code, reviewed like any other change.
- **Reads:** your project's files, as Claude Code does. The `token-review` skill reads your own
  Claude Code session files in `~/.claude/projects/` to count tokens; it copies no prompt text and
  sends nothing anywhere.
- **Fetches:** the stack advisor, the UX researcher and the board seats may search the web and read
  public pages, to check facts such as current prices. The page that `project-map` writes loads
  the Mermaid library from cdn.jsdelivr.net, at a pinned version, when you open it.
- **Never:** signs up for services, handles keys or passwords, or copies production data.

Optional guard hooks (refuse edits to protected files, `pkill`, and skipped git hooks) are a separate
plugin, `ai-dev-guild-guards`, in the same marketplace.

Full documentation: <https://github.com/mgionas/ai-dev-guild>. Licence: MIT.
