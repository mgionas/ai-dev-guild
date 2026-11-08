# Privacy

ai-dev-guild collects no data. It has no servers, no accounts, no analytics and no telemetry.

- **The main plugin** (`plugin/`) is roles and skills written in Markdown. It runs inside your own
  Claude Code session and sends nothing to the authors of this repository or to anyone else.
- **What the agents read:** your project's files, as Claude Code does. The `token-review` skill also
  reads your own Claude Code session files in `~/.claude/projects/` on your machine, to count
  tokens. It copies no prompt text and sends nothing anywhere.
- **What the agents fetch:** some roles (the stack advisor, the UX researcher and the board seats)
  may search the web and read public pages, such as a provider's pricing page. Those requests go
  from your Claude Code session to those sites, like any web search you run.
- **The project map page** you create with `project-map` loads the Mermaid library from
  cdn.jsdelivr.net when you open it in a browser.
- **The optional guards plugin** (`guards/`) runs locally and makes no network requests.

How Claude itself handles your data is set by Anthropic's own terms and privacy policy, not by
this plugin.

Questions: open an issue at <https://github.com/mgionas/ai-dev-guild/issues>.
