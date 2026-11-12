# Project map page template

The `project-map` skill writes this page to `docs/map/index.html`, or publishes it as an artifact.
Copy everything inside the code block below, unchanged, then replace only the content of the
`<script type="application/json" id="map-data">` block with the project's data.

The page has no `<!doctype>`, `<html>`, `<head>` or `<body>`: it starts with `<title>` and
`<style>`, as an artifact expects, and its colours follow the reader's light or dark setting. A
plain file at `docs/map/index.html` needs a minimal skeleton around it (`<!doctype html>`,
`<html lang="en">`, `<head>` with `<meta charset="utf-8">` and `<meta name="viewport"
content="width=device-width, initial-scale=1">`, then `<body>`). The map's data is always the
embedded block: it comes from the code, not from an artifact database.

It is kept here as text, inside a Markdown file, so the plugin itself contains no web pages or
scripts: the page exists only once you create it in your project.

````html
<title>Project map</title>
<style>
  :root {
    --bg: #ffffff; --card: #f6f8fa; --border: #d0d7de; --text: #1f2328; --muted: #59636e;
    --accent: #9a6700; --link: #0969da; --warn-bg: #fff8c5; --warn: #7d4e00;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #f0f6fc; --muted: #9198a1;
      --accent: #e3b341; --link: #4493f8; --warn-bg: #2e2a1a; --warn: #e3b341;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #f0f6fc; --muted: #9198a1;
    --accent: #e3b341; --link: #4493f8; --warn-bg: #2e2a1a; --warn: #e3b341;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 24px; margin: 0; }
  .meta { color: var(--muted); font-size: 13px; margin: 4px 0 20px; }
  nav { display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
  nav button { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted);
    font: inherit; padding: 8px 4px; cursor: pointer; }
  nav button[aria-selected="true"] { color: var(--text); border-color: var(--accent); font-weight: 600; }
  .diagram { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px; overflow-x: auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
  .card b { display: block; }
  .kind { color: var(--accent); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .muted { color: var(--muted); }
  .tree ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px dashed var(--border); }
  .tree > ul { padding-left: 0; border: 0; }
  .tree li { margin: 6px 0; }
  .tree summary { cursor: pointer; }
  .tree code { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .nojob { background: var(--warn-bg); color: var(--warn); border-radius: 6px; padding: 0 6px; font-size: 12px; }
  [hidden] { display: none !important; }
</style>
<main>
  <h1 id="title">Project map</h1>
  <p class="meta" id="meta"></p>
  <nav role="tablist" aria-label="Map views">
    <button role="tab" aria-selected="true" data-tab="system" aria-controls="system">System</button>
    <button role="tab" aria-selected="false" data-tab="folders" aria-controls="folders">Folders</button>
  </nav>
  <section id="system" role="tabpanel">
    <div class="diagram"><pre class="mermaid" id="graph"></pre></div>
    <div class="cards" id="parts"></div>
  </section>
  <section id="folders" role="tabpanel" hidden>
    <p class="muted">Every folder and the job it does. A highlighted folder has no stated job yet:
      give it an <code>AGENTS.md</code> or a README whose first paragraph says what it is for.</p>
    <div class="tree" id="tree"></div>
  </section>
</main>

<!-- The skill replaces the content of this block with the project's data. Nothing else changes. -->
<script type="application/json" id="map-data">
{
  "project": "example",
  "generated": "2026-01-01",
  "commit": "0000000",
  "system": {
    "parts": [
      { "id": "web", "name": "Web app", "kind": "app", "job": "What users open in the browser." },
      { "id": "api", "name": "API", "kind": "app", "job": "Answers the web app and checks permissions." },
      { "id": "db", "name": "Database", "kind": "service", "job": "Stores accounts and orders." },
      { "id": "email", "name": "Email provider", "kind": "outside", "job": "Sends sign-up emails." }
    ],
    "links": [
      { "from": "web", "to": "api", "label": "HTTPS" },
      { "from": "api", "to": "db", "label": "SQL" },
      { "from": "api", "to": "email", "label": "sends" }
    ]
  },
  "folders": [
    { "path": "src", "job": "All source code." },
    { "path": "src/api", "job": "Routes, one folder per feature." },
    { "path": "src/web", "job": "" }
  ]
}
</script>

<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
  const data = JSON.parse(document.getElementById('map-data').textContent);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.getElementById('title').textContent = `${data.project} — project map`;
  document.title = `${data.project} — project map`;
  document.getElementById('meta').textContent = `Read from the code on ${data.generated}, commit ${data.commit}.`;

  // Tabs
  for (const button of document.querySelectorAll('nav button')) {
    button.addEventListener('click', () => {
      for (const b of document.querySelectorAll('nav button')) b.setAttribute('aria-selected', String(b === button));
      for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== button.dataset.tab;
    });
  }

  // System: a diagram from the links, and a card per part.
  const parts = data.system?.parts ?? [];
  const known = new Set(parts.map((p) => p.id));
  const safeId = (id) => 'n_' + String(id).replace(/[^A-Za-z0-9_]/g, '_');
  const shape = { outside: ['([', '])'], service: ['[(', ')]'] };
  const label = (s) => String(s).replace(/"/g, "'").replace(/[\s#]+/g, ' ').trim();
  const lines = ['flowchart LR'];
  for (const p of parts) {
    const [open, close] = Object.hasOwn(shape, p.kind) ? shape[p.kind] : ['[', ']'];
    lines.push(`  ${safeId(p.id)}${open}"${label(p.name)}"${close}`);
  }
  for (const l of data.system?.links ?? []) {
    if (!known.has(l.from) || !known.has(l.to)) continue; // a link to nothing is skipped, never invented
    lines.push(l.label ? `  ${safeId(l.from)} -- "${label(l.label)}" --> ${safeId(l.to)}` : `  ${safeId(l.from)} --> ${safeId(l.to)}`);
  }
  document.getElementById('graph').textContent = lines.join('\n');
  document.getElementById('parts').innerHTML = parts.map((p) =>
    `<div class="card"><span class="kind">${esc(p.kind)}</span><b>${esc(p.name)}</b><span class="muted">${esc(p.job) || 'No stated job yet.'}</span></div>`).join('');

  // Folders: a tree built from the paths.
  const root = { children: new Map() };
  for (const f of data.folders ?? []) {
    let node = root;
    for (const segment of f.path.split('/').filter(Boolean)) {
      if (!node.children.has(segment)) node.children.set(segment, { children: new Map() });
      node = node.children.get(segment);
    }
    node.job = f.job;
    node.listed = true;
  }
  const render = (node, depth) => {
    const items = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => {
      const job = child.job ? esc(child.job) : (child.listed ? '<span class="nojob">no stated job</span>' : '');
      const head = `<code>${esc(name)}/</code> ${job}`;
      return child.children.size
        ? `<li><details ${depth < 1 ? 'open' : ''}><summary>${head}</summary>${render(child, depth + 1)}</details></li>`
        : `<li>${head}</li>`;
    });
    return `<ul>${items.join('')}</ul>`;
  };
  document.getElementById('tree').innerHTML = root.children.size ? render(root, 0) : '<p class="muted">No folders listed.</p>';

  // The diagram last: it needs the network, and the rest of the page must work without it.
  const graph = document.getElementById('graph');
  if (!parts.length) {
    graph.closest('.diagram').hidden = true;
  } else {
    try {
      const theme = document.documentElement.dataset.theme;
      const dark = theme === 'dark' || (matchMedia('(prefers-color-scheme: dark)').matches && theme !== 'light');
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', securityLevel: 'strict' });
      mermaid.run({ nodes: [graph] }).catch(() => { graph.textContent = 'The diagram could not be drawn. The parts are listed below.'; });
    } catch {
      graph.textContent = 'The diagram needs a network connection. The parts are listed below.';
    }
  }
</script>
````
