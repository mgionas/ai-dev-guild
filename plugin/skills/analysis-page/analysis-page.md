# Analysis page template

The `analysis-page` skill publishes this page. It is the same design for every analysis, so the
owner learns one layout: copy the code block below unchanged, replace `{{TITLE}}` (twice) and
`{{PROJECT}}` (once), and touch nothing else, not the tokens, fonts, sections, labels or script.

The page reads its content from the `<script type="application/json" id="page-data">` block in
the page, and nothing else. When you write the page as a plain file, fill that block, writing
every `<` inside it as `<` so no text in it can end the block. When you publish it as an
artifact, fill the same block. There is no artifact database: when the owner answers, the
controller edits the block and republishes to the same URL.

It is kept as text, inside a Markdown file, so the plugin itself contains no web pages or scripts.
A plain file needs a minimal skeleton around the block (`<!doctype html>`, `<html lang="en">`,
`<head>` with `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width,
initial-scale=1">`, then `<body>`); an artifact adds its own.

## The data block

One object. Fields you leave out show as empty; a field of the wrong type is ignored.

| Field | Meaning |
| --- | --- |
| `question` | the decision, as one sentence the owner would recognise |
| `status` | `open` or `decided`; anything else shows as `open` |
| `updated` | date of the last change, `YYYY-MM-DD` |
| `summary` | two or three sentences: what the facts say, and what they do not |
| `findings` | `[{id, title, note, figures}]`, each figure `{label, value, tag, source}` |
| `options` | `[{id, title, detail, recommended}]`, the recommended one first; at most one has `recommended: true` |
| `answer` | `null` while open; when decided `{text, date, option}`, with `text` the owner's words, quoted, and `option` an option's id or empty |
| `gaps` | `["what is still unknown and who could answer it"]` |
| `sources` | `[{n, title, url}]`, numbered from 1 in the order they appear |

A figure's `tag` is `sourced`, `assumption` or `gap`; any other value shows as `gap`. A figure's
`source` is a number from `sources`. A `sourced` figure with no matching source shows a red
"source missing" mark, so a broken link between a number and its page cannot pass quietly.

Example, with neutral figures:

```json
{
  "question": "Should the shared cost be split by area or by equal share?",
  "status": "open",
  "updated": "2026-01-15",
  "summary": "Splitting by area shifts cost toward the three largest units. Equal share is simpler to explain. We have no figure for how many owners would object.",
  "findings": [
    {
      "id": "f1",
      "title": "What each split costs a typical unit",
      "note": "Based on one year of shared cost.",
      "figures": [
        { "label": "Total shared cost per year", "value": "12,000", "tag": "sourced", "source": 1 },
        { "label": "Smallest unit pays, by area", "value": "180", "tag": "assumption", "source": 2 },
        { "label": "Owners who prefer equal share", "value": "not found", "tag": "gap" }
      ]
    }
  ],
  "options": [
    { "id": "o1", "title": "Split by area", "detail": "Follows what each unit uses; needs the area of every unit on record.", "recommended": true },
    { "id": "o2", "title": "Split by equal share", "detail": "Simple; the smallest units pay more than their use." }
  ],
  "answer": null,
  "gaps": ["Share of owners who would object to either split: ask the residents' committee."],
  "sources": [
    { "n": 1, "title": "Annual accounts, shared cost page", "url": "https://example.org/accounts" },
    { "n": 2, "title": "Our own calculation from the unit list", "url": "" }
  ]
}
```

When the owner answers, set `status` to `decided`, `updated` to the day, and `answer` to
`{"text": "Split by area, but review after a year.", "date": "2026-01-16", "option": "o1"}`.

