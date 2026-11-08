# Copy the folders instead

The plugins are the easiest way to install and update ai-dev-guild. If you would rather keep plain
files in your repository (to edit them freely, or because your team does not use plugins), copy
them into your project's `.claude/` folder by hand.

## 1. Copy the roles and skills

Download this repository from GitHub (the green **Code** button, then **Download ZIP**), and read
what you are copying. Then copy two folders into your project:

| From the download | To your project   |
| ----------------- | ----------------- |
| `plugin/agents/`  | `.claude/agents/` |
| `plugin/skills/`  | `.claude/skills/` |

That is the whole main plugin: Markdown files only. Nothing in it runs by itself.

## 2. Optional: the guard hooks

Copy `guards/hooks/` to `.claude/hooks/` (you can leave out `hooks.test.mjs`), then add this to
`.claude/settings.json`, merged with what is there:

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

The hooks need Node.js 22.5 or later.

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

- Skills and agents are not namespaced: `/run-task` instead of `/ai-dev-guild:run-task`, and the
  agent `builder` instead of `ai-dev-guild:builder`.
- You update by copying again. Read [CHANGELOG.md](../CHANGELOG.md) first: each entry is one
  change, so you can take the ones you want.
