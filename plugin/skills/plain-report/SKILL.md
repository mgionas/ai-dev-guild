---
name: plain-report
description: "Edit a text written for a person (a report to the owner, a pull request body, a review or fix summary, a hand-back, a commit message body, a roadmap note) so it reads plainly and every claim is no stronger than its evidence. Use before sending any such text."
---

# Plain report

Adapted from "academic-humanizer" by AIScientists-Dev
(https://github.com/AIScientists-Dev/academic-humanizer), itself built on "humanizer" by blader
(https://github.com/blader/humanizer). The licence of each is MIT. This skill is written fresh from
their ideas, and no text from other projects is used.

## Scope

- **Use on** text you write fresh for a person: a report to the owner, a pull request body, a
  review or fix summary, a hand-back, a commit message body, a roadmap note.
- **Never on** the words shown in the product's interface, documents the owner keeps (specs,
  decisions, glossary), existing docs or comments nobody asked you to change, or quoted words.
  The owner's documents get a dated note, never a rewrite.
- **Never change** a number, a count, a commit, a `file:line`, a code name, a glossary term or a
  quotation.

## Process

1. **Audit, silently.** Note each phrasing problem below and where it sits, and each claim with
   what backs it.
2. **Rewrite** with the same content in the same order. Remove the problems and match each claim
   to its evidence.
3. **Re-read once as the owner would, on a phone.** Can they act on it without opening another
   file?

## Phrasing to remove

- Hype and inflated importance: "crucial", "robust", "seamless", "comprehensive", "paves the way".
- Filler: "it is worth noting", "importantly", "in order to".
- "Serves as", "acts as", "stands as": write "is".
- "-ing" tails that add no fact: "..., ensuring a smooth experience", "..., highlighting the need".
- "Not just X but Y", and lists of three where two items are real.
- Several sentences in a row opened with Moreover, Furthermore or Additionally.
- Sentences past about 30 words: split them, one point each.
- Em-dashes in new text: use a colon, a comma, parentheses or a new sentence.
- Two names for one thing: pick the glossary's term and keep it.
- Vague hedges ("somewhat", "fairly", "relatively"): give the number or cut the word.

Before: "It is worth noting that the new cache is a robust layer, ensuring that reads are fast."
After: "Reads from the new cache take 4 ms, down from 40 ms (`bench/read.txt`)."

## Leave alone

- An honest hedge where something is uncertain: "likely", "I have not checked". Never turn
  "looks like a timing problem" into "was a timing problem".
- Technical terms, code in backticks, commands, paths, test names.
- Lists and tables that help the reader act.
- Quoted words.

## Claim and evidence

For each claim, ask what backs it here (a test result, a command's output, a commit, a
`file:line`, a reviewer's file) and whether the verb is no stronger than that.

- **No backing: add the pointer, or soften.** "Tests pass" becomes "unit tests 212/212; the
  integration suite was not run".
- **Verb stronger than the evidence: downgrade it.** "Fixed" only after a test went red and then
  green. "Verified" only if you ran it. "All" only if you counted all. Otherwise say what you did
  check: "the two routes I opened work".
- **A whole claim on partial evidence: narrow it.** If you explained 2 of 40 failures, say 2 of 40
  are explained and name what the other 38 are. Do not say "they are all harmless".
- **A vague size becomes a number with its source:** "about 300 users (analytics export, Nov 3)".
- **A failure or a skipped step goes in the main text, said plainly.** Do not soften it or leave it
  to a linked file.

## Output

Send the cleaned text. Add no list of changes unless asked.
