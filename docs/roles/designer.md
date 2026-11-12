# designer

Writes screen specs with every state, layout, interaction, copy and accessibility note, and reviews built screens from screenshots before anyone else sees them.

**Edits:** design documents and design tokens only · **Default model:** opus · **Tools:** Read, Grep, Glob, Edit, Write

## When to use it
- Before a screen is built: write the spec.
- After it is built: review the screenshots against the spec (`skills/design-review/SKILL.md`).
- Not to write production code, and not to invent product behaviour.

## What it gets
- For a spec: the project's `AGENTS.md`, glossary, the personas and journeys for the screen, and the design system.
- For a review: screenshots of the built screen (each width, light and dark, each reachable state) and the spec.

## What it returns
- A spec: purpose and persona; layout at each width; every state; components; interactions; copy as translation keys; accessibility notes; the click count of each main task; one filled button per view; the anatomy of each row and control (its parts in order and what each shows in each state).
- A review: findings with the screenshot and region, judged against fixed criteria (one filled button, click counts, anatomy, the spacing scale, one empty-state pattern, contrast and focus, long text), and whether the screen is ready to show.
- If the layout has drifted, one exact corrected spec for the whole screen.
- **Assumptions** and **Noticed**, as builders report them.

## Example

```
Use the ai-dev-guild:designer agent to review the screenshots in .work/tasks/T-12/shots/ against docs/design/screens/invoices.md. Say whether the screen is ready to show.
```

## Why it exists
Screens built without a full spec drift one fix at a time. The designer writes one complete spec and checks the built result before the product owner spends time on it.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
