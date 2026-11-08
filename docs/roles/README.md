# Roles

The builder of a change never reviews it. Reviewers get the change and the rules, never the builder's reasoning. Models are chosen on purpose; see [the run-task skill](../../skills/run-task/SKILL.md) for the table.

## Build

| Role | Does | Edits | Model |
| --- | --- | --- | --- |
| [builder](builder.md) | Builds one task from a brief | Code in the brief's scope | sonnet |
| [fixer](fixer.md) | Fixes a list of review findings in a fresh context | Code and tests named by the findings | sonnet |
| [money-specialist](money-specialist.md) | Builds or reviews code that touches money (never both on one change) | Code in the brief's scope | opus |
| [db-migrations](db-migrations.md) | Writes backward-compatible schema migrations and their tests | Migrations, schema, tests | sonnet |
| [i18n](i18n.md) | Keeps translation files complete and consistent with the glossary | Message files | sonnet |

## Review

The designer also writes screen specs. The ux-researcher also does research.

| Role | Does | Edits | Model |
| --- | --- | --- | --- |
| [architect](architect.md) | Reviews boundaries, contracts, schemas and structure; drafts decision records | Nothing (read-only) | opus |
| [security-reviewer](security-reviewer.md) | Reviews access, personal data, secrets, uploads and webhooks | Nothing (read-only) | opus |
| [domain-guardian](domain-guardian.md) | Checks work against the glossary and rules; lists product questions | Nothing (read-only) | sonnet |
| [qa-tester](qa-tester.md) | Maps criteria to tests, adds tests, tries to break the change | Tests only | sonnet |
| [designer](designer.md) | Reviews built screens; also writes screen specs | Design documents and tokens | opus |
| [ux-researcher](ux-researcher.md) | Reviews flows and screens for usability; also does research | Research documents | sonnet |
| [docs-keeper](docs-keeper.md) | Keeps documentation true to what was built | Documentation | sonnet |

## Board

Board members advise in a [board session](../../skills/board/SKILL.md). Each answers alone.

| Role | Does | Edits | Model |
| --- | --- | --- | --- |
| [board-product-manager](board-product-manager.md) | Chairs; goals, scope, trade-offs | Nothing (read-only) | opus |
| [board-business-development](board-business-development.md) | Customers, competitors, positioning | Nothing (read-only) | sonnet |
| [board-domain-expert](board-domain-expert.md) | How the industry really works | Nothing (read-only) | sonnet |
| [board-finance-expert](board-finance-expert.md) | Pricing, cash flow, tax, payment costs | Nothing (read-only) | opus |
| [board-legal-advisor](board-legal-advisor.md) | Law where the product runs; questions for a lawyer | Nothing (read-only) | opus |
| [board-operations-expert](board-operations-expert.md) | Day-to-day running of the service | Nothing (read-only) | sonnet |
| [board-tech-lead](board-tech-lead.md) | Feasibility, cost, data model risk | Nothing (read-only) | sonnet |
| [board-user-advocate](board-user-advocate.md) | The users' voice | Nothing (read-only) | sonnet |

## Outside the board

Advisors for getting started and for running the loop cheaply.

| Role | Does | Edits | Model |
| --- | --- | --- | --- |
| [stack-advisor](stack-advisor.md) | Proposes a stack and online services, with current free tiers and a way to test | `docs/stack.md` only | opus |
| [token-optimizer](token-optimizer.md) | Measures where a session spent its tokens and suggests cheaper habits | its report only | sonnet |
