/**
 * A small stand-in for the browser, just big enough to run a page template's script once.
 *
 * Why it exists: the page templates are Markdown, so no test ever ran their code. A typo in a
 * script, or an id the script reads that the markup lacks, only showed when somebody opened the
 * page. This parses the page's HTML into a real tree, so `getElementById` returns null for an id
 * that is not there (as a browser does), and runs the scripts in a `node:vm` context with no
 * network and no timers. It is not a browser: layout, styles, events and promises that wait on the
 * outside world are not modelled. It stays strict where it matters: a selector or a global it does
 * not know throws, so nothing passes by quietly matching nothing.
 */
import vm from "node:vm";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return Object.hasOwn(ENTITIES, e) ? ENTITIES[e] : m;
  });

export class Text {
  constructor(data) {
    this.data = data;
    this.parentNode = null;
  }
  get textContent() {
    return this.data;
  }
  set textContent(v) {
    this.data = String(v);
  }
}

// --- Selectors -----------------------------------------------------------------------------

/** Parses "a > b c, d" into alternatives; each is a list of {combinator, compound} from left to right. */
function parseSelector(source) {
  return source.split(",").map((part) => {
    const chain = [];
    let combinator = " ";
    const tokens = part.trim().replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (token === ">") { combinator = ">"; continue; }
      chain.push({ combinator, compound: parseCompound(token, source) });
      combinator = " ";
    }
    if (!chain.length) throw new Error(`dom-standin: unsupported selector "${source}"`);
    return chain;
  });
}

