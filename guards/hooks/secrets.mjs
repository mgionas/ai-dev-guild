/**
 * Which files hold secrets, and which shell commands read or send one.
 *
 * Deny rules in settings stop the file tools, but `cat .env` or `curl -d @.env …` from the shell
 * would put the secrets into the model's context or send them out. A secret file is `.env` or
 * `.env.<anything>` in any folder, except the committed templates `.env.example`, `.env.sample`
 * and `.env.template`. It is matched by the last part of its path, ignoring case, because macOS
 * and Windows open `.ENV` as `.env`.
 *
 * Loading a file with `source .env` or `. .env` is allowed: it sets variables without printing
 * them. Like the rest of these hooks this reads the command as text and catches the common
 * spellings (a reader or sender naming the file, `< .env`, quoted names, `$(…)`), not every one: a
 * file reached through a variable, a symlink or a directory search is not seen.
 */
import { matchesGlob } from 'node:path';
import { shellCommands } from './shell-words.mjs';

const TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template']);

// Commands that print a file they are given. grep-like tools print matching lines, which is
// enough to leak a key, so any use on a secret counts.
const READERS = new Set(['cat', 'less', 'more', 'head', 'tail', 'bat', 'grep', 'egrep', 'fgrep', 'rg', 'awk', 'sed', 'strings', 'xxd', 'od', 'base64']);
const PATTERN_FIRST = new Set(['grep', 'egrep', 'fgrep', 'rg']);
const COPIERS = new Set(['scp', 'rsync', 'nc', 'ncat', 'netcat']);

/** True when `path` names a secret file. A glob (`.env*`, `.e*`) counts when it can match one. */
export function isSecretFile(path) {
  const name = path.split(/[\\/]/).pop().toLowerCase();
  if (TEMPLATES.has(name)) return false;
  if (name === '.env' || name.startsWith('.env.')) return true;
  return /[*?[{]/.test(name) && (matchesGlob('.env', name) || matchesGlob('.env.local', name));
}

/** Why the command reads or sends a secret file, or null. */
export function secretAccess(command) {
  for (const words of shellCommands(command)) {
    const [name, ...args] = words;
    const redirected = words.findIndex((w, i) => w === '<' && isSecretFile(words[i + 1] ?? ''));
    if (redirected !== -1) return `\`< ${words[redirected + 1]}\` reads a secret file`;
    if (READERS.has(name)) {
      const file = fileArgs(name, args).find(isSecretFile);
      if (file) return `\`${name}\` prints the secret file ${file}`;
    }
    if (name === 'curl') {
      const file = curlUpload(args);
      if (file) return `\`curl\` sends the secret file ${file}`;
    }
    if (COPIERS.has(name)) {
      const file = args.find(isSecretFile);
      if (file) return `\`${name}\` sends the secret file ${file}`;
    }
  }
  return null;
}

/**
 * The words a reader may open as files. For grep-like tools the first plain word is the pattern,
 * not a file, unless the pattern came from `-e`/`-f`; skipping it keeps `grep .env docs/` (a search
 * for the word) allowed. Every other word counts, options' values included: a wrong guess refuses.
 */
function fileArgs(name, args) {
  const words = args.filter((w) => w !== '<' && w !== '>' && w !== '>>');
  if (!PATTERN_FIRST.has(name)) return words;
  const patternGiven = words.some((w) => /^-[a-zA-Z]*[ef]/.test(w) || /^--(regexp|file)\b/.test(w));
  if (patternGiven) return words;
  const first = words.findIndex((w) => !w.startsWith('-'));
  return words.filter((_, i) => i !== first);
}

/** The secret file a curl command uploads with `@file` (`-d`, `--data*`, `-F`, `-H`) or `-T`, or null. */
function curlUpload(args) {
  for (const [i, w] of args.entries()) {
    // `@file` in any word: `-d @.env`, `-d@.env`, `--data-binary=@.env`, `-F f=@.env;type=x`.
    for (const m of w.matchAll(/@([^;,]+)/g)) if (isSecretFile(m[1])) return m[1];
    const upload = /^(?:-T|--upload-file)(?:=)?(.*)$/.exec(w);
    if (upload) {
      const file = upload[1] || args[i + 1] || '';
      if (isSecretFile(file)) return file;
    }
  }
  return null;
}
