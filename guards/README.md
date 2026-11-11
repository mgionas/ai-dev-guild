# ai-dev-guild guards

Optional guard hooks for the [ai-dev-guild](https://github.com/mgionas/ai-dev-guild) loop. They
stop the things agents keep doing by accident.

| Hook          | Refuses                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `guard-paths` | an edit to a file listed in `.claude/protected-paths` (default: `.env` files, not `.env.example`), symlinks included                           |
| `bash-guard`  | `pkill`, `killall`, `kill $(pgrep …)`; `--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`; a shell write to a protected file          |
|               | reading or sending a secret file from the shell (`cat .env`, `grep KEY .env`, `< .env`, `curl -d @.env`, `scp .env`); `source .env` is allowed |
|               | asks you first before `kill <number>`: it cannot tell whose process that is. `kill %1` and stopping the agent's own background task still work |
| `guard-reads` | the Read and Grep tools opening a secret file (`.env`, `.env.*` in any folder; not `.env.example`, `.env.sample`, `.env.template`)            |
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

The hooks read commands as text (heredocs are ignored, and so is quoted text except where a file
name or process number matters) and catch the common spellings, not every one. They fail open on
bad input: your pre-commit hooks and CI stay the authority. They do not protect their own files.

Run the tests with `node --test 'hooks/*.test.mjs'` from this folder. Licence: MIT.
