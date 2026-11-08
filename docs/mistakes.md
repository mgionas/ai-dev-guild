# Mistakes that keep happening

AI agents (and people) make the same few mistakes again and again. Every item below is a kind of
bug that review kept catching. Each comes with a tiny reproduction, so you can spot it, and a fix.

Copy the ones that fit into your project's `AGENTS.md`. Then add your own: whenever review finds
the same kind of bug a second time, write it down with its reproduction. A written-down mistake
with an example is far less likely to come back.

**In the code:**
[Failing open](#failing-open) ·
[A key from outside indexes a plain object](#a-key-from-outside-indexes-a-plain-object) ·
[A secret riding inside an error](#a-secret-riding-inside-an-error) ·
[A control that becomes the outage](#a-control-that-becomes-the-outage) ·
[A table nobody deletes from](#a-table-nobody-deletes-from) ·
[No timeout on the slow path](#no-timeout-on-the-slow-path) ·
[Assuming one country](#assuming-one-country)

**In the tests and checks:**
[A test that cannot fail](#a-test-that-cannot-fail) ·
[A check that never runs](#a-check-that-never-runs) ·
[A measurement something else can move](#a-measurement-something-else-can-move) ·
[Evidence gathered where something repairs the bug](#evidence-gathered-where-something-repairs-the-bug) ·
[Believing the label instead of the artifact](#believing-the-label-instead-of-the-artifact)

**In the way agents work:**
[Editing the decision to match the code](#editing-the-decision-to-match-the-code) ·
[Killing processes by pattern](#killing-processes-by-pattern) ·
[A commit that sweeps in someone else's staged files](#a-commit-that-sweeps-in-someone-elses-staged-files) ·
[Resuming the builder to fix its own findings](#resuming-the-builder-to-fix-its-own-findings)

---

## Failing open

An input the code did not expect ends up on the "allow" side of a comparison.

```js
const PLANS = ["enterprise", "team", "free"]; // most powerful first
const canExport = (plan) => PLANS.indexOf(plan) <= PLANS.indexOf("team");

canExport("free"); // false, as intended
canExport("Free"); // indexOf → -1, and -1 <= 1 → true
```

One wrong capital letter, and the weakest plan gets more than the strongest.

**Fix:** decide what an unknown value means, and make it mean "no". Turn outside input into a
closed set of known values at the edge, and treat "not found" as its own case.

## A key from outside indexes a plain object

```js
const REGION_URL = {
  eu: "https://eu.example.com",
  us: "https://us.example.com",
};
const url = REGION_URL[req.query.region]; // ?region=toString → a function
```

Every plain object inherits `toString`, `constructor`, `__proto__` and more. TypeScript says the
value is a string; at run time it can be anything those names hold.

**Fix:** use a `Map`, check `Object.hasOwn(record, key)` first, or create the record with
`Object.create(null)`.

## A secret riding inside an error

```js
try {
  await sendSms(phone, `Your code is ${code}`);
} catch (error) {
  logger.warn(`SMS failed: ${error.message}`); // the client library quotes the request body
}
```

Database drivers, HTTP clients and SDKs often put their inputs into the error message. One failure
is enough to copy a phone number or a one-time code into your logs and your error tracker.

**Fix:** treat every error you did not create as if it holds its inputs. Log your own short message
and an error code; keep the raw error out of anywhere personal data may not go.

## A control that becomes the outage

```js
// "Protect the SMS bill": at most 1,000 verification texts per day, for everyone.
if ((await countToday("sms")) >= 1000) return refuse();
```

An attacker who requests 1,000 codes, even for numbers that do not exist, has now locked every real
user out until midnight. The limit meant to stop abuse is the abuse.

**Fix:** for each limit, ask whom it refuses once an attacker has used it up. Limit per account,
per number or per address first; make anything global far larger than one attacker can reach. And
do the sum: write down how many requests it takes to hit the limit and what they cost the attacker.

## A table nobody deletes from

An `events` or `attempts` table that only ever grows is fast in the first month. Later, the query
that counts "attempts in the last hour" scans millions of rows, and if it runs while holding a lock,
every request behind it waits.

**Fix:** a new table comes with its retention in the same change: what deletes old rows, and when.
Check the queries that read it with `EXPLAIN` on realistic data.

## No timeout on the slow path

```js
await db.transaction(async (tx) => {
  await tx.lock("account", id);
  await paymentProvider.charge(card); // no timeout; the provider hangs
});
```

Each waiting request now holds a database connection. When the small pool is used up, pages that
have nothing to do with payments fail too.

**Fix:** many fast refusals are survivable; a few stuck requests are not. Every call that can wait
gets a timeout, and nothing waits on the network while holding a lock or a pooled connection.

## Assuming one country

```js
const cents = Math.round(price * 100);             // wrong for currencies with 0 or 3 decimals
const due = new Date(); due.setDate(due.getDate() + 30); // the server's time zone, not the user's
const label = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; // one country's date order
```

Each line works where it was written and fails somewhere else: an amount off by a factor of 100 or
10, a due date a day early for users east or west of the server, a date read the wrong way round.

**Fix:** keep money with its currency code and read the minor unit from it; store UTC and convert
with an IANA time zone; format with the user's locale. See
[Assume no country](rules/international-by-default.md).

---

## A test that cannot fail

```js
const token = createToken({ userId: 42 });
expect(token).toBeTruthy(); // true for any non-empty string, valid or not
```

**Fix:** once the test passes, break the code it covers on purpose (return a wrong value, skip a
check) and run it again. If it still passes, it tests nothing, and it is worse than no test because
it looks like coverage.

## A check that never runs

```json
{ "scripts": { "lint": "eslint src" } }
```

The package has unit tests and a test config, but no `test` script, so the monorepo's
`run test` silently skips it. In the same way, a lint or architecture rule whose file pattern
matches nothing reports "0 problems" forever.

**Fix:** never trust a check you have not seen fail. When you add one, make a change it should
catch and confirm it goes red.

## A measurement something else can move

```js
const before = await readCounter("cache_misses"); // shared by every process
await loadDashboard();
expect((await readCounter("cache_misses")) - before).toBe(0);
```

Another test, a background job or the test's own setup can move a shared, cumulative counter
inside the window. The test then fails now and then, and mostly when the whole suite runs.

**Fix:** measure the thing itself, not a side effect others share. For a database query, run
`EXPLAIN` on the exact statement; for a cache, assert on that one call's result.

## Evidence gathered where something repairs the bug

A test compares a generated file with the committed one. On the author's machine the editor
reformats the file on save, so the test always passes there. In CI nothing reformats it, and it
always fails. The author's pasted "passing" output was true and still proved nothing.

**Fix:** run a check the way CI does before you trust it: a clean build, no editor or watcher
running, no local caches or secrets. (The [`local-ci`](../skills/local-ci/SKILL.md) skill.)

## Believing the label instead of the artifact

A package's README says it is tree-shaken; the bundle still contains all of it. A config comment
says a feature flag is off; the code reads a different flag. A file is called `latin.woff2` and
holds four scripts.

**Fix:** look at the real thing: open the file, measure the bundle, run the query, read the
installed version. A label is a claim to check, not evidence.

---

## Editing the decision to match the code

The spec says the team will use library X. X is not installed yet, because the milestone that adds
it has not started. A tidy-up pass sees that X is missing and "fixes" the spec to say the project
does not use X.

The pass has quietly reversed a decision. **An empty spot in the code can mean "not done yet" or
"decided against", and only the decision log knows which.**

**Fix:** specs, decision logs and board records belong to the product owner. If the code and a
decision disagree, the code is the unfinished side. Report the mismatch; never rewrite the
decision. And a package's own README cannot overrule a decision made above it.

## Killing processes by pattern

```bash
pkill -f jest   # "my test run is stuck"
```

When several agents share one machine, this stops every test run on it, including the other
agents' work and the full check before merge. Runs that die with exit code 143 (SIGTERM) for no
clear reason are often this.

**Fix:** stop only a process you started, by its PID. The `bash-guard` hook refuses `pkill`,
`killall` and `kill $(pgrep …)`.

## A commit that sweeps in someone else's staged files

```bash
git add README.md && git commit -m "docs: update README"
```

`git commit` commits everything in the index, not just the file you added. If another agent has
staged half-finished changes in the same checkout, they go into your commit, and anything that
deploys from the branch breaks.

**Fix:** in a shared checkout, commit by path: `git commit -m "…" -- README.md`. Then look at
`git show --stat HEAD`.

## Resuming the builder to fix its own findings

Sending review findings back into the builder's long-running session is slow and expensive: the
whole long context is read again on every turn. It also keeps the line of thinking that caused the
mistakes.

**Fix:** each fix round goes to a new `fixer` agent with a findings file (the
[`fix-round`](../skills/fix-round/SKILL.md) skill).