````html
<title>{{TITLE}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap">
<style>
/* Layout: one column that reads top to bottom: the question, the summary, findings with tagged figures, options, the answer, gaps, sources. */
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
.wrap { max-width: 820px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 56px; display: grid; gap: 28px; }
header { display: grid; gap: 8px; }
.eyebrow { font-family: var(--f-mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0; font-size: clamp(26px, 4vw, 34px); font-weight: 700; letter-spacing: -.01em; text-wrap: balance; overflow-wrap: anywhere; }
.question { margin: 0; font-size: 17px; max-width: 68ch; overflow-wrap: anywhere; }
.statusline { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.stamp { font-family: var(--f-mono); font-size: 12px; color: var(--muted); }
h2 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
section { display: grid; gap: 12px; }
p { margin: 0; overflow-wrap: anywhere; }
.pill { font-family: var(--f-mono); font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.s-done { color: var(--done); background: var(--done-soft); }
.s-pending { color: var(--pending); background: var(--pending-soft); }
.s-gap { color: var(--you); background: var(--you-soft); }
.s-active { color: var(--active); background: var(--active-soft); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: grid; gap: 8px; min-width: 0; }
.card-title { font-weight: 600; font-size: 15.5px; line-height: 1.35; overflow-wrap: anywhere; }
.card-note { color: var(--muted); font-size: 13.5px; overflow-wrap: anywhere; }
.figs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.fig { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: baseline; padding-block: 8px; border-top: 1px solid var(--line); }
.fig-label { font-size: 14px; overflow-wrap: anywhere; }
.fig-value { font-family: var(--f-mono); font-size: 14px; font-weight: 500; text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.fig-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ref { font-family: var(--f-mono); font-size: 11px; color: var(--accent); }
.opt { border-left: 4px solid var(--line); }
.opt.rec { border-left-color: var(--accent); }
.opt.chosen { border-color: var(--done); border-left-color: var(--done); }
.opt-flags { display: flex; flex-wrap: wrap; gap: 6px; }
.answer { border-color: var(--done); }
.quote { margin: 0; padding-left: 12px; border-left: 3px solid var(--done); font-size: 16px; overflow-wrap: anywhere; }
.empty { color: var(--muted); font-size: 13.5px; }
.notice { background: var(--surface); border: 1px dashed var(--line); border-radius: 8px; padding: 14px 16px; color: var(--muted); }
.list { margin: 0; padding-left: 20px; display: grid; gap: 6px; overflow-wrap: anywhere; }
.src-title { overflow-wrap: anywhere; }
.src-url { font-family: var(--f-mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
a { color: var(--accent); }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--muted); }
.legend span { display: inline-flex; gap: 6px; align-items: center; }
@media (max-width: 620px) { .wrap { padding-block: 20px 40px; } }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">{{PROJECT}} · analysis</div>
    <h1>{{TITLE}}</h1>
    <p class="question" id="question">Loading the analysis…</p>
    <div class="statusline"><span class="pill" id="status"></span><span class="stamp" id="stamp"></span></div>
  </header>

  <section aria-labelledby="sum-h" id="sec-summary">
    <h2 id="sum-h">Summary</h2>
    <p id="summary"></p>
    <div class="legend">
      <span><b class="pill s-done">sourced</b> from a page listed under Sources</span>
      <span><b class="pill s-pending">assumption</b> chosen, and the line says why</span>
      <span><b class="pill s-gap">gap</b> looked for, not found</span>
    </div>
  </section>

  <section aria-labelledby="find-h">
    <h2 id="find-h">Findings</h2>
    <div id="findings"></div>
  </section>

  <section aria-labelledby="opt-h">
    <h2 id="opt-h">Options</h2>
    <div id="options"></div>
  </section>

  <section aria-labelledby="ans-h" id="sec-answer" hidden>
    <h2 id="ans-h">The owner's answer</h2>
    <div id="answer"></div>
  </section>

  <section aria-labelledby="gap-h">
    <h2 id="gap-h">Gaps</h2>
    <div id="gaps"></div>
  </section>

  <section aria-labelledby="src-h">
    <h2 id="src-h">Sources</h2>
    <div id="sources"></div>
  </section>
</div>

<!-- The content. Fill this block (every < written as <); the controller edits it and republishes when the owner answers. -->
<script type="application/json" id="page-data">
{ "question": "", "status": "open", "updated": "", "summary": "", "findings": [], "options": [], "answer": null, "gaps": [], "sources": [] }
</script>

<script>
const TAGS = new Map([["sourced", "s-done"], ["assumption", "s-pending"], ["gap", "s-gap"]]);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}
function str(v) { return typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : ""; }
function list(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === "object") : []; }
function safeUrl(u) { return /^https?:\/\/\S+$/i.test(u) ? u : ""; }

function readData() {
  const node = document.getElementById("page-data");
  if (!node) return null;
  try { const v = JSON.parse(node.textContent); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (_) { return null; }
}

function figure(f, known) {
  const li = el("li", "fig");
  li.append(el("span", "fig-label", str(f.label)), el("span", "fig-value", str(f.value)));
  const meta = el("div", "fig-meta");
  // An unknown tag is shown as a gap, never as a sourced figure.
  const tag = TAGS.has(f.tag) ? f.tag : "gap";
  meta.append(el("b", "pill " + TAGS.get(tag), tag));
  const n = typeof f.source === "number" ? f.source : null;
  if (n !== null && known.has(n)) {
    const a = el("a", "ref", "source [" + n + "]");
    a.href = "#src-" + n;
    meta.append(a);
  } else if (tag === "sourced") {
    meta.append(el("b", "pill s-gap", "source missing"));
  }
  li.append(meta);
  return li;
}

function renderFindings(d, known) {
  const box = document.getElementById("findings");
  box.replaceChildren();
  const rows = list(d.findings);
  if (!rows.length) { box.append(el("div", "notice", "No findings have been written yet.")); return; }
  const stack = el("div"); stack.style.display = "grid"; stack.style.gap = "12px";
  for (const r of rows) {
    const c = el("article", "card");
    c.append(el("div", "card-title", str(r.title)));
    if (str(r.note)) c.append(el("div", "card-note", str(r.note)));
    const figs = list(r.figures);
    if (figs.length) {
      const ul = el("ul", "figs");
      for (const f of figs) ul.append(figure(f, known));
      c.append(ul);
    }
    stack.append(c);
  }
  box.append(stack);
}

function renderOptions(d, decided, chosenId) {
  const box = document.getElementById("options");
  box.replaceChildren();
  const rows = list(d.options);
  if (!rows.length) { box.append(el("div", "notice", "No options have been written yet.")); return; }
  const stack = el("div"); stack.style.display = "grid"; stack.style.gap = "12px";
  // The recommended option goes first, whatever order the data came in.
  const first = rows.findIndex(o => o.recommended === true);
  const ordered = first > 0 ? [rows[first], ...rows.filter((_, i) => i !== first)] : rows;
  for (const o of ordered) {
    const isChosen = decided && chosenId !== "" && str(o.id) === chosenId;
    const rec = o.recommended === true;
    const c = el("article", "card opt" + (rec ? " rec" : "") + (isChosen ? " chosen" : ""));
    const flags = el("div", "opt-flags");
    if (rec) flags.append(el("b", "pill s-active", "recommended"));
    if (rec && !decided) flags.append(el("b", "pill s-pending", "for you to decide"));
    if (isChosen) flags.append(el("b", "pill s-done", "chosen"));
    if (flags.childNodes.length) c.append(flags);
    c.append(el("div", "card-title", str(o.title)));
    if (str(o.detail)) c.append(el("div", "card-note", str(o.detail)));
    stack.append(c);
  }
  box.append(stack);
}

function renderAnswer(d, decided) {
  const sec = document.getElementById("sec-answer");
  const box = document.getElementById("answer");
  box.replaceChildren();
  const a = d.answer && typeof d.answer === "object" ? d.answer : null;
  sec.hidden = !(decided && a);
  if (sec.hidden) return;
  const c = el("div", "card answer");
  const q = el("blockquote", "quote", str(a.text));
  c.append(q, el("div", "stamp", "Answered " + (str(a.date) || "(no date recorded)")));
  box.append(c);
}

function renderGaps(d) {
  const box = document.getElementById("gaps");
  box.replaceChildren();
  const rows = Array.isArray(d.gaps) ? d.gaps.map(str).filter(Boolean) : [];
  if (!rows.length) { box.append(el("div", "empty", "No gaps are listed.")); return; }
  const ul = el("ul", "list");
  for (const g of rows) ul.append(el("li", null, g));
  box.append(ul);
}

function renderSources(d) {
  const box = document.getElementById("sources");
  box.replaceChildren();
  const rows = list(d.sources).filter(s => typeof s.n === "number");
  if (!rows.length) { box.append(el("div", "empty", "No sources are listed.")); return; }
  const ol = el("ol", "list");
  for (const s of rows) {
    const li = el("li"); li.id = "src-" + s.n; li.value = s.n;
    li.append(el("span", "src-title", str(s.title)));
    const url = str(s.url);
    if (url) {
      li.append(el("br"));
      const safe = safeUrl(url);
      if (safe) { const a = el("a", "src-url", url); a.href = safe; a.rel = "noopener noreferrer"; a.target = "_blank"; li.append(a); }
      else li.append(el("span", "src-url", url));
    }
    ol.append(li);
  }
  box.append(ol);
}

function render() {
  const d = readData();
  const q = document.getElementById("question");
  if (!d) { q.textContent = "This page holds no readable data."; return; }
  // Anything but the exact word "decided" counts as open: a typo never shows a decision that was not made.
  const decided = d.status === "decided";
  q.textContent = str(d.question) || "No question has been written yet.";
  const st = document.getElementById("status");
  st.textContent = decided ? "decided" : "open";
  st.className = "pill " + (decided ? "s-done" : "s-pending");
  document.getElementById("stamp").textContent = str(d.updated) ? "Last updated " + str(d.updated) : "";
  document.getElementById("summary").textContent = str(d.summary) || "No summary has been written yet.";
  const known = new Set(list(d.sources).map(s => s.n).filter(n => typeof n === "number"));
  renderFindings(d, known);
  const a = d.answer && typeof d.answer === "object" ? d.answer : null;
  renderOptions(d, decided && !!a, a ? str(a.option) : "");
  renderAnswer(d, decided);
  renderGaps(d);
  renderSources(d);
}
render();
</script>
````
