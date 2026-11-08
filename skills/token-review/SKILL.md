---
name: token-review
description: Find out where this project's Claude Code sessions spent their tokens and get a short, ranked list of changes that cost less for the same work — cheaper models where judgement is not needed, fewer fix rounds, fresh agents instead of resumed ones, shorter hand-backs. Use when usage limits bite, or once a day on long multi-agent sessions.
argument-hint: "[session id, or blank for the latest]"
---

Long agent sessions get expensive in ways nobody sees while working: the strongest model on a
rename, a builder resumed for its third fix round, a controller carrying 400K tokens of context.
This skill measures it and turns it into a few rules.

1. **Find the session.** Sessions for this project are in `~/.claude/projects/`, in the folder whose
   name is this project's path with `/` replaced by `-`. Use the session the user names, or the most
   recently changed `.jsonl` file there. Never read it whole.
2. **Dispatch the `token-optimizer` agent** with the session file's path and a report path,
   `.work/token-review/<date>.md`.
3. **Show the user the top changes**, each with its numbers, and ask once whether to adopt them
   ([`decision-batch`](../decision-batch/SKILL.md)). A rule the user accepts goes into `AGENTS.md` or the brief template, with the
   date and the measured reason, so the next session follows it.

Common findings, so you recognise them:

| Finding                                                  | Usual rule                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| The strongest model ran builds that had a complete brief | builders and fixers default to the middle model; the strongest only for security, architecture, money, concurrency |
| Fix rounds cost more than the builds                     | better briefs (name the traps), Lows to the carried list, a fresh fixer per round                                  |
| Findings were sent back into the builder's session       | always a fresh fixer with a findings file                                                                          |
| Agents ran past about 110 turns                          | split the task, or hand off with a written handover at about 250K context                                          |
| The controller's context passed 250K                     | `/compact` after each merge, and hand-backs of a few lines pointing at the report file                             |
| Two reviewers covered the same ground                    | one scope per reviewer                                                                                             |

Report what you measured, not what you expected. If the numbers are too thin to say anything,
say that.
