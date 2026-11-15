# ai-dev-guild guards

Optional guard hooks for the [ai-dev-guild](https://github.com/mgionas/ai-dev-guild) loop. They
stop the things agents keep doing by accident.

| Hook          | Refuses (or asks)                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `guard-paths` | an edit to a file in `.claude/protected-paths` (default: `.env` files, not `.env.example`), symlinks included; asks before a hook file          |
| `bash-guard`  | `pkill`, `killall`, `kill $(pgrep …)`; `--no-verify` (abbreviated too), `git commit -n`, `core.hooksPath`, `HUSKY=0`; a protected-file write    |
|               | any command naming a secret file, except the few that do not read it (`ls`, `rm`, `touch`, `chmod`, `stat`, `test`, `echo`, `source .env`, …)   |
|               | `git config` that sets `core.hooksPath` (unsetting it is fine); `node -e`, `python3 -c`, `ruby -e`, `perl -e`, `deno eval` naming a secret file |
|               | asks: any `kill` but `kill %1`, `kill $!` or `kill -0` (`kill 1234`, `kill $PID`, `kill $(lsof …)`), since it cannot tell whose process that is |
|               | asks: a shell that reads its script from a pipe (`curl … \| bash`) or another input it cannot see                                               |
|               | asks: a shell whose `-c` string or here-string is built from an expansion (`bash -c "$(curl …)"`, `bash -c "$CMD"`)                             |
|               | asks: `source` or `.` of a script it cannot see (`source <(curl …)`, `. /dev/stdin`, `source /dev/fd/3`, zsh `=(…)`)                            |
|               | asks: a shell run on an unquoted heredoc whose body expands something (`bash <<EOF` with `$name` or `$(…)` inside)                              |
|               | asks: deleting, moving, writing or re-moding a git hook or hook manager file (`rm .git/hooks/…`, `chmod -x .husky/…`, `lefthook.yml`)           |
|               | asks: `git commit` or `git push` with pre-commit's `SKIP=` set; a variable set to a secret file name and then expanded (`F=.env; cat $F`)       |
| `guard-reads` | the Read and Grep tools opening a secret file (`.env`, `.env.*` in any folder; not `.env.example`, `.env.sample`, `.env.template`)              |
| `after-edit`  | nothing by itself: if your project has an executable `.claude/after-edit`, it runs it on each edited file and sends any failure back to Claude  |

## Install

```
/plugin marketplace add mgionas/ai-dev-guild
/plugin install ai-dev-guild-guards@ai-dev-guild
```

Needs Node.js 22.5 or later. On an older Node the file-edit and shell hooks refuse every call with a message that
names the version needed, since they cannot check anything there.

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

## What the guards cannot see

They read each command as text, so these get past them. Your pre-commit hooks, CI and the deny rules in
your settings are the layer for them.

- **An interpreter reading a file by a computed path.** `node -e`, `python3 -c`, `ruby -e`, `perl -e` and
  `deno eval` are refused when a quoted name in the program is a secret file, but not when the name is
  built at run time (`'.' + 'env'`), read from the environment, or run from a script file or a heredoc.
- **A search over a tree that holds a secret.** `grep -r SECRET .` and `rg KEY` open every file under
  the folder, and `cat ./*` expands to the files in it; neither names a secret file, and recursive search
  is everyday use, so both are allowed. By default `./*` skips dotfiles, so `cat ./*` does not read `.env`
  unless the shell has `dotglob` set, which the guards cannot tell.
- **A variable set in an earlier command.** `F=.env; cat $F` is asked about, but a variable set in one
  tool call and expanded in the next is not linked.
- **A file changed by other means.** A hook changed with `find .git/hooks -delete`, from an interpreter
  or with `git checkout` is not asked about, and neither is a hook folder reached after a `cd` in an
  earlier command.
- **A hook skipped through git's environment.** `GIT_CONFIG_COUNT` with a `core.hooksPath` key, or a
  `git` alias that adds `--no-verify`, set in an earlier command or in your own config.

Run the tests with `node --test 'hooks/*.test.mjs'` from this folder. Licence: MIT.
