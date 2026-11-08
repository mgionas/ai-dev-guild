# Where CI runs

The facts an agent needs before it touches CI, build config, test timeouts or heavy tests. Keep
this page beside your other operations notes and link it from `AGENTS.md`. When a runner changes,
this page changes in the same pull request.

## Runners

| Job      | Runner      | Labels          | OS / arch      | Cores | Memory | Node heap by default | Jobs at once | Shared with                      |
| -------- | ----------- | --------------- | -------------- | ----- | ------ | -------------------- | ------------ | -------------------------------- |
| `checks` | hosted      | `ubuntu-latest` | Linux / x86-64 | <n>   | <GB>   | <MB, measured>       | 1 per job    | nobody                           |
| `<job>`  | self-hosted | `<labels>`      | <OS> / <arch>  | <n>   | <GB>   | <MB, measured>       | <instances>  | <agent sessions, other projects> |

Measure the default heap on the runner itself, once:
`node -e "console.log(require('v8').getHeapStatistics().heap_size_limit / 2**20)"`.

## Limits the local check imitates

- Heap: `NODE_OPTIONS=--max-old-space-size=<the smallest runner's MB>`
- Parallel tasks and test workers: <the smallest runner's cores>
- Time zone and locale: `TZ=<CI's zone, usually UTC>`, `LANG=<CI's locale>`

## Caches

| Cache              | Key             | What it holds | Who can write it      |
| ------------------ | --------------- | ------------- | --------------------- |
| <dependency store> | <lockfile hash> | <path>        | <pushes to main only> |

## Who can start a run

<Pushes and pull requests from members; fork pull requests wait for approval; a self-hosted
runner never runs fork pull requests.>

## Known differences from a developer machine

- <case-sensitive file system, no browser cache, a security policy, a missing system package, …>
