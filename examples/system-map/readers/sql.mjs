/**
 * Reads the tables from SQL migration files: it replays `CREATE TABLE`, `ALTER TABLE ... RENAME TO`
 * and `DROP TABLE` in file-name order and returns the tables left at the end. Names are compared
 * without quotes and in lower case, exactly as written otherwise (`public.invoice` and `invoice`
 * are two names, so write them one way).
 *
 * Fails closed. A statement that mentions TABLE and is none of the forms above, or one of the
 * few harmless ones (other `ALTER TABLE` changes, `COMMENT`, `GRANT`, `REVOKE`, `TRUNCATE`,
 * `LOCK`), throws with the file's name rather than being skipped: a table this reader did not
 * understand would be a table the map never sees. So does a drop or rename of a table that was
 * never created, a `DROP SCHEMA ... CASCADE`, a `$$` block that creates or changes a table, and
 * an unfinished string, comment or `$$` block. Dynamic SQL (`EXECUTE '...'`) is not read.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const NAME = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?`;
const CREATE = new RegExp(String.raw`^CREATE\s+(?:(?:GLOBAL\s+|LOCAL\s+)?(TEMP|TEMPORARY)\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${NAME})`, "i");
const DROP = new RegExp(String.raw`^DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(${NAME}(?:\s*,\s*${NAME})*)(?:\s+(?:CASCADE|RESTRICT))?$`, "i");
const RENAME = new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${NAME})\s+RENAME\s+TO\s+(${NAME})$`, "i");
// Any other ALTER TABLE, except the two that change a table's name or schema.
const ALTER_OTHER = new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${NAME}\s+(?!RENAME\s+TO\b|SET\s+SCHEMA\b)\S`, "i");
const HARMLESS = /^(?:COMMENT\s+ON|TRUNCATE|GRANT|REVOKE|LOCK)\b/i;

/**
 * Splits SQL text into statements. Comments are dropped and the inside of string literals and
 * `$tag$ ... $tag$` blocks is blanked, so a word inside them can neither start a statement nor
 * hide one. Double-quoted names are kept: they are table names.
 *
 * @returns {string[]} the statements, whitespace collapsed, without the final `;`.
 */
export function statementsOf(text, file) {
  const out = [];
  let cur = "";
  let i = 0;
  const end = (what) => { throw new Error(`${file}: ${what} is never closed`); };
  while (i < text.length) {
    const c = text[i];
    const two = text.slice(i, i + 2);
    if (two === "--") { const n = text.indexOf("\n", i); i = n === -1 ? text.length : n; continue; }
    if (two === "/*") { const n = text.indexOf("*/", i + 2); if (n === -1) end("a /* comment"); i = n + 2; cur += " "; continue; }
    if (c === "'") {
      let j = i + 1;
      // E'...' is the one string where a backslash escapes the next character, quote included.
      const escapes = /[eE]/.test(text[i - 1] ?? "") && !/[\w$]/.test(text[i - 2] ?? "");
      for (;;) {
        if (j >= text.length) end("a string");
        if (escapes && text[j] === "\\") j += 2;
        else if (text[j] === "'" && text[j + 1] === "'") j += 2;
        else if (text[j] === "'") break;
        else j++;
      }
      cur += "''"; i = j + 1; continue;
    }
    if (c === '"') {
      const n = text.indexOf('"', i + 1);
      if (n === -1) end('a "quoted name"');
      cur += text.slice(i, n + 1); i = n + 1; continue;
    }
    if (c === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(text.slice(i))?.[0];
      if (tag) {
        const n = text.indexOf(tag, i + tag.length);
        if (n === -1) end(`a ${tag} block`);
        // The inside is blanked below, so a table made in there would never be seen: refuse it instead.
        if (/\b(?:CREATE|DROP|ALTER)\s+(?:\w+\s+)*TABLE\b/i.test(text.slice(i + tag.length, n))) {
          throw new Error(`${file}: a ${tag} block creates or changes a table; write it as a plain statement`);
        }
        cur += "''"; i = n + tag.length; continue;
      }
    }
    if (c === ";") { out.push(cur); cur = ""; i++; continue; }
    cur += c; i++;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const clean = (name) => name.replaceAll('"', "").toLowerCase();

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : Number(a.name > b.name)))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
}

/**
 * @param {string} root - the folder the config file is in.
 * @param {{dir: string}} options - the folder of `.sql` files; subfolders are read too.
 * @returns {Promise<{id: string}[]>}
 */
export default async function readSql(base, { dir }) {
  const top = resolve(base, dir);
  let files;
  try {
    if (!statSync(top).isDirectory()) throw new Error("not a folder");
    files = walk(top).filter((f) => f.toLowerCase().endsWith(".sql"));
  } catch (error) {
    throw new Error(`${dir}: cannot read the migrations folder (${error.message})`);
  }
  if (files.length === 0) throw new Error(`${dir}: no .sql file, so no table was found`);
  const tables = new Set();
  for (const path of files) {
    const file = relative(base, path).split(sep).join("/");
    for (const sql of statementsOf(readFileSync(path, "utf8"), file)) {
      if (/^DROP\s+SCHEMA\b.*\bCASCADE$/i.test(sql)) throw new Error(`${file}: DROP SCHEMA ... CASCADE is not understood: it drops tables this reader cannot list`);
      // Test for the word on a copy without the quoted names, so a column called "table" is not a table statement.
      if (!/\bTABLE\b/i.test(sql.replace(/"[^"]*"/g, '""'))) continue;
      let m;
      if ((m = CREATE.exec(sql))) { if (!m[1]) tables.add(clean(m[2])); continue; }
      if ((m = RENAME.exec(sql))) {
        const from = clean(m[1]);
        if (!tables.delete(from)) throw new Error(`${file}: renames the table ${from}, which no earlier statement created`);
        const schema = from.includes(".") ? from.split(".")[0] + "." : "";
        tables.add(schema + clean(m[2]).split(".").at(-1));
        continue;
      }
      if ((m = DROP.exec(sql))) {
        for (const raw of m[2].split(",")) {
          const name = clean(raw.trim());
          if (!tables.delete(name) && !m[1]) throw new Error(`${file}: drops the table ${name}, which no earlier statement created`);
        }
        continue;
      }
      if (ALTER_OTHER.test(sql) || HARMLESS.test(sql)) continue;
      throw new Error(`${file}: a statement that mentions TABLE is not understood: ${sql.slice(0, 70)}`);
    }
  }
  return [...tables].sort().map((id) => ({ id }));
}
