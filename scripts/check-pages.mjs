#!/usr/bin/env node
/**
 * Checks the page templates' code, which lives inside Markdown and so was never run.
 *
 * For every `plugin/skills/<skill>/*-page.md` and `plugin/skills/project-map/map-template.md`:
 * - every `json` code block (the example data shown in the Markdown) parses;
 * - every `<script type="application/json">` block in the page's HTML parses;
 * - every inline script passes `node --check`;
 * - each page script runs once against a small DOM stand-in (`dom-standin.mjs`), with the block as
 *   shipped (empty) and again with each example filled in, and nothing throws, rejects or fails
 *   when a listener is fired. A template with no example data of its own needs a fixture in
 *   `scripts/fixtures/page-data/<template name>.json`, so its render code meets real data too;
 * - the template still tells the reader to write `<` inside the data block as the escape
 *   (backslash, u, 0, 0, 3, c). An editing tool turns that text into a bare `<` without a
 *   word, which ends the data block early in the published page.
 *
 * Usage: node scripts/check-pages.mjs [repo-root]. Exits 1 and lists every problem it finds.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runPage } from "./dom-standin.mjs";

const root = resolve(process.argv[2] ?? join(import.meta.dirname, ".."));
const problems = [];
// Built from parts: typed whole, an editing tool rewrites it to `<` in this very file.
const ESCAPED_LT = String.fromCharCode(92) + "u003c";

/** The fenced code blocks of a Markdown file: language, body and the line the block starts on. */
function codeBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(`{3,})\s*([\w-]*)\s*$/);
    if (!open) continue;
    const start = i + 1;
    const body = [];
    for (i++; i < lines.length && lines[i].trim() !== open[1]; i++) body.push(lines[i]);
    blocks.push({ lang: open[2], body: body.join("\n"), line: start });
  }
  return blocks;
}

/** The scripts of a page: JSON data blocks with their ids, and the inline scripts that run. */
function scriptsOf(html) {
  const json = [];
  const inline = [];
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(attrs)) continue; // a library from a CDN; the stand-in supplies what the page needs of it
    if (/type\s*=\s*"application\/json"/i.test(attrs)) json.push({ id: attrs.match(/id\s*=\s*"([^"]+)"/)?.[1] ?? "(no id)", body });
    else inline.push(body);
  }
  return { json, inline };
}

/** Runs `node --check` on the code and returns the first line of its complaint, or null. */
function syntaxError(code, dir) {
  const file = join(dir, "script.js");
  writeFileSync(file, code);
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status === 0) return null;
  return result.stderr.split("\n").find((l) => /Error/.test(l)) ?? result.stderr.trim();
}

/** True when the parsed data holds something: a non-empty list, object or text, or a number. */
function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return value !== null && value !== undefined && value !== "" && value !== false;
}

const skillsDir = join(root, "plugin", "skills");
const skills = existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
const templates = skills.flatMap((skill) => {
  const files = readdirSync(join(skillsDir, skill)).filter((f) => f.endsWith("-page.md"));
  if (skill === "project-map") {
    if (existsSync(join(skillsDir, skill, "map-template.md"))) files.push("map-template.md");
    else problems.push("plugin/skills/project-map/map-template.md: the template is missing");
  }
  return files.sort().map((f) => ({ skill, name: f, path: join(skillsDir, skill, f), rel: `plugin/skills/${skill}/${f}` }));
});

const tmp = mkdtempSync(join(tmpdir(), "check-pages-"));
let runs = 0;
try {
  for (const t of templates) {
    const text = readFileSync(t.path, "utf8");
    const skillText = existsSync(join(skillsDir, t.skill, "SKILL.md")) ? readFileSync(join(skillsDir, t.skill, "SKILL.md"), "utf8") : "";
    // The instruction sits in the template, or for the project map in its skill file.
    if (!text.includes(ESCAPED_LT) && !skillText.includes(ESCAPED_LT))
      problems.push(`${t.rel}: no longer says to write every < as ${ESCAPED_LT} in the data block`);

    const blocks = codeBlocks(text);
    const htmlBlocks = blocks.filter((b) => b.lang === "html");
    if (!htmlBlocks.length) {
      problems.push(`${t.rel}: no html code block`);
      continue;
    }

    // Example data shown in the Markdown.
    const examples = [];
    for (const b of blocks.filter((b) => b.lang === "json")) {
      try {
        examples.push({ label: `the example JSON block at line ${b.line}`, text: b.body, value: JSON.parse(b.body) });
      } catch (error) {
        problems.push(`${t.rel}: the example JSON block at line ${b.line} is not valid JSON (${error.message})`);
      }
    }
    const fixturePath = join(root, "scripts", "fixtures", "page-data", `${basename(t.name, ".md")}.json`);
    if (existsSync(fixturePath)) {
      const fixtureText = readFileSync(fixturePath, "utf8");
      try {
        examples.push({ label: `the fixture ${basename(fixturePath)}`, text: fixtureText, value: JSON.parse(fixtureText) });
      } catch (error) {
        problems.push(`scripts/fixtures/page-data/${basename(fixturePath)} is not valid JSON (${error.message})`);
      }
    }

    let shippedHasContent = false;
    for (const b of htmlBlocks) {
      const { json, inline } = scriptsOf(b.body);
      let parsesAll = true;
      for (const block of json) {
        try {
          if (hasContent(JSON.parse(block.body))) shippedHasContent = true;
        } catch (error) {
          parsesAll = false;
          problems.push(`${t.rel}: the data block "${block.id}" is not valid JSON (${error.message})`);
        }
      }
      inline.forEach((code, i) => {
        const complaint = syntaxError(code, tmp);
        if (complaint) {
          parsesAll = false;
          problems.push(`${t.rel}: inline script ${i + 1} does not parse (${complaint})`);
        }
      });
      if (!parsesAll) continue;

      // Run as shipped, then once per example filled into the first data block.
      const targets = [{ label: "the block as shipped", data: {} }];
      for (const e of examples) if (json.length) targets.push({ label: e.label, data: { [json[0].id]: e.text } });
      for (const target of targets) {
        runs++;
        const { errors } = await runPage({ html: b.body, scripts: inline, data: target.data });
        for (const error of errors) problems.push(`${t.rel}: running the page with ${target.label}: ${error}`);
      }
    }
    if (!shippedHasContent && !examples.length)
      problems.push(`${t.rel}: has no example data: its block ships empty and the Markdown shows none; add scripts/fixtures/page-data/${basename(t.name, ".md")}.json`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!templates.length) problems.push("no page templates found under plugin/skills");
if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Page template checks passed (${templates.length} templates, ${runs} page runs).`);
