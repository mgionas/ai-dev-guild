# ai-dev-guild

**A guild of AI agents for Claude Code: one builds, another inspects, and nothing leaves the
workshop without proof.**

Like a craft guild, every member has one trade, and no piece of work gets the guild's mark until
someone other than its maker has checked it. ai-dev-guild is a Claude Code plugin: 20 subagent roles, 12 skills and 3 guard hooks. It came out of a
production project built mostly by AI agents, after months of finding the same mistakes in review.
Everything project-specific has been taken out, so you bring your own glossary, stack and rules.

## Quick start (2 minutes)

In Claude Code:

```
/plugin marketplace add mgionas/ai-dev-guild
/plugin install ai-dev-guild@ai-dev-guild
```

Or from a shell:

```bash
claude plugin marketplace add mgionas/ai-dev-guild
```

```bash
claude plugin install ai-dev-guild@ai-dev-guild
```

Then, in your project:

```
/ai-dev-guild:setup
```

This writes an `AGENTS.md` brief (golden rules, where your glossary lives, commands), a `CLAUDE.md`
that imports it, a `.work/` folder for briefs and reports, and the list of files the guard hooks
protect. It never overwrites a file; it asks.

Now run a task through the loop:

```
/ai-dev-guild:run-task <a task from your plan>
```

Hooks need Node.js 22.5 or later (24 LTS recommended). Prefer plain files to a plugin? See [copy the folder instead](docs/install.md).

## The loop

The **controller** is your main Claude Code session: it writes briefs, sends each task to a fresh
agent and reads reports, but never builds or reviews. A **question sweep** lists the product
questions a task will raise before anyone builds it. The **carried list** (`.work/carried.md`) keeps
problems noticed outside a task until they get their own.

```
question sweep → brief → fresh builder → report with evidence
   → review panel (never the builder) → fresh fixer → one re-check
   → strict local check → merge → roadmap and QA board updated
```

[How the loop works](docs/loop.md) has the diagram and the reason for each step.

## What you get

### Roles (subagents)

| Build                                              | Review                                               | Board (decision advisors)                                        |
| -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| [builder](docs/roles/builder.md)                   | [architect](docs/roles/architect.md)                 | [product-manager](docs/roles/board-product-manager.md) (chair)   |
| [fixer](docs/roles/fixer.md)                       | [security-reviewer](docs/roles/security-reviewer.md) | [tech-lead](docs/roles/board-tech-lead.md)                       |
| [money-specialist](docs/roles/money-specialist.md) | [domain-guardian](docs/roles/domain-guardian.md)     | [finance-expert](docs/roles/board-finance-expert.md)             |
| [db-migrations](docs/roles/db-migrations.md)       | [qa-tester](docs/roles/qa-tester.md)                 | [legal-advisor](docs/roles/board-legal-advisor.md)               |
| [i18n](docs/roles/i18n.md)                         | [designer](docs/roles/designer.md)                   | [user-advocate](docs/roles/board-user-advocate.md)               |
|                                                    | [ux-researcher](docs/roles/ux-researcher.md)         | [operations-expert](docs/roles/board-operations-expert.md)       |
|                                                    | [docs-keeper](docs/roles/docs-keeper.md)             | [business-development](docs/roles/board-business-development.md) |
|                                                    |                                                      | [domain-expert](docs/roles/board-domain-expert.md)               |

Each role page says when to use it, what it gets and what it returns. Each role has a default
model: opus where judgement is the whole job (security, architecture, money), sonnet elsewhere.

### Skills

| Skill                                                | Use it to                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [`setup`](skills/setup/SKILL.md)                     | prepare a project for the loop, once                            |
| [`run-task`](skills/run-task/SKILL.md)               | run one task through the whole loop, as the controller          |
| [`write-brief`](skills/write-brief/SKILL.md)         | write a brief a fresh agent can work from alone                 |
| [`review-panel`](skills/review-panel/SKILL.md)       | choose reviewers by what the change touches                     |
| [`fix-round`](skills/fix-round/SKILL.md)             | fix findings with a fresh agent, then confirm once              |
| [`decision-batch`](skills/decision-batch/SKILL.md)   | ask the owner every open question at once, with recommendations |
| [`board`](skills/board/SKILL.md)                     | put a decision with real trade-offs to a board of advisors      |
| [`design-review`](skills/design-review/SKILL.md)     | review a built screen from screenshots before anyone sees it    |
| [`research-review`](skills/research-review/SKILL.md) | review a flow against personas, heuristics and WCAG 2.2 AA      |
| [`local-ci`](skills/local-ci/SKILL.md)               | run (or set up) a strict local check that mirrors CI            |
| [`system-map`](skills/system-map/SKILL.md)           | keep a map of features, operations, screens and tables current  |
| [`progress-boards`](skills/progress-boards/SKILL.md) | keep the roadmap and the QA board current with every change     |

Skills are invoked as `/ai-dev-guild:<name>`. Stack-specific skills (migrations with row-level
security, API endpoints, outbox events, screens) are in [examples](examples/README.md), clearly
marked, and are not loaded by the plugin.

### The guard hooks

| Hook          | Refuses                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guard-paths` | an edit to a file listed in `.claude/protected-paths` (default: `.env` files), symlinks included                                                       |
| `bash-guard`  | `pkill`, `killall`, `kill $(pgrep …)`; `--no-verify` and other skipped git hooks; a shell write (`>`, `tee`, `sed -i`, `cp`, `mv`) to a protected file |
| `after-edit`  | nothing by itself: if your project has an executable `.claude/after-edit`, it runs it on each edited file and sends any failure back to Claude         |

The hooks read the command as text (quoted text and heredocs are ignored) and fail open on bad
input. They are a fast first line; your pre-commit hooks and CI stay the authority. With the default
rules, `cp .env.example .env` is refused too: create secret files yourself, not through an agent.
The hooks do not protect their own files or `.claude/protected-paths`; review changes to those.
A live run inside a Claude Code session has not been recorded yet; the hooks' own tests and their
exact command strings have been run.

## The rules behind it

- [Working rules](docs/rules/README.md), one file each, with the reason. The core:
  the builder never reviews; one task per fresh agent; evidence before done; change only what the
  task needs; write down what you assumed; build nothing unasked.
- [Mistakes that keep happening](docs/mistakes.md), each with a short reproduction: failing open,
  secrets inside errors, a test that cannot fail, a check that never runs, editing the decision to
  match the code, and more.

## What it does not do

- It does not know your product. Your glossary, business rules and decisions live in your
  repository, and the roles read them from the paths your `AGENTS.md` names.
- It does not decide for you. Product, money and legal questions always go to a person.
- It does not replace CI. It makes sure the local check is as strict as CI, and that nobody says
  "done" without one.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE).
