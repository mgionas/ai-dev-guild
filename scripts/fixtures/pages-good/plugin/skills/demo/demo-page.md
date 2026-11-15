# Demo page template

The page reads its content from the `<script type="application/json" id="page-data">` block. Fill it
and write every `<` inside it as `\u003c`, so no text in it can end the block.

Example data:

```json
{ "title": "Shown title", "items": ["one", "two"] }
```

````html
<title>Demo</title>
<style>
body { margin: 0; }
</style>
<main>
  <h1 id="title"></h1>
  <ul id="list"></ul>
  <button id="more" type="button">More</button>
</main>

<script type="application/json" id="page-data">
{ "title": "", "items": [] }
</script>

<script>
function el(tag, text) {
  const n = document.createElement(tag);
  n.textContent = String(text);
  return n;
}
function read() {
  try { return JSON.parse(document.getElementById("page-data").textContent); } catch (_) { return null; }
}
function render() {
  const d = read();
  document.getElementById("title").textContent = d && d.title ? d.title : "Nothing yet";
  const list = document.getElementById("list");
  list.replaceChildren();
  for (const item of d && Array.isArray(d.items) ? d.items : []) list.append(el("li", item));
}
document.getElementById("more").addEventListener("click", render);
render();
(async () => { await Promise.resolve(); render(); })();
</script>
````
