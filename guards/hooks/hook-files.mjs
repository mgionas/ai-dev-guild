/**
 * Which files are the project's git hooks or its hook manager's configuration, and which shell
 * commands change one.
 *
 * Skipping a hook is refused (`--no-verify`, `HUSKY=0`), but `rm .git/hooks/pre-commit` or
 * `chmod -x .husky/pre-commit` switches the same check off without any flag. Changing one is
 * sometimes the task (adding a lint step), so the guard asks instead of refusing. Reading a hook
 * stays allowed.
 *
 * Covered: anything under `.git/hooks/`, `.husky/` or `.lefthook/` in any folder, `lefthook.yml`
 * (and `.yaml`, `.json`, `.toml`, a leading dot, a `-local` suffix) and `.pre-commit-config.yaml`.
 */
import { commandParts } from './shell-words.mjs';

const MANAGER_FILE = /^(\.?lefthook(-local)?\.(ya?ml|json|toml)|\.pre-commit-config\.yaml)$/;

/** True when `path` is inside a hooks folder or is a hook manager's config file. */
export function isHookFile(path) {
  const parts = path.split(/[\\/]/).filter((part) => part && part !== '.');
  if (parts.some((part, i) => part === '.husky' || part === '.lefthook' || (part === '.git' && parts[i + 1] === 'hooks'))) return true;
  return MANAGER_FILE.test(parts.at(-1) ?? '');
}

// Commands that change what they are given: every plain word is a path they may write, move,
// delete or re-mode. `cp` is not here: only its destination is written, and `writeTargets` has it.
const CHANGES_ITS_ARGUMENTS = new Set(['rm', 'unlink', 'rmdir', 'shred', 'mv', 'chmod', 'chown', 'chgrp', 'touch', 'truncate', 'ln', 'install', 'dd']);
const GIT_CHANGES = new Set(['rm', 'mv']);

// The file a word names, also as an option's `=value` (`dd of=…`, `--target-directory=…`).
function pathsIn(word) {
  const eq = word.indexOf('=');
  return eq === -1 ? [word] : [word, word.slice(eq + 1)];
}

function gitSubcommand(words) {
  return words.find((w, i) => i > 0 && !w.startsWith('-') && words[i - 1] !== '-c' && words[i - 1] !== '-C');
}

/**
 * Why the command changes a hook file, as text for the question, or null. `targets` are the files
 * `writeTargets` found (redirects, `tee`, `sed -i`, the destination of `cp` and `mv`). A `cd` into
 * a hooks folder followed by any change in the same command counts too, since the file names after
 * it are relative to that folder.
 */
export function hookFileChange(command, targets) {
  const target = targets.find(isHookFile);
  if (target) return `the command writes ${target}, a git hook or hook manager file`;
  let intoHooks = null;
  let changes = targets.length > 0;
  for (const { words } of commandParts(command)) {
    const [name, ...args] = words;
    const plain = args.filter((w) => !w.startsWith('-'));
    if (name === 'cd' || name === 'pushd') {
      intoHooks ??= plain.find(isHookFile) ?? null;
      continue;
    }
    const gitChange = name === 'git' && GIT_CHANGES.has(gitSubcommand(words));
    if (!CHANGES_ITS_ARGUMENTS.has(name) && !gitChange) continue;
    changes = true;
    const file = plain.flatMap(pathsIn).find(isHookFile);
    if (file) return `\`${gitChange ? `git ${gitSubcommand(words)}` : name}\` changes ${file}, a git hook or hook manager file`;
  }
  if (intoHooks && changes) return `the command changes files after moving into ${intoHooks}, a git hook folder`;
  return null;
}
