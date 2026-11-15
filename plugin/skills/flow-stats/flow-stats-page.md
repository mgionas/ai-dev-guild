# Flow stats page template

The `flow-stats` skill publishes this page. It is the same design every time, so the owner learns
one layout: copy the code block below unchanged, replace `{{TITLE}}` (twice) and `{{PROJECT}}`
(once), put the counting script's output into the data block, and touch nothing else, not the
tokens, fonts, sections, labels or script.

The page reads its content from the `<script type="application/json" id="page-data">` block in
the page, and nothing else. Fill that block whether the page is a plain file or an artifact, and
write every `<` inside it as `\u003c` so no text in it can end the block. There is no artifact
database: on each refresh the controller replaces the block and republishes to the same URL.

It is kept as text, inside a Markdown file, so the plugin itself contains no web pages or scripts.
A plain file needs a minimal skeleton around the block (`<!doctype html>`, `<html lang="en">`,
`<head>` with `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width,
initial-scale=1">`, then `<body>`); an artifact adds its own.

## The data block

The block is the JSON the counting script writes, unchanged, plus the agent's entries for
anything the script marked as a gap. Fields you leave out show as "not found". A whole section is
`null` when none of its records exist, and the page then says "not found" for it, never zero. A
field of the wrong type is ignored.

| Field | Meaning |
| --- | --- |
| `meta` | `{project, generated, from, to, tasks}`: the dates are `YYYY-MM-DD` |
| `time` | `{medianDays, p90Days, stages: {building, review, fixing}, slowest: [{task, days}]}`, stage values are median days |
| `review` | `{tasks, blocking, bySeverity: {critical, high, medium, low}, byReviewer: [{role, findings}]}`; `blocking` counts tasks with a critical, high or medium finding |
| `fixRounds` | `{distribution: {"0", "1", "2", "3+"}, rechecks, newBreakage}`: tasks by number of fix rounds, then re-checks and how many found a new problem |
| `claims` | `{reports, didNotHold}` |
| `ci` | `{runs, pass, realFailures, flaky}` |
| `questions` | `{batches, answered, acceptedAll, changed, medianWaitDays}` |
| `tokens` | `{perTaskMedian, byModel: [{model, share}]}`, `share` in percent |
| `gaps` | `["what the script could not find"]` |
| `suggestions` | `[{id, measure, value, threshold, skill, text, status}]`, at most three; `status` is `proposed`, `accepted` or `declined` |

An unknown `status` shows as `proposed`: a typo never shows a suggestion as accepted.

Example, with neutral figures (the tokens section is `null`, to show a "not found" line):

```json
{
  "meta": { "project": "example-shop", "generated": "2026-03-02", "from": "2026-01-12", "to": "2026-03-02", "tasks": 18 },
  "time": { "medianDays": 1.6, "p90Days": 5.8, "stages": { "building": 0.4, "review": 0.3, "fixing": 0.6 }, "slowest": [ { "task": "t-14-export", "days": 7.2 }, { "task": "t-09-search", "days": 5.1 } ] },
  "review": { "tasks": 18, "blocking": 9, "bySeverity": { "critical": 2, "high": 6, "medium": 9, "low": 11 }, "byReviewer": [ { "role": "security-reviewer", "findings": 8 }, { "role": "qa-tester", "findings": 12 }, { "role": "domain-guardian", "findings": 8 } ] },
  "fixRounds": { "distribution": { "0": 9, "1": 5, "2": 3, "3+": 1 }, "rechecks": 14, "newBreakage": 3 },
  "claims": { "reports": 18, "didNotHold": 2 },
  "ci": { "runs": 31, "pass": 24, "realFailures": 4, "flaky": 3 },
  "questions": { "batches": 5, "answered": 5, "acceptedAll": 3, "changed": 2, "medianWaitDays": 0.9 },
  "tokens": null,
  "gaps": ["tokens: no report in .work/token-review/", "time: task t-03-login has no merge; its last file time was used"],
  "suggestions": [
    { "id": "second-round", "measure": "tasks with 2 or more fix rounds", "value": "22%", "threshold": "> 20% of tasks", "skill": "write-brief, fix-round", "text": "Name the known traps and the tests to run in each brief; one fresh fixer per round.", "status": "proposed" }
  ]
}
```

