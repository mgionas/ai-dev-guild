# Roadmap page template

The `roadmap` skill publishes this page. It is the same design for every project, so a new
project's first roadmap looks like every other: copy the code block below unchanged, replace
`{{PROJECT}}` (twice) and `{{PHASE}}` (once), and touch nothing else, not the tokens, fonts,
lanes, labels or script.

The page reads its rows one of two ways, so it works for every user:

1. **Artifact database** when the view can run it: `window.claude.use("db")` returns the
   database and the page subscribes once to `milestones`, `items` and `meta/info`.
2. **Embedded data** otherwise: the `<script type="application/json" id="page-data">` block in
   the page. When you write the page as a plain file, fill that block (write every `<` inside it
   as `\u003c`); when you publish it as an artifact with the database, leave it empty.

It is kept as text, inside a Markdown file, so the plugin itself contains no web pages or scripts.
A plain file needs a minimal skeleton around the block (`<!doctype html>`, `<html lang="en">`,
`<head>` with `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width,
initial-scale=1">`, then `<body>`); an artifact adds its own.

````html
<title>{{PROJECT}} Roadmap</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap">
<style>
/* Layout: a milestone track across the top, then a four-lane board (completed → in progress → planned → pending), stacking to one lane on a phone. */
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
.wrap { max-width: 1280px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 56px; display: grid; gap: 28px; }
header { display: grid; gap: 6px; }
.eyebrow { font-family: var(--f-mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0; font-size: clamp(26px, 4vw, 34px); font-weight: 700; letter-spacing: -.01em; text-wrap: balance; }
.lede { margin: 0; color: var(--muted); max-width: 68ch; }
.now { margin: 0; max-width: 72ch; font-size: 16px; }
.stamp { font-family: var(--f-mono); font-size: 12px; color: var(--muted); }
h2 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
section { display: grid; gap: 12px; }
.track { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 10px; }
.ms { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line); min-width: 0; }
.ms:hover { border-color: var(--muted); }
.ms:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ms[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.ms-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.code { font-family: var(--f-mono); font-size: 12px; font-weight: 500; }
.ms-name { font-weight: 600; font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.bar { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--done); }
.ms-foot { font-family: var(--f-mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pill { font-family: var(--f-mono); font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.s-done { color: var(--done); background: var(--done-soft); }
.s-active { color: var(--active); background: var(--active-soft); }
.s-planned { color: var(--planned); background: var(--planned-soft); }
.s-pending { color: var(--pending); background: var(--pending-soft); }
.filterline { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); }
.filterline button { font: inherit; font-size: 13px; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
.board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: start; }
.lane { display: grid; gap: 8px; min-width: 0; }
.lane-head { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 8px; border-bottom: 2px solid var(--lc); }
.lane-head h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--lc); }
.lane-head .n { font-family: var(--f-mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.lane[data-s="done"] { --lc: var(--done); }
.lane[data-s="active"] { --lc: var(--active); }
.lane[data-s="planned"] { --lc: var(--planned); }
.lane[data-s="pending"] { --lc: var(--pending); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 11px 12px; display: grid; gap: 5px; min-width: 0; }
.card.you { border-color: var(--you); }
.card-title { font-weight: 500; font-size: 14.5px; line-height: 1.35; overflow-wrap: anywhere; }
.card-note { color: var(--muted); font-size: 13.5px; overflow-wrap: anywhere; }
.card-foot { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 2px; }
.tag { font-family: var(--f-mono); font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
.youtag { font-family: var(--f-mono); font-size: 11px; font-weight: 500; color: var(--you); background: var(--you-soft); border-radius: 4px; padding: 0 6px; }
.prog { display: grid; gap: 4px; margin-top: 2px; }
.prog-line { display: flex; justify-content: space-between; gap: 8px; font-family: var(--f-mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.subs { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; }
.subs > summary { cursor: pointer; font-size: 12.5px; color: var(--accent); list-style-position: inside; }
.subs > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
.sublist { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 7px; }
.sub { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; align-items: center; }
.sub-title { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
.sub-ref { font-family: var(--f-mono); font-size: 10.5px; color: var(--muted); margin-left: 4px; }
.sub-note { grid-column: 1 / -1; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.steps { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
.steps > i { height: 3px; border-radius: 2px; background: var(--line); }
.steps > i.on { background: var(--sc); }
.sub[data-s="done"] { --sc: var(--done); }
.sub[data-s="active"] { --sc: var(--active); }
.sub[data-s="planned"] { --sc: var(--planned); }
.sub[data-s="pending"] { --sc: var(--pending); }
.empty { color: var(--muted); font-size: 13.5px; padding: 10px 2px; }
.notice { background: var(--surface); border: 1px dashed var(--line); border-radius: 8px; padding: 14px 16px; color: var(--muted); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--muted); }
.legend span { display: inline-flex; gap: 6px; align-items: center; }
@media (max-width: 1020px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .board { grid-template-columns: minmax(0, 1fr); } .wrap { padding-block: 20px 40px; } }
@media (prefers-reduced-motion: no-preference) { .card, .ms { transition: border-color .15s; } }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">{{PHASE}} · delivery roadmap</div>
    <h1>{{PROJECT}} Roadmap</h1>
    <p class="now" id="now">Loading the latest status…</p>
    <div class="stamp" id="stamp"></div>
  </header>

  <section aria-labelledby="ms-h">
    <h2 id="ms-h">Milestones</h2>
    <div class="track" id="track"></div>
    <div class="legend">
      <span><b class="pill s-done">done</b> finished and merged</span>
      <span><b class="pill s-active">in progress</b> being built or reviewed</span>
      <span><b class="pill s-planned">planned</b> designed, not started</span>
      <span><b class="pill s-pending">pending</b> waiting on something, or later</span>
      <span><b class="youtag">needs you</b> waiting for your decision or action</span>
      <span>Tasks move through four steps: built → reviewed → fixed → merged</span>
    </div>
  </section>

  <section aria-labelledby="board-h">
    <div class="filterline"><h2 id="board-h">Work items</h2><span id="filtertext"></span></div>
    <div class="board" id="board"></div>
  </section>
</div>

<!-- Mode 2 rows. Filled when the page is a plain file; left empty when the artifact database holds the rows. -->
<script type="application/json" id="page-data">
{ "meta": [], "milestones": [], "items": [] }
</script>

<script>
const LANES = [
  { key: "done", label: "Completed" },
  { key: "active", label: "In progress" },
  { key: "planned", label: "Planned" },
  { key: "pending", label: "Pending & backlog" },
];
const STATUS_LABEL = new Map([["done", "done"], ["active", "in progress"], ["planned", "planned"], ["pending", "pending"]]);
let milestones = [], items = [], meta = null, filter = null, loaded = false, timedOut = false, failMessage = "";

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}
function laneOf(s) { return STATUS_LABEL.has(s) ? s : "pending"; }

// A subtask's stage says how far along the four steps (built, reviewed, fixed, merged) it is.
const STAGES = new Map([
  ["done", { steps: 4, lane: "done", label: "merged" }],
  ["fixing", { steps: 3, lane: "active", label: "fixing review findings" }],
  ["review", { steps: 2, lane: "active", label: "in review" }],
  ["building", { steps: 1, lane: "active", label: "being built" }],
  ["waiting", { steps: 0, lane: "pending", label: "waiting" }],
  ["planned", { steps: 0, lane: "planned", label: "planned" }],
]);
function stageOf(s) { return STAGES.get(s) || STAGES.get("planned"); }
function subsOf(i) { return Array.isArray(i.subtasks) ? i.subtasks.filter(x => x && typeof x === "object") : []; }
// Progress in units: an item with subtasks counts each subtask, an item without counts once.
function unitsOf(i) {
  const subs = subsOf(i);
  if (!subs.length) return { done: i.status === "done" ? 1 : 0, total: 1, steps: i.status === "done" ? 4 : 0 };
  let done = 0, steps = 0;
  for (const x of subs) { const st = stageOf(x.stage); steps += st.steps; if (st.steps === 4) done++; }
  return { done, total: subs.length, steps };
}
function bar(pct) { const b = el("div", "bar"); const f = el("i"); f.style.width = Math.max(0, Math.min(100, Math.round(pct))) + "%"; b.append(f); return b; }

function renderHeader() {
  const now = document.getElementById("now");
  const stamp = document.getElementById("stamp");
  if (failMessage) { now.textContent = failMessage; stamp.textContent = ""; return; }
  if (!loaded) { if (timedOut) now.textContent = "Still waiting for the roadmap data. It appears as soon as the connection answers."; return; }
  now.textContent = (meta && meta.headline) || "No status has been written yet.";
  stamp.textContent = meta && meta.updated ? "Last updated " + meta.updated : "";
}

function renderTrack() {
  const track = document.getElementById("track");
  track.replaceChildren();
  if (!milestones.length) { track.append(el("div", "notice", loaded ? "No milestones yet." : "Milestones appear here once the data loads.")); return; }
  for (const m of milestones) {
    const own = items.filter(i => i.milestone === m.id);
    const hasSubs = own.some(i => subsOf(i).length);
    let done = 0, total = 0;
    for (const i of own) { const u = unitsOf(i); done += u.done; total += u.total; }
    const b = el("button", "ms");
    b.type = "button";
    b.setAttribute("aria-pressed", String(filter === m.id));
    const top = el("div", "ms-top");
    top.append(el("span", "code", m.code || m.id), el("span", "pill s-" + laneOf(m.status), STATUS_LABEL.get(laneOf(m.status))));
    b.append(top, el("div", "ms-name", m.name || ""));
    if (own.length) {
      b.append(bar(done / total * 100), el("div", "ms-foot", done + " of " + total + (hasSubs ? " tasks done" : " items done")));
    } else if (m.summary) {
      b.append(el("div", "ms-foot", m.summary));
    }
    b.addEventListener("click", () => { filter = filter === m.id ? null : m.id; renderAll(); });
    track.append(b);
  }
}

function renderBoard() {
  const board = document.getElementById("board");
  const ft = document.getElementById("filtertext");
  ft.replaceChildren();
  if (filter) {
    const m = milestones.find(x => x.id === filter);
    ft.append(el("span", null, "Showing " + ((m && (m.code || m.id)) || filter) + " only · "));
    const clear = el("button", null, "show all"); clear.type = "button";
    clear.addEventListener("click", () => { filter = null; renderAll(); });
    ft.append(clear);
  }
  board.replaceChildren();
  const shown = filter ? items.filter(i => i.milestone === filter) : items;
  const msCode = new Map(milestones.map(m => [m.id, m.code || m.id]));
  for (const lane of LANES) {
    const list = shown.filter(i => laneOf(i.status) === lane.key);
    const col = el("div", "lane"); col.dataset.s = lane.key;
    const head = el("div", "lane-head");
    head.append(el("h3", null, lane.label), el("span", "n", list.length));
    col.append(head);
    if (!list.length) col.append(el("div", "empty", loaded ? "Nothing here." : "Loading…"));
    for (const i of list) {
      const c = el("article", "card" + (i.needsOwner ? " you" : ""));
      c.append(el("div", "card-title", i.title || ""));
      if (i.note) c.append(el("div", "card-note", i.note));
      const subs = subsOf(i);
      if (subs.length) {
        const u = unitsOf(i);
        const prog = el("div", "prog");
        const line = el("div", "prog-line");
        line.append(el("span", null, u.done + " of " + u.total + " done"), el("span", null, Math.round(u.steps / (u.total * 4) * 100) + "%"));
        prog.append(bar(u.steps / (u.total * 4) * 100), line);
        c.append(prog);
        const det = el("details", "subs");
        det.open = i.status === "active";
        const busy = subs.filter(x => stageOf(x.stage).lane === "active").length;
        det.append(el("summary", null, "Tasks" + (busy ? " · " + busy + " moving now" : "")));
        const ul = el("ul", "sublist");
        for (const x of subs) {
          const st = stageOf(x.stage);
          const li = el("li", "sub"); li.dataset.s = st.lane;
          const t = el("span", "sub-title", x.title || "");
          if (x.ref) t.append(el("span", "sub-ref", x.ref));
          li.append(t, el("span", "pill s-" + st.lane, st.label));
          const steps = el("div", "steps"); steps.setAttribute("aria-hidden", "true");
          for (let k = 0; k < 4; k++) steps.append(el("i", k < st.steps ? "on" : ""));
          li.append(steps);
          if (x.note) li.append(el("div", "sub-note", x.note));
          ul.append(li);
        }
        det.append(ul);
        c.append(det);
      }
      const foot = el("div", "card-foot");
      if (i.milestone) foot.append(el("span", "tag", msCode.get(i.milestone) || i.milestone));
      if (i.ref) foot.append(el("span", "tag", i.ref));
      if (i.needsOwner) foot.append(el("span", "youtag", "needs you"));
      if (foot.childNodes.length) c.append(foot);
      col.append(c);
    }
    board.append(col);
  }
}

function renderAll() { renderHeader(); renderTrack(); renderBoard(); }

// Rows are read one of two ways. Mode 1: the artifact database, when this view can run it.
// Mode 2: the JSON block in the page (a plain file, or a view without the database).
function num(v) { return typeof v === "number" && Number.isFinite(v) ? v : 9999; }
function rowsOf(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === "object" && typeof x.id === "string").sort((a, b) => num(a.order) - num(b.order)) : []; }

function readEmbedded() {
  const node = document.getElementById("page-data");
  if (!node) return null;
  try { const v = JSON.parse(node.textContent); return v && typeof v === "object" ? v : null; } catch (_) { return null; }
}

function useEmbedded() {
  const d = readEmbedded();
  milestones = d ? rowsOf(d.milestones) : [];
  items = d ? rowsOf(d.items) : [];
  meta = d ? rowsOf(d.meta).find(r => r.id === "info") || null : null;
  if (!milestones.length && !items.length && !meta) failMessage = "This view cannot read the roadmap database and the page holds no embedded rows.";
  loaded = true;
  renderAll();
}

// Subscribe once per collection. The 10-second timer is cleared by the first answer, data or error, and only ever explains the wait; it never reloads.
function listen(ref, apply, counted) {
  let first = true;
  const timer = setTimeout(() => { if (first) { timedOut = true; renderAll(); } }, 10000);
  ref.onSnapshot(s => {
    clearTimeout(timer);
    apply(s);
    if (first) { first = false; counted.n++; if (counted.n >= 3) loaded = true; }
    renderAll();
  }, () => {
    clearTimeout(timer);
    failMessage = "The roadmap data could not be loaded. Reload the page to try again.";
    renderAll();
  });
}

function useDatabase(db) {
  const counted = { n: 0 };
  listen(db.collection("milestones").orderBy("order"), s => { milestones = s.docs.map(d => ({ ...d.data(), id: d.id })); }, counted);
  listen(db.collection("items").orderBy("order"), s => { items = s.docs.map(d => ({ ...d.data(), id: d.id })); }, counted);
  listen(db.doc("meta/info"), s => { meta = s.exists ? s.data() : null; }, counted);
}

renderAll();
(async () => {
  let db = null;
  try { if (window.claude?.use) db = await window.claude.use("db"); } catch (_) { db = null; }
  if (db) useDatabase(db); else useEmbedded();
})();
</script>
````
