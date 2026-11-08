---
name: fix-round
description: "Run a fix round — one findings file, a fresh fixer agent, only the covering tests, then one confirm-only re-check. Use after a review finds something to fix."
argument-hint: "<task id> <round number>"
---

1. **Write the findings file** `.work/tasks/<id>/findings-<n>.md` from `findings-template.md`:
   each finding with its severity, `file:line`, what is wrong, how to see it, and the test that
   should catch it. Leave out Lows and notes that block nothing: they go to `.work/carried.md`.
2. **Dispatch a fresh `fixer`** with that path. Never resume the builder's session: a long resumed
   context is slow, costly, and carries the reasoning that made the mistake.
3. **The fixer runs only the covering tests**, plus lint, typecheck and format of touched files.
   Everything else waits for the single strict local check before merging.
4. **One combined re-check.** One reviewer (or the one or two whose findings were fixed) confirms
   each fix against the findings file. Security and money reviewers re-check their own Critical
   and High findings themselves.
5. **A re-check confirms; it does not reopen.** New blocking problems are a new finding. New
   non-blocking points go to the carried list.
6. **After round 2:** if the re-check confirms every fix, stop by default and say so in the merge
   report. Otherwise **ask the owner** whether to stop, with what is still open and what it would
   cost to continue.