````html
<title>{{TITLE}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap">
<style>
/* Layout: one column that reads top to bottom: a row of headline tiles, where time goes, findings, fix rounds, local CI, questions, tokens, suggestions, gaps. */
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --ink: #18202b;
  --muted: #5d6675;
  --line: #dde1e7;
  --accent: #6e2a4a;
  --done: #2f7d4f;
  --done-soft: #e4f2e9;
  --active: #1f5fa8;
  --active-soft: #e3edf9;
  --planned: #5b5f86;
  --planned-soft: #ebebf5;
  --pending: #9a6212;
  --pending-soft: #f8eedc;
  --you: #b3261e;
  --you-soft: #fbe6e4;
  --f-body: "Fira Sans", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "Fira Code", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12161c; --surface: #1a2029; --ink: #e8ebf0; --muted: #9aa3b2; --line: #2c3440;
    --accent: #d77fa6;
    --done: #6cc990; --done-soft: #1b2e23; --active: #7fb2ee; --active-soft: #1a2638;
    --planned: #a9acd6; --planned-soft: #232437; --pending: #e0ad5c; --pending-soft: #33291a;
    --you: #f28b82; --you-soft: #3a1f1d;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ebf0; --muted: #9aa3b2; --line: #2c3440;
  --accent: #d77fa6;
  --done: #6cc990; --done-soft: #1b2e23; --active: #7fb2ee; --active-soft: #1a2638;
  --planned: #a9acd6; --planned-soft: #232437; --pending: #e0ad5c; --pending-soft: #33291a;
  --you: #f28b82; --you-soft: #3a1f1d;
  color-scheme: dark;
}
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--f-body); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 980px; margin: 0 auto; padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 56px; display: grid; gap: 28px; }
header { display: grid; gap: 8px; }
.eyebrow { font-family: var(--f-mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0; font-size: clamp(26px, 4vw, 34px); font-weight: 700; letter-spacing: -.01em; text-wrap: balance; overflow-wrap: anywhere; }
.stamp { font-family: var(--f-mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
h2 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
section { display: grid; gap: 12px; min-width: 0; }
p { margin: 0; overflow-wrap: anywhere; }
.pill { font-family: var(--f-mono); font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.s-done { color: var(--done); background: var(--done-soft); }
.s-active { color: var(--active); background: var(--active-soft); }
.s-planned { color: var(--planned); background: var(--planned-soft); }
.s-pending { color: var(--pending); background: var(--pending-soft); }
.s-gap { color: var(--you); background: var(--you-soft); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: grid; gap: 10px; min-width: 0; }
.card-title { font-weight: 600; font-size: 15.5px; line-height: 1.35; overflow-wrap: anywhere; }
.card-note { color: var(--muted); font-size: 13.5px; overflow-wrap: anywhere; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: grid; gap: 4px; min-width: 0; align-content: start; }
.tile-label { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.tile-value { font-family: var(--f-mono); font-size: 24px; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tile-value.none { font-family: var(--f-body); font-size: 15px; color: var(--muted); font-weight: 400; padding-block: 5px; }
.tile-sub { font-family: var(--f-mono); font-size: 11px; color: var(--muted); }
.stack { display: grid; gap: 12px; min-width: 0; }
.stage-bar { display: flex; gap: 2px; height: 22px; }
.stage-bar.is-empty { border: 1px dashed var(--line); border-radius: 4px; }
.seg { min-width: 4px; border-radius: 2px; }
.seg.building { background: var(--active); }
.seg.review { background: var(--planned); }
.seg.fixing { background: var(--pending); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.legend span { display: inline-flex; gap: 6px; align-items: center; }
.dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dot.building { background: var(--active); }
.dot.review { background: var(--planned); }
.dot.fixing { background: var(--pending); }
.bars { display: grid; gap: 8px; }
.brow { display: grid; grid-template-columns: minmax(80px, 160px) minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; }
.blabel { font-size: 14px; overflow-wrap: anywhere; }
.btrack { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.bfill { height: 100%; border-radius: 4px; background: var(--active); }
.bfill.critical { background: var(--you); }
.bfill.high { background: var(--pending); }
.bfill.medium { background: var(--active); }
.bfill.low { background: var(--planned); }
.bfill.ok { background: var(--done); }
.bfill.bad { background: var(--you); }
.bval { font-family: var(--f-mono); font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
.cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; font-size: 14px; }
.kv .v { font-family: var(--f-mono); text-align: right; font-variant-numeric: tabular-nums; }
.sub-h { margin: 0; font-size: 15px; font-weight: 600; }
.empty { color: var(--muted); font-size: 13.5px; }
.notice { background: var(--surface); border: 1px dashed var(--line); border-radius: 8px; padding: 14px 16px; color: var(--muted); }
.list { margin: 0; padding-left: 20px; display: grid; gap: 6px; overflow-wrap: anywhere; }
.sg-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sg-nums { font-family: var(--f-mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
@media (max-width: 620px) { .wrap { padding-block: 20px 40px; } .cols { grid-template-columns: minmax(0, 1fr); } .brow { grid-template-columns: minmax(0, 1fr) auto; } .brow .btrack { grid-column: 1 / -1; order: 3; } }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">{{PROJECT}} · flow stats</div>
    <h1>{{TITLE}}</h1>
    <div class="stamp" id="stamp"></div>
  </header>

  <section aria-labelledby="tiles-h">
    <h2 id="tiles-h">At a glance</h2>
    <div class="tiles" id="tiles"></div>
  </section>

  <section aria-labelledby="time-h">
    <h2 id="time-h">Where time goes</h2>
    <div id="time"></div>
  </section>

  <section aria-labelledby="rev-h">
    <h2 id="rev-h">Review findings</h2>
    <div id="review"></div>
  </section>

  <section aria-labelledby="fix-h">
    <h2 id="fix-h">Fix rounds</h2>
    <div id="fixrounds"></div>
  </section>

  <section aria-labelledby="ci-h">
    <h2 id="ci-h">Local CI</h2>
    <div id="ci"></div>
  </section>

  <section aria-labelledby="q-h">
    <h2 id="q-h">Questions to the owner</h2>
    <div id="questions"></div>
  </section>

  <section aria-labelledby="tok-h">
    <h2 id="tok-h">Tokens by model</h2>
    <div id="tokens"></div>
  </section>

  <section aria-labelledby="sug-h">
    <h2 id="sug-h">Suggestions</h2>
    <div id="suggestions"></div>
  </section>

  <section aria-labelledby="gap-h">
    <h2 id="gap-h">Not found</h2>
    <div id="gaps"></div>
  </section>
</div>

<!-- The content. Fill this block with the counting script's output (every < written as \u003c); the controller replaces it and republishes on each refresh. -->
<script type="application/json" id="page-data">
{ "meta": null, "time": null, "review": null, "fixRounds": null, "claims": null, "ci": null, "questions": null, "tokens": null, "gaps": [], "suggestions": [] }
</script>

<script>
const SEVERITIES = ["critical", "high", "medium", "low"];
const STAGES = ["building", "review", "fixing"];
const BUCKETS = ["0", "1", "2", "3+"];
const STATUS = new Map([["proposed", "s-pending"], ["accepted", "s-done"], ["declined", "s-planned"]]);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}
function str(v) { return typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : ""; }
function num(v) { return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null; }
function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : null; }
function rows(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === "object") : []; }
// A rate is a share of a count; with nothing to divide by it is not found, never zero.
function pct(part, whole) { const p = num(part), w = num(whole); return p === null || w === null || w === 0 ? null : Math.round(100 * p / w); }
function days(v) { const n = num(v); return n === null ? null : (Math.round(n * 10) / 10) + " d"; }
function none(text) { return el("div", "notice", text || "not found"); }

function readData() {
  const node = document.getElementById("page-data");
  if (!node) return null;
  try { return obj(JSON.parse(node.textContent)); } catch (_) { return null; }
}

function tile(label, value, sub) {
  const t = el("div", "tile");
  t.append(el("div", "tile-label", label));
  t.append(value === null ? el("div", "tile-value none", "not found") : el("div", "tile-value", value));
  if (sub && value !== null) t.append(el("div", "tile-sub", sub));
  return t;
}

function barRow(label, value, max, cls, shown) {
  const r = el("div", "brow");
  r.append(el("div", "blabel", label));
  const track = el("div", "btrack");
  const fill = el("div", "bfill" + (cls ? " " + cls : ""));
  fill.style.width = (max > 0 ? Math.max(0, Math.min(100, 100 * value / max)) : 0) + "%";
  track.append(fill);
  r.append(track, el("div", "bval", shown != null ? shown : value));
  return r;
}

function kv(pairs) {
  const box = el("div", "kv");
  for (const [k, v] of pairs) box.append(el("span", null, k), el("span", "v", v === null ? "not found" : v));
  return box;
}

function renderTiles(d) {
  const box = document.getElementById("tiles");
  box.replaceChildren();
  const time = obj(d.time), rev = obj(d.review), fr = obj(d.fixRounds), ci = obj(d.ci), tok = obj(d.tokens);
  const median = time ? days(time.medianDays) : null;
  const blocking = rev ? pct(rev.blocking, rev.tasks) : null;
  let second = null;
  const dist = fr ? obj(fr.distribution) : null;
  if (dist) {
    const total = BUCKETS.reduce((s, k) => s + (num(dist[k]) || 0), 0);
    second = pct((num(dist["2"]) || 0) + (num(dist["3+"]) || 0), total);
  }
  const real = ci ? pct(ci.realFailures, ci.runs) : null;
  const tokens = tok && num(tok.perTaskMedian) !== null ? Math.round(tok.perTaskMedian).toLocaleString("en") : null;
  box.append(
    tile("Median days per task", median, time && num(time.p90Days) !== null ? "slowest tenth: " + days(time.p90Days) : ""),
    tile("Tasks with a blocking finding", blocking === null ? null : blocking + "%", rev ? str(rev.blocking) + " of " + str(rev.tasks) + " tasks" : ""),
    tile("Tasks with two or more fix rounds", second === null ? null : second + "%"),
    tile("Local CI runs with a real failure", real === null ? null : real + "%", ci ? str(ci.realFailures) + " of " + str(ci.runs) + " runs" : ""),
    tile("Tokens per task (median)", tokens)
  );
}

function renderTime(d) {
  const box = document.getElementById("time");
  box.replaceChildren();
  const t = obj(d.time);
  if (!t) { box.append(none()); return; }
  const stages = obj(t.stages) || {};
  const vals = STAGES.map(s => num(stages[s]));
  const total = vals.reduce((s, v) => s + (v || 0), 0);
  const card = el("div", "card");
  // A measured 0 is a value; "not found" is only for stages the script could not measure.
  if (vals.every(v => v === null)) {
    card.append(none("Stage times: not found"));
  } else if (total > 0) {
    const bar = el("div", "stage-bar");
    STAGES.forEach((s, i) => {
      if (vals[i] === null || vals[i] === 0) return;
      const seg = el("div", "seg " + s);
      seg.style.flexGrow = String(vals[i]);
      seg.title = s + " " + days(vals[i]);
      bar.append(seg);
    });
    card.append(bar);
  } else {
    card.append(el("div", "stage-bar is-empty"), el("div", "card-note", "Every measured stage rounds to 0 days."));
  }
  const legend = el("div", "legend");
  STAGES.forEach((s, i) => {
    const item = el("span");
    item.append(el("i", "dot " + s), el("span", null, s + " " + (vals[i] === null ? "not found" : days(vals[i]))));
    legend.append(item);
  });
  card.append(legend, el("div", "card-note", "Median days per stage, from file times in each task folder: approximate."));
  const slow = rows(t.slowest);
  if (slow.length) {
    card.append(el("h3", "sub-h", "Slowest tasks"));
    card.append(kv(slow.map(r => [str(r.task), days(r.days)])));
  }
  box.append(card);
}

function renderReview(d) {
  const box = document.getElementById("review");
  box.replaceChildren();
  const r = obj(d.review);
  if (!r) { box.append(none()); return; }
  const cols = el("div", "cols");
  const sev = obj(r.bySeverity) || {};
  const a = el("div", "card");
  a.append(el("h3", "sub-h", "By severity"));
  const bars = el("div", "bars");
  const max = Math.max(0, ...SEVERITIES.map(s => num(sev[s]) || 0));
  for (const s of SEVERITIES) bars.append(barRow(s, num(sev[s]) || 0, max, s));
  a.append(bars);
  const b = el("div", "card");
  b.append(el("h3", "sub-h", "By reviewer"));
  const who = rows(r.byReviewer);
  if (!who.length) b.append(el("div", "empty", "not found"));
  else {
    const rb = el("div", "bars");
    const m = Math.max(0, ...who.map(w => num(w.findings) || 0));
    for (const w of who) rb.append(barRow(str(w.role), num(w.findings) || 0, m, ""));
    b.append(rb, el("div", "card-note", "A findings file counts for every reviewer it names, so these add up to more than the findings."));
  }
  cols.append(a, b);
  box.append(cols);
  const claims = obj(d.claims);
  if (claims) box.append(el("p", "card-note", "Builder claims that did not hold: " + str(claims.didNotHold) + " of " + str(claims.reports) + " reports."));
}

function renderFixRounds(d) {
  const box = document.getElementById("fixrounds");
  box.replaceChildren();
  const f = obj(d.fixRounds);
  const dist = f ? obj(f.distribution) : null;
  if (!f || !dist) { box.append(none()); return; }
  const card = el("div", "card");
  card.append(el("h3", "sub-h", "Tasks by number of fix rounds"));
  const bars = el("div", "bars");
  const max = Math.max(0, ...BUCKETS.map(k => num(dist[k]) || 0));
  for (const k of BUCKETS) bars.append(barRow(k === "1" ? "1 round" : k + " rounds", num(dist[k]) || 0, max, ""));
  card.append(bars);
  const re = num(f.rechecks), nb = num(f.newBreakage);
  card.append(kv([["Re-checks", re === null ? null : String(re)], ["Re-checks that found a new problem", nb === null ? null : String(nb)]]));
  box.append(card);
}

function renderCi(d) {
  const box = document.getElementById("ci");
  box.replaceChildren();
  const c = obj(d.ci);
  if (!c || num(c.runs) === null) { box.append(none()); return; }
  const card = el("div", "card");
  const bars = el("div", "bars");
  const runs = num(c.runs);
  bars.append(barRow("pass", num(c.pass) || 0, runs, "ok"), barRow("real failure", num(c.realFailures) || 0, runs, "bad"), barRow("flaky", num(c.flaky) || 0, runs, "high"));
  card.append(bars, el("div", "card-note", "Of " + runs + " runs. Flaky means every failure passed on its retry."));
  box.append(card);
}

function renderQuestions(d) {
  const box = document.getElementById("questions");
  box.replaceChildren();
  const q = obj(d.questions);
  if (!q || num(q.batches) === null) { box.append(none()); return; }
  const card = el("div", "card");
  const share = pct(q.acceptedAll, q.answered);
  card.append(kv([
    ["Batches sent", String(num(q.batches))],
    ["Answered", num(q.answered) === null ? null : String(num(q.answered))],
    ["Accepted as recommended", share === null ? null : share + "%"],
    ["Median wait for an answer", days(q.medianWaitDays)]
  ]));
  box.append(card);
}

function renderTokens(d) {
  const box = document.getElementById("tokens");
  box.replaceChildren();
  const t = obj(d.tokens);
  const models = t ? rows(t.byModel).filter(m => num(m.share) !== null) : [];
  if (!models.length) { box.append(none()); return; }
  const card = el("div", "card");
  const bars = el("div", "bars");
  for (const m of models) bars.append(barRow(str(m.model), num(m.share), 100, "", num(m.share) + "%"));
  card.append(bars);
  box.append(card);
}

function renderSuggestions(d) {
  const box = document.getElementById("suggestions");
  box.replaceChildren();
  const list = rows(d.suggestions).slice(0, 3);
  if (!list.length) { box.append(el("div", "empty", "No measure is past its threshold.")); return; }
  const stack = el("div", "stack");
  for (const s of list) {
    const c = el("article", "card");
    const head = el("div", "sg-head");
    // An unknown status reads as proposed, never as accepted.
    const status = STATUS.has(s.status) ? s.status : "proposed";
    head.append(el("b", "pill " + STATUS.get(status), status));
    if (str(s.skill)) head.append(el("b", "pill s-active", str(s.skill)));
    c.append(head, el("div", "card-title", str(s.text)));
    c.append(el("div", "sg-nums", str(s.measure) + ": " + str(s.value) + " (past " + str(s.threshold) + ")"));
    stack.append(c);
  }
  box.append(stack);
}

function renderGaps(d) {
  const box = document.getElementById("gaps");
  box.replaceChildren();
  const g = Array.isArray(d.gaps) ? d.gaps.map(str).filter(Boolean) : [];
  if (!g.length) { box.append(el("div", "empty", "Nothing is missing.")); return; }
  const ul = el("ul", "list");
  for (const x of g) ul.append(el("li", null, x));
  box.append(ul);
}

function render() {
  const d = readData();
  const stamp = document.getElementById("stamp");
  if (!d) { stamp.textContent = "This page holds no readable data."; return; }
  const m = obj(d.meta);
  const parts = [];
  if (m && str(m.generated)) parts.push("Generated " + str(m.generated));
  if (m && str(m.from) && str(m.to)) parts.push(str(m.from) + " to " + str(m.to));
  if (m && str(m.tasks)) parts.push(str(m.tasks) + " tasks");
  stamp.textContent = parts.join(" · ");
  renderTiles(d);
  renderTime(d);
  renderReview(d);
  renderFixRounds(d);
  renderCi(d);
  renderQuestions(d);
  renderTokens(d);
  renderSuggestions(d);
  renderGaps(d);
}
render();
</script>
````
