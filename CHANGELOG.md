# Changelog

One entry per change, so each can be taken or left on its own. **(field-tested)** means it ran in a
real project's workflow before it was written here; **(new)** means it has not yet.

Each merged pull request cuts a version: the entry moves from Unreleased to a new heading, and the
tag `vX.Y.Z` marks that version on GitHub. The guards plugin keeps its own version, named under the
heading where it changed.

## Unreleased

## 0.21.0 (2026-11-21)

- The `local-environment` skill now covers local telemetry and fake message providers. It advises one telemetry stack per project, never one shared between projects. Tracing starts only when the OTLP endpoint is set, every span carries the environment, and data is scrubbed in the app before export. Logs go out as JSON lines, through a forwarder with a bounded queue. Dashboards are kept in the repository, mounted read-only with browser edits off, and a recreate is needed to reload them, which wipes the data when there is no volume. Every outside provider that messages a person has a fake chosen by configuration, writing a delivery log, plus a fixed sign-in code in development only. A boot check refuses either one outside development and treats an unknown environment as not development. `templates.md` adds the dashboard provider, its mounts (with the image's provider path, checked on 0.41.0), the telemetry variables and the guard. The troubleshooting list gains three proxy and dashboard cases. Guards unchanged (0.3.2). (field-tested: telemetry, dashboards and the guard come from a real project's setup; the template is new)

## 0.20.1 (2026-11-21)

- The wait for a quiet machine no longer deadlocks with other waiters (`local-ci`, `docs/rules/heavy-runs-once.md`, `run-task`): a test tool is matched by the program that runs it (or by the containers it starts), never by a command line alone, because every other agent's `wait && run` shell names the tool too and two waiters each saw the other as busy. Several heavy runs go in one queue the controller runs one after another, because waiters released together start together. `docs/mistakes.md`, "A wait that waits on itself", gains the case. Guards unchanged (0.3.2). (field-tested: the deadlock and the program-name match; the queue is new)

## 0.20.0 (2026-11-21)

- New role, `status-keeper` (`plugin/agents/status-keeper.md`, `docs/roles/status-keeper.md`): it checks the roadmap and its published page against git after every merge and agent hand-back, and once a day on a schedule. A step whose pull request is merged, or whose branch is already in the main branch, becomes done; a step at building, review or fixing, not merged, with no commit for 2 days, which the controller does not name as running, becomes `paused` (a new roadmap stage; `waiting` on the page), and a scheduled run with no list of running work only reports it; an item whose steps are all done becomes done; every milestone's status and count is checked against its items, and a parent with no children is never marked done; a sentence git contradicts is replaced; a merge with no QA board entry is reported. It changes a status only with evidence, never deletes or rewrites notes, never marks the owner's step done without proof, and reports each change as "from → to, evidence". The `progress-boards`, `roadmap` and `run-task` skills and `docs/rules/progress-boards.md` call it, and say that a parent status the page stores on its own is worked out from its children or checked. Guards unchanged (0.3.2). (new)

## 0.19.0 (2026-11-21)

- New rule, "Failures in full, passes as a count" (`docs/rules/quiet-test-output.md`): agents run tests with the runner's own quiet output, read each failure in full and the passing tests as a count (test files and tests, where zero, a missing count or an unexplained drop is a failure), still see standard error, warnings and unhandled errors in full, list mutation survivors in full, paste the exit code and the log's path, prove once per runner that a passing test's error output still shows, keep the full log in a file, and never hide a failing exit code behind a pipe. The `builder`, `fixer` and `qa-tester` roles, the `write-brief` template, `token-review` and the `token-optimizer` follow. It should save input tokens on every test run; not yet measured. Guards unchanged (0.3.2). (new)

## 0.18.0 (2026-11-20)

