/**
 * Builds the five documents the map page shows (`meta`, `areas`, `features`, `system`,
 * `unclaimed`) from facts that already passed the check. Same input, same bytes: lists are
 * sorted with plain comparison, keys are written in a fixed order, and nothing reads a clock.
 * `meta` carries no date and no change list: whoever seeds the page adds them (see the skill).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KINDS } from "./compare.mjs";

const byId = (a, b) => (a.id < b.id ? -1 : Number(a.id > b.id));

/** An area is `all` built when it has features and each is built, `part` when any is started. */
function progress(own) {
  if (own.length > 0 && own.every((f) => f.status === "built")) return "all";
  return own.some((f) => f.status === "built" || f.status === "building") ? "part" : "none";
}

/**
 * @param {Record<string, {id: string}[]>} facts
 * @param {{areas: object[], features: object[]}} map
 * @returns {Record<string, object>} document name to document body.
 */
export function buildDocs(facts, { areas, features }) {
  const list = (kind) => [...(facts[kind] ?? [])].sort(byId);
  const claimed = new Map(KINDS.map((k) => [k, new Set(features.flatMap((f) => f[k]))]));
  const unclaimed = (kind) => list(kind).filter((f) => !claimed.get(kind).has(f.id)).map((f) => f.id);
  const split = (id) => { const i = id.indexOf(" "); return i === -1 ? ["", id] : [id.slice(0, i), id.slice(i + 1)]; };
  return {
    meta: {
      counts: {
        areas: areas.length,
        features: features.length,
        built: features.filter((f) => f.status === "built").length,
        operations: list("operations").length,
        screens: list("screens").length,
        tables: list("tables").length,
      },
    },
    areas: {
      items: areas.map((a) => ({
        id: a.id, name: a.name, explanation: a.explanation, buildsOn: a.buildsOn,
        progress: progress(features.filter((f) => f.area === a.id)),
      })),
    },
    features: {
      items: areas.flatMap((a) => features.filter((f) => f.area === a.id)).map((f) => ({
        id: f.id, area: f.area, name: f.name, explanation: f.explanation, status: f.status,
        decisions: f.decisions, operations: f.operations, screens: f.screens, tables: f.tables,
      })),
    },
    system: {
      packages: [],
      operations: list("operations").map((o) => {
        const [method, path] = split(o.id);
        return { id: o.id, method: o.method ?? method, path: o.path ?? path, tag: o.tag ?? "" };
      }),
      screens: list("screens").map((s) => ({ site: s.site ?? "", route: s.id })),
      tables: list("tables").map((t) => t.id),
    },
    unclaimed: { operations: unclaimed("operations"), screens: unclaimed("screens"), tables: unclaimed("tables") },
  };
}

/** Writes each document as `<dir>/<name>.json`, two-space indented, with a final newline. */
export function writeDocs(dir, docs) {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(docs)) writeFileSync(join(dir, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
}
