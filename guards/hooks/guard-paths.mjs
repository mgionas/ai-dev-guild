/**
 * PreToolUse hook for file edits: refuses a change to a protected path, and asks before a change to
 * a git hook, a hook manager's file or `.git/config` (`hook-files.mjs`).
 *
 * A path is judged by where it really points, so a harmless-looking symlink to `.env` is still
 * refused. Files outside the project are not this hook's business, apart from a hooks folder
 * wherever it is. See `protected.mjs` for the rules file. An error while judging refuses: a hook
 * that crashes would let the edit through.
 */
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { describeHookFile, isHookFile } from './hook-files.mjs';
import { loadRules, protectingRule, requireGlobSupport } from './protected.mjs';
import { ask, block, readInput } from './read-input.mjs';

function realPath(path) {
  try {
    return lstatSync(path).isSymbolicLink() ? realpathSync(path) : path;
  } catch {
    return path; // a new file does not exist yet; judge the path as written
  }
}

requireGlobSupport();
const read = readInput();
const filePath = read?.input?.tool_input?.file_path ?? read?.input?.tool_input?.notebook_path;
if (read && typeof filePath === 'string') {
  try {
    judge(read.projectDir, filePath);
  } catch {
    block('the guard could not check this edit because it failed while reading the rules or the path.');
  }
}

// A refusal wins over the question, so the hook files are asked about only after every path is judged.
function judge(projectDir, filePath) {
  // Compare both spellings of the root and of the file: on macOS `/var/…` is `/private/var/…`,
  // and a project opened through a symlink has two names. Missing one would let an edit through.
  const roots = new Set([projectDir, realPath(projectDir)]);
  try {
    roots.add(realpathSync(projectDir));
  } catch {
    // keep the path as given
  }
  const rules = loadRules(projectDir);
  const written = resolve(projectDir, filePath);
  const candidates = new Set([written, realPath(written)]);
  for (const candidate of candidates) {
    for (const root of roots) {
      const rel = relative(root, candidate);
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue;
      const rule = protectingRule(rel.split(sep).join('/'), rules);
      if (rule) {
        block(`${rel} is protected by "${rule}" in .claude/protected-paths. Add a new file instead (for a migration, a new migration), or ask the user.`);
      }
    }
  }
  const hook = [...candidates].find(isHookFile);
  if (hook) ask(`${hook} is ${describeHookFile(hook)}, which is the project's check. Allow the change only if the user asked for it.`);
}
