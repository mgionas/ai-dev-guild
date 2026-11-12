# Changelog

One entry per change, so each can be taken or left on its own. **(field-tested)** means it ran in a
real project's workflow before it was written here; **(new)** means it has not yet.

## Unreleased

- The designer, builder and `research-review` carry more of the practice they were thin on:
  the designer counts clicks per task, keeps one filled button per view, gives each row and control
  an anatomy and reviews screenshots against stated criteria; the builder builds every state the
  spec names, checks accessibility, comments why, keeps feature folders and runs the system-map
  check; `research-review` ends in a checklist of the findings that keep recurring. A `new-module`
  example joins the four beside it. The role pages say the same. (field-tested)

- A system map starter in `examples/system-map/`: the `docs/system-map/` layout (areas, one
  features file per area, a baseline of undescribed items that only shrinks), a small checker that
  refuses an API operation, screen or table no feature claims, and three readers that take those
  facts from an OpenAPI document, route files and SQL migrations, each refusing an input it cannot
  read instead of skipping it. The `system-map` skill now ships its page as a template in the same
  two modes as the roadmap, and `project-map` says it is the lighter version. The starter's one
  dependency is `yaml`, pinned. (field-tested)

- The local CI example is rebuilt with tests: one tested function decides what a change reaches, an
  empty selection is never read as a pass, renames count on both sides, the build tool's own
  selection is checked against the script's, a failing step prints its log tail, and test workers
  are capped at the CI runner's cores. A flaky-test retry and a "did a step change the files" probe
  come as optional parts. CI now runs the example tests. (field-tested)

- The roadmap, the QA board and the project map ship as page templates, so every project gets the
  same pages instead of a sentence describing one. Each page reads its rows from the artifact
  database when the view can run it, or from a JSON block in the page when it is a plain file; the
  QA board records results only in the first case and shows read-only controls in the second. The
  skills carry the data shape for each page and the capabilities to declare when publishing, and
  the project map template now starts at `<title>` like an artifact, with dark-mode tokens that
  follow a theme setting. (field-tested)

- The guard hooks ask before a `kill` and refuse secret files from the shell: any kill but the
  agent's own job (`kill %1`, `kill $!`) gets the "ask" answer, because one command does not say
  which processes this agent started (a pattern kill is still refused, and its message no longer
  suggests `kill <pid>`). A command naming `.env` or `.env.*` (not a name ending in `.example`,
  `.sample` or `.template`) is refused from the shell unless it is one of the few that do not read
  it (`ls`, `rm`, `source .env`, …), and from the Read and Grep tools, a side door the settings'
  deny rules left open. Every rule also looks inside `bash -c`, `eval` and wrappers such as
  `sudo -u`, and a command the hook cannot read is refused instead of let through. (field-tested)

- The loop follows the project, not one habit: `setup` asks "squash follow-ups, or fix forward?"
  and writes the answer under a "History" heading in `AGENTS.md` (default: fix forward); skills and
  roles follow it. `qa-tester` has a panel mode that edits nothing and reports each missing test as
  a finding, so it cannot change the head the others review. `run-task` gains a controller
  checklist and a fallback when `ai-dev-guild:<role>` agent types are not loaded (a general-purpose
  agent with the role's tools as a hard rule). Briefs gain "Choices already made (do not reopen)".
  (field-tested)

- A new project loads and runs on its first day: `setup` writes the permission rules (deny reads of
  `.env` files, ask before `git push` and `gh pr merge`, allow edits under `.work/` so reports can
  be written), offers to git-ignore `.claude/worktrees/`, proves the guard hooks run with a harmless
  pattern-kill probe, and ends by telling you to start a new session, since plugins, agents, skills,
  rules and hooks load only at session start. A builder whose report write is refused hands the
  report back instead. (field-tested)

- Narrowed checks fail closed: a changed file outside the packages that nobody has classified runs
  everything; files read across package lines are declared as inputs of the task that reads them,
  in the build tool's config, with a guard test; suites that scan every package declare it; the
  build tool's own selection is checked before it is trusted; the verdict names its reach; the
  example runner gains `--dry-run`, an INERT list and lockfile diffs that external diff tools
  cannot change. Mistake "A hand-kept list of what reads what". (field-tested)

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
