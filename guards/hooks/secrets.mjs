/**
 * Which files hold secrets, and which shell commands may name one.
 *
 * Deny rules in settings stop the file tools, but `cat .env` or `curl -d @.env …` from the shell
 * would put the secrets into the model's context or send them out. A secret file is `.env` or
 * `.env.<anything>` in any folder, except a committed template: a name ending in `.example`,
 * `.sample` or `.template`. It is matched by the last part of its path, ignoring case, because
 * macOS and Windows open `.ENV` as `.env`.
 *
 * The shell rule fails closed: a command that names a secret file where a file could go is
 * refused, unless it is one of the few commands that do not read what is in the file (`MAY_NAME`):
 * listing, removing, touching or testing it, printing its name, or loading it with `source .env`
 * or `. .env`, which sets variables without printing them. `cp` and `mv` may name it only as the
 * destination, which the protected-paths rule judges, and `git` only to `rm` or `check-ignore` it.
 * For grep-like tools the first plain word is the search pattern, not a file, and the value of an
 * exclusion (`--exclude .env`, `--glob '!.env'`) is not a read.
 *
 * Known refusals on the safe side: a URL whose path ends in `.env` (`curl https://host/.env`,
 * `user@host/.env`), `.env` in a comment, a remote path (`scp host:.env .`), and an option value
 * that is not read as a file (`node --env-file=.env`, `docker compose --env-file .env`).
 *
 * Like the rest of these hooks this reads the command as text and catches the common spellings,
 * not every one: a file reached through a variable, a symlink or a directory search is not seen.
 */
import { commandParts, Unclear } from './shell-words.mjs';

const TEMPLATE = /\.(example|sample|template)$/;
const MAY_NAME = new Set(['ls', 'rm', 'touch', 'chmod', 'chown', 'stat', 'test', '[', 'echo', 'printf', 'source', '.']);
const GIT_MAY_NAME = new Set(['rm', 'check-ignore']);

// Options whose value is something to leave out, not a file to read.
const EXCLUSIONS = new Set(['--exclude', '--exclude-dir']);
const GLOBS = new Set(['-g', '--glob', '--iglob']);

// grep-like tools and their options that take a value, so the pattern is not mistaken for one.
const GREP = { value: 'ABCDdefm', long: ['after-context', 'before-context', 'binary-files', 'context', 'devices', 'directories', 'exclude', 'exclude-dir', 'exclude-from', 'file', 'group-separator', 'include', 'label', 'max-count', 'regexp'] };
const RG = { value: 'ABCEMTdefgjmrt', long: ['after-context', 'before-context', 'color', 'colors', 'context', 'context-separator', 'encoding', 'engine', 'field-context-separator', 'field-match-separator', 'file', 'glob', 'iglob', 'ignore-file', 'max-columns', 'max-count', 'max-depth', 'max-filesize', 'path-separator', 'pre', 'pre-glob', 'regexp', 'replace', 'sort', 'sortr', 'threads', 'type', 'type-add', 'type-clear', 'type-not'] };
const SEARCHERS = new Map([
  ['grep', GREP],
  ['egrep', GREP],
  ['fgrep', GREP],
  ['rg', RG],
]);

/**
 * True when `path` names a secret file. A glob (`.env*`, `.e*`, `{a,.env}`) counts when it can
 * match `.env` or `.env.local`. With `dot`, `*`, `?` and `[…]` may match a leading dot, as in
 * ripgrep's globs (the Grep tool); without it they may not, as in the shell.
 */
