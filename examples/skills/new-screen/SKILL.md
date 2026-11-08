---
name: new-screen
description: "EXAMPLE (web front end with a component library and translation files): build a screen from its spec — gate inside the page, every state, library components first, all text as translation keys, accessibility checks, then the screenshot review. Rewrite for your stack before use."
---

> Example skill. Replace the paths, the component library and the routing with your project's.

Reviewed by `ux-researcher` (`research-review`), `designer` (`design-review`), `domain-guardian`
and `qa-tester`; by `security-reviewer` too if it signs people in or shows personal data.

1. **No spec, no screen.** If the spec marks something as still open, do not decide it yourself: build
   the interim behaviour the spec describes and repeat the open point in your report.
2. **API names come from the contracts.** If the screen needs an operation or field that does not exist,
   ask the architect; do not patch around it in the page.
3. **Repeat the access check inside the page**, not only in the layout. A layout and its page can
   render independently, so a check in the layout alone can be skipped.
4. **Build every state** the spec names: empty, loading, error, partial, offline, no permission.
5. **Components from the library first.** Anything hand-made needs a reason in the report.
6. **No hard-coded text.** Every string is a key, present in every language file.
7. **Accessibility:** labels, focus order, contrast, keyboard use; run the automated checks in
   component tests.
8. **Screenshot review** before anyone else sees it (`design-review` skill).