- Lessons from a real project's workflow, each where it applies. Fixers run the guard tests every round as well as the covering tests, and the findings file names them (`fixer`, `fix-round`). Builders and fixers stop and report when a hook refuses (roles and their pages), instead of taking the alternative the refusal suggests. The `security-reviewer` checks a cap on requests in flight, statement timeouts shorter than the connection wait, and one person setting off two limits at once. A wait-until-quiet loop runs as its own command and counts only named busy signals, with two quiet checks and a time limit; a port clash or a hung process is ruled out before a test is called flaky (`local-ci`, `docs/rules/heavy-runs-once.md`). A branch too big for one reviewer is reviewed by area, and a reviewer may be resumed for its own confirm-only re-check (`review-panel`, `fix-round`). Pull requests that change the lockfile merge one at a time (`run-task`). `docs/mistakes.md` gains "A wait that waits on itself" and a connection-dependent count. Guards unchanged (0.3.2). (field-tested)

## 0.17.2 (2026-11-16)

- The skills that need a script (`local-ci`, `system-map`, `flow-stats`) no longer carry a download command: they ask the user to copy the folder from the matching release tag, following the new `docs/copy-a-script.md`, and never download it themselves. The plugin README says so under "What it runs, sends and fetches". The plugin directory had flagged the commands as download-and-run. `setup` step 8 and `docs/troubleshooting.md` follow. Guards unchanged (0.3.2). (new)

## 0.17.1 (2026-11-15)

- CI validates the marketplace and both plugins with `claude plugin validate --strict`, the first check the plugin directory runs, using a pinned Claude Code version; `CONTRIBUTING.md` gives the same command. The plugin gets its directory listing name, "AI Dev Guild", and a new icon in place of the unused old one (`plugin/.claude-plugin/icon.png`); the install name `ai-dev-guild` is unchanged. `scripts/check-repo.mjs` now checks that a manifest's `icon` is a real file, because the validator passes a missing one. Guards unchanged (0.3.2). (new)

## 0.17.0 (2026-11-15)

- Releases and onboarding: this changelog is cut into versions (each merged pull request cuts one, tagged `vX.Y.Z`), `CONTRIBUTING.md` has the release steps, and the skills that need a script (`local-ci`, `flow-stats`, `system-map`) give one command that copies the example folder from the tag matching the installed plugin; `setup` offers the local CI runner when a project has CI and no local check; new pages `docs/upgrade-and-remove.md` (check the version, update, remove what `setup` wrote) and `docs/troubleshooting.md`, linked from the README and `docs/install.md`. (new)

## 0.16.0 (2026-11-15)

*Guards 0.3.2 shipped in this version; the first entry is theirs. The checks and CI entry did not change the plugin version, so it sits under the tag it first appears in.*

- Guards 0.3.2: gaps found in review. `git commit --no-verif` and every other abbreviation of `--no-verify` git accepts for `commit`, `push`, `merge`, `am` and `rebase` is refused (checked against git, and from `--no-v` up whatever the version), and so is `core.hooksPath` set by `git config` (unsetting or reading it passes, judged by the word after `config`, so `git config core.hooksPath get` is refused), `--config-env`, `GIT_CONFIG_KEY_<n>` or `GIT_CONFIG_PARAMETERS`. Asked about, not refused: deleting, moving, writing or re-moding a file under `.git/hooks/`, `.husky/` or `.lefthook/` or `lefthook.yml` / `.pre-commit-config.yaml` (also a Write or Edit to one); `git commit` or `git push` with pre-commit's `SKIP=` set; and a variable set to a secret file name that a later command or a nested shell expands (`F=.env; cat $F`, `F=.env bash -c 'cat $F'`). The same question for `.git/config` and `.git/config.worktree` (also a Write or Edit), `lefthook uninstall`, `pre-commit uninstall`, and `perl -pi` or `ruby -pi` on a hook file. `node -e`, `python3 -c`, `ruby -e`, `perl -e`, `php -r`, `bun -e` and `deno eval` one-liners, and a heredoc or here-string fed to an interpreter, that name a secret file are refused; so is `node --env-file=.env -p process.env` (asked about when the code does not mention `env`). On Node older than 22.5 (or 20.19) the edit and shell hooks refuse every call with a message naming the version needed, where before they died while loading and let the call through; `guard-paths` also refuses when it fails while judging. The guards' README lists what they cannot see. (new)

- CI catches the drift a review found by hand: `check-repo` also checks that role and skill counts, lists and badges match the folders, frontmatter names match file names, every agent has a role document with the same model, `#anchor` links point at a real heading and "in this skill's folder" names a real file; a new `check-pages` parses every page template's data and scripts and runs each script once against a small DOM stand-in with example data, and checks the `<` escape text is still there; all of it runs on Ubuntu and macOS with Node 22 and 24, with the actions pinned to commits. (new)