export function isSecretFile(path, { dot = false } = {}) {
  for (const alternative of expandBraces(path)) {
    const name = alternative.split(/[\\/:]/).pop().toLowerCase();
    if (TEMPLATE.test(name)) continue;
    if (name === '.env' || name.startsWith('.env.')) return true;
    if (/[*?[]/.test(name)) {
      const tokens = globTokens(name);
      if (globMatches(tokens, '.env', dot) || globMatches(tokens, '.env.local', dot)) return true;
    }
  }
  return false;
}

/** Why the command reads or sends a secret file, or null. */
export function secretAccess(command) {
  for (const { words, dropped } of commandParts(command)) {
    const redirected = words.findIndex((w, i) => w === '<' && namesSecret(words[i + 1] ?? ''));
    if (redirected !== -1) return `\`< ${words[redirected + 1]}\` reads a secret file`;
    // A wrapper's own option can name the file too: `xargs -a .env echo` passes it on.
    const wrapperFile = dropped.find((w) => !/^\w+=/.test(w) && namesSecret(w));
    if (wrapperFile) return `a wrapper option names the secret file ${wrapperFile}`;
    const [name, ...args] = words;
    if (name === 'curl') {
      const file = curlUpload(args);
      if (file) return `\`curl\` sends the secret file ${file}`;
    }
    if (mayName(name, args)) continue;
    const file = [name, ...filePositions(name, args)].find(namesSecret);
    if (file) return `\`${name}\` names the secret file ${file}, and may print or send it`;
  }
  return null;
}

/** True when this command may name a secret file: it does not read what is in it. */
function mayName(name, args) {
  if (MAY_NAME.has(name)) return true;
  if (name === 'git') return GIT_MAY_NAME.has(gitSubcommand(args));
  if (name === 'cp' || name === 'mv') return !args.slice(0, -1).some(namesSecret);
  return false;
}

function gitSubcommand(args) {
  for (let i = 0; i < args.length; i++) {
    if (['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'].includes(args[i])) i++;
    else if (!args[i].startsWith('-')) return args[i];
  }
  return null;
}

/**
 * The words that may be files: every word, options' values included, since a wrong guess only
 * refuses. Left out are redirect targets (a write is the protected-paths rule's business, and `<`
 * is checked on its own), an exclusion's value, and a grep-like tool's search pattern.
 */
function filePositions(name, args) {
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const next = args[i + 1] ?? '';
    if (/^(<|<<|>+)$/.test(w) || EXCLUSIONS.has(w) || (GLOBS.has(w) && next.startsWith('!'))) i++;
    else if (!/^--exclude(-dir)?=|^(--i?glob=|-g=?)!/.test(w)) words.push(w);
  }
  const spec = SEARCHERS.get(name);
  return spec ? withoutPattern(spec, words) : words;
}

/**
 * A grep-like tool's words without its search pattern: the first plain word that is not an
 * option's value. With `-e` or `-f` the pattern is an option's value and every plain word counts;
 * skipping it keeps `grep .env docs/` (a search for the word) allowed.
 */
function withoutPattern(spec, words) {
  let pattern = -1;
  let given = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '--') {
      if (pattern === -1 && i + 1 < words.length) pattern = i + 1;
      break;
    }
    if (w.startsWith('--')) {
      const long = w.slice(2).split('=')[0];
      if (long === 'regexp' || long === 'file') given = true;
      if (!w.includes('=') && spec.long.includes(long)) i++;
    } else if (w.startsWith('-') && w.length > 1) {
      for (let k = 1; k < w.length; k++) {
        if (w[k] === 'e' || w[k] === 'f') given = true;
        if (spec.value.includes(w[k])) {
          if (k === w.length - 1) i++;
          break;
        }
      }
    } else if (pattern === -1) pattern = i;
  }
  return given || pattern === -1 ? words : words.filter((_, i) => i !== pattern);
}

/** True when a word names a secret file as itself, as `@file`, as an option's `=value` or `-Xvalue`. */
function namesSecret(word) {
  const candidates = [word, word.replace(/^@/, '')];
  const eq = word.indexOf('=');
  if (eq !== -1) candidates.push(word.slice(eq + 1).replace(/^@/, ''));
  if (/^-[^-]/.test(word)) candidates.push(word.slice(2));
  return candidates.some((candidate) => candidate !== '' && isSecretFile(candidate));
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

const MAX_ALTERNATIVES = 1024;

/**
 * The words a brace expression stands for (`a{b,c}` → `ab`, `ac`). A range is not expanded:
 * `{a..e}` becomes the class `[a-e]` and a number range `[-0-9]*`, which match at least what the
 * range does, so `cat {1..100000}` costs nothing. More alternatives than the guard can check throw.
 */
function expandBraces(word) {
  const done = [];
  const queue = [word];
  while (queue.length) {
    const w = queue.pop();
    const brace = firstBrace(w);
    if (!brace) done.push(w);
    else for (const alternative of brace.alternatives) queue.push(w.slice(0, brace.start) + alternative + w.slice(brace.end + 1));
    if (done.length + queue.length > MAX_ALTERNATIVES) throw new Unclear(`a brace expression stands for more than ${MAX_ALTERNATIVES} names`);
  }
  return done;
}

// The leftmost brace expression in `w` (`{a,b}` or a range; `${…}` is not one), or null.
function firstBrace(w) {
  const stack = [];
  const opens = []; // in order: { start, end, comma }
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (c === '\\') i++;
    else if (c === '{') {
      const open = { start: i, end: -1, commas: [], parameter: w[i - 1] === '$' };
      stack.push(open);
      opens.push(open);
    } else if (c === ',' && stack.length) stack.at(-1).commas.push(i);
    else if (c === '}' && stack.length) stack.pop().end = i;
  }
  for (const open of opens) {
    if (open.end === -1 || open.parameter) continue;
    if (open.commas.length) {
      const bounds = [open.start, ...open.commas, open.end];
      return { start: open.start, end: open.end, alternatives: bounds.slice(1).map((end, k) => w.slice(bounds[k] + 1, end)) };
    }
    const range = open.end - open.start < 40 && rangeClass(w.slice(open.start + 1, open.end));
    if (range) return { start: open.start, end: open.end, alternatives: [range] };
  }
  return null;
}

