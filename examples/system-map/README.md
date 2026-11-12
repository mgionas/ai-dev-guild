# System map starter

A starting point for a system map and the check that keeps it true: which feature owns each API
operation, screen and table, in plain words, and a check that refuses anything new nobody
described. Copy this folder into your project (`tools/system-map/`, say), edit one config file,
write your `docs/system-map/`, and run `node check.mjs`. The `system-map` skill in the plugin
says why and when; this is the code.

It needs Node.js 22 or later and one dependency, [`yaml`](https://www.npmjs.com/package/yaml)
(ISC licence), pinned in `package.json`. Run `npm ci` once.

## The layout

```text
system-map.config.json       where the facts come from (below)
docs/system-map/
  README.md                  what the map is, in your project's words
  areas.yaml                 the areas, in page order
  features/<area-id>.yaml    the features of that one area, and nothing else
  undescribed.yaml           the baseline: facts no feature describes yet; it only shrinks
```

`example/` is a small worked project with every file in place. Run it:

```bash
cd example && node ../check.mjs
```

**`areas.yaml`**: each area has `id` (kebab-case, also the name of its features file), `name`,
`explanation` (two or three plain sentences) and `buildsOn` (area ids it relies on, `[]` if none).

**`features/<area-id>.yaml`**: `features:` is a list (`[]` is fine, a missing file is not). Each
feature has `id` (kebab-case, unique across every file), `area` (this file's name), `name`,
`explanation`, `status` (`built`, `building` or `planned`), `operations`, `screens`, `tables`
(each a list of the facts it owns, written exactly as the check prints them) and `decisions`
(free text, for example the title of the note that records why). One file per area, so two
branches adding features to different areas never touch the same lines.

**`undescribed.yaml`**: `operations`, `screens` and `tables`, each a list. When you adopt the
check on an existing project, list there everything that already exists and no feature describes.
After that the list only shrinks: describing an item means moving it into a feature and deleting
its line here. A line listed twice is refused. Whether the list grew is only known by comparing it
with an earlier copy, so run the check with `--base <ref>` (the branch the change merges into, for
example `node check.mjs --base origin/main`) in CI and in the local gate: every entry must also be in
that ref's `undescribed.yaml`, and a new one is refused ("new items go to a feature, not the
baseline"). A ref that cannot be read refuses; a ref with no `undescribed.yaml` means the baseline is
being created, and the ok line says so. Without `--base` the ok line says the baseline was not
compared. In CI, fetch enough history for the ref to exist (`fetch-depth: 0`, or fetch the base branch).

Every key is required and an unknown key is refused: a misspelt `operatons:` would otherwise
describe nothing and still pass.

## What the check refuses

- an operation, screen or table that no feature claims and that is not in `undescribed.yaml`;
- a line in `undescribed.yaml` for something that no longer exists, or that a feature now claims,
  a line listed twice, and (with `--base`) a line the base ref does not have;
- one operation, screen or table claimed by two features, naming both. Something truly shared
  belongs to a feature of its own ("shared ...");
- a feature naming an operation, screen or table that does not exist in the code;
- a features file holding a feature of another area, a file in `features/` named after no area,
  an area with no file, a feature id used twice;
- an unknown or missing key in any YAML file or in the config, and a config that tracks no kind;
- a reader that cannot read its input (below). It stops the check and names the file; it never
  skips.

## Where the facts come from

The facts are read from the code, never typed. `system-map.config.json` names one reader for each
kind. A kind left out is not tracked (an API with no screens leaves `screens` out), and a feature
that names something of that kind is then refused.

| Kind | Reader | Config | A fact is |
| --- | --- | --- | --- |
| operations | `openapi` | `{"reader": "openapi", "file": "openapi.json"}` | `METHOD /path` from the document's `paths`, the path as written (a `servers` base path is not added) |
| screens | `routes` | `{"reader": "routes", "root": "src/app", "pattern": "^page\\.tsx$"}` | the folder of each file under `root` whose name matches `pattern`, as `/folder/sub` (`/` for the top) |
| tables | `sql` | `{"reader": "sql", "dir": "db/migrations"}` | a table left after replaying `CREATE TABLE`, `ALTER TABLE ... RENAME TO` and `DROP TABLE` in file-name order |

Paths in the config are relative to the config file's folder, and the map is read from
`docs/system-map/` beside it. The `sql` reader refuses any statement that mentions `TABLE` and is
neither one of those nor a harmless one (another `ALTER TABLE`, `COMMENT`, `GRANT`, `REVOKE`,
`TRUNCATE`, `LOCK`), because a table it did not understand is a table the map would never show.
Table names are compared without quotes and in lower case, otherwise as written. Files ending in
`.sql` are read in any letter case. A table made or changed inside a `$$` block (a function body,
`DO`) is refused, as is `DROP SCHEMA ... CASCADE`; dynamic SQL (`EXECUTE '...'`) is not read at all.

The `openapi` reader refuses a path item with a key it does not know (`$ref`, `query`,
`additionalOperations`, a misspelt method), because an operation could hide there. The `routes`
reader refuses a symbolic link under its folder rather than miss what it leads to.

### Your own reader

When none fits (routes declared in code, a schema in another format), write a module whose default
export returns the same shape and point the config at it with a path starting with `.`:

```js
// tools/system-map/my-routes.mjs
export default async function read(root, options) {
  // root: the config file's folder; options: the rest of the config entry
  return [{ id: "GET /health" }, { id: "POST /books" }];
}
```

```json
{ "operations": { "reader": "./my-routes.mjs", "anything": "your options" } }
```

Each item needs a unique text `id`. For operations you may add `method`, `path` and `tag`, and for
screens `site`; the page shows them. A reader that throws, or returns anything else, refuses.

## The page

`node check.mjs --out <dir>` writes the five documents the map page shows (`meta.json`,
`areas.json`, `features.json`, `system.json`, `unclaimed.json`), only when the check passes. The
same input gives the same bytes. `system.packages` is `[]`: this starter reads no workspace
packages. `meta` holds the counts and no date, so whoever seeds the page adds `updated` and
`changes`. The page template and how to publish it are in the plugin's `system-map` skill.

## Tests

```bash
npm ci
node --test '*.test.mjs'
```

The tests build small projects in a temporary folder (`fixture.mjs`) and break one thing each.
