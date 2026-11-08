---
name: project-map
description: "Create or refresh a visual map of the project from its code — a System view (apps, services and outside systems, and who talks to whom) and a Folders view (every folder and the job it does) — as one self-contained HTML page anyone can open. Use when someone new joins, when a project has grown hard to picture, and after merges that add a part or a folder."
---

People new to a project, and owners who do not read code, need a picture before they can follow
the steps. This skill draws one from the code itself, so it stays true.

## The rule that keeps it honest

Everything on the map is **read from the repository**, never written from memory:

- **Folders and their jobs:** the job of a folder is the first paragraph of its `AGENTS.md`, or
  failing that its `README.md`. A folder with neither is shown as "no stated job". Never invent a
  job to fill the gap: the gap is the finding.
- **Parts:** apps and packages from the workspace config, services from deploy and container
  files (`docker-compose`, platform config, CI), databases and outside services from config files
  and the dependencies that talk to them.
- **Links:** who calls whom, from the code (HTTP clients, database clients, queues, SDKs) and the
  deploy config. A link you cannot point to in a file does not go on the map.
- **Configuration:** the names of settings at most. Never a value, never a secret, a key or a URL
  with credentials, never personal data. Scan the finished data for them before you write the page.

Skip what makes the map noisy: dependency folders, build output, caches, generated files and test
folders (count them if useful, do not list them).

## Steps

1. Collect the facts above into the data shape below.
2. Take the HTML inside the code block of `map-template.md` in this skill's folder and write it to
   `docs/map/index.html` (or the path the user gives) and replace only the content of the `<script id="map-data">` block with the data, serialised as
   JSON with every `<` written as `\u003c`, so no text inside it can end the block.
3. Open the page or describe it, and list the folders with no stated job: each is a small task for
   the docs or the builder who owns that folder.
4. If the project can publish a page others open in a browser (a hosted page or an artifact),
   publish the same file there. The repository copy stays the source.
5. Refresh the map after merges that add a part, a link or a folder: the `progress-boards` skill
   lists it beside the roadmap.

## The data shape

```json
{
  "project": "name",
  "generated": "YYYY-MM-DD",
  "commit": "short sha",
  "system": {
    "parts": [
      {
        "id": "api",
        "name": "API",
        "kind": "app | package | service | outside",
        "job": "one line"
      }
    ],
    "links": [{ "from": "api", "to": "db", "label": "SQL" }]
  },
  "folders": [
    { "path": "src/api", "job": "first paragraph of its AGENTS.md, or empty" }
  ]
}
```

Kinds: `app` is something you build and deploy, `package` is shared code, `service` is something
you run or rent for the project (a database, a queue), `outside` is a third party you call (email,
payments).

The page draws the System view with Mermaid (loaded from a CDN at a pinned version), follows the
reader's light or dark setting, and works on a phone. A link naming an unknown part is skipped,
not drawn.

If the project also keeps a `system-map` check (features, operations, screens and tables), this
page is its picture: build both from the same facts.