- Coherence pass: `run-task` starts with a task branch named in the brief and defines the merge (a pull request, or a local merge with no remote); builders and fixers carry the claim-and-evidence rules in their own files instead of calling a skill they cannot run; one severity scale (critical, high, medium, low) in every role and skill, and `flow-stats` reads the old words; `setup` writes a `## Pages` list that `run-task` follows; one combined reviewer only for docs-only changes; the roadmap page accepts `merged` as a stage; counts, links and CI steps in the READMEs match the repository. (new)

## 0.15.0 (2026-11-15)

- `flow-stats` skill and page: a script counts the records the loop already writes (task days, findings, fix rounds, local CI runs, questions to the owner, tokens) and a living page shows them, with at most three suggestions tied to the guild's own rules when a measure passes its threshold; templates and skills now state the record conventions it reads, and `local-ci` gains `--record`. (new)

## 0.14.0 (2026-11-15)

*Guards 0.3.1 shipped in this version; its entry is the third one below. It and the two README entries did not change the plugin version, so they sit under the nearest one.*

- README: screenshots of the five living pages (light and dark, example data), a paragraph on why the
  system map matters when agents change code often, and a "What the loop catches" figure: average rates from
  reviewed tasks. (field-tested)

- README: a "Living pages" section says what the roadmap, QA board, analysis page, project map and system map are, why the guild keeps them, how they work (artifacts or embedded rows) and how they help, a "Plain reports" section explains `plain-report` with a before and after, two rows join the "What changes" table, and each new section has a diagram. (field-tested)

- Guards 0.3.1: three gaps closed. `source` and `.` of `/dev/stdin`, `-` or a `<(…)`, and a shell given
  `<(…)` as its script, are asked about; `$'…'` escapes (`\x65`, octal, `\u`, `\U`, `\cX`, `\e` and the rest)
  are decoded before any rule judges the word, so `cat $'.\x65nv'` is refused; and a shell that reads an
  unquoted heredoc whose body expands something (`$name`, `$(…)`, backticks) is asked about. Their
  bypasses are closed too: a redirect before the file (`source 2>/dev/null <(…)`), another descriptor
  (`/dev/fd/3`), other spellings of stdin (`//dev/stdin`, `/proc/$$/fd/0`, `bash < /dev/stdin`) and zsh's
  `=(…)` are asked about; a heredoc delimiter written `$'A'` or `$"A"` no longer hides the commands after
  it; `$"…"` reads as a double-quoted string; and quoted or backslashed command names and options
  (`'pkill' -f x`, `git commit "--no-verify"`, `HUSKY='0' git commit`) are refused like the plain ones, as
  is `tee >(cat) .env`. Writes through `&>`, `>&` and `>|` to a protected path are refused, a
  redirect before the command name no longer hides it (`2>/dev/null pkill -f x`), and a job kill with a
  redirect (`kill %1 2>/dev/null`) is no longer asked about. (new)

- One house design for every published page: new `progress-boards/page-design.md` (tokens for both
  themes, fonts, status colours, components, layout and the rules), pointed to from the roadmap,
  progress-boards, analysis-page, project-map and system-map skills, the designer and `setup`, which
  asks whether a project's pages use the house look or its own brand. The QA board and the project
  map templates are restyled to it (CSS and fonts only; the markup and scripts do not change). (field-tested)

## 0.13.0 (2026-11-15)

- New `plain-report` skill: an agent cleans up the prose it is about to hand to a human reader (a report,
  a pull request body, a summary of a review, a hand-back) so the wording is plain and no claim says more
  than its evidence. The builder, the fixer, the report template and `run-task` point to it.
  (field-tested)

## 0.12.0 (2026-11-15)

- New `analysis-page` skill: when the owner must decide something that rests on facts, the controller
  asks what the decision is and what the page must show, then publishes a page where every figure is
  tagged sourced, assumption or gap, sources are numbered at the end, and each recommendation is
  marked "for you to decide". The owner's answer is written back onto the page with its date. The
  `setup` skill asks which living pages a project wants. (field-tested)

