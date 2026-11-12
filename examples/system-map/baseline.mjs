/**
 * The baseline only shrinks. It lives in a file people edit, so the check compares it with the
 * copy at a git ref (the branch the change will merge into) and refuses every entry that is not
 * there: a new item goes to a feature, never to the baseline.
 */
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { KINDS } from "./compare.mjs";
import { MAP_DIR } from "./load.mjs";

const FILE = `${MAP_DIR}/undescribed.yaml`;

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0 && !r.error, out: r.stdout ?? "", err: (r.error?.message ?? r.stderr ?? "").trim() };
}

/**
 * @param {string} base - the folder the config file is in (git runs there).
 * @param {string} ref - a commit, branch or tag.
 * @param {Record<string, string[]>} undescribed - the baseline as it is now.
 * @returns {{problems: string[], note: string}} `note` goes in the ok line.
 */
export function compareBaseline(base, ref, undescribed) {
  const fail = (why) => ({ problems: [`--base ${ref}: cannot read the baseline there (${why})`], note: "" });
  if (ref.startsWith("-")) return fail("a ref cannot start with a dash");
  const commit = git(base, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (!commit.ok) return fail(commit.err || "not a commit in this repository");
  // ls-tree tells "the file is not there" (the baseline is being created) from "git could not look".
  const listed = git(base, ["ls-tree", "--name-only", ref, "--", FILE]);
  if (!listed.ok) return fail(listed.err);
  if (listed.out.trim() === "") return { problems: [], note: `baseline created: ${ref} has no undescribed.yaml` };
  const shown = git(base, ["show", `${ref}:./${FILE}`]);
  if (!shown.ok) return fail(shown.err);
  let old;
  try { old = parse(shown.out); } catch (error) { return fail(error.message); }
  const problems = [];
  for (const kind of KINDS) {
    const list = old && typeof old === "object" && Array.isArray(old[kind]) ? old[kind] : null;
    if (!list) return fail(`${FILE} there has no list "${kind}"`);
    const before = new Set(list);
    for (const id of undescribed[kind]) {
      if (!before.has(id)) problems.push(`${FILE} lists the ${kind.slice(0, -1)} ${id}, which ${ref} does not: new items go to a feature, not the baseline`);
    }
  }
  return { problems, note: `baseline compared with ${ref}` };
}
