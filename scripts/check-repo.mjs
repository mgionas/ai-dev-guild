#!/usr/bin/env node
/**
 * Repository checks that run on every pull request.
 *
 * They guard the rules the Claude plugin directory applies to the listed plugin, so a pull
 * request cannot quietly make the listing refusable:
 * - `plugin/` holds only Markdown, its manifest, the icon and the licence. The directory will take
 *   hooks, scripts and other file types only from Verified organizations.
 * - No file is over 256 KiB (the directory holds larger ones for a reviewer).
 * - Every manifest is valid JSON, and the listed plugin has a version.
 * - Every frontmatter `description` in agents and skills is a quoted string, so YAML cannot misread
 *   a `#` or a `: ` inside it.
 * - Every relative link in a Markdown file points at a file that exists, and a `#anchor` on it
 *   points at a heading that exists there (GitHub's anchor rules).
 * - The guild's own inventory agrees with itself: the role and skill counts in the READMEs and
 *   badges, every skill and agent in each list that should name it, no list naming one that does
 *   not exist, frontmatter names equal to file and folder names, a role document for every agent
 *   (and the reverse) with the model the roles README gives, and "`x.md` in this skill's folder"
 *   naming a file that exists. These were found drifting by hand; now CI finds them.
 *
 * Usage: node scripts/check-repo.mjs [repo-root]. Exits 1 and lists every problem it finds.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve, extname, basename } from "node:path";

const root = resolve(process.argv[2] ?? join(import.meta.dirname, ".."));
const problems = [];
const MAX_BYTES = 256 * 1024;
const SKIP = new Set([".git", "node_modules"]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root);
const rel = (path) => relative(root, path).split("\\").join("/");

// The listed plugin: Markdown, its manifest, one PNG icon and the licence.
for (const file of files.filter((f) => rel(f).startsWith("plugin/"))) {
  const name = rel(file);
  const allowed =
    extname(file) === ".md" ||
    name === "plugin/.claude-plugin/plugin.json" ||
    name === "plugin/.claude-plugin/icon.png" ||
    name === "plugin/LICENSE";
  if (!allowed)
    problems.push(
      `${name}: only Markdown, the manifest, the icon and the licence may live in plugin/`,
    );
}

for (const file of files) {
  if (statSync(file).size > MAX_BYTES)
    problems.push(`${rel(file)}: larger than 256 KiB`);
}

for (const manifest of [
  ".claude-plugin/marketplace.json",
  "plugin/.claude-plugin/plugin.json",
  "guards/.claude-plugin/plugin.json",
]) {
  try {
    const data = JSON.parse(readFileSync(join(root, manifest), "utf8"));
    if (manifest.startsWith("plugin/") && !data.version)
      problems.push(`${manifest}: no version`);
  } catch (error) {
    problems.push(`${manifest}: not valid JSON (${error.message})`);
  }
}

const frontmatterFiles = files.filter((f) => {
  const name = rel(f);
  return (
    (name.startsWith("plugin/agents/") && name.endsWith(".md")) ||
    basename(f) === "SKILL.md"
  );
});
for (const file of frontmatterFiles) {
  const head = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---\n/);
  if (!head) {
    problems.push(`${rel(file)}: no frontmatter`);
    continue;
  }
  const description = head[1]
    .split("\n")
    .find((line) => line.startsWith("description:"));
  if (!description) problems.push(`${rel(file)}: no description`);
  else if (!/^description: ".*"$/.test(description))
    problems.push(`${rel(file)}: description is not a quoted string`);
}

for (const file of files.filter((f) => extname(f) === ".md")) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target)))
      problems.push(`${rel(file)}: broken link to ${target}`);
  }
}

// --- Anchors -------------------------------------------------------------------------------

/**
 * GitHub's anchor for a heading: the text lower-cased, everything but letters, digits, spaces,
 * hyphens and underscores removed (emoji and their variation selector go), each space a hyphen.
 * The text is trimmed before the emoji go, so "⚙️ Skills" becomes "-skills", as it does on GitHub.
 */
