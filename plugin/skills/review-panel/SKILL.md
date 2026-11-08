---
name: review-panel
description: "Choose who reviews a change, size the panel to the risk, and brief each reviewer with the change and the rules — never the builder's reasoning. Use after a build report arrives."
---

**The builder never reviews their own change.** A reviewer who reads the builder's reasoning tends
to repeat the builder's mistake. Give reviewers the diff, the brief, the project rules and the spec.
They read the report's **Assumptions** after their own first pass.

## Who reviews what

| The change touches | Reviewers |
| --- | --- |
| Any code | `domain-guardian` + `qa-tester` |
| A small change with no money, access, personal data or migration | one combined Sonnet reviewer (domain + QA) |
| A public interface, contract, event or folder structure | add `architect` |
| A migration | `db-migrations` (if not the builder) + `architect` |
| Login, permissions, personal data, uploads, webhooks | add `security-reviewer` |
| Money | `money-specialist` (if not the builder) + a human |
| A new or changed screen or flow | `ux-researcher` (`research-review`), `designer` (`design-review`), `domain-guardian` |
| A high-risk change | a second, independent model as well, to reduce shared blind spots |

## Rules for the panel

- Block only on correctness and on stated requirements. Low findings go to the carried list, not
  into a fix round; security and money findings of Medium and above are always fixed.
- Run reviewers in parallel, each with its own scope. Two reviewers never answer the same question.
- A reviewer does not rerun tests the builder already ran and pasted, unless they doubt the output.
- Ask each for findings with a severity and `file:line`. Merge them into one findings file for the
  `fix-round` skill, with duplicates removed and disagreements between reviewers shown, not hidden.
- Product questions in the findings go to the owner as one batch (`decision-batch`), not to a fixer.
