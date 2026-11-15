---
name: plain-report
description: "Polish anything you are about to send to a human reader (a status report, a pull request body, a review or fix summary, a hand-back, a commit body, a roadmap note) so the wording is plain and no claim outruns what backs it. Run it before such a text goes out."
---

# Plain report

Adapted from "academic-humanizer" by AIScientists-Dev
(https://github.com/AIScientists-Dev/academic-humanizer), itself built on "humanizer" by blader
(https://github.com/blader/humanizer). The licence of each is MIT. This skill is written fresh from
their ideas, and no text from other projects is used.

## Scope

- **Use it on** prose you compose yourself for a human reader: status reports, pull request bodies,
  summaries of a review or a fix, hand-backs, commit message bodies, roadmap notes.
- **Leave out** strings that appear in the product's interface, the owner's own documents (specs,
  decisions, glossary), older docs and code comments that are not part of your task, and anything quoted.
  If an owner's document seems wrong, add a dated note instead of rewriting it.
- **Keep exactly** every figure, `file:line`, commit, identifier in code, glossary term and quotation.

## Process

1. **Audit without commenting.** Mark each phrasing problem listed below, and for each claim note
   what supports it.
2. **Rewrite**, keeping the content and the order. Remove the problems and bring every claim in
   line with its support.
3. **Read it once more in the owner's seat, on a small screen.** Could they decide or act from this
   text alone, with no other file open?

## Phrasing to remove

- Hype and inflated importance: "crucial", "robust", "seamless", "comprehensive", "paves the way".
- Filler: "it is worth noting", "importantly", "in order to".
- "Serves as", "acts as", "stands as": say "is".
- Trailing "-ing" clauses with no fact in them: "..., ensuring a smooth experience", "...,
  highlighting the need".
- "Not just X but Y", and triplets where only two items are real.
- A run of sentences that each begin with Moreover, Furthermore or Additionally.
- Any sentence longer than about 30 words: cut it into pieces of one point each.
- Em-dashes in new text: a colon, a comma, parentheses or a fresh sentence does the job.
- Two names for one thing: use the glossary's term every time.
- Soft hedges ("somewhat", "fairly", "relatively"): state the figure or drop the word.

Before: "It is worth noting that the new cache is a robust layer, ensuring that reads are fast."
After: "Reads from the new cache take 4 ms, down from 40 ms (`bench/read.txt`)."

## Leave alone

- A hedge that is true because you are unsure: "likely", "I have not checked". Do not harden
  "looks like a timing problem" into "was a timing problem".
- Technical vocabulary and anything in backticks, including test names, paths and commands.
- Lists and tables that help the reader act.
- Quoted words.

## Claim and evidence

Take each claim and ask what supports it in this very text: a test result, a
`file:line`, a commit, command output, or a file written by a reviewer. Then check that the verb is not stronger than that
support.

- **Nothing supports it: point to something, or soften.** "Tests pass" becomes "unit tests 212/212;
  integration suite not run".
- **The verb outruns the evidence: weaken it.** Write "fixed" only when a test failed before the
  change and passed after it. Write "verified" only for what you actually ran. Write "all" only
  for what you counted in full. Otherwise report what you did check: "the two routes I opened
  work".
- **A broad claim resting on a narrow check: shrink it.** If 2 of 40 failures are understood, say
  so and state what the other 38 are. Never write that they are all harmless.
- **A loose size turns into a figure with its origin:** "about 300 users (analytics export, Nov 3)".
- **A failure or a skipped step belongs in the main text, in plain words.** Do not cushion it or
  park it in a linked file.

## Output

Return the cleaned text only, with no list of edits unless someone asks for one.
