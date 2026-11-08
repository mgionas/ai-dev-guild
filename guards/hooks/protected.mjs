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
import { join, matchesGlob } from 'node:path';

const DEFAULT_RULES = ['.env', '.env.*', '!.env.example'];

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
    if (matchesGlob(relPath, glob) || matchesGlob(relPath, pattern)) match = negated ? null : raw;
  }
  return match;
}