function slug(heading) {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[`*~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\uFE0F/g, "")
    .replace(/[^\p{L}\p{N}\p{Mn}\p{Mc}_ -]/gu, "")
    .replace(/ /g, "-");
}

const anchorCache = new Map();
/** Every anchor a Markdown file offers: its headings (repeats get -1, -2) and its HTML ids. */
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const text = readFileSync(file, "utf8");
  const anchors = new Set();
  const seen = new Map();
  for (const [, heading] of text
    .replace(/^(`{3,}|~{3,})[\s\S]*?^\1[^\n]*$/gm, "")
    .matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm)) {
    const base = slug(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n ? `${base}-${n}` : base);
  }
  for (const [, id] of text.matchAll(/<a\s[^>]*?(?:id|name)="([^"]+)"/g)) anchors.add(id);
  anchorCache.set(file, anchors);
  return anchors;
}

for (const file of files.filter((f) => extname(f) === ".md")) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, target, anchor] of text.matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const targetFile = target ? resolve(dirname(file), target) : file;
    if (extname(targetFile) !== ".md" || !existsSync(targetFile)) continue; // a missing file is reported above
    let wanted = anchor;
    try { wanted = decodeURIComponent(anchor); } catch { /* keep it as written */ }
    if (!anchorsOf(targetFile).has(wanted.toLowerCase()))
      problems.push(`${rel(file)}: broken anchor #${anchor} in ${target || "(this file)"}`);
  }
}

// --- The inventory: counts, lists, names, role parity, folder references -------------------

const agentFiles = files.filter((f) => /^plugin\/agents\/[^/]+\.md$/.test(rel(f)));
const agentNames = agentFiles.map((f) => basename(f, ".md")).sort();
const skillsDir = join(root, "plugin", "skills");
const skillNames = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];

/** The `key: value` lines of a file's frontmatter, quotes removed. Null when it has none. */
function frontmatterOf(file) {
  const head = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---\n/);
  if (!head) return null;
  const fields = new Map();
  for (const line of head[1].split("\n")) {
    const m = line.match(/^([a-z-]+):\s*(.*)$/);
    if (m) fields.set(m[1], m[2].replace(/^"(.*)"$/, "$1"));
  }
  return fields;
}

const readIf = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
const readme = readIf("README.md");
const pluginReadme = readIf("plugin/README.md");
const rolesReadme = readIf("docs/roles/README.md");

// Counts. A number in prose or in a badge goes stale the day a role is added.
function checkCounts(path, text) {
  if (text === null) return;
  const claims = [
    [/badge\/roles-(\d+)/g, "roles badge says", "agent files", agentNames.length],
    [/alt="(\d+) roles"/g, "roles badge text says", "agent files", agentNames.length],
    [/badge\/skills-(\d+)/g, "skills badge says", "skill folders", skillNames.length],
    [/alt="(\d+) skills"/g, "skills badge text says", "skill folders", skillNames.length],
  ];
  for (const [pattern, said, unit, actual] of claims)
    for (const [, n] of text.matchAll(pattern))
      if (Number(n) !== actual) problems.push(`${path}: ${said} ${n}, found ${actual} ${unit}`);
  for (const [, n, kind] of text.matchAll(/\*\*(\d+) (roles|skills)\*\*/g)) {
    const actual = kind === "roles" ? agentNames.length : skillNames.length;
    if (Number(n) !== actual)
      problems.push(`${path}: "${n} ${kind}" but found ${actual} ${kind === "roles" ? "agent files" : "skill folders"}`);
  }
}
checkCounts("README.md", readme);
checkCounts("plugin/README.md", pluginReadme);

/** The plain names in backticks inside `text` (`a`, `b`), skipping placeholders like `/x:<name>`. */
const backticked = (text) => [...text.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);

/** The "**N skills**" bullet: from its marker to the next blank line. */
const skillsBullet = (text) => text.match(/^- \*\*\d+ skills\*\*[\s\S]*?(?=\n\s*\n|(?![\s\S]))/m)?.[0] ?? null;

