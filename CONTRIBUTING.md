# Contributing

Thanks for helping. ai-dev-guild is small on purpose: every role, skill and rule should earn its place
with a mistake it prevents.

## What makes a good change

- **One change per pull request.** One role, one skill, one rule or one mistake. Each lives in its
  own file so it can be adopted, changed or dropped on its own.
- **Say why.** A new rule or mistake comes with the reason, and for a mistake a short reproduction:
  the code or command, and what went wrong. "It seemed cleaner" is not a reason.
- **Generic.** No product names, business rules, company terms, people, paths or ports from your
  own project. The main plugin in `plugin/` stays free of scripts and hooks: anything that runs goes in
  `guards/` or `examples/`. A stack-specific skill goes in `examples/`, marked as an example, never in `skills/`.
- **Plain English.** Short sentences. Say what to do and why. No marketing words.
- **Build nothing unasked.** No option or setting until someone needs it.

## Before you open a pull request

These are the seven steps CI runs, on Ubuntu and macOS with Node 22 and 24; run all of them:

```bash
node scripts/check-repo.mjs
node scripts/check-pages.mjs
node --test 'scripts/*.test.mjs'
(cd guards && node --test 'hooks/*.test.mjs')
node --test 'examples/ci-local/*.test.mjs'
node --test 'examples/flow-stats/*.test.mjs'
(cd examples/system-map && npm ci --ignore-scripts && node --test '*.test.mjs' \
  && node check.mjs --config example/system-map.config.json --base origin/main)
```

```bash
claude plugin validate .
claude plugin validate ./plugin
claude plugin validate ./guards
```

Paste the output of all of them in the pull request. If you change a hook, add a test that fails without
your change, and say that you saw it fail.

Add one line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md): what changed and why, in
one sentence. Mark it **(field-tested)** if it comes from real use in a project, or **(new)** if it
has not been used in anger yet.

## How changes get in

`main` is protected. Every change arrives as a pull request, CI must pass (the seven steps above), and the maintainer reviews and approves it before it is merged. CI on a pull
request from a first-time or outside contributor runs once the maintainer allows it.

## Releasing a merged change

Each merged pull request cuts a version. The maintainer does these steps, in the pull request or
right after the merge:

1. Bump `version` in `plugin/.claude-plugin/plugin.json`. Also bump `guards/.claude-plugin/plugin.json`
   when `guards/` changed; the guards plugin keeps its own version.
2. In [CHANGELOG.md](CHANGELOG.md), move the entry from `Unreleased` under a new heading
   `## X.Y.Z (YYYY-MM-DD)` and name the guards version where it changed. Leave `Unreleased` empty.
3. Tag the merge commit `vX.Y.Z` and push the tag:

   ```bash
   git tag vX.Y.Z <merge-commit>
   git push origin vX.Y.Z
   ```

A minor bump (0.16.0 to 0.17.0) is for a new skill, rule or behaviour. A patch bump (0.16.0 to 0.16.1)
is for a fix or a wording change. The skills tell users to copy example folders from the tag that
matches their installed version, so the tag must exist before users update.

## The rule we keep ourselves

The person who wrote a change does not approve it. Every pull request gets a review from someone
else, and the reviewer reads the change before the description.
