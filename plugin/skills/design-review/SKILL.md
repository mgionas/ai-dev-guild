---
name: design-review
description: "Review a built screen from screenshots before the product owner sees it — every width, light and dark, every reachable state — against its spec, then fix in one pass. Use whenever a screen is built or changed."
---

The person who wrote the spec should not be the first to see the screen rendered, and the product
owner should never be the first visual reviewer.

1. **Take screenshots** of the built screen from the running app, with test accounts and seed
   data: each supported width (at least phone and desktop), light and dark, and every state you can
   reach (empty, loading, error, full, long text, no permission).
2. **Give them to the `designer`** with the screen spec. The designer compares the screenshots with
   the spec and with each other: spacing scale, alignment, one empty-state pattern, one place for
   counts, actions apart from view controls, contrast and focus.
3. **Fix in one pass.** If the layout has drifted, the designer writes one exact corrected spec for
   the whole screen, and a fresh builder rebuilds from it. Do not fix one screenshot at a time: piece
   fixes are how a screen drifts.
4. **Screenshot again** and confirm. Only then show the owner, with the screenshots.

Prefer the project's component library and its published examples. Anything hand-made needs a
stated reason.