function parseCompound(token, source) {
  const compound = { tag: null, id: null, classes: [], attrs: [] };
  let rest = token;
  const tag = rest.match(/^[a-zA-Z][\w-]*|^\*/);
  if (tag) { compound.tag = tag[0] === "*" ? null : tag[0].toLowerCase(); rest = rest.slice(tag[0].length); }
  while (rest) {
    let m;
    if ((m = rest.match(/^#([\w-]+)/))) compound.id = m[1];
    else if ((m = rest.match(/^\.([\w-]+)/))) compound.classes.push(m[1]);
    else if ((m = rest.match(/^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) compound.attrs.push([m[1], m[2] ?? m[3] ?? m[4] ?? null]);
    else throw new Error(`dom-standin: unsupported selector "${source}"`);
    rest = rest.slice(m[0].length);
  }
  return compound;
}

function matchesCompound(el, c) {
  if (c.tag && el.localName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  const classes = el.className.split(/\s+/);
  if (!c.classes.every((k) => classes.includes(k))) return false;
  return c.attrs.every(([k, v]) => el.hasAttribute(k) && (v === null || el.getAttribute(k) === v));
}

function matchesChain(el, chain, i = chain.length - 1) {
  if (!matchesCompound(el, chain[i].compound)) return false;
  if (i === 0) return true;
  if (chain[i].combinator === ">") return !!el.parentNode?.localName && matchesChain(el.parentNode, chain, i - 1);
  for (let p = el.parentNode; p && p.localName; p = p.parentNode) if (matchesChain(p, chain, i - 1)) return true;
  return false;
}

// --- Elements ------------------------------------------------------------------------------

export class Element {
  constructor(tag, doc) {
    this.localName = tag.toLowerCase();
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
    this.attrs = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" };
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.value = "";
    this.checked = false;
    this.tabIndex = 0;
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  get id() { return this.attrs.get("id") ?? ""; }
  set id(v) { this.attrs.set("id", String(v)); }
  get className() { return this.attrs.get("class") ?? ""; }
  set className(v) { this.attrs.set("class", String(v)); }
  get classList() {
    const list = () => this.className.split(/\s+/).filter(Boolean);
    return {
      add: (...k) => { this.className = [...new Set([...list(), ...k])].join(" "); },
      remove: (...k) => { this.className = list().filter((x) => !k.includes(x)).join(" "); },
      contains: (k) => list().includes(k),
      toggle: (k, force) => {
        const on = force ?? !list().includes(k);
        if (on) this.classList.add(k); else this.classList.remove(k);
        return on;
      },
    };
  }
  get children() { return this.childNodes.filter((n) => n instanceof Element); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.#setChildren(String(v) === "" ? [] : [new Text(String(v))]); }
  get innerHTML() { return this.childNodes.map((n) => (n instanceof Text ? n.data : n.outerHTML)).join(""); }
  set innerHTML(html) {
    this.#setChildren([]);
    parseInto(this, String(html), this.ownerDocument);
  }
  get outerHTML() { return `<${this.localName}>${this.innerHTML}</${this.localName}>`; }

  #setChildren(nodes) {
    for (const n of this.childNodes) n.parentNode = null;
    this.childNodes = [];
    for (const n of nodes) this.appendChild(n);
  }
  #adopt(node) {
    const n = typeof node === "string" || typeof node === "number" ? new Text(String(node)) : node;
    if (!(n instanceof Element) && !(n instanceof Text)) throw new TypeError("dom-standin: can only append an element, text or a string");
    n.parentNode?.removeChild(n);
    n.parentNode = this;
    return n;
  }
  appendChild(node) { const n = this.#adopt(node); this.childNodes.push(n); return n; }
  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  prepend(...nodes) { this.childNodes.unshift(...nodes.map((n) => this.#adopt(n))); }
  replaceChildren(...nodes) { this.#setChildren([]); this.append(...nodes); }
  insertBefore(node, ref) {
    const n = this.#adopt(node);
    const at = ref ? this.childNodes.indexOf(ref) : -1;
    if (at < 0) this.childNodes.push(n); else this.childNodes.splice(at, 0, n);
    return n;
  }
  removeChild(node) {
    const at = this.childNodes.indexOf(node);
    if (at >= 0) { this.childNodes.splice(at, 1); node.parentNode = null; }
    return node;
  }
  remove() { this.parentNode?.removeChild(this); }
  contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }

  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === "hidden") this.hidden = true; }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }

  *#descendants() {
    for (const n of this.childNodes) if (n instanceof Element) { yield n; yield* n.#descendants(); }
  }
  querySelectorAll(selector) {
    const alternatives = parseSelector(selector);
    return [...this.#descendants()].filter((el) => alternatives.some((chain) => matchesChain(el, chain)));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  matches(selector) { return parseSelector(selector).some((chain) => matchesChain(this, chain)); }
  closest(selector) {
    const alternatives = parseSelector(selector);
    for (let n = this; n?.localName; n = n.parentNode) if (alternatives.some((chain) => matchesChain(n, chain))) return n;
    return null;
  }
  findById(id) {
    for (const el of this.#descendants()) if (el.id === id) return el;
    return null;
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
    this.ownerDocument?.listening.add(this);
  }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn)); }
  /** Calls the listeners one by one; a throw is recorded (as a browser reports it) and the rest still run. */
  dispatchEvent(event) {
    const e = { target: this, currentTarget: this, key: "", preventDefault() {}, stopPropagation() {}, ...event };
    for (const fn of this.listeners.get(e.type) ?? []) {
      try { fn.call(this, e); } catch (error) { this.ownerDocument.report(error); }
    }
    return true;
  }
  click() { this.dispatchEvent({ type: "click" }); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }
  scrollIntoView() {}
  getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}

// --- Parsing -------------------------------------------------------------------------------

const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>=`]+))?)*)\s*(\/?)>|<!doctype[^>]*>|[^<]+|</gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+)))?/g;

/** Builds the elements of `html` under `parent`. Tolerant: an unclosed tag is closed at the end. */
function parseInto(parent, html, doc) {
  const stack = [parent];
  const top = () => stack[stack.length - 1];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(html))) {
    const [raw, close, open, attrText = "", selfClose] = m;
    if (close) {
      const at = stack.map((e) => e.localName).lastIndexOf(close.toLowerCase());
      if (at > 0) stack.length = at;
    } else if (open) {
      const el = new Element(open, doc);
      for (const a of attrText.matchAll(ATTR)) {
        const value = decode(a[2] ?? a[3] ?? a[4] ?? "");
        el.attrs.set(a[1], value);
        if (a[1].startsWith("data-")) el.dataset[a[1].slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
      }
      if (el.attrs.has("hidden")) el.hidden = true;
      if (el.attrs.has("value")) el.value = el.attrs.get("value");
      top().appendChild(el);
      const tag = el.localName;
      if (RAW_TEXT.has(tag) && !selfClose) {
        const end = html.toLowerCase().indexOf(`</${tag}`, TOKEN.lastIndex);
        const body = html.slice(TOKEN.lastIndex, end < 0 ? html.length : end);
        if (body) el.appendChild(new Text(tag === "script" || tag === "style" ? body : decode(body)));
        TOKEN.lastIndex = end < 0 ? html.length : html.indexOf(">", end) + 1;
      } else if (!VOID.has(tag) && !selfClose) stack.push(el);
    } else if (!raw.startsWith("<!") && !/^<$/.test(raw)) {
      top().appendChild(new Text(decode(raw)));
    } else if (raw === "<") {
      top().appendChild(new Text("<"));
    }
  }
}

// --- The document and the run --------------------------------------------------------------

export class Document {
  constructor(html) {
    this.listening = new Set();
    this.errors = [];
    this.activeElement = null;
    this.title = "";
    this.documentElement = new Element("html", this);
    this.body = new Element("body", this);
    this.documentElement.append(this.body);
    parseInto(this.body, html, this);
  }
  report(error) { this.errors.push(error); }
  createElement(tag) { return new Element(tag, this); }
  createTextNode(text) { return new Text(String(text)); }
  getElementById(id) { return this.body.findById(id); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
  querySelector(selector) { return this.body.querySelector(selector); }
  addEventListener() {}
}

/** One line for an error: its name and message, and where in the script it came from. */
function describe(error) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const at = String(error?.stack ?? "").match(/inline-script-(\d+):(\d+):\d+/);
  return at ? `${text} (script ${at[1]}, line ${at[2]})` : text;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Runs `scripts` (the page's inline scripts, in order) against `html`, then lets promises settle,
 * then fires one click, input and change on every element that has a listener for it. `data` maps
 * the id of a JSON block to the text to put in it before anything runs. Returns the errors seen:
 * a throw while a script loads, a rejected promise nobody caught, and a throw inside a listener.
 */
export async function runPage({ html, scripts, data = {} }) {
  const doc = new Document(html);
  for (const [id, text] of Object.entries(data)) {
    const block = doc.getElementById(id);
    if (!block) return { errors: [`the data block "${id}" is not in the page`] };
    block.textContent = text;
  }
  const noTimers = () => 0;
  const sandbox = {
    document: doc,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    Option: class { constructor(text = "", value = text) { const o = doc.createElement("option"); o.textContent = text; o.value = value; return o; } },
    // The diagram library the project map loads from a CDN; the page must work when it is absent, so a stand-in is enough.
    mermaid: { initialize() {}, run: () => Promise.resolve() },
    setTimeout: noTimers,
    setInterval: noTimers,
    clearTimeout() {},
    clearInterval() {},
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    addEventListener() {},
  };
  const context = vm.createContext(sandbox);
  context.window = context;

  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  // Other listeners (the test runner's fails the running test) would also hear a rejection the page
  // left uncaught, which is the very thing being collected here. They are put back afterwards.
  const others = process.listeners("unhandledRejection");
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", onRejection);
  try {
    scripts.forEach((code, i) => {
      try { vm.runInContext(code, context, { filename: `inline-script-${i + 1}` }); } catch (error) { doc.report(error); }
    });
    await tick();
    await tick();
    for (const el of [...doc.listening]) for (const type of ["click", "input", "change"]) if (el.listeners.has(type)) el.dispatchEvent({ type });
    await tick();
    await tick();
  } finally {
    process.off("unhandledRejection", onRejection);
    for (const listener of others) process.on("unhandledRejection", listener);
  }
  // One line per distinct error: a listener that fails fires again for every event.
  return { errors: [...new Set([...doc.errors, ...rejections].map(describe))] };
}
