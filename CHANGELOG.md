# Changelog

One entry per change, so each can be taken or left on its own. **(field-tested)** means it ran in a
real project's workflow before it was written here; **(new)** means it has not yet.

## Unreleased

- Know where CI runs: a guide (`docs/where-ci-runs.md`) on how CI differs from a developer machine
  (heap and workers sized from the machine, parallel levels that multiply, local state that hides
  missing setup, case-sensitive file systems, time zone and processor, unreached steps, hidden
  progress), every-workflow basics and self-hosted runner traps, security first. A page template in
  the `local-ci` skill, filled by `setup` and linked from briefs; the local check and its example
  runner imitate CI's heap, cores, time zone and locale. Rule "Know where CI runs"; mistakes "CI is
  a smaller machine" and "Raising a timeout to hide a starved machine"; "A check that never runs"
  now covers CI steps nobody reaches. (field-tested)

- Heavy checks run only where the change reaches: the `local-ci` skill and its example runner run
  the affected steps from the merge base by default, using the build tool's own detection; they
  escalate to the full suite for CI files, the check itself, root config, a lockfile change that
  alters lines, an unknown base, or `--full` where no remote CI follows; every step reports ran,
  skipped (why) or escalated. Briefs and reports name the heavy steps and why; never two heavy
  runs at once on a shared machine. New mistake: "Testing everything for a change that reaches
  nothing". (field-tested)

- Repository guards: CI on every pull request (`scripts/check-repo.mjs` keeps the listed plugin
  Markdown-only, files under 256 KiB, frontmatter quoted and links whole; the hook tests), a
  CODEOWNERS file, and a protected `main` that needs the maintainer's approval. (new)

- Listing links for the directory: support (GitHub issues), documentation, and a privacy note
  (`PRIVACY.md`: the plugin collects and sends nothing). (new)

- Split for the Claude plugin directory: the main plugin (`plugin/`) is roles and skills in Markdown
  only (the project-map page template is now a code block in `map-template.md`), with no hooks or
  scripts; the guard hooks are a separate optional plugin,
  `ai-dev-guild-guards` (`guards/`), in the same marketplace. Install with
  `/plugin install ai-dev-guild-guards@ai-dev-guild`. (new)
- Directory fixes: a square icon, hooks written as `node` plus the script path, every frontmatter
  text value quoted, and the copy instructions no longer chain a download into a copy. (new)

- README: the "How it works" diagram is now a designed image in the banner's style, with numbered
  steps, the role and the file each step leaves, and the fix loop; a tall version for phones, light
  and dark. (new)

- Role `token-optimizer` and skill `token-review`: measure where a session spent its tokens and
  adopt a few rules to spend less. (field-tested)
- Skill `roadmap`: milestones a user can see, one step per task with its stage, and "later" items
  with what is done now to keep room for them. (field-tested)
- Skill `project-map`: a self-contained page with a System diagram and a Folders tree, read from the
  code, that never invents a job or shows a secret value. (field-tested, rewritten generic)
- The loop: hand off at about 110 turns or 250K context; hand-backs of a few lines; reviewers block
  only on correctness; reports list existing test assertions they changed; fixup commits; stop by
  default after a confirmed second fix round; rule "Turn a repeated mistake into a check".
  (field-tested)

- Role `stack-advisor` and skill `stack-advice`: a newcomer describes the project and gets a stack
  proposal per layer with an alternative, today's free tier (linked and dated), regions, lock-in,
  monthly cost and how to build and test; the user decides and signs up. (new)

- README is now a landing page: a light and dark banner, before-and-after advantages, a diagram of
  the loop, a two-minute install, what's inside and who it is for. (new)

## 0.1.0 — 2026-11-08

First public version.

- Roles: builder, fixer, qa-tester, architect, security-reviewer, domain-guardian,
  money-specialist, db-migrations, designer, ux-researcher, i18n, docs-keeper, and eight board
  members with a chair. (field-tested)
- Role `fixer`: a fresh agent for each fix round, instead of resuming the builder. (field-tested as
  a practice; new as a role file)
- Skills: run-task, write-brief, review-panel, fix-round, decision-batch, board, design-review,
  research-review, local-ci, system-map, progress-boards. (field-tested)
- Skill `setup`: writes an `AGENTS.md` brief, `CLAUDE.md`, `.work/` and the protected-paths list.
  (new)
- Hooks: `guard-paths` (protected files, symlinks resolved), `bash-guard` (pattern kills, skipped
  git hooks, shell writes to protected files). (field-tested)
- Hook `after-edit`: runs the project's own `.claude/after-edit` command instead of a built-in
  formatter, so it works with any stack. (new)
- Docs: how the loop works, 22 working rules with reasons, 15 mistakes with reproductions, one page
  per role. (field-tested)
- Rule "Assume no country" and the mistake "Assuming one country": money with its currency code
  and minor unit, UTC with IANA time zones, locale formatting, E.164 phone numbers, country rules from
  the project. Applied to the builder, money, i18n, QA and domain roles and the `AGENTS.md`
  template. (new)
- Examples, not loaded by the plugin: new-migration, new-endpoint, new-event, new-screen, and a
  strict local CI runner. (field-tested, rewritten generic)
