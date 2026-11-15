# Report: task <id>

**Head:** <short sha>   **Status:** done | blocked

## Done

- `<file>` — <what changed and why>

## Evidence

```
$ <command>
<pasted output>
```

Steps: <each heavy step as ran, skipped (why) or escalated (which file); or "none needed", and why>

## Tests changed

- `<test file>:<line>` — <an existing assertion you changed or removed, and why>; or "none"

## Assumptions

- Chose <X>; the other reading was <Y>; because <reason>.

## Noticed

- `<file>:<line>` — <what looks wrong; left untouched>

## Questions

- <question only a person can decide, with a recommendation if you have one>

Write it in plain words, and keep each claim no stronger than what backs it:

- Say "fixed" only when a test failed before the change and passed after it. Say "verified" only
  for what you ran, and "all" only for what you counted in full.
- A claim with nothing behind it gets a pointer (a test result, a `file:line`, a commit, pasted
  output) or a softer verb: "unit tests 212/212; integration not run", not "tests pass".
- A broad claim resting on a narrow check shrinks to the check. A loose size gets a figure with its
  source, or goes.
- A failure or a skipped step goes in the main text, in plain words, never only in a linked file.
- Keep every figure, `file:line`, commit, identifier and glossary term exactly as it is. Cut hype,
  filler, sentences over about 30 words, and em-dashes.
