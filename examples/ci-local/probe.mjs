/**
 * Optional part, off unless `--probe` is given: after each step, the working tree must look the way
 * it did before the step. A step that rewrites a file (a formatter, a code generator, a lockfile
 * refresh) passes on a machine where someone commits the result and fails in CI, where nothing
 * does; this finds it here and names the files.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Splits `git status --porcelain=v1 -z` output into [status, path] pairs. A rename or copy carries
 * its old path as a second, status-less field, which is listed too: both sides changed.
 *
 * @param {string} text - the raw output.
 * @returns {[string, string][]} status code and path, one pair per path.
 */
export function parseStatus(text) {
  const fields = text.split("\0").filter(Boolean);
  const pairs = [];
  for (let i = 0; i < fields.length; i += 1) {
    const status = fields[i].slice(0, 2);
    pairs.push([status, fields[i].slice(3)]);
    if (/[RC]/.test(status) && i + 1 < fields.length) {
      i += 1;
      pairs.push([status, fields[i]]);
    }
  }
  return pairs;
}

/**
 * A fingerprint of every path git reports as changed or untracked: its status and a hash of its
 * content. Content matters because a step that rewrites a file already modified leaves the status
 * line as it was.
 *
 * @param {string} root - the checkout.
 * @param {(args: string[]) => string | null} [git] - git's stdout or null on failure; replaceable in tests.
 * @param {(path: string) => Buffer | null} [read] - a file's bytes, null when it is gone; replaceable in tests.
 * @returns {Map<string, string> | null} path to fingerprint, or null when git could not answer.
 */
export function snapshot(
  root,
  git = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return result.status === 0 ? result.stdout : null;
  },
  read = (path) => {
    try {
      return readFileSync(join(root, path));
    } catch {
      return null;
    }
  },
) {
  const out = git([
    "-c",
    "core.quotePath=false",
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (out === null) return null;
  const state = new Map();
  for (const [status, path] of parseStatus(out)) {
    const bytes = read(path);
    const hash = bytes ? createHash("sha256").update(bytes).digest("hex") : "gone";
    state.set(path, `${status}:${hash}`);
  }
  return state;
}

/**
 * Compares two snapshots. A snapshot git could not take means "unknown", which is a failure: a check
 * that cannot look must not report that it saw nothing.
 *
 * @param {Map<string, string> | null} before - taken before the step.
 * @param {Map<string, string> | null} after - taken after it.
 * @returns {string | null} the complaint for the step's log, or null when nothing changed.
 */
export function probeProblem(before, after) {
  if (before === null || after === null)
    return "probe: git could not report the working tree, so the step cannot be shown to leave it alone";
  const changed = [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();
  if (changed.length === 0) return null;
  return `probe: the step changed the working tree: ${changed.join(", ")}`;
}
