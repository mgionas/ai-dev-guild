#!/usr/bin/env node
/**
 * The system map check. It reads the facts (API operations, screens, tables) from the code with
 * the readers named in the config file, reads the map people wrote under `docs/system-map/`, and
 * refuses when they disagree. Nothing is skipped quietly: a reader that cannot read its input
 * refuses, naming the file.
 *
 * Usage: node check.mjs [--config <file>] [--base <ref>] [--out <dir>]
 *   --config  the config file (default `system-map.config.json` here). The map is read from
 *             `docs/system-map/` beside it, and every path in it is relative to its folder.
 *   --base    a git ref (for example `origin/main`): the baseline may only lose entries compared
 *             with that ref's copy. Use it in CI and in the local gate; without it the baseline is not compared.
 *   --out     when the check passes, also write the page's five documents there as JSON.
 *
 * Exits 0 when the map is true, 1 with every problem listed, 2 on a wrong command line.
 */
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, loadMap } from "./load.mjs";
import { compare } from "./compare.mjs";
import { compareBaseline } from "./baseline.mjs";
import { buildDocs, writeDocs } from "./out.mjs";
import readOpenApi from "./readers/openapi.mjs";
import readRoutes from "./readers/routes.mjs";
import readSql from "./readers/sql.mjs";

const READERS = new Map([["openapi", readOpenApi], ["routes", readRoutes], ["sql", readSql]]);

/** Finds a reader: a built-in by name, or the project's own module by path. */
async function readerFor(base, name) {
  if (!name.startsWith(".")) return READERS.get(name);
  const module = await import(pathToFileURL(resolve(base, name)).href);
  if (typeof module.default !== "function") throw new Error(`${name}: must export a default function (root, options) => [{ id }]`);
  return module.default;
}

/**
 * Runs one reader and refuses an answer that is not a list of `{ id }` with a text id, so a
 * custom reader that returns the wrong shape fails here instead of being read as "no facts".
 */
async function readFacts(base, kind, entry) {
  const { reader, ...options } = entry;
  let found;
  try {
    found = await (await readerFor(base, reader))(base, options);
  } catch (error) {
    throw new Error(`${kind}: ${error.message}`);
  }
  if (!Array.isArray(found) || !found.every((f) => f && typeof f.id === "string" && f.id !== "")) {
    throw new Error(`${kind}: the reader "${reader}" must return a list of { id: "<text>" }`);
  }
  const ids = new Set(found.map((f) => f.id));
  if (ids.size !== found.length) throw new Error(`${kind}: the reader "${reader}" returned the same id twice`);
  return found;
}

/**
 * @param {{config: string, base?: string, out?: string}} args - `config` is the config file's path, `base` a git ref.
 * @returns {Promise<{problems: string[], summary?: string}>}
 */
export async function runCheck({ config: configPath, base: ref, out }) {
  const base = dirname(resolve(configPath));
  const { config, problems } = loadConfig(resolve(configPath));
  const map = loadMap(base);
  problems.push(...map.problems);
  const facts = {};
  for (const [kind, entry] of Object.entries(config)) {
    try { facts[kind] = await readFacts(base, kind, entry); } catch (error) { problems.push(error.message); }
  }
  // Compare only when everything was read: with a reader down, "does not exist" would mislead.
  if (problems.length > 0) return { problems };
  const found = compare(facts, map);
  const baseline = ref === undefined ? { problems: [], note: "baseline not compared: pass --base <ref>" } : compareBaseline(base, ref, map.undescribed);
  found.push(...baseline.problems);
  if (found.length > 0) return { problems: found };
  const docs = buildDocs(facts, map);
  if (out) writeDocs(resolve(out), docs);
  const c = docs.meta.counts;
  return { problems: [], summary: `system map: ok (${c.areas} areas, ${c.features} features, ${c.operations} operations, ${c.screens} screens, ${c.tables} tables; ${baseline.note})` };
}

function parseArgs(argv) {
  const args = { config: "system-map.config.json" };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if ((!["--config", "--base", "--out"].includes(flag)) || !argv[i + 1]) return null;
    args[flag.slice(2)] = argv[i + 1];
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("usage: node check.mjs [--config <file>] [--base <ref>] [--out <dir>]");
    process.exit(2);
  }
  const { problems, summary } = await runCheck(args);
  if (problems.length > 0) {
    console.error(`system map: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n` + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(summary);
}
