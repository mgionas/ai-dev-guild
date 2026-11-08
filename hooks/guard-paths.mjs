/**
 * PreToolUse hook for file edits: refuses a change to a protected path.
 *
 * A path is judged by where it really points, so a harmless-looking symlink to `.env` is still
 * refused. Files outside the project are not this hook's business. See `protected.mjs` for the
 * rules file.
 */
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { loadRules, protectingRule } from './protected.mjs';
import { block, readInput } from './read-input.mjs';

function realPath(path) {
  try {
    return lstatSync(path).isSymbolicLink() ? realpathSync(path) : path;
  } catch {
    return path; // a new file does not exist yet; judge the path as written
  }
}

const read = readInput();
const filePath = read?.input?.tool_input?.file_path ?? read?.input?.tool_input?.notebook_path;
if (read && typeof filePath === 'string') {
  // Compare both spellings of the root and of the file: on macOS `/var/…` is `/private/var/…`,
  // and a project opened through a symlink has two names. Missing one would let an edit through.
  const roots = new Set([read.projectDir, realPath(read.projectDir)]);
  try {
    roots.add(realpathSync(read.projectDir));
  } catch {
    // keep the path as given
  }
  const rules = loadRules(read.projectDir);
  const written = resolve(read.projectDir, filePath);
  for (const candidate of new Set([written, realPath(written)])) {
    for (const root of roots) {
      const rel = relative(root, candidate);
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue;
      const rule = protectingRule(rel.split(sep).join('/'), rules);
      if (rule) {
        block(`${rel} is protected by "${rule}" in .claude/protected-paths. Add a new file instead (for a migration, a new migration), or ask the user.`);
      }
    }
  }
}
