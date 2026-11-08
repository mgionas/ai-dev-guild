# One task per fresh agent, with a brief file and a report file

Each task goes to a new agent that gets a written brief and writes a report file. The controller reads files, not conversations.

**Why:** A fresh agent with a complete brief does not carry yesterday's wrong assumptions, and a file survives when a session ends. The controller's own context stays small, which keeps every coordination turn cheap.

**How to apply:**

- Write the brief with the `write-brief` skill: goal, scope, acceptance criteria, covering tests, guard tests, the owner's answers.
- Split a task likely to need more than about 110 turns (about 250K tokens of context).
- An agent near that point writes a handover file and stops.
- Hand back in a few lines; the full report stays in its file.

**Where it lives:** the `run-task` and `write-brief` skills.

Origin: field-tested.
