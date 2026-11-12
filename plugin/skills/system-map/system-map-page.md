# System map page template

The `system-map` skill publishes this page. It is the same design for every project: copy the code
block below unchanged, replace `{{PROJECT}}` (twice), and touch nothing else, not the tokens, fonts,
tabs, labels or script.

The page reads its five documents (`meta`, `areas`, `features`, `system`, `unclaimed`, as the
starter's `check.mjs --out` writes them) one of two ways, so it works for every user:

1. **Artifact database** when the view can run it: `window.claude.use("db")` returns the database
   and the page subscribes once to the collection `map`, whose documents are named after the five.
2. **Embedded data** otherwise: the `<script type="application/json" id="page-data">` block in the
   page, one object with the five documents under their names. When you write the page as a plain
   file, fill that block (write every `<` inside it as `\u003c`); when you publish it as an artifact
   with the database, leave it as `{}`.

Every value is shown as text, never as markup. The page keeps the reader's light or dark setting
and works on a phone. It is kept as text, inside a Markdown file, so the plugin itself contains no
web pages or scripts. A plain file needs a minimal skeleton around the block (`<!doctype html>`,
`<html lang="en">`, `<head>` with `<meta charset="utf-8">` and `<meta name="viewport"
content="width=device-width, initial-scale=1">`, then `<body>`); an artifact adds its own.

````html
<title>{{PROJECT}} System Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Fira+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
/* Layout: a header with counts and search, then four tabs: Areas, Features, System and Not yet described. */
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --ink: #18202b;
  --muted: #5d6675;
  --line: #dde1e7;
  --accent: #6e2a4a;
  --accent-ink: #ffffff;
  --accent-soft: #f1e9ed;
  --chip: #eceef1;
  --built: #2f7d4f;
  --built-soft: #e4f2e9;
  --building: #1f5fa8;
  --building-soft: #e3edf9;
  --planned: #5b5f86;
  --planned-soft: #ebebf5;
  --warn: #8a5a00;
  --warn-soft: #fff4d6;
  --focus: #1f5fbf;
  --sans: "Fira Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12161c; --surface: #1a2029; --ink: #e8ebf0; --muted: #9aa3b2; --line: #2c3440;
    --accent: #d77fa6; --accent-ink: #12161c; --accent-soft: #2e2229; --chip: #232a35;
    --built: #6cc990; --built-soft: #1b2e23; --building: #7fb2ee; --building-soft: #1a2638;
    --planned: #a9acd6; --planned-soft: #232437; --warn: #f0c36a; --warn-soft: #3a2f12; --focus: #7fb0ff;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #12161c; --surface: #1a2029; --ink: #e8ebf0; --muted: #9aa3b2; --line: #2c3440;
  --accent: #d77fa6; --accent-ink: #12161c; --accent-soft: #2e2229; --chip: #232a35;
  --built: #6cc990; --built-soft: #1b2e23; --building: #7fb2ee; --building-soft: #1a2638;
  --planned: #a9acd6; --planned-soft: #232437; --warn: #f0c36a; --warn-soft: #3a2f12; --focus: #7fb0ff;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 15px/1.5 var(--sans); overflow-x: hidden; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
code, .mono { font-family: var(--mono); font-size: 0.86em; }
h1, h2, h3 { line-height: 1.25; margin: 0; }
p { margin: 0; }
.wrap { max-width: 1240px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header.top { padding-block: 16px 8px; }
h1 { font-size: 22px; font-weight: 600; }
.sub { color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.counts { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-family: var(--mono); font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.counts b { color: var(--ink); font-weight: 500; }
.changes { margin-top: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; }
.changes summary { cursor: pointer; color: var(--accent); }
.changes ul { margin: 6px 0 0; padding-left: 18px; color: var(--muted); }
.search { margin: 12px 0 0; }
.search input { width: 100%; min-height: 44px; padding: 8px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.tabs { display: flex; gap: 4px; margin: 16px 0 0; border-bottom: 1px solid var(--line); overflow-x: auto; }
.tabs button { background: none; border: 0; border-bottom: 3px solid transparent; padding: 10px 16px; min-height: 44px; color: var(--muted); font-weight: 500; white-space: nowrap; }
.tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.tabs .n { font-family: var(--mono); font-size: 12px; margin-left: 4px; }
main { padding-block: 16px 64px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 8px; min-width: 0; align-content: start; }
.card.click { cursor: pointer; text-align: left; }
.card.click:hover { border-color: var(--accent); }
.card h3 { font-size: 16px; font-weight: 600; }
.card .ex { color: var(--muted); font-size: 14px; overflow-wrap: anywhere; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pill { font-family: var(--mono); font-size: 11.5px; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
.s-built, .p-all { color: var(--built); background: var(--built-soft); }
.s-building, .p-part { color: var(--building); background: var(--building-soft); }
.s-planned, .p-none { color: var(--planned); background: var(--planned-soft); }
.tag { font-family: var(--mono); font-size: 11.5px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 6px; overflow-wrap: anywhere; }
.bar { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; display: flex; }
.bar i { display: block; height: 100%; }
.bar i.b { background: var(--built); }
.bar i.g { background: var(--building); }
.foot { font-family: var(--mono); font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; font-size: 14px; color: var(--muted); }
.filters select { min-height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; }
.tech { border-top: 1px solid var(--line); padding-top: 8px; display: grid; gap: 4px; font-size: 13px; }
.tech dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
.tech dd { margin: 0 0 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.decs { font-size: 12.5px; color: var(--muted); }
.decs li { overflow-wrap: anywhere; }
.decs ul { margin: 2px 0 0; padding-left: 16px; }
.empty, .notice { color: var(--muted); padding: 14px; background: var(--surface); border: 1px dashed var(--line); border-radius: 10px; }
.notice.ok { border-style: solid; }
.sec { display: grid; gap: 10px; margin-bottom: 22px; }
.sec h2 { font-size: 13px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; min-width: 520px; font-size: 14px; }
th, td { text-align: left; padding: 9px 12px; border-top: 1px solid var(--line); vertical-align: top; }
thead th { border-top: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; }
td.mono { white-space: nowrap; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--muted); margin-top: 10px; }
</style>

<div class="wrap">
  <header class="top">
    <h1>{{PROJECT}} System Map</h1>
    <p class="sub" id="sub">Loading the map…</p>
    <div class="counts" id="counts"></div>
    <details class="changes" id="changes" hidden><summary>What changed in the last refresh</summary><ul id="changelist"></ul></details>
    <div class="search"><input id="q" type="search" aria-label="Search" placeholder="Search features, operations, screens, tables" autocomplete="off"></div>
    <div class="legend">
      <span><b class="pill s-built">built</b> works in main</span>
      <span><b class="pill s-building">building</b> started</span>
      <span><b class="pill s-planned">planned</b> designed, not started</span>
    </div>
    <div class="tabs" role="tablist" aria-label="Views">
      <button role="tab" id="tab-areas" aria-selected="true">Areas</button>
      <button role="tab" id="tab-features" aria-selected="false" tabindex="-1">Features<span class="n" id="n-features"></span></button>
      <button role="tab" id="tab-system" aria-selected="false" tabindex="-1">System</button>
      <button role="tab" id="tab-unclaimed" aria-selected="false" tabindex="-1">Not yet described<span class="n" id="n-unclaimed"></span></button>
    </div>
  </header>
  <main id="main"></main>
</div>

<!-- Mode 2 data. Filled when the page is a plain file; left empty when the artifact database holds the documents. -->
<script type="application/json" id="page-data">
{}
</script>

<script>
let meta = null, areas = [], features = [], system = null, unclaimed = null, loaded = false, timedOut = false, failMessage = "";
let tab = "areas", areaFilter = "", statusFilter = "", query = "";
const STATUS = ["built", "building", "planned"];

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
function areaName(id) { const a = areas.find(x => x.id === id); return a ? a.name : id; }
function featuresOf(id) { return features.filter(f => f.area === id); }
function matches(f) {
  if (!query) return true;
  const hay = [f.name, f.explanation, f.milestone, f.id, ...(f.operations || []), ...(f.screens || []), ...(f.tables || [])].join(" ").toLowerCase();
  return hay.includes(query);
}

function renderHeader() {
  const sub = document.getElementById("sub"), counts = document.getElementById("counts");
  if (failMessage) { sub.textContent = failMessage; return; }
  if (!loaded) { if (timedOut) sub.textContent = "Still waiting for the map data. It appears as soon as the connection answers."; return; }
  if (!meta) { sub.textContent = "The map has not been written yet."; return; }
  sub.textContent = ["Which feature owns each API operation, screen and table.", meta.updated ? "Last refreshed " + meta.updated + "." : "", meta.latestMigration ? "Latest migration " + meta.latestMigration + "." : ""].filter(Boolean).join(" ");
  counts.replaceChildren();
  const c = meta.counts || {};
  for (const [k, label] of [["areas", "areas"], ["features", "features"], ["built", "built"], ["operations", "API operations"], ["screens", "screens"], ["tables", "tables"]]) {
    const s = el("span"); s.append(el("b", null, c[k] ?? 0), " " + label); counts.append(s);
  }
  const ch = Array.isArray(meta.changes) ? meta.changes : [];
  const box = document.getElementById("changes"), list = document.getElementById("changelist");
  list.replaceChildren(...ch.map(t => el("li", null, t)));
  box.hidden = ch.length === 0;
  document.getElementById("n-features").textContent = features.length ? features.length : "";
  const un = unclaimed ? (unclaimed.operations || []).length + (unclaimed.screens || []).length + (unclaimed.tables || []).length : 0;
  document.getElementById("n-unclaimed").textContent = un;
}

function renderAreas(main) {
  if (!areas.length) { main.append(el("div", "empty", loaded ? "No areas yet." : "Loading…")); return; }
  const grid = el("div", "grid");
  for (const a of areas) {
    const own = featuresOf(a.id);
    const n = s => own.filter(f => f.status === s).length;
    const card = el("button", "card click"); card.type = "button";
    const top = el("div", "row");
    top.append(el("span", "pill p-" + (a.progress === "all" || a.progress === "part" ? a.progress : "none"), a.progress === "all" ? "all built" : a.progress === "part" ? "partly built" : "not built yet"));
    if (a.chapter) top.append(el("span", "tag", a.chapter));
    card.append(top, el("h3", null, a.name), el("p", "ex", a.explanation || ""));
    const bar = el("div", "bar"); const total = own.length || 1;
    const b = el("i", "b"); b.style.width = (n("built") / total * 100) + "%";
    const g = el("i", "g"); g.style.width = (n("building") / total * 100) + "%";
    bar.append(b, g); card.append(bar);
    card.append(el("div", "foot", own.length + " features · " + n("built") + " built · " + n("building") + " building · " + n("planned") + " planned"));
    if (a.buildsOn && a.buildsOn.length) card.append(el("div", "foot", "Builds on: " + a.buildsOn.map(areaName).join(", ")));
    card.addEventListener("click", () => { areaFilter = a.id; statusFilter = ""; setTab("features"); });
    grid.append(card);
  }
  main.append(grid);
}

function featureCard(f) {
  const card = el("article", "card");
  const top = el("div", "row");
  top.append(el("span", "pill s-" + (STATUS.includes(f.status) ? f.status : "planned"), f.status || "planned"));
  if (f.milestone) top.append(el("span", "tag", f.milestone));
  top.append(el("span", "tag", areaName(f.area)));
  card.append(top, el("h3", null, f.name), el("p", "ex", f.explanation || ""));
  const groups = [["API operations", f.operations], ["Screens", f.screens], ["Tables", f.tables]].filter(([, v]) => v && v.length);
  if (groups.length) {
    const dl = el("dl", "tech");
    for (const [label, vals] of groups) { dl.append(el("dt", null, label)); const dd = el("dd"); for (const v of vals) dd.append(el("code", "tag", v)); dl.append(dd); }
    card.append(dl);
  }
  if (f.decisions && f.decisions.length) {
    const d = el("details", "decs"); d.append(el("summary", null, "Decisions behind it (" + f.decisions.length + ")"));
    const ul = el("ul"); for (const h of f.decisions) ul.append(el("li", null, h)); d.append(ul); card.append(d);
  }
  return card;
}

function renderFeatures(main) {
  const bar = el("div", "filters");
  const sa = el("select"); sa.setAttribute("aria-label", "Area");
  sa.append(new Option("Every area", ""), ...areas.map(a => new Option(a.name, a.id))); sa.value = areaFilter;
  sa.addEventListener("change", () => { areaFilter = sa.value; render(); });
  const ss = el("select"); ss.setAttribute("aria-label", "Status");
  ss.append(new Option("Every status", ""), ...STATUS.map(s => new Option(s, s))); ss.value = statusFilter;
  ss.addEventListener("change", () => { statusFilter = ss.value; render(); });
  bar.append(sa, ss);
  const list = features.filter(f => (!areaFilter || f.area === areaFilter) && (!statusFilter || f.status === statusFilter) && matches(f));
  bar.append(el("span", null, list.length + " shown"));
  main.append(bar);
  if (!list.length) { main.append(el("div", "empty", loaded ? "No feature matches." : "Loading…")); return; }
  const grid = el("div", "grid"); for (const f of list) grid.append(featureCard(f)); main.append(grid);
}

function claimOf(kind, name) {
  const f = features.find(x => (x[kind] || []).includes(name));
  return f ? f.name : "not yet described";
}
function tableSec(main, title, head, rows) {
  const sec = el("section", "sec"); sec.append(el("h2", null, title));
  if (!rows.length) { sec.append(el("div", "empty", "None yet.")); main.append(sec); return; }
  const wrap = el("div", "table-wrap"), t = el("table"), th = el("thead"), tr = el("tr");
  for (const h of head) tr.append(el("th", null, h)); th.append(tr); t.append(th);
  const tb = el("tbody");
  for (const r of rows) { const row = el("tr"); r.forEach((v, i) => row.append(el("td", i === 0 ? "mono" : null, v))); tb.append(row); }
  t.append(tb); wrap.append(t); sec.append(wrap); main.append(sec);
}
function renderSystem(main) {
  if (!system) { main.append(el("div", "empty", loaded ? "No system facts yet." : "Loading…")); return; }
  const q = s => !query || String(s).toLowerCase().includes(query);
  tableSec(main, "Apps and packages", ["Name", "Kind", "Folder", "Uses"], (system.packages || []).filter(p => q(p.name)).map(p => [p.name, p.kind, p.folder, (p.uses || []).join(", ") || "—"]));
  tableSec(main, "API operations", ["Operation", "Owned by"], (system.operations || []).filter(o => q(o.id)).map(o => [o.id, claimOf("operations", o.id)]));
  tableSec(main, "Screens", ["Route", "App", "Owned by"], (system.screens || []).filter(s => q(s.route)).map(s => [s.route, s.site, claimOf("screens", s.route)]));
  tableSec(main, "Tables", ["Table", "Owned by"], (system.tables || []).filter(t => q(t)).map(t => [t, claimOf("tables", t)]));
}
function renderUnclaimed(main) {
  if (!unclaimed) { main.append(el("div", "empty", loaded ? "Nothing written yet." : "Loading…")); return; }
  const all = [...(unclaimed.operations || []).map(x => ["API operation", x]), ...(unclaimed.screens || []).map(x => ["Screen", x]), ...(unclaimed.tables || []).map(x => ["Table", x])];
  if (!all.length) { main.append(el("div", "notice ok", "Everything in the code belongs to a feature. The check refuses anything new until a feature describes it.")); return; }
  tableSec(main, "Not yet described", ["Name", "Kind"], all.map(([k, v]) => [v, k]));
}

function setTab(t) { tab = t; for (const id of ["areas", "features", "system", "unclaimed"]) { const b = document.getElementById("tab-" + id); b.setAttribute("aria-selected", String(id === t)); b.tabIndex = id === t ? 0 : -1; } render(); }
function render() {
  renderHeader();
  const main = document.getElementById("main"); main.replaceChildren();
  if (tab === "areas") renderAreas(main); else if (tab === "features") renderFeatures(main); else if (tab === "system") renderSystem(main); else renderUnclaimed(main);
}
for (const id of ["areas", "features", "system", "unclaimed"]) document.getElementById("tab-" + id).addEventListener("click", () => setTab(id));
document.getElementById("q").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); if (query && tab === "areas") setTab("features"); else render(); });
render();

// The five documents are read one of two ways. Mode 1: the artifact database, when this view can run it.
// Mode 2: the JSON block in the page (a plain file, or a view without the database).
const list = v => Array.isArray(v) ? v.filter(x => x && typeof x === "object") : [];
function apply(docs) {
  const one = name => { const v = docs.get(name); return v && typeof v === "object" && !Array.isArray(v) ? v : null; };
  meta = one("meta");
  areas = list(one("areas") && one("areas").items);
  features = list(one("features") && one("features").items);
  system = one("system");
  unclaimed = one("unclaimed");
}

function readEmbedded() {
  const node = document.getElementById("page-data");
  if (!node) return null;
  try { const v = JSON.parse(node.textContent); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (_) { return null; }
}

function useEmbedded() {
  const d = readEmbedded();
  apply(new Map(d ? Object.entries(d) : []));
  if (!meta && !areas.length && !features.length && !system && !unclaimed) failMessage = "This view cannot read the map database and the page holds no embedded data.";
  loaded = true; render();
}

// Subscribe once. The 10-second timer is cleared by the first answer, data or error, and only ever explains the wait; it never reloads.
function useDatabase(db) {
  const timer = setTimeout(() => { timedOut = true; render(); }, 10000);
  db.collection("map").onSnapshot(s => {
    clearTimeout(timer);
    apply(new Map(s.docs.map(d => [d.id, d.data()])));
    loaded = true; render();
  }, () => {
    clearTimeout(timer);
    failMessage = "The map could not be loaded. Reload the page to try again.";
    render();
  });
}

(async () => {
  let db = null;
  try { if (window.claude && window.claude.use) db = await window.claude.use("db"); } catch (_) { db = null; }
  if (db) useDatabase(db); else useEmbedded();
})();
</script>
````
