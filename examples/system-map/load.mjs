/**
 * Reads what people write: `docs/system-map/areas.yaml`, one `features/<area-id>.yaml` per area
 * and `undescribed.yaml`, and the config file that says where the facts come from.
 *
 * Every shape is checked here and every problem names its file. An unknown key is refused (a
 * misspelt `operatons:` would otherwise describe nothing and pass), and so is a missing one.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const MAP_DIR = "docs/system-map";
export const STATUSES = ["built", "building", "planned"];
const KINDS = ["operations", "screens", "tables"];
const READER_KEYS = new Map([
  ["openapi", ["reader", "file"]],
  ["routes", ["reader", "root", "pattern"]],
  ["sql", ["reader", "dir"]],
]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// The one file a macOS Finder leaves in a folder it opened. Any other stray file is refused, not skipped.
const IGNORED = ".DS_Store";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x !== "");

/** Reads and parses one YAML file, putting the file's name on a syntax error. */
function readYaml(base, name) {
  const path = join(base, name);
  const shown = `${MAP_DIR}/${name}`;
  if (!existsSync(path)) throw new Error(`${shown}: file not found`);
  if (statSync(path).isDirectory()) throw new Error(`${shown}: is a folder, not a .yaml file`);
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${shown}: ${error.message}`);
  }
}

/** Checks one object's keys against the exact list; pushes a problem per unknown or missing key. */
function keys(obj, where, required, optional, problems) {
  if (!isObject(obj)) { problems.push(`${where}: must be a mapping`); return false; }
  for (const k of Object.keys(obj)) {
    if (!required.includes(k) && !optional.includes(k)) problems.push(`${where}: unknown key "${k}"`);
  }
  for (const k of required) {
    if (!Object.hasOwn(obj, k)) problems.push(`${where}: missing key "${k}"`);
  }
  return true;
}

/**
 * @param {string} base - the folder the config file is in.
 * @returns {{areas: object[], features: object[], undescribed: Record<string, string[]>, problems: string[]}}
 */
export function loadMap(base) {
  const problems = [];
  const dir = join(base, MAP_DIR);
  const rel = (name) => `${MAP_DIR}/${name}`;
  let areas = [];
  let features = [];
  const undescribed = { operations: [], screens: [], tables: [] };

  // areas.yaml
  try {
    const doc = readYaml(dir, "areas.yaml");
    if (keys(doc, rel("areas.yaml"), ["areas"], [], problems) && Array.isArray(doc.areas)) {
      doc.areas.forEach((a, i) => {
        const where = `${rel("areas.yaml")} area ${i + 1}`;
        if (!keys(a, where, ["id", "name", "explanation", "buildsOn"], [], problems)) return;
        if (typeof a.id !== "string" || !ID.test(a.id)) problems.push(`${where}: id must be kebab-case`);
        for (const k of ["name", "explanation"]) if (typeof a[k] !== "string" || a[k] === "") problems.push(`${where}: ${k} must be a non-empty string`);
        if (!isStrings(a.buildsOn)) problems.push(`${where}: buildsOn must be a list of area ids (an empty list is fine)`);
        areas.push(a);
      });
    } else if (isObject(doc) && Object.hasOwn(doc, "areas")) problems.push(`${rel("areas.yaml")}: areas must be a list`);
  } catch (error) { problems.push(error.message); }

  const areaIds = new Map();
  for (const a of areas) {
    if (areaIds.has(a.id)) problems.push(`${rel("areas.yaml")}: the area id "${a.id}" is used twice`);
    areaIds.set(a.id, a);
  }
  for (const a of areas) {
    for (const b of Array.isArray(a.buildsOn) ? a.buildsOn : []) {
      if (!areaIds.has(b)) problems.push(`${rel("areas.yaml")}: area "${a.id}" builds on "${b}", which is not an area`);
      if (b === a.id) problems.push(`${rel("areas.yaml")}: area "${a.id}" builds on itself`);
    }
  }

  // features/<area-id>.yaml, one per area, read in the order of areas.yaml
  const featureDir = join(dir, "features");
  const present = existsSync(featureDir) ? readdirSync(featureDir).filter((f) => f !== IGNORED).sort() : [];
  if (!existsSync(featureDir)) problems.push(`${rel("features")}: folder not found`);
  for (const f of present) {
    if (!f.endsWith(".yaml") || !areaIds.has(f.slice(0, -5))) problems.push(`${rel("features/" + f)}: is not named after an area (<area-id>.yaml)`);
  }
  const seen = new Map();
  for (const area of areas) {
    const name = `features/${area.id}.yaml`;
    if (!present.includes(`${area.id}.yaml`)) { problems.push(`${rel(name)}: file not found (an area with no features still needs "features: []")`); continue; }
    try {
      const doc = readYaml(dir, name);
      if (!keys(doc, rel(name), ["features"], [], problems)) continue;
      if (!Array.isArray(doc.features)) { if (Object.hasOwn(doc, "features")) problems.push(`${rel(name)}: features must be a list`); continue; }
      doc.features.forEach((f, i) => {
        const where = `${rel(name)} feature ${i + 1}`;
        if (!keys(f, where, ["id", "area", "name", "explanation", "status", "operations", "screens", "tables", "decisions"], [], problems)) return;
        if (typeof f.id !== "string" || !ID.test(f.id)) problems.push(`${where}: id must be kebab-case`);
        else if (seen.has(f.id)) problems.push(`${where}: the feature id "${f.id}" is already used in ${seen.get(f.id)}`);
        else seen.set(f.id, rel(name));
        if (f.area !== area.id) problems.push(`${where}: area is "${f.area}" but this file belongs to "${area.id}"`);
        for (const k of ["name", "explanation"]) if (typeof f[k] !== "string" || f[k] === "") problems.push(`${where}: ${k} must be a non-empty string`);
        if (!STATUSES.includes(f.status)) problems.push(`${where}: status must be one of ${STATUSES.join(", ")}`);
        for (const k of [...KINDS, "decisions"]) if (!isStrings(f[k])) problems.push(`${where}: ${k} must be a list of strings (an empty list is fine)`);
        features.push({ ...f, file: rel(name) });
      });
    } catch (error) { problems.push(error.message); }
  }

  // undescribed.yaml, the baseline
  try {
    const doc = readYaml(dir, "undescribed.yaml");
    if (keys(doc, rel("undescribed.yaml"), KINDS, [], problems)) {
      for (const k of KINDS) {
        if (isStrings(doc[k])) undescribed[k] = doc[k];
        else if (Object.hasOwn(doc, k)) problems.push(`${rel("undescribed.yaml")}: ${k} must be a list of strings (an empty list is fine)`);
      }
    }
  } catch (error) { problems.push(error.message); }

  return { areas, features, undescribed, problems };
}

/**
 * Reads the config: which reader finds each kind of fact. A kind left out is not tracked.
 *
 * @returns {{config: Record<string, object>, problems: string[]}}
 */
export function loadConfig(path) {
  const problems = [];
  const name = path.split(/[\\/]/).at(-1);
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); } catch (error) { return { config: {}, problems: [`${name}: cannot read the config (${error.message})`] }; }
  const config = {};
  if (!keys(doc, name, [], KINDS, problems)) return { config, problems };
  for (const kind of KINDS) {
    if (!Object.hasOwn(doc, kind)) continue;
    const entry = doc[kind];
    if (!isObject(entry) || typeof entry.reader !== "string") { problems.push(`${name}: ${kind} needs a "reader"`); continue; }
    // A reader is a built-in name, or the path of the project's own module (starting with ".").
    const own = entry.reader.startsWith(".");
    const allowed = own ? null : READER_KEYS.get(entry.reader);
    if (!own && !allowed) { problems.push(`${name}: ${kind}: unknown reader "${entry.reader}" (openapi, routes, sql, or a path starting with ".")`); continue; }
    if (!own) {
      keys(entry, `${name}: ${kind}`, allowed, [], problems);
      for (const k of allowed) if (Object.hasOwn(entry, k) && (typeof entry[k] !== "string" || entry[k] === "")) problems.push(`${name}: ${kind}: "${k}" must be a non-empty string`);
    }
    config[kind] = entry;
  }
  return { config, problems };
}
