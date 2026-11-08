# Build nothing the task did not ask for

If neither the spec nor any caller needs a setting, switch, argument or plug-in point today, leave it out. Do not wrap code in an abstraction that only one place uses.

**Why:** Every option someone adds must then be tested, documented and kept. Room to grow is good design; an option nobody asked for is a cost.

**How to apply:**

- Shaping code so a likely next feature fits without a rewrite is fine and expected.
- If you think an option is needed, ask; it goes in the next decision batch.

**Where it lives:** every builder role; the `architect` review.

Origin: field-tested.