/** The README's "Skills" heading section (any emoji in front), up to the next heading. */
const skillsSection = (text) => text.match(/^#{2,4} [^\n]*Skills[ \t]*\n([\s\S]*?)(?=^#{1,6} |(?![\s\S]))/m)?.[1] ?? null;

/** The names in the skills table: rows that start with a backticked name linking a skill folder. */
const tableSkills = (text) => [...text.matchAll(/^\|\s*\[`([a-z0-9-]+)`\]\(plugin\/skills\//gm)].map((m) => m[1]);

/** One list of skills: every folder in it, and nothing in it without a folder. */
function checkSkillList(path, label, names) {
  if (names === null) {
    problems.push(`${path}: no ${label} found`);
    return;
  }
  for (const s of skillNames) if (!names.includes(s)) problems.push(`${path}: skill "${s}" is not in the ${label}`);
  for (const n of new Set(names)) if (!skillNames.includes(n)) problems.push(`${path}: the ${label} names "${n}", which is no skill folder`);
}
if (readme !== null) {
  checkSkillList("README.md", "skills table", tableSkills(readme));
  const section = skillsSection(readme);
  checkSkillList("README.md", "skills name list", section === null ? null : backticked(section));
}
if (pluginReadme !== null) {
  const bullet = skillsBullet(pluginReadme);
  checkSkillList("plugin/README.md", "skills list", bullet === null ? null : backticked(bullet));
}

// The roles README: a row per agent, none for an agent that does not exist, and its model.
const roleRows = new Map(); // agent name -> the Model cell
if (rolesReadme !== null) {
  for (const line of rolesReadme.split("\n")) {
    const row = line.match(/^\|\s*\[([a-z0-9-]+)\]\(([a-z0-9-]+)\.md\)\s*\|.*\|\s*([a-z0-9-]+)\s*\|\s*$/);
    if (row) roleRows.set(row[2], row[3]);
  }
  for (const a of agentNames)
    if (!roleRows.has(a)) problems.push(`docs/roles/README.md: agent "${a}" is not listed`);
  for (const r of roleRows.keys())
    if (!agentNames.includes(r)) problems.push(`docs/roles/README.md: lists "${r}", which is no agent file`);
}

// Names, and role parity.
for (const a of agentNames) {
  const fields = frontmatterOf(join(root, "plugin/agents", `${a}.md`));
  if (!fields) continue; // "no frontmatter" is reported above
  if (fields.get("name") !== a)
    problems.push(`plugin/agents/${a}.md: name is "${fields.get("name") ?? ""}", the file is ${a}.md`);
  if (!existsSync(join(root, "docs/roles", `${a}.md`)))
    problems.push(`plugin/agents/${a}.md: has no docs/roles/${a}.md`);
  if (roleRows.has(a) && fields.get("model") !== roleRows.get(a))
    problems.push(`plugin/agents/${a}.md: model is "${fields.get("model") ?? ""}", docs/roles/README.md says "${roleRows.get(a)}"`);
}
for (const s of skillNames) {
  const skillFile = join(skillsDir, s, "SKILL.md");
  const fields = existsSync(skillFile) ? frontmatterOf(skillFile) : null;
  if (!fields) continue;
  if (fields.get("name") !== s)
    problems.push(`plugin/skills/${s}/SKILL.md: name is "${fields.get("name") ?? ""}", the folder is ${s}`);
}
for (const f of files.filter((f) => /^docs\/roles\/[^/]+\.md$/.test(rel(f)) && basename(f) !== "README.md")) {
  const a = basename(f, ".md");
  if (!agentNames.includes(a)) problems.push(`docs/roles/${a}.md: has no plugin/agents/${a}.md`);
}

// "`x.md` in this skill's folder" and "in the `y` skill's folder": the file must be there. Prose
// wraps, so whitespace is folded first.
for (const file of files.filter((f) => /^plugin\/skills\/[^/]+\/.+\.md$/.test(rel(f)))) {
  const own = rel(file).split("/")[2];
  const text = readFileSync(file, "utf8").replace(/\s+/g, " ");
  for (const [, name, other] of text.matchAll(/`([^`\s]+\.[a-z]+)` in (?:this|the `([a-z0-9-]+)`) skill's folder/g)) {
    const folder = other ?? own;
    if (!existsSync(join(skillsDir, folder, name)))
      problems.push(`${rel(file)}: "${name}" is not in the ${folder} skill's folder`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Repository checks passed (${files.length} files).`);
