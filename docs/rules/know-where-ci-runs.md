# Know where CI runs

Each project keeps one page saying what its CI runs on: hosted or self-hosted, operating system,
cores, memory, how many jobs run at once and what else uses the machine. Briefs that touch CI,
build config, test timeouts or heavy tests link it, and the local check imitates the smallest
runner's limits.

**Why:** Builds and tests that passed on a developer machine ran out of memory, or timed out, on a
runner with half the cores and memory. Agents raised test timeouts three times before anyone
looked at the machine. Nothing in their briefs said CI was smaller.

**How to apply:**

- Write the page from the [template](../../plugin/skills/local-ci/ci-environment-template.md) and
  link it from `AGENTS.md`. Change it in the same pull request as any runner change.
- Run the local check with CI's heap cap, core count, time zone and locale.
- A test that times out only on CI is a question about the machine first. Do not raise the timeout
  until you know why it is slow there.
- A self-hosted runner gets its own user account, never runs fork pull requests and never serves a
  public repository.

**Where it lives:** the `local-ci`, `setup` and `write-brief` skills; [Where CI runs](../where-ci-runs.md).

Origin: field-tested.
