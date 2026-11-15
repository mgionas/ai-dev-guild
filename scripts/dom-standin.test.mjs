/** Tests for the small DOM stand-in the page check runs template scripts against. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, runPage } from "./dom-standin.mjs";

const html = `<nav><button id="a" data-tab="one">A</button><button data-tab="two">B</button></nav>
<main><section id="one"><p class="x y">Hi &amp; bye</p></section><section id="two" hidden></section></main>
<script type="application/json" id="page-data">{"k": 1}</script>`;

test("the parsed page answers getElementById, and null for an id that is not in the markup", () => {
  const doc = new Document(html);
  assert.equal(doc.getElementById("one").tagName, "SECTION");
  assert.equal(doc.getElementById("missing"), null);
  assert.equal(doc.getElementById("page-data").textContent, '{"k": 1}');
  assert.equal(doc.getElementById("one").textContent, "Hi & bye");
});

test("selectors: tag, class, attribute, descendant and child combinators, lists", () => {
  const doc = new Document(html);
  assert.equal(doc.querySelectorAll("nav button").length, 2);
  assert.equal(doc.querySelectorAll("[data-tab]").length, 2);
  assert.equal(doc.querySelectorAll("main > section").length, 2);
  assert.equal(doc.querySelectorAll("p.x.y").length, 1);
  assert.equal(doc.querySelectorAll("#a, section").length, 3);
  assert.equal(doc.querySelectorAll("main > p").length, 0);
  assert.equal(doc.getElementById("one").closest("main").tagName, "MAIN");
});

test("a selector it does not implement throws instead of quietly matching nothing", () => {
  assert.throws(() => new Document(html).querySelectorAll("p:first-child"), /unsupported selector/);
});

test("elements built by a script can be appended, found and emptied", () => {
  const doc = new Document(html);
  const li = doc.createElement("li");
  li.textContent = "x";
  li.id = "made";
  doc.getElementById("one").append(li, "text");
  assert.equal(doc.getElementById("made"), li);
  doc.getElementById("one").replaceChildren();
  assert.equal(doc.getElementById("made"), null);
});

test("innerHTML builds children that can be queried", () => {
  const doc = new Document(html);
  const box = doc.getElementById("two");
  box.innerHTML = '<ul><li class="a">1</li><li>2</li></ul>';
  assert.equal(box.querySelectorAll("li").length, 2);
});

test("runPage reports a throw, a rejected promise and a failing listener, and passes a clean page", async () => {
  const page = '<button id="b"></button>';
  assert.deepEqual((await runPage({ html: page, scripts: ["document.getElementById('b').textContent = 'ok';"] })).errors, []);
  assert.match((await runPage({ html: page, scripts: ["document.getElementById('zzz').textContent = 'x';"] })).errors[0], /TypeError/);
  assert.match((await runPage({ html: page, scripts: ["(async () => { await 1; throw new Error('late'); })();"] })).errors[0], /late/);
  assert.match((await runPage({ html: page, scripts: ["document.getElementById('b').addEventListener('click', () => { throw new Error('in handler'); });"] })).errors[0], /in handler/);
  assert.match((await runPage({ html: page, scripts: ["notDefinedAnywhere();"] })).errors[0], /ReferenceError/);
});

test("runPage puts the data override into the named block before any script runs", async () => {
  const page = '<script type="application/json" id="d">{}</script><div id="o"></div>';
  const code = "document.getElementById('o').textContent = JSON.parse(document.getElementById('d').textContent).v.w;";
  assert.match((await runPage({ html: page, scripts: [code] })).errors[0], /TypeError/);
  assert.deepEqual((await runPage({ html: page, scripts: [code], data: { d: '{"v":{"w":1}}' } })).errors, []);
});
