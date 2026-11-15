# Troubleshooting

Short entries: what you see, then what to do.

## Skills or agents are not found after installing

Plugins, agents, skills, permission rules and hooks load only when a session starts. Start a new
session and try again. `claude plugin list` shows whether the plugin
is installed and enabled.

## `/ai-dev-guild:run-task` does not resolve

- Start a new session first (see above).
- With the folders copied by hand ([install.md](install.md)) there is no plugin name, so the command
  is `/run-task`, and the agents are `builder` instead of `ai-dev-guild:builder`.
- Check the spelling with `claude plugin list`: the plugin is `ai-dev-guild`, the marketplace is
  `ai-dev-guild`.

## An agent type such as `ai-dev-guild:builder` is missing

Plugin agent types load only in a new session. Until then `run-task` falls back to a general-purpose
agent with the role file's path in the brief and the role's tools as a hard rule. Start a new session
to get the real agent types.

## The guards are not running

`setup` probes them with a harmless pattern kill, which the guards must refuse:

```
pkill -f ai-dev-guild-probe-no-such-process
```

If it runs instead of being refused, the guards are not loaded. Check that `ai-dev-guild-guards` is
installed and enabled with `claude plugin list`, install it with
`/plugin install ai-dev-guild-guards@ai-dev-guild`, and start a new session. The guards also need
Node.js 22.5 or later (or 20.19 or later).

## The guards refuse every call on an old Node

The file-edit and shell hooks refuse every call, with a message that names the Node version they
need and the version you have, because they cannot check anything on an older one. Upgrade Node.js to
22.5 or later (20.19 or later also works), or turn the guards plugin off.

## A skill asks for a script the project does not have

The local CI runner, `flow-stats` and the system map check are example folders in the repository,
not part of the plugin. Each skill that needs one gives a copy command: read the installed version with
`claude plugin list` (the `Version:` under `ai-dev-guild@ai-dev-guild`), then clone the matching tag and copy the folder, for example

```bash
git clone --depth 1 --branch v<version> https://github.com/mgionas/ai-dev-guild /tmp/ai-dev-guild-v<version>
mkdir -p scripts/ci-local && cp -R /tmp/ai-dev-guild-v<version>/examples/ci-local/. scripts/ci-local/
```

On Windows use Git Bash, or copy the folder with your usual tools. Tags start at `v0.15.0`. If that tag is not there yet, use the newest tag listed at
<https://github.com/mgionas/ai-dev-guild/tags>.

## `claude plugin validate` shows warnings

On the plugin manifests this repository ships, three warnings are expected: `documentationUrl`,
`supportUrl` and `privacyPolicyUrl` are unknown fields that Claude Code ignores at load time. They are
there for the plugin directory's listing. Any other warning or error is worth reading.