function rangeClass(inner) {
  const m = /^(?:(-?\d+)\.\.-?\d+|([a-zA-Z])\.\.([a-zA-Z]))(?:\.\.-?\d+)?$/.exec(inner);
  if (!m) return null;
  if (m[1] !== undefined) return '[-0-9]*';
  const [low, high] = [m[2], m[3]].sort();
  return `[${low}-${high}]`;
}

// A glob as tokens: { literal }, { star }, { any } or a class { ranges, negate, anyChar }.
function globTokens(pattern) {
  const tokens = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (!tokens.at(-1)?.star) tokens.push({ star: true });
    } else if (c === '?') tokens.push({ any: true });
    else if (c === '[' && classAt(pattern, i)) {
      const { token, end } = classAt(pattern, i);
      tokens.push(token);
      i = end;
    } else tokens.push({ literal: c });
  }
  return tokens;
}

// The class `[…]` that opens at `i`, or null when it never closes.
function classAt(p, i) {
  let j = i + 1;
  const negate = p[j] === '!' || p[j] === '^';
  if (negate) j++;
  const start = j;
  if (p[j] === ']') j++; // a `]` first is a member
  for (; j < p.length && p[j] !== ']'; j++) {
    if (p[j] === '[' && p[j + 1] === ':') {
      const end = p.indexOf(':]', j + 2);
      if (end !== -1) j = end + 1;
    }
  }
  if (j >= p.length) return null;
  const body = p.slice(start, j);
  const token = { ranges: [], negate, anyChar: /\[:\w+:\]/.test(body) }; // a named class could be anything
  for (let k = 0; k < body.length; k++) {
    if (body[k + 1] === '-' && k + 2 < body.length) {
      const [low, high] = [body[k], body[k + 2]].sort();
      token.ranges.push([low, high]);
      k += 2;
    } else token.ranges.push([body[k], body[k]]);
  }
  return { token, end: j };
}

/**
 * True when the glob's tokens match `name`. A set of positions moves through the name one
 * character at a time, so the cost is the glob's length times the name's, however many stars.
 */
function globMatches(tokens, name, dot) {
  const n = tokens.length;
  const spread = (states) => {
    for (let p = 0; p < n; p++) if (states[p] && tokens[p].star) states[p + 1] = 1;
    return states;
  };
  let current = new Uint8Array(n + 1);
  current[0] = 1;
  spread(current);
  for (let k = 0; k < name.length; k++) {
    const ch = name[k];
    const hiddenDot = !dot && k === 0 && ch === '.';
    const next = new Uint8Array(n + 1);
    for (let p = 0; p < n; p++) {
      if (!current[p]) continue;
      const t = tokens[p];
      if (t.star) {
        if (!hiddenDot) next[p] = 1;
      } else if (t.literal !== undefined) {
        if (t.literal === ch) next[p + 1] = 1;
      } else if (!hiddenDot && (t.any || inClass(t, ch))) next[p + 1] = 1;
    }
    current = spread(next);
  }
  return current[n] === 1;
}

function inClass(token, ch) {
  const member = token.anyChar || token.ranges.some(([low, high]) => ch >= low && ch <= high);
  return member !== token.negate;
}
