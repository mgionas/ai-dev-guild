import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ESCALATE,
  STEPS,
  classify,
  judgeSelection,
  parseArgs,
  runStep,
  tail,
} from "./ci-local.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
// The workflow and package.json are fixtures a person wrote, never files this test generated:
// the test must read what a project keeps and compare it with STEPS.
const workflow = read("./fixtures/ci.yml");
const scripts = JSON.parse(read("./fixtures/package.json")).scripts;

// The expected lists are written out here on purpose. Building them from STEPS would make the
// comparison circular: dropping, reordering or renaming a step there would still pass.
const EXPECTED_STEPS = [
  { name: "format", run: "npx prettier --check ." },
  { name: "lint", run: "npx turbo run lint --concurrency={cores}" },
  { name: "typecheck", run: "npx turbo run typecheck --concurrency={cores}" },
  {
    name: "test",
    run: "npx turbo run test --concurrency={cores} -- --maxWorkers={cores}",
  },
  { name: "build", run: "npx turbo run build --concurrency={cores}" },
  { name: "e2e", run: "npm run test:e2e" },
];

// The only steps the workflow may have. Setup and install are the workflow's own, because a CI
// runner starts empty and a developer machine does not; the last line is the whole of STEPS.
const EXPECTED_WORKFLOW = [
  { uses: "actions/checkout" },
  { uses: "actions/setup-node" },
  { run: "npm ci" },
  { run: "node scripts/ci-local/ci-local.mjs --full" },
];

const indentOf = (line) => line.length - line.trimStart().length;

/** Reads the workflow's steps whatever their shape: `- run:`, `- name:` then `run:`, `run: |` blocks, `uses:`. */
function workflowSteps(text) {
  const lines = text.split("\n");
  const steps = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*steps:\s*$/.test(lines[i])) continue;
    const stepsIndent = indentOf(lines[i]);
    let current = null;
    let itemIndent = null;
    for (i += 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (indentOf(line) <= stepsIndent) {
        i -= 1;
        break;
      }
      const isItem = line.trimStart().startsWith("- ");
      if (isItem && (itemIndent === null || indentOf(line) === itemIndent)) {
        itemIndent = indentOf(line);
        current = {};
        steps.push(current);
      }
      // The dash counts as indentation, so the step's own keys all sit two columns right of it; deeper ones (`with:`)
      // belong to the step's inputs.
      const content = isItem && indentOf(line) === itemIndent ? line.replace("- ", "  ") : line;
      const keyIndent = indentOf(content);
      if (keyIndent !== itemIndent + 2) continue;
      const match = content.trim().match(/^(uses|run):\s*(.*)$/);
      if (!match) continue;
      let value = match[2].replace(/\s+#.*$/, "");
      if (/^[|>][+-]?$/.test(value)) {
        const block = [];
        while (i + 1 < lines.length && (!lines[i + 1].trim() || indentOf(lines[i + 1]) > keyIndent)) {
          i += 1;
          block.push(lines[i].trim());
        }
        value = block.join("\n").trim();
      }
      current[match[1]] = match[1] === "uses" ? value.split("@")[0] : value;
    }
  }
  return steps;
}

test("the workflow has exactly the expected steps, in order", () => {
  assert.deepEqual(workflowSteps(workflow), EXPECTED_WORKFLOW);
});

test("a workflow with an extra step, in any shape, is rejected", () => {
  const named = `${workflow}      - name: extra\n        run: npm run lint\n`;
  const block = `${workflow}      - run: |\n          npm run lint\n          npm test\n`;
  assert.notDeepEqual(workflowSteps(named), EXPECTED_WORKFLOW);
  assert.notDeepEqual(workflowSteps(block), EXPECTED_WORKFLOW);
  assert.deepEqual(workflowSteps(block).at(-1), { run: "npm run lint\nnpm test" });
  assert.deepEqual(workflowSteps(named).at(-1), { run: "npm run lint" });
});

test("STEPS is the pinned list: names and commands, in order", () => {
  assert.deepEqual(
    STEPS.map(({ name, run }) => ({ name, run })),
    EXPECTED_STEPS,
  );
});

test("the workflow installs before it runs the check", () => {
  const runs = workflowSteps(workflow).map((step) => step.run);
  assert.ok(runs.indexOf("npm ci") < runs.indexOf("node scripts/ci-local/ci-local.mjs --full"));
});

test("every npm script a step runs exists in the project's package.json", () => {
  for (const step of STEPS) {
    const script = step.run.match(/^npm run (\S+)/)?.[1];
    if (script) assert.ok(scripts[script], `${step.name}: "${step.run}" is not a package.json script`);
  }
});

test("the narrow form of a step runs the same task as the full one", () => {
  for (const step of STEPS.filter((candidate) => candidate.affected)) {
    const task = step.run.match(/^npx turbo run (\S+)/)?.[1];
    assert.ok(step.affected.startsWith(`npx turbo run ${task} `), `${step.name}: affected form differs`);
  }
});

test("the test step caps workers at the runner core count, in both forms", () => {
  const step = STEPS.find((candidate) => candidate.name === "test");
  assert.match(step.run, / -- --maxWorkers=\{cores\}$/);
  assert.match(step.affected, / -- --maxWorkers=\{cores\}$/);
});

