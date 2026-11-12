/**
 * Test helper: builds a small project in a temporary folder from a base set of files, with any
 * of them replaced or removed (`null`), so each test states only what it breaks.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const BASE = {
  "system-map.config.json": JSON.stringify({
    operations: { reader: "openapi", file: "openapi.json" },
    screens: { reader: "routes", root: "app", pattern: "^page\\.tsx$" },
    tables: { reader: "sql", dir: "migrations" },
  }),
  "openapi.json": JSON.stringify({
    paths: {
      "/books": { get: { tags: ["books"] }, post: {} },
      "/health": { get: {} },
    },
  }),
  "app/books/page.tsx": "",
  "app/page.tsx": "",
  "migrations/0001.sql": "CREATE TABLE book (id int);\nCREATE TABLE audit_log (id int);\n",
  "docs/system-map/areas.yaml": "areas:\n  - id: catalog\n    name: Catalog\n    explanation: The books.\n    buildsOn: []\n  - id: shelf\n    name: Shelf\n    explanation: Where they sit.\n    buildsOn: [catalog]\n",
  "docs/system-map/features/catalog.yaml":
    "features:\n  - id: list-books\n    area: catalog\n    name: List books\n    explanation: See the books.\n    status: built\n    operations: ['GET /books']\n    screens: ['/books']\n    tables: [book]\n    decisions: []\n",
  "docs/system-map/features/shelf.yaml": "features: []\n",
  "docs/system-map/undescribed.yaml": "operations: ['POST /books', 'GET /health']\nscreens: ['/']\ntables: [audit_log]\n",
};

/** Writes BASE with `changes` applied to a new temp folder and returns the config file's path. */
export function project(changes = {}) {
  const dir = mkdtempSync(join(tmpdir(), "system-map-"));
  const files = { ...BASE, ...changes };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return join(dir, "system-map.config.json");
}
