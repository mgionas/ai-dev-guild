# Living pages

The guild keeps a few pages current for you, so you can see where a project stands without asking.
The [README](../README.md#living-pages) shows what each one looks like.

**Why.** Progress, test results and decisions get lost in a chat's scrollback. A page you can open
on a phone answers "where are we?" without you asking an agent.

**Why a system map.** Agents write and change code often and fast, and a developer can lose track of
what now exists and why. The system map is read from the code, so it shows what is really there: each
API operation, screen and table and the feature that owns it, plus the decisions people recorded for
that feature. The starter check in [`examples/system-map`](../examples/system-map), run with `--base`
against the main branch, refuses a new operation, screen or table that no feature describes, so the
map cannot quietly fall behind the code.

**How it works.**

- In Claude Code the pages publish as claude.ai artifacts. For the roadmap and the QA board, agents
  write the rows into the artifact's database in the same turn as each change, unprompted, so a
  status change is a data write and not a new page.
- If you do not use artifacts, the same page works as a plain file with the rows embedded in it.
  The QA board's buttons are then read-only.
- On the QA board, testers mark each check Pass, Fail or Blocked and add a note. The board shows who
  marked it and when, and an agent never overwrites a tester's result.
- On an analysis page, a figure with no tag is not put on the page. The page reports and never
  decides: the options come with a recommendation, and your answer is written back with its date.
- All pages share one design ([`page-design.md`](../plugin/skills/progress-boards/page-design.md)), for
  light and dark themes and for a phone. `setup` asks which pages the project wants and whether they
  use the house look or the project's brand.

**How it helps.**

- A tester knows what changed and what to retest, because each update lists its checks.
- You answer a decision from numbers whose trust level is on the page, and the answer stays beside them.
- A newcomer gets the picture of the parts and folders from a page read from the code, so it matches
  what is there.
- After a run of agent changes, a developer finds which feature a new route or table belongs to in
  one search, instead of reading the diff.
