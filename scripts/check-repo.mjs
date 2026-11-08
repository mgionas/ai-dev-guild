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
 * - Every relative link in a Markdown file points at a file that exists.
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

if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Repository checks passed (${files.length} files).`);
