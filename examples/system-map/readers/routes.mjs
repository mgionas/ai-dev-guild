/**
 * Reads the screens from a folder of route files: every file under `root` whose name matches
 * `pattern` is one screen, and its id is the folder it sits in, relative to `root`, written with
 * slashes (`/` for the top folder). No framework is assumed: the project says which file name
 * marks a screen (for example `page.tsx`, or `index.html`).
 *
 * Fails closed: a missing folder, a pattern that is not a regular expression, or a folder with no
 * matching file throws with the folder's name. A map with no screens leaves `screens` out of the
 * config instead.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Folders that never hold a route and can hold thousands of files.
const SKIP = new Set(["node_modules", ".git"]);

function walk(dir, top) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : Number(a.name > b.name)))
    .flatMap((entry) => {
      if (SKIP.has(entry.name)) return [];
      const path = join(dir, entry.name);
      // A link could lead to routes we would not list, or in a loop: refuse it rather than miss it.
      if (entry.isSymbolicLink()) throw new Error(`${relative(top, path).split(sep).join("/")}: a symbolic link under the route folder is not followed`);
      return entry.isDirectory() ? walk(path, top) : [path];
    });
}

/**
 * @param {string} root - the folder the config file is in.
 * @param {{root: string, pattern: string}} options - `pattern` is tested against the file name only.
 * @returns {Promise<{id: string, site: string}[]>}
 */
export default async function readRoutes(base, { root, pattern }) {
  const top = resolve(base, root);
  let matcher;
  try {
    matcher = new RegExp(pattern);
  } catch (error) {
    throw new Error(`${root}: the file name pattern ${JSON.stringify(pattern)} is not a regular expression (${error.message})`);
  }
  let files;
  try {
    if (!statSync(top).isDirectory()) throw new Error("not a folder");
    files = walk(top, top);
  } catch (error) {
    throw new Error(`${root}: cannot read the route folder (${error.message})`);
  }
  const site = root.split(/[\\/]/).filter(Boolean).at(-1) ?? root;
  const found = files
    .filter((file) => matcher.test(file.split(sep).at(-1)))
    .map((file) => {
      const folder = relative(top, join(file, ".."));
      return { id: "/" + folder.split(sep).filter(Boolean).join("/"), site };
    });
  if (found.length === 0) {
    throw new Error(`${root}: no file matches ${JSON.stringify(pattern)}, so no screen was found (a wrong folder or pattern would otherwise read as "no screens")`);
  }
  return found;
}
