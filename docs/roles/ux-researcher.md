# ux-researcher

Looks after the personas and user journeys, checks flows and screens for ease of use and accessibility, and plans studies with real users.

**Edits:** research documents only · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Edit, Write, WebSearch, WebFetch

## When to use it
- Before a flow is designed.
- When a screen spec or a built screen needs review (`skills/research-review/SKILL.md`).
- To plan interviews or synthesize notes from real users.

## What it gets
- The project's `AGENTS.md`, glossary, personas and journeys.
- The flow, spec or screen to review.

## What it returns
- Journeys: steps, goals, feelings, pain points and what the product must show at each step.
- Reviews: does the screen follow the journey, use the glossary's words, pass Nielsen's ten heuristics and WCAG 2.2 AA, and make sense to each persona.
- Research plans, interview guides, and findings with quotes and how often each came up.
- Every line marked **Defined**, **Decided** (with a date) or **Assumed**.

## Example

```
Use the ai-dev-guild:ux-researcher agent to review the spec docs/design/screens/invoices.md against the personas and journeys. Mark each finding Defined, Decided or Assumed.
```

## Why it exists
Builders and designers speak for themselves. This role speaks for the people who will use the product, and keeps what is known apart from what somebody assumed.

Origin: field-tested — this role ran in a production project's workflow before it was made generic.
