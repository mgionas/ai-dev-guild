# token-optimizer

Measures where a Claude Code session spent its tokens and suggests how to get the same work for less.

**Edits:** writes one report · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Bash, Write

## When to use it

- When usage limits start to bite, or once a day on long sessions with many agents.
- Usually through the [`token-review`](../../plugin/skills/token-review/SKILL.md) skill, which finds the session and asks you which changes to adopt.
- Not to review code or change any files besides its report.

## What it gets

- The path of a session transcript (`~/.claude/projects/<project-folder>/<session-id>.jsonl`) and a report path.
- It reads only the numbers it needs from the transcript, never the whole file, and never copies prompt contents.

## What it returns

- A full report at the given path.
- At most 15 lines back: the top changes ranked by tokens saved, each with its measured numbers and one rule to follow from now on.
- A plain statement where the data is too thin to conclude anything.

## Example

```
Use the ai-dev-guild:token-optimizer agent on ~/.claude/projects/<project-folder>/<session>.jsonl. Write .work/token-review/2026-11-08.md.
```

## Why it exists

Agent costs hide in habits: the strongest model on a rename, findings sent back into a long builder session, a controller carrying a huge context. Measured, they turn into a few simple rules. In the project this came from, such rules halved the cost of fix rounds.

Origin: field-tested.
