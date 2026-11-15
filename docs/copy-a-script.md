# Copy a script into your project

Three skills need a script that is not part of the plugin: `local-ci`, `system-map` and
`flow-stats`. The listed plugin ships Markdown only, so these scripts live in this repository's
`examples/` folder and you copy them into your project yourself. The skills never download
them. Once a script is in your project, it is your project's code: read it and review it like any
other change before it runs.

Copy from the release that matches your installed plugin, so the script and the skill agree. Read the
installed version with `claude plugin list` (the `Version:` under `ai-dev-guild@ai-dev-guild`) and use
it in place of `<version>` below. Tags start at `v0.15.0`; with an older plugin, update it first (see
[upgrade and remove](upgrade-and-remove.md)). If that tag is not there yet, use the newest tag listed
at <https://github.com/mgionas/ai-dev-guild/tags>.

On Windows the same commands work in Git Bash, or download the folder from the tag's page and copy it
with your usual tools.

## local-ci

The local CI runner, into `scripts/ci-local/` (or adjust the first line of `ESCALATE` in it):

```bash
git clone --depth 1 --branch v<version> https://github.com/mgionas/ai-dev-guild /tmp/ai-dev-guild-v<version>
mkdir -p scripts/ci-local && cp -R /tmp/ai-dev-guild-v<version>/examples/ci-local/. scripts/ci-local/
```

## system-map

The system map check, into `tools/system-map/`:

```bash
git clone --depth 1 --branch v<version> https://github.com/mgionas/ai-dev-guild /tmp/ai-dev-guild-v<version>
mkdir -p tools/system-map && cp -R /tmp/ai-dev-guild-v<version>/examples/system-map/. tools/system-map/
```

## flow-stats

The counting script, into `scripts/flow-stats/`:

```bash
git clone --depth 1 --branch v<version> https://github.com/mgionas/ai-dev-guild /tmp/ai-dev-guild-v<version>
mkdir -p scripts/flow-stats && cp -R /tmp/ai-dev-guild-v<version>/examples/flow-stats/. scripts/flow-stats/
```