- Questions to the owner: agents ask as soon as a product detail is unclear, not only in the sweep
  before a build. Each question is multiple choice with the recommended option first and marked, and
  stands on its own, since the owner may see only the question dialog. The `decision-batch` skill,
  its template and the `ask-dont-invent` rule say so. (field-tested)

- The `local-ci` skill says to tell the other agent sessions before a heavy run and to wait for the
  "done" of any that is running its own, checked right before each run. (field-tested)

- `where-ci-runs` says that when merges to the main branch land close together, a cancelling group
  can cancel the older run and let the newer one cover both: report it as cancelled, not failed, and
  read the newer run. (field-tested)

- The `local-environment` skill advises that a long-running dev supervisor print its own commit when
  it starts, or restart when its own files change, since it reloads its children and not itself.
  (field-tested)

- The `local-environment` skill says the page on running end-to-end tests lists every switch those
  tests need that is off by default. (field-tested)

- The `fix-round` skill sends mutation survivors in access or permission code to the
  `security-reviewer` before any fix, and the report records each one's class: real gap, equivalent
  mutant, or blocked by a database constraint. (field-tested)

- A research section for briefs, `write-brief/research-template.md`: the URL each number came from
  beside it, "not found" instead of a guess, and a result that labels each figure as sourced, an
  assumption or a gap. (field-tested)

- The `local-environment` skill says to name what a database reset wipes, including hand-made data,
  before asking the owner for one, and to remind them afterwards what to recreate. (field-tested)

## 0.11.0 (2026-11-14)

- The `local-ci` skill counts the runs one change gets: it lists the places the suite runs (git hooks,
  the local check, remote CI on the pull request, remote CI on main), keeps git hooks to fast checks,
  and says to check for other runs on the machine (CI too, when it runs there) before starting a
  heavy one. The rule and the matching mistake entry say the same. (field-tested)

## 0.10.0 (2026-11-12)

- A `local-environment` skill that advises, and never requires, how a project's local setup could be
  written down: its own named Docker Compose group (explicit names, loopback-only ports), local
  HTTPS on a `.test` domain with the certificate-trust step per operating system, one ports
  registry, a wiki and a generated API reference. It ships a compose file, proxy config, ports
  table and hosts block as templates, and `setup` offers it when a project has no written local
  setup. (field-tested)

## 0.9.0 (2026-11-12)

- The designer, builder and `research-review` carry more of the practice they were thin on:
  the designer counts clicks per task, keeps one filled button per view, gives each row and control
  an anatomy and reviews screenshots against stated criteria; the builder builds every state the
  spec names, checks accessibility, comments why, keeps feature folders and runs the system-map
  check; `research-review` ends in a checklist of the findings that keep recurring. A `new-module`
  example joins the four beside it. The role pages say the same. (field-tested)

## 0.8.0 (2026-11-12)

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

## 0.7.0 (2026-11-12)

- The roadmap, the QA board and the project map ship as page templates, so every project gets the
  same pages instead of a sentence describing one. Each page reads its rows from the artifact
  database when the view can run it, or from a JSON block in the page when it is a plain file; the
  QA board records results only in the first case and shows read-only controls in the second. The
  skills carry the data shape for each page and the capabilities to declare when publishing, and
  the project map template now starts at `<title>` like an artifact, with dark-mode tokens that
  follow a theme setting. (field-tested)

## 0.6.0 (2026-11-11)

*The guard entry below is Guards 0.3.0. It came in after this version and before 0.7.0 without a new plugin version, so it sits under the nearest one.*

