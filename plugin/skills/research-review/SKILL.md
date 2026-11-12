---
name: research-review
description: "Check a flow or screen from the user's side — against its persona and journey, the glossary, Nielsen's ten heuristics and WCAG 2.2 AA — and say which findings rest on facts and which on guesses. Run it on a screen spec before building, and again on the built screen."
---

This review belongs to the `ux-researcher`. The person who designed or built the screen never runs
it on their own work. Send each finding to the person who can act on it: the designer fixes the
spec, the builder fixes the screen, the product owner answers questions.

## What to read

- The persona and the journey that the spec points to, including their open questions.
- The spec itself, plus any shared layout or frame spec the screen lives inside.
- The glossary entry for every word, role and status shown on the screen.
- The project's design system.

Personas and journeys should label each statement **Defined** (taken from the glossary),
**Decided** (the owner's call, dated) or **Assumed**. If a finding depends on an Assumed statement,
report it as a question rather than a defect.

## Four checks, in this order

1. **Journey.** Do the steps come in the order the journey gives, with the same choices at the same
   moments? If the screen asks for information before the journey explains why it is needed, the
   user is being asked too early.
2. **Words.** Is every label, role and status the glossary's term, used in the glossary's sense?
3. **Heuristics.** Walk Nielsen's ten: visible status; the user's own words and concepts; easy undo
   and exit; consistency; preventing errors; showing options rather than relying on memory;
   shortcuts for frequent users; nothing on screen that does not need to be; plain error messages
   with a way forward; help where it is needed.
4. **Accessibility (WCAG 2.2 AA).** Labels on every control, a sensible focus order, enough
   contrast, targets large enough to tap, meaning never carried by colour alone, full keyboard and
   screen-reader use, and layouts that hold up with longer translations and at 200% zoom.

## Heuristics that keep catching things

Run these as a checklist after the four checks. Each is a defect that reviewers found more than once.

- [ ] **A submit that only goes grey.** A disabled button with no other change tells nobody
  anything. The button stays reachable, and its label or a message says what is happening.
- [ ] **A model word on screen.** Labels use the user's words, not field, table or status names from
  the code. The menu item and the page it opens use the same word.
- [ ] **An error with no next step.** Each error says what to do, and for a state a retry cannot
  fix (expired, revoked, blocked) it names a person or place to go. No promise the product cannot
  keep, such as "someone has been told" when nothing tells anyone.
- [ ] **A one-way action that looks safe.** A destructive or irreversible dialog opens with focus on
  the safe choice and names what will happen.
- [ ] **A field that silently changes input.** A length limit that cuts a pasted value, or a refusal
  with no reason, is a defect. Say why, and send nothing.
- [ ] **The same action under two names.** Check the other screens and the message files, not
  memory. A row action's accessible name contains its visible word.
- [ ] **A state nobody drew.** For each entity, list its statuses from the glossary, and each
  error the screen's operations can return; each needs a place on the screen.
- [ ] **A screen that tells more than it should.** Where a screen looks someone up by contact
  details or an identifier, the answer must be the same whether or not they exist, in content,
  wording and timing. A helpful "already registered" is a leak.
- [ ] **A secret in an address.** A token in a path, a query or a return link ends up in logs.
- [ ] **Targets too small.** Check tappable things on a phone, especially links inside table cells
  and row actions.
- [ ] **Clipped text.** A label cut off, clamped or ellipsed is unreadable in the language where it
  is longest. Check long translations, 200% zoom and a narrow width.
- [ ] **A guess written as a finding.** A claim about what users do or prefer that no research backs
  is a question, marked as assumed, not a defect.

## What to return

A list of findings. Each has a severity (**blocker**, **should-fix** or **question**), where it is
(a spec section or a screenshot region), what is wrong and why, and the kind of statement it rests
on: Defined, Decided or Assumed.
