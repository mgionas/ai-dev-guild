# ai-dev-guild guards

Optional guard hooks for the [ai-dev-guild](https://github.com/mgionas/ai-dev-guild) loop. They
stop the things agents keep doing by accident.

| Hook          | Refuses (or asks)                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `guard-paths` | an edit to a file listed in `.claude/protected-paths` (default: `.env` files, not `.env.example`), symlinks included                           |
| `bash-guard`  | `pkill`, `killall`, `kill $(pgrep …)`; `--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`; a shell write to a protected file          |
|               | any command naming a secret file, except the few that do not read it (`ls`, `rm`, `touch`, `chmod`, `stat`, `test`, `echo`, `source .env`, …)  |
|               | asks: any `kill` but `kill %1` or `kill $!` (`kill 1234`, `kill $PID`, `kill $(lsof …)`), since it cannot tell whose process that is           |
|               | asks: a shell that reads its script from a pipe (`curl … \| bash`) or another input it cannot see                                              |
| `guard-reads` | the Read and Grep tools opening a secret file (`.env`, `.env.*` in any folder; not `.env.example`, `.env.sample`, `.env.template`)             |
| `after-edit`  | nothing by itself: if your project has an executable `.claude/after-edit`, it runs it on each edited file and sends any failure back to Claude |

## Install

```
/plugin marketplace add mgionas/ai-dev-guild
/plugin install ai-dev-guild-guards@ai-dev-guild
```

Needs Node.js 22.5 or later.

## What it runs, sends and fetches

- **Runs:** `node` on the hook scripts in `hooks/`, before and after Claude edits a file or runs
  a shell command, and before it reads or searches a file. `after-edit` also runs your own
  `.claude/after-edit`, if you created one.
- **Reads:** the tool call Claude is about to make, and your project's `.claude/protected-paths`.
  It reads the `CLAUDE_PROJECT_DIR` setting to find your project.
- **Sends and fetches:** nothing. No network access.

The hooks read commands as text (comments are ignored, and so are heredoc bodies except for the
`$(…)` bash still runs in them, and quoted text except for a `$(…)` inside double quotes and where
a file name or process number matters). They look inside `bash -c '…'`, `eval` and a heredoc a
shell runs as its script (`bash <<'EOF'`), and behind wrappers such as `sudo -u root`, `doas` or
`timeout 5`, and catch the common spellings, not every one. A command they cannot read is refused, and one over
20,000 characters is asked about. They fail open only on malformed hook input: your pre-commit
hooks and CI stay the authority. They do not protect their own files.

Run the tests with `node --test 'hooks/*.test.mjs'` from this folder. Licence: MIT.
