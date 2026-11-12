/**
 * Reads the API operations from an OpenAPI JSON document, one per method and path, as
 * `METHOD /path` (the method in capitals, the path as the document writes it).
 *
 * Paths are taken as written: a `servers` base path is not added. Fails closed: a missing file, text that is not JSON, or a document with no `paths` object
 * throws with the file's name. An empty `paths` is a real answer (an API with no routes yet).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The methods OpenAPI allows on a path. Anything else under a path (parameters, summary) is not an operation.
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

// The other keys a path item may hold. Anything else (`$ref`, `query`, `additionalOperations`) may hide operations this reader would miss.
const ITEM_KEYS = ["parameters", "summary", "description", "servers"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * @param {string} root - the folder the config file is in.
 * @param {{file: string}} options
 * @returns {Promise<{id: string, method: string, path: string, tag: string}[]>}
 */
export default async function readOpenApi(root, { file }) {
  const path = resolve(root, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${file}: cannot read the OpenAPI document (${error.message})`);
  }
  if (!isObject(doc) || !isObject(doc.paths)) {
    throw new Error(`${file}: no "paths" object, so it is not an OpenAPI document`);
  }
  const found = [];
  for (const [route, item] of Object.entries(doc.paths)) {
    if (!isObject(item)) throw new Error(`${file}: the path ${route} is not an object`);
    for (const key of Object.keys(item)) {
      if (!METHODS.includes(key) && !ITEM_KEYS.includes(key) && !key.startsWith("x-")) {
        throw new Error(`${file}: the path ${route} has "${key}", which this reader cannot read (an operation could hide in it)`);
      }
    }
    for (const method of METHODS) {
      if (!Object.hasOwn(item, method)) continue;
      const op = item[method];
      const tag = isObject(op) && Array.isArray(op.tags) && typeof op.tags[0] === "string" ? op.tags[0] : "";
      found.push({ id: `${method.toUpperCase()} ${route}`, method: method.toUpperCase(), path: route, tag });
    }
  }
  return found;
}