- The loop follows the project, not one habit: `setup` asks "squash follow-ups, or fix forward?"
  and writes the answer under a "History" heading in `AGENTS.md` (default: fix forward); skills and
  roles follow it. `qa-tester` has a panel mode that edits nothing and reports each missing test as
  a finding, so it cannot change the head the others review. `run-task` gains a controller
  checklist and a fallback when `ai-dev-guild:<role>` agent types are not loaded (a general-purpose
  agent with the role's tools as a hard rule). Briefs gain "Choices already made (do not reopen)".
  (field-tested)

- The guard hooks ask before a `kill` and refuse secret files from the shell: any kill but the
  agent's own job (`kill %1`, `kill $!`) gets the "ask" answer, because one command does not say
  which processes this agent started (a pattern kill is still refused, and its message no longer
  suggests `kill <pid>`). A command naming `.env` or `.env.*` (not a name ending in `.example`,
  `.sample` or `.template`) is refused from the shell unless it is one of the few that do not read
  it (`ls`, `rm`, `source .env`, …), and from the Read and Grep tools, a side door the settings'
  deny rules left open. Every rule also looks inside `bash -c`, `eval` and wrappers such as
  `sudo -u`, and a command the hook cannot read is refused instead of let through. (field-tested)

## 0.5.0 (2026-11-11)

- A new project loads and runs on its first day: `setup` writes the permission rules (deny reads of
  `.env` files, ask before `git push` and `gh pr merge`, allow edits under `.work/` so reports can
  be written), offers to git-ignore `.claude/worktrees/`, proves the guard hooks run with a harmless
  pattern-kill probe, and ends by telling you to start a new session, since plugins, agents, skills,
  rules and hooks load only at session start. A builder whose report write is refused hands the
  report back instead. (field-tested)

## 0.4.1 (2026-11-09)

- Narrowed checks fail closed: a changed file outside the packages that nobody has classified runs
  everything; files read across package lines are declared as inputs of the task that reads them,
  in the build tool's config, with a guard test; suites that scan every package declare it; the
  build tool's own selection is checked before it is trusted; the verdict names its reach; the
  example runner gains `--dry-run`, an INERT list and lockfile diffs that external diff tools
  cannot change. Mistake "A hand-kept list of what reads what". (field-tested)

## 0.4.0 (2026-11-09)

- Know where CI runs: a guide (`docs/where-ci-runs.md`) on how CI differs from a developer machine
  (heap and workers sized from the machine, parallel levels that multiply, local state that hides
  missing setup, case-sensitive file systems, time zone and processor, unreached steps, hidden
  progress), every-workflow basics and self-hosted runner traps, security first. A page template in
  the `local-ci` skill, filled by `setup` and linked from briefs; the local check and its example
  runner imitate CI's heap, cores, time zone and locale. Rule "Know where CI runs"; mistakes "CI is
  a smaller machine" and "Raising a timeout to hide a starved machine"; "A check that never runs"
  now covers CI steps nobody reaches. (field-tested)

## 0.3.0 (2026-11-09)

- Heavy checks run only where the change reaches: the `local-ci` skill and its example runner run
  the affected steps from the merge base by default, using the build tool's own detection; they
  escalate to the full suite for CI files, the check itself, root config, a lockfile change that
  alters lines, an unknown base, or `--full` where no remote CI follows; every step reports ran,
  skipped (why) or escalated. Briefs and reports name the heavy steps and why; never two heavy
  runs at once on a shared machine. New mistake: "Testing everything for a change that reaches
  nothing". (field-tested)

## 0.2.0 (2026-11-08)

*The plugin was split in two in this version. Guards 0.2.0 is the first version of the guards plugin. The last two entries did not change the plugin version, so they sit here as the nearest one.*

- Split for the Claude plugin directory: the main plugin (`plugin/`) is roles and skills in Markdown
  only (the project-map page template is now a code block in `map-template.md`), with no hooks or
  scripts; the guard hooks are a separate optional plugin,
  `ai-dev-guild-guards` (`guards/`), in the same marketplace. Install with
  `/plugin install ai-dev-guild-guards@ai-dev-guild`. (new)

- Directory fixes: a square icon, hooks written as `node` plus the script path, every frontmatter
  text value quoted, and the copy instructions no longer chain a download into a copy. (new)

- Listing links for the directory: support (GitHub issues), documentation, and a privacy note
  (`PRIVACY.md`: the plugin collects and sends nothing). (new)

- Repository guards: CI on every pull request (`scripts/check-repo.mjs` keeps the listed plugin
  Markdown-only, files under 256 KiB, frontmatter quoted and links whole; the hook tests), a
  CODEOWNERS file, and a protected `main` that needs the maintainer's approval. (new)

## 0.1.0 (2026-11-08)

*The first seven entries below were written on the same day, before the split into two plugins, so they sit under 0.1.0.*

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
