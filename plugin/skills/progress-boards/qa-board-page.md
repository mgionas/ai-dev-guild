# QA board page template

The `progress-boards` skill publishes this page. It is the same design for every project: copy the
code block below unchanged, replace `{{PROJECT}}` (twice), and touch nothing else.

The page reads its rows one of two ways, so it works for every user:

1. **Artifact database** when the view can run it: `window.claude.use("db")` returns the database
   and the page subscribes once to `updates`, `features` and `checks`. A tester's Pass / Fail /
   Blocked and note update the check's document, and the tester's id comes from
   `window.claude.use("user")`; names are looked up when the page draws, never stored.
2. **Embedded data** otherwise: the `<script type="application/json" id="page-data">` block in
   the page, with the same three collections as arrays of objects that each carry an `id`. The
   controls are then read-only, with one line saying results are saved only on the published page.
   When you write the page as a plain file, fill that block (write every `<` inside it as
   `\u003c`); when you publish it as an artifact with the database, leave it empty.

It is kept as text, inside a Markdown file, so the plugin itself contains no web pages or scripts.
A plain file needs a minimal skeleton around the block (`<!doctype html>`, `<html lang="en">`,
`<head>` with `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width,
initial-scale=1">`, then `<body>`); an artifact adds its own.

````html
<title>{{PROJECT}} QA Board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one working column; a sticky bar with the totals and filters, then updates → features → checks. */
:root {
  --bg: #f5f7f6;
  --surface: #ffffff;
  --ink: #17201d;
  --muted: #5b6965;
  --line: #dde4e1;
  --accent: #0f6b5c;
  --accent-ink: #ffffff;
  --pass: #1d7a3e; --pass-bg: #e3f3e8;
  --fail: #b42318; --fail-bg: #fde8e6;
  --blocked: #9a5b00; --blocked-bg: #fdf0d9;
  --open: #5b6965; --open-bg: #edf1ef;
  --font-body: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --r: 8px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0f1513; --surface: #161e1b; --ink: #e4ebe8; --muted: #9aa9a4; --line: #27322e;
    --accent: #4fc2ab; --accent-ink: #062520;
    --pass: #6fd38f; --pass-bg: #12301d; --fail: #ff8a80; --fail-bg: #3a1714;
    --blocked: #f2b65b; --blocked-bg: #33250d; --open: #9aa9a4; --open-bg: #1d2623;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1513; --surface: #161e1b; --ink: #e4ebe8; --muted: #9aa9a4; --line: #27322e;
  --accent: #4fc2ab; --accent-ink: #062520;
  --pass: #6fd38f; --pass-bg: #12301d; --fail: #ff8a80; --fail-bg: #3a1714;
  --blocked: #f2b65b; --blocked-bg: #33250d; --open: #9aa9a4; --open-bg: #1d2623;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 15px; line-height: 1.5;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 0 48px;
}
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.wrap { max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
header.top { padding-top: 28px; display: flex; flex-direction: column; gap: 6px; }
h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; text-wrap: balance; }
.lede { margin: 0; color: var(--muted); max-width: 65ch; }
.bar {
  position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg);
  padding-block: 12px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--line);
}
.totals { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.meter { flex: 1 1 220px; height: 8px; border-radius: 4px; background: var(--open-bg); overflow: hidden; display: flex; min-width: 160px; }
.meter span { display: block; height: 100%; }
.meter .p { background: var(--pass); } .meter .f { background: var(--fail); } .meter .b { background: var(--blocked); }
.count { font-variant-numeric: tabular-nums; font-size: 13px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.count.pass { color: var(--pass); background: var(--pass-bg); }
.count.fail { color: var(--fail); background: var(--fail-bg); }
.count.blocked { color: var(--blocked); background: var(--blocked-bg); }
.count.open { color: var(--open); background: var(--open-bg); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; background: var(--surface); }
.seg button { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 13px; padding: 6px 10px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }
select, input[type="search"], input.note {
  font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r); padding: 6px 10px; min-height: 34px;
}
input[type="search"] { flex: 1 1 200px; min-width: 0; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.notice { padding: 12px 14px; border-radius: var(--r); background: var(--surface); border: 1px solid var(--line); color: var(--muted); }
.notice strong { color: var(--ink); }
section.update { display: flex; flex-direction: column; gap: 14px; }
.update-head { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.update-head .meta { font-family: var(--font-mono); font-size: 12px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 14px; }
.update-head h2 { margin: 0; font-size: 19px; text-wrap: balance; }
.update-head p { margin: 0; color: var(--muted); max-width: 70ch; }
h3.area { margin: 10px 0 -4px; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.feature { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.feature-head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.feature-head h3 { margin: 0; font-size: 15px; }
.feature-head .where { color: var(--muted); font-size: 13px; }
.feature-head .mini { display: flex; gap: 6px; }
ol.checks { list-style: none; margin: 0; padding: 0; }
li.check { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; padding: 12px 14px; border-top: 1px solid var(--line); }
li.check:first-child { border-top: 0; }
.stripe { width: 4px; border-radius: 2px; background: var(--line); grid-row: 1 / span 3; }
li.check[data-status="pass"] .stripe { background: var(--pass); }
li.check[data-status="fail"] .stripe { background: var(--fail); }
li.check[data-status="blocked"] .stripe { background: var(--blocked); }
.check-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.check-title { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.check-title b { font-weight: 600; }
.id { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
.acct { font-size: 12px; color: var(--accent); border: 1px solid var(--line); border-radius: 999px; padding: 0 8px; white-space: nowrap; }
details summary { cursor: pointer; color: var(--muted); font-size: 13px; width: fit-content; }
details p { margin: 6px 0 0; white-space: pre-line; font-size: 14px; max-width: 70ch; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.status { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; }
.status button { font: inherit; font-size: 13px; font-weight: 600; border: 0; padding: 5px 12px; min-height: 32px; cursor: pointer; background: var(--surface); color: var(--muted); }
.status button + button { border-left: 1px solid var(--line); }
.status button[data-s="pass"][aria-pressed="true"] { background: var(--pass-bg); color: var(--pass); }
.status button[data-s="fail"][aria-pressed="true"] { background: var(--fail-bg); color: var(--fail); }
.status button[data-s="blocked"][aria-pressed="true"] { background: var(--blocked-bg); color: var(--blocked); }
.status button:disabled { cursor: not-allowed; opacity: .6; }
input.note { flex: 1 1 220px; min-width: 0; }
.who { font-size: 12px; color: var(--muted); }
.empty-filter { padding: 14px; color: var(--muted); }
@media (max-width: 520px) { h1 { font-size: 22px; } .status button { padding: 5px 10px; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="wrap">
  <header class="top">
    <h1>{{PROJECT}} QA Board</h1>
    <p class="lede">What to test before a release. Each update lists the features it touched and the checks to run. Mark each check Pass, Fail or Blocked and leave a note; everyone sees the same board.</p>
    <p class="notice" id="mode-note" hidden>Results are saved only on the published page. Here the checks are read-only.</p>
  </header>

  <div class="bar" id="bar">
    <div class="totals" id="totals" aria-live="polite"></div>
    <div class="filters">
      <div class="seg" role="group" aria-label="Group by">
        <button type="button" id="by-update" aria-pressed="true">By update</button>
        <button type="button" id="by-feature" aria-pressed="false">By feature</button>
      </div>
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-f="all" aria-pressed="true">All</button>
        <button type="button" data-f="open" aria-pressed="false">To test</button>
        <button type="button" data-f="fail" aria-pressed="false">Failed</button>
        <button type="button" data-f="blocked" aria-pressed="false">Blocked</button>
        <button type="button" data-f="pass" aria-pressed="false">Passed</button>
      </div>
      <label class="sr" for="acct" style="position:absolute;left:-9999px">Account</label>
      <select id="acct"><option value="">Any account</option></select>
      <label for="q" style="position:absolute;left:-9999px">Search checks</label>
      <input type="search" id="q" placeholder="Search checks">
    </div>
  </div>

  <main id="board">
    <div class="notice" id="state"><strong>Loading the board…</strong> Updates appear here after each change.</div>
  </main>
</div>

<!-- Mode 2 rows. Filled when the page is a plain file; left empty when the artifact database holds the rows. -->
<script type="application/json" id="page-data">
{ "updates": [], "features": [], "checks": [] }
</script>

<script>
(function () {
  const STATUS_WORDS = { open: 'To test', pass: 'Pass', fail: 'Fail', blocked: 'Blocked' };
  const data = { updates: new Map(), features: new Map(), checks: new Map() };
  const loaded = { updates: false, features: false, checks: false };
  const view = { by: 'update', filter: 'all', acct: '', q: '' };
  // Writes in flight (check id → fields) and the latest fields asked for meanwhile, written when the first one settles.
  const pending = new Map(), queued = new Map();
  let db = null, user = null, myId = null, canWrite = false, names = {};

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k) n.append(k);
    return n;
  };
  const str = (v) => (typeof v === 'string' ? v : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 9999);
  const statusOf = (c) => (Object.hasOwn(STATUS_WORDS, c.status) ? c.status : 'open');
  const when = (iso) => { const d = new Date(str(iso)); return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };

  function matches(c) {
    const s = statusOf(c);
    if (view.filter !== 'all' && s !== view.filter) return false;
    if (view.acct && str(c.account) !== view.acct) return false;
    if (view.q) {
      const hay = (str(c.title) + ' ' + str(c.steps) + ' ' + str(c.note) + ' ' + c.id).toLowerCase();
      if (!hay.includes(view.q)) return false;
    }
    return true;
  }

  function tally(list) {
    const t = { pass: 0, fail: 0, blocked: 0, open: 0 };
    for (const c of list) t[statusOf(c)]++;
    return t;
  }

  function renderTotals() {
    const all = [...data.checks.values()];
    const t = tally(all), n = all.length || 1;
    const meter = el('div', { class: 'meter', role: 'img', 'aria-label': `${t.pass} passed, ${t.fail} failed, ${t.blocked} blocked, ${t.open} to test` },
      el('span', { class: 'p', style: `width:${(t.pass / n) * 100}%` }),
      el('span', { class: 'f', style: `width:${(t.fail / n) * 100}%` }),
      el('span', { class: 'b', style: `width:${(t.blocked / n) * 100}%` }));
    $('totals').replaceChildren(meter,
      el('span', { class: 'count open', text: `${t.open} to test` }),
      el('span', { class: 'count fail', text: `${t.fail} failed` }),
      el('span', { class: 'count blocked', text: `${t.blocked} blocked` }),
      el('span', { class: 'count pass', text: `${t.pass} passed` }));
  }

  function renderAccounts() {
    const sel = $('acct'), keep = sel.value;
    const accts = [...new Set([...data.checks.values()].map((c) => str(c.account)).filter(Boolean))].sort();
    sel.replaceChildren(el('option', { value: '', text: 'Any account' }),
      ...accts.map((a) => el('option', { value: a, text: a })));
    sel.value = accts.includes(keep) ? keep : '';
  }

  function checkRow(c) {
    const s = statusOf(c);
    const statusGroup = el('div', { class: 'status', role: 'group', 'aria-label': 'Result' });
    for (const k of ['pass', 'fail', 'blocked']) {
      const b = el('button', { type: 'button', 'data-s': k, 'aria-pressed': String(s === k), disabled: !canWrite, text: STATUS_WORDS[k] });
      b.addEventListener('click', () => setStatus(c, s === k ? 'open' : k));
      statusGroup.append(b);
    }
    const note = el('input', { class: 'note', id: `note-${c.id}`, type: 'text', placeholder: 'Note: what you saw, browser, steps', 'aria-label': `Note for ${str(c.title)}`, disabled: !canWrite });
    note.value = str(c.note);
    const saveNote = () => { if (note.value.trim() !== str(c.note)) setNote(c, note.value.trim()); };
    note.addEventListener('blur', saveNote);
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); note.blur(); } });

    let who = null;
    if (s !== 'open' && (c.by || c.at)) {
      const prof = c.by && Object.hasOwn(names, c.by) ? names[c.by] : null;
      const nm = (prof && prof.name) || 'Someone';
      who = el('span', { class: 'who', text: `${STATUS_WORDS[s]} · ${nm}${c.at ? ' · ' + when(c.at) : ''}` });
    }
    const steps = str(c.steps) ? el('details', {}, el('summary', { text: 'How to test' }), el('p', { text: str(c.steps) })) : null;
    const acct = str(c.account) ? el('span', { class: 'acct', text: c.account }) : null;

    return el('li', { class: 'check', 'data-status': s },
      el('span', { class: 'stripe', 'aria-hidden': 'true' }),
      el('div', { class: 'check-main' },
        el('div', { class: 'check-title' }, el('b', { text: str(c.title) }), acct, el('span', { class: 'id', text: c.id })),
        steps,
        el('div', { class: 'actions' }, statusGroup, note, who)));
  }

  function featureCard(fid, checks, label) {
    const f = data.features.get(fid) || {};
    const t = tally(checks);
    const sorted = checks.slice().sort((a, b) => num(a.order) - num(b.order) || a.id.localeCompare(b.id));
    return el('article', { class: 'feature' },
      el('div', { class: 'feature-head' },
        el('div', {}, el('h3', { text: label || str(f.name) || fid }), str(f.where) ? el('div', { class: 'where', text: str(f.where) }) : null),
        el('div', { class: 'mini' },
          t.open ? el('span', { class: 'count open', text: `${t.open} to test` }) : null,
          t.fail ? el('span', { class: 'count fail', text: `${t.fail} failed` }) : null,
          t.blocked ? el('span', { class: 'count blocked', text: `${t.blocked} blocked` }) : null,
          t.pass ? el('span', { class: 'count pass', text: `${t.pass} passed` }) : null)),
      el('ol', { class: 'checks' }, ...sorted.map(checkRow)));
  }

  /** Cards in their features' order, with an area heading wherever the area changes. */
  function byArea(fids, card) {
    const sorted = fids.slice().sort((a, b) => num((data.features.get(a) || {}).order) - num((data.features.get(b) || {}).order) || a.localeCompare(b));
    const out = [];
    let last = null;
    for (const fid of sorted) {
      const area = str((data.features.get(fid) || {}).area);
      if (area && area !== last) out.push(el('h3', { class: 'area', text: area }));
      last = area || last;
      out.push(card(fid));
    }
    return out;
  }

  function render() {
    renderTotals();
    renderAccounts();
    const board = $('board');
    if (!loaded.updates || !loaded.checks) return;
    if (data.updates.size === 0 && data.checks.size === 0) {
      board.replaceChildren(el('div', { class: 'notice' }, el('strong', { text: 'No updates yet.' }), document.createTextNode(' After each change, the update is added with its affected features and the checks to run.')));
      return;
    }
    const visible = [...data.checks.values()].filter(matches);
    const out = [];
    if (view.by === 'update') {
      const ups = [...data.updates.entries()].sort((a, b) => str(b[1].date).localeCompare(str(a[1].date)) || num(b[1].order) - num(a[1].order));
      for (const [uid, u] of ups) {
        const mine = visible.filter((c) => c.updateId === uid);
        const order = Array.isArray(u.features) ? u.features.filter((x) => typeof x === 'string') : [];
        const fids = [...new Set([...order, ...mine.map((c) => str(c.featureId))])].filter((fid) => mine.some((c) => c.featureId === fid));
        const head = el('div', { class: 'update-head' },
          el('div', { class: 'meta' }, el('span', { text: str(u.date) }), str(u.branch) ? el('span', { text: str(u.branch) }) : null, str(u.commit) ? el('span', { text: str(u.commit) }) : null),
          el('h2', { text: str(u.title) || uid }),
          str(u.summary) ? el('p', { text: str(u.summary) }) : null);
        const body = fids.length ? byArea(fids, (fid) => featureCard(fid, mine.filter((c) => c.featureId === fid))) : [el('div', { class: 'notice empty-filter', text: 'No check matches the filters in this update.' })];
        out.push(el('section', { class: 'update', 'aria-label': str(u.title) || uid }, head, ...body));
      }
    } else {
      const fids = [...new Set(visible.map((c) => str(c.featureId)))].sort((a, b) => num((data.features.get(a) || {}).order) - num((data.features.get(b) || {}).order) || a.localeCompare(b));
      out.push(...byArea(fids, (fid) => featureCard(fid, visible.filter((c) => c.featureId === fid))));
      if (!fids.length) out.push(el('div', { class: 'notice empty-filter', text: 'No check matches the filters.' }));
    }
    // A snapshot rebuilds the board; keep what the tester is typing and where the cursor was.
    const ae = document.activeElement;
    const typing = ae && ae.classList && ae.classList.contains('note') && board.contains(ae) ? { id: ae.id, value: ae.value, from: ae.selectionStart, to: ae.selectionEnd } : null;
    board.replaceChildren(...out);
    const back = typing && document.getElementById(typing.id);
    if (back && !back.disabled) {
      back.value = typing.value;
      back.focus({ preventScroll: true });
      back.setSelectionRange(typing.from, typing.to);
    }
  }

  async function resolveNames() {
    if (!user) return;
    const ids = [...new Set([...data.checks.values()].map((c) => c.by).filter((x) => typeof x === 'string'))];
    if (!ids.length) return;
    try { names = await user.profiles(ids); render(); } catch (_) { /* names stay "Someone" */ }
  }

  // The row is not redrawn while a write starts: a note saves on blur, and a redraw then would replace the button the tester is pressing before the click lands.
  async function write(c, fields, defaults = {}) {
    if (!db) return;
    if (pending.has(c.id)) {
      const q = queued.get(c.id) || {};
      const statusInFlight = 'status' in pending.get(c.id) || 'status' in q;
      queued.set(c.id, { ...(statusInFlight ? {} : defaults), ...q, ...fields });
      return;
    }
    pending.set(c.id, { ...defaults, ...fields });
    try { await db.collection('checks').doc(c.id).update({ ...defaults, ...fields }); }
    catch (e) {
      $('state') && $('state').remove();
      const msg = e && (e.code === 'permission_denied' || e.code === 'not_granted') ? 'You can view this board but not mark checks. Ask an editor for access to record results.' : 'That change was not saved. Check your connection and try again.';
      $('board').prepend(el('div', { class: 'notice', role: 'alert', text: msg }));
    } finally { pending.delete(c.id); }
    const next = queued.get(c.id);
    if (next) { queued.delete(c.id); await write(c, next); return; }
    render();
  }
  const setStatus = (c, s) => write(c, { status: s, by: s === 'open' ? null : myId, at: s === 'open' ? null : new Date().toISOString() });
  const setNote = (c, note) => write(c, { note }, { by: c.by || myId, at: c.at || null });

  function wire() {
    $('by-update').addEventListener('click', () => { view.by = 'update'; $('by-update').setAttribute('aria-pressed', 'true'); $('by-feature').setAttribute('aria-pressed', 'false'); render(); });
    $('by-feature').addEventListener('click', () => { view.by = 'feature'; $('by-feature').setAttribute('aria-pressed', 'true'); $('by-update').setAttribute('aria-pressed', 'false'); render(); });
    for (const b of document.querySelectorAll('[data-f]')) b.addEventListener('click', () => {
      view.filter = b.dataset.f;
      for (const o of document.querySelectorAll('[data-f]')) o.setAttribute('aria-pressed', String(o === b));
      render();
    });
    $('acct').addEventListener('change', (e) => { view.acct = e.target.value; render(); });
    let t; $('q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { view.q = e.target.value.trim().toLowerCase(); render(); }, 150); });
  }

  // Mode 1. One subscription per collection; the 10-second timer is cleared by the first answer (data or error) and only explains the wait, it never reloads.
  function subscribe(name) {
    const timer = setTimeout(() => { if (!loaded[name]) { const s = $('state'); if (s) s.textContent = 'The board cannot be reached yet. It will appear when the connection answers.'; } }, 10000);
    db.collection(name).onSnapshot((snap) => {
      clearTimeout(timer);
      const m = data[name]; m.clear();
      for (const d of snap.docs) { const v = d.data(); if (v && typeof v === 'object') m.set(d.id, Object.assign({}, v, { id: d.id })); }
      loaded[name] = true;
      render();
      if (name === 'checks') resolveNames();
    }, () => {
      clearTimeout(timer);
      loaded[name] = true;
      $('board').replaceChildren(el('div', { class: 'notice', role: 'alert', text: 'The board could not be loaded. Reload the page to try again.' }));
    });
  }

  // Mode 2. The rows come from the JSON block in the page, and the controls are read-only.
  function useEmbedded() {
    let d = null;
    try { const n = $('page-data'); d = n ? JSON.parse(n.textContent) : null; } catch (_) { d = null; }
    $('mode-note').hidden = false;
    let any = false;
    for (const name of ['updates', 'features', 'checks']) {
      for (const v of d && Array.isArray(d[name]) ? d[name] : []) {
        if (v && typeof v === 'object' && typeof v.id === 'string') { data[name].set(v.id, v); any = true; }
      }
      loaded[name] = true;
    }
    if (!any) { $('state').textContent = 'This view cannot read the board database and the page holds no embedded checks.'; return; }
    render();
  }

  async function start() {
    wire();
    renderTotals();
    let live = null, who = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') [live, who] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    } catch (_) { live = null; }
    if (!live) { useEmbedded(); return; }
    db = live; user = who;
    canWrite = true;
    if (user) {
      try { myId = await user.id(); } catch (_) { myId = null; }
      try { const w = await user.can('data.write'); if (w === false) canWrite = false; } catch (_) { /* keep inputs; refused writes decide */ }
    }
    if (!myId) { canWrite = false; $('mode-note').textContent = 'Sign in to record results.'; $('mode-note').hidden = false; }
    subscribe('updates'); subscribe('features'); subscribe('checks');
  }
  start();
})();
</script>
````