test("parseArgs: flags and values are read", () => {
  assert.deepEqual(parseArgs(["--full", "--dry-run", "--retry", "--probe", "--base", "dev", "--out", "/x"]), {
    full: true,
    dryRun: true,
    retry: true,
    probe: true,
    base: "dev",
    out: "/x",
    problem: null,
  });
});

test("parseArgs: an unknown option or a missing value is refused, not ignored", () => {
  assert.match(parseArgs(["--skip-lint"]).problem, /unknown argument --skip-lint/);
  assert.match(parseArgs(["--base"]).problem, /needs a value/);
  assert.match(parseArgs(["--out", "--full"]).problem, /needs a value/);
  // A key from outside must not match an inherited name.
  assert.match(parseArgs(["constructor"]).problem, /unknown argument/);
});

test("classify: every file that reaches everything escalates", () => {
  for (const file of [
    ".github/workflows/ci.yml",
    "scripts/ci-local/ci-local.mjs",
    "scripts/ci-local/retry.mjs",
    "package.json",
    "turbo.json",
    "tsconfig.base.json",
    ".nvmrc",
    ".npmrc",
    ".prettierrc.json",
    ".prettierignore",
    "eslint.config.js",
  ]) {
    const scope = classify([file]);
    assert.equal(scope.full, true, file);
    assert.match(scope.why, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.ok(ESCALATE.length > 0);
});

test("classify: inert files are narrow and reach no package", () => {
  assert.deepEqual(classify(["docs/handover.md", "README.md"]), {
    full: false,
    reachesPackages: false,
  });
});

test("classify: an unknown file means the full run, never less", () => {
  assert.equal(classify(["Dockerfile"]).full, true);
  assert.equal(classify(["tools/x.js"]).full, true);
  assert.match(classify(["Dockerfile", "docs/a.md"]).why, /Dockerfile .*not known to be inert/);
  // Unknown beside a package file still escalates.
  assert.equal(classify(["apps/web/a.ts", "tools/x.js"]).full, true);
});

test("classify: a package file is narrow and reaches packages", () => {
  assert.deepEqual(classify(["apps/api/src/x.ts", "docs/a.md"]), {
    full: false,
    reachesPackages: true,
  });
});

test("classify: an empty list is the full run, not a skip", () => {
  assert.equal(classify([]).full, true);
});

test("classify: an added-only lockfile reaches packages, a changed one escalates", () => {
  assert.deepEqual(classify(["package-lock.json"], "added-only"), {
    full: false,
    reachesPackages: true,
  });
  assert.equal(classify(["package-lock.json"], "changed").full, true);
  assert.equal(classify(["package-lock.json"]).full, true);
});

test("classify: a rename lists both paths, so a move out of a package is not inert", () => {
  assert.deepEqual(classify(["apps/api/src/x.ts", "docs/x.ts"]), {
    full: false,
    reachesPackages: true,
  });
  assert.equal(classify(["turbo.json", "docs/turbo.json"]).full, true);
});

test("judgeSelection: an empty selection means the full run", () => {
  const all = { packages: ["//", "@a/one", "@a/two"] };
  const verdict = judgeSelection({ packages: [] }, all);
  assert.equal(verdict.full, true);
  assert.match(verdict.why, /selected no package/);
  assert.equal(judgeSelection({ packages: ["//"] }, all).full, true);
});

test("judgeSelection: an unreadable answer means the full run", () => {
  assert.equal(judgeSelection(null, { packages: ["@a/one"] }).full, true);
  assert.equal(judgeSelection({ packages: ["@a/one"] }, null).full, true);
  assert.equal(judgeSelection({ packages: ["@a/one"] }, { packages: [] }).full, true);
});

test("judgeSelection: a package the build tool does not list means the full run", () => {
  assert.equal(judgeSelection({ packages: ["@a/ghost"] }, { packages: ["@a/one"] }).full, true);
});

test("judgeSelection: a real selection names its reach", () => {
  const all = { packages: ["//", "@a/one", "@a/two", "@a/three"] };
  assert.deepEqual(judgeSelection({ packages: ["//", "@a/one", "@a/two"] }, all), {
    full: false,
    reach: "2 of 3 packages",
  });
});

test("tail keeps only the last lines", () => {
  assert.equal(tail("a\nb\nc\nd", 2), "c\nd");
});

test("a failing step prints the tail of its log and returns its exit code", () => {
  const out = mkdtempSync(join(tmpdir(), "ci-local-test-"));
  const printed = [];
  const { code } = runStep({
    name: "stub",
    command: `node -e "console.log('why it failed'); process.exit(3)"`,
    env: process.env,
    out,
    log: (line) => printed.push(line),
  });
  assert.equal(code, 3);
  assert.match(printed.join("\n"), /why it failed/);
  assert.match(readFileSync(join(out, "stub.log"), "utf8"), /why it failed/);
});

test("a passing step prints nothing", () => {
  const out = mkdtempSync(join(tmpdir(), "ci-local-test-"));
  const printed = [];
  const { code } = runStep({
    name: "ok",
    command: 'node -e "0"',
    env: process.env,
    out,
    log: (line) => printed.push(line),
  });
  assert.equal(code, 0);
  assert.deepEqual(printed, []);
});
