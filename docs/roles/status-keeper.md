# status-keeper

Checks the roadmap and its published page against git and corrects only what the evidence proves wrong.

**Edits:** `docs/roadmap.md`, a page file with embedded rows, and its report · **Default model:** sonnet · **Tools:** Read, Grep, Glob, Bash, Edit, Write

## When to use it

- After every merge and every agent hand-back (not its own), in the same turn.
- Once a day as a scheduled backstop, for the runs a busy controller forgets.
- Not to plan work, write QA checks or decide anything for the owner.

## What it gets

- The repository, and where the roadmap and its page live.
- The work still running: the controller names the steps an agent or a person is on right now, because the keeper cannot see other agents. A scheduled run has no such list, so it only reports stalled steps.
- For a page whose rows live in an artifact database, the keeper needs the app's database tool. Without it, it checks `docs/roadmap.md` and lists the page rows to change, and the controller writes them.
- A report path.

## What it does

- A step whose pull request is merged, or whose branch is already in the main branch, becomes done, with the merge date and number or commit.
- A step at building, review or fixing, not merged, with no commit for 2 days and not named as running, becomes paused (`waiting` on the page), with a note saying since when.
- An item with steps that are all done becomes done; an active item with nothing moving becomes pending, unless it waits on the owner.
- Every milestone's status and count is checked against its items, every run. A parent with no children is never marked done.
- A sentence git contradicts is replaced; the headline and its date change only when something did.
- A merge with no QA board entry is reported, not written.

## What it returns

- A full report, and at most 15 lines back: each change as "from → to, evidence", and what it left alone and why.

## Rules it keeps

- A status changes only with evidence: a pull request number, a commit or a ledger line.
- It never deletes an item, never rewrites a note (it appends a dated sentence or replaces the one wrong sentence), never marks the owner's step done without proof, never sets or clears "needs the owner", and never touches a tester's result.
- `docs/roadmap.md` is the source; the page says the same.
- Plain language, no personal data.

## Example

```
Use the ai-dev-guild:status-keeper agent. Roadmap: docs/roadmap.md and the published page at <address> (rows in its database). Running now: step 4 (builder), step 7 (fix round). Write .work/status/2026-11-21.md.
```

## Why it exists

"Update the page with every change" is a rule written in prose, and under load it gets skipped. In the project this came from, the roadmap showed a milestone as all items done yet still in progress, because its status was stored on its own and untouched for seven weeks. A full check found ten more stale entries: merged work still shown as being built, and work shown as being built that had had no commit for days. An agent that checks the page against git after each merge and once a day catches that drift; a person remembering does not.

Origin: new. A real project adopted it after the drift above was found; it has not yet run there for long.
