# Copy the folder instead

The plugin is the easiest way to install and update ai-dev-guild. If you would rather keep plain
files in your repository (to edit them freely, or because your team does not use plugins), copy
them into `.claude/`.

## 1. Copy

```bash
git clone https://github.com/mgionas/ai-dev-guild /tmp/ai-dev-guild
```

```bash
mkdir -p .claude && cp -R /tmp/ai-dev-guild/agents /tmp/ai-dev-guild/skills /tmp/ai-dev-guild/hooks .claude/
```

Delete the hook tests if you do not want them in your project: `.claude/hooks/hooks.test.mjs`.

## 2. Wire the hooks

A copied hook is not read from `hooks/hooks.json`. Add this to `.claude/settings.json` (merge it
with what is there):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/bash-guard.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/after-edit.mjs\""
          }
        ]
      }
    ]
  }
}
```

## 3. Keep secrets out of the model's context

Hooks stop writes. To stop reads of secret files too, add deny rules to the same settings file:

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./**/.env)",
      "Read(./**/.env.*)"
    ],
    "ask": ["Bash(git push*)"]
  }
}
```

## What changes

- Skills and agents are not namespaced: `/run-task` instead of `/ai-dev-guild:run-task`, and the agent
  `builder` instead of `ai-dev-guild:builder`.
- You update by copying again. Read [CHANGELOG.md](../CHANGELOG.md) first: each entry is one
  change, so you can take the ones you want.
