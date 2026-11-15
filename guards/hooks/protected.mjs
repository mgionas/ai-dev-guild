/**
 * Which files no agent may change: read from the project's `.claude/protected-paths`.
 *
 * One glob per line, relative to the project root. `#` starts a comment, and a line starting with
 * `!` makes an exception. A pattern without a `/` matches that name in any folder, the way
 * `.gitignore` does, because "protect `.env`" almost always means every `.env`. The last matching
 * line wins, so an exception goes after the rule it narrows.
 *
 * Without the file, dotenv files are protected and `.env.example` is not: secrets are the one
 * thing every project has and no agent should ever rewrite.
 */
import { existsSync, readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import { block } from './read-input.mjs';

const DEFAULT_RULES = ['.env', '.env.*', '!.env.example'];

/**
 * Refuses the call when this Node has no `path.matchesGlob` (added in 22.5 and in 20.19). A named import of it
 * would kill the hook while it loads, and a hook that dies lets the call through; reading it from
 * the `path` object at call time keeps the hook running, so it can say why it refuses.
 */
export function requireGlobSupport() {
  if (typeof path.matchesGlob !== 'function') {
    block(`these guards need Node 22.5 or later (or 20.19 or later), for path.matchesGlob, and this is Node ${process.version}, so no call can be checked. Upgrade Node, or turn the plugin off.`);
  }
}

/** Reads the project's rules, or the defaults when it has none. */
export function loadRules(projectDir) {
  const file = join(projectDir, '.claude', 'protected-paths');
  if (!existsSync(file)) return DEFAULT_RULES;
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Returns the rule that protects `relPath` (a path relative to the project root, with `/`), or
 * null when nothing protects it.
 */
export function protectingRule(relPath, rules) {
  let match = null;
  for (const raw of rules) {
    const negated = raw.startsWith('!');
    const pattern = negated ? raw.slice(1) : raw;
    const glob = pattern.includes('/') ? pattern : `**/${pattern}`;
    if (path.matchesGlob(relPath, glob) || path.matchesGlob(relPath, pattern)) match = negated ? null : raw;
  }
  return match;
}
