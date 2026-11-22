# Offer safe shortcuts; never take one alone

When a step clearly costs more than it protects, the agent proposes a shortcut: what it saves, what
it risks, and a recommendation. The human decides. The agent never skips a step on its own.

**Why:** An agent follows its process even where it buys nothing, such as a full suite on a change
that touches only documentation, and hours go by unnoticed. An agent that skips steps on its own
judgement is worse: nobody knows what was left unchecked. Asking keeps the time savings and keeps
the human informed.

**How to apply:**

- Propose a shortcut in three parts: what it saves (time, runs, money), what could slip through,
  and your recommendation.
- Name the condition that makes it safe, for example "nothing is live yet, and a later full run
  catches what this skips". When that condition changes, such as once the product is live,
  ask again.
- Never propose a shortcut for high-stakes logic, security, personal data, database migrations or
  [the owner's documents](owner-documents.md). Keep their full process, and still tell the human
  what it costs.
- Put shortcut questions in the next question batch rather than asking them one by one. Ask at
  once only when waiting would cost more than the interruption.
- Record the answer the same turn where the project keeps its decisions, so the next agent does
  not ask again.
- Report an approved shortcut as a skip, with who approved it. It never reads as a pass.
- Shortcuts the project's own checks already define, such as an affected-only run, need no ask.
  This rule covers going beyond them.

**Where it lives:** the `decision-batch` and `local-ci` skills. See also
[Run the heavy checks once](heavy-runs-once.md) and [Ask the owner in batches](decision-batches.md).

Origin: field-tested.
