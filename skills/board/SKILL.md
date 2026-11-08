---
name: board
description: Put a decision with real trade-offs in front of a board of AI advisors — each seat answers alone, the product owner is asked at four points, and the summary keeps disagreement in view. Use it for scope, business rules, pricing or legal exposure; technical choices inside an agreed architecture go through normal review instead.
argument-hint: "<the question>"
disable-model-invocation: true
---

The question: $ARGUMENTS

Ask one agent whether to do something and you get one point of view, delivered with confidence on
every topic. A board makes the same question face several points of view that would genuinely pull
in different directions. The seats give advice. **The product owner is part of the discussion and
makes the call.**

Keep each case in its own folder, `docs/board/records/NNN-short-title/`, and list every case in
`docs/board/REGISTER.md` with its status. Start files from this skill's `templates/` folder. Commit
after each step with a message such as `board(NNN): opinions round 1`.

1. **Open the case.** Take the next free number. Fill `01-request.md`: the question, the smaller
   questions inside it, the options, and links to what matters. Pick three seats or more; the
   `board-product-manager` always chairs. Register the case as Open.
2. **First check-in: is this the right question?** Ask the owner up to four multiple-choice
   questions about the framing, the limits, and any option that is missing. Add their answers,
   word for word and dated, to `02-owner-input.md`.
3. **Collect the opinions.** Start every chosen `board-*` seat at the same time and give each one
   only the folder path. No seat may read another's answer. Store each answer unchanged in
   `opinions/<seat>.md`.
4. **Second check-in: facts.** Gather the questions the seats tagged for the owner, merge the
   duplicates, and ask them in groups of four at most, each with the answer you would suggest.
   Questions tagged for a lawyer, an accountant or users are not put to the owner; record them as
   facts still missing.
5. **Third check-in, if the owner wants it:** their own view, stored like any seat's.
6. **A second round**, only when an answer changes the picture: ask the seats it affects again, and
   store their answers in `opinions/round-2/`.
7. **Summary.** The chair writes `03-synthesis.md`: a table of where each seat stands, the facts
   with their sources, what the seats agree on, where they still disagree (shown, not smoothed
   over), the risks, a recommendation, and the facts still missing. Set the case to Awaiting
   decision.
8. **Fourth check-in: the decision.** The owner accepts, changes it, or waits for the missing
   facts. Once they decide, write `04-decision.md` with a checklist of every document it changes,
   add it to the decision log, and mark the case Decided.

A decided case is frozen. To revisit it, open a new case that says which one it replaces.
