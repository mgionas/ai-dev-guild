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

```bash
node --test 'guards/hooks/*.test.mjs'
```

```bash
claude plugin validate .
claude plugin validate ./plugin
claude plugin validate ./guards
```

Paste the output of both in the pull request. If you change a hook, add a test that fails without
your change, and say that you saw it fail.

Add one line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md): what changed and why, in
one sentence. Mark it **(field-tested)** if it comes from real use in a project, or **(new)** if it
has not been used in anger yet.

## The rule we keep ourselves

The person who wrote a change does not approve it. Every pull request gets a review from someone
else, and the reviewer reads the change before the description.
