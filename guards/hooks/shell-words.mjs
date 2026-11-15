/**
 * Splits a shell command into simple commands and their words, keeping what was inside quotes.
 *
 * `bash-guard`'s `simpleCommands` blanks quoted text so a commit message that mentions a command is
 * not mistaken for running it. That is wrong for rules about what a command names: `cat ".env"`
 * reads `.env` and `kill "1234"` kills process 1234. Here a quoted word keeps its text without the
 * quotes, while quotes still stop `;`, `|` and the like from splitting commands, so
 * `echo "kill 1234"` stays one `echo`. A `$(…)` or backtick substitution runs even inside double
 * quotes, so its body is read as commands of its own. Comments are dropped first (`withoutHeredocs`).
 *
 * An ANSI-C quote (`$'…'`) is a quote in which a backslash escapes the next character, so
 * `$'it\'s'` closes where bash closes it, and its escapes are decoded (`decodeAnsiC`). A command that ends inside an open quote throws `Unclear`:
 * the rest of it would be hidden from the rules, and bash would not run it anyway.
 *
 * This is not a shell parser. It catches the common spellings, not every possible one. Where it
 * cannot tell what a command runs, it throws `Unclear` and the hook refuses the command.
 */

import { posix } from 'node:path';

/** Thrown when the guard cannot tell what a command runs. The hooks refuse such a command. */
export class Unclear extends Error {}

/** Throws `Unclear` when a scan ended inside a quote, which would hide the rest of the command. */
export function refuseOpenQuote(quoteOpen) {
  if (quoteOpen) throw new Unclear('it could not read where this quote ends');
}

/**
 * The command with heredoc bodies and comments taken out: their lines are text, not commands. Only
 * a real `<<` starts a heredoc: not one inside quotes, a comment or `$(( ))`, and not `<<<`. A body
 * is dropped only up to a line holding the delimiter; with no such line nothing is dropped. With a
 * quoted delimiter (`<<'EOF'`) the body is plain text. With an unquoted one bash still runs the
 * body's `$(…)` and backticks, so those stay, each on a line of its own.
 *
 * Each `<<` becomes `<<HEREDOC<n>`, and the n-th body's text goes into `bodies[n]`, so a shell
 * that runs a heredoc as its script (`bash <<'EOF'`) can be judged on it (`innerScripts`). The
 * numbers of the unquoted bodies that hold an expansion go into the set `bodies.expanding`: what
 * such a script runs is known only when it runs.
 *
 * A comment is a `#` that starts a word outside quotes, up to the end of its line. It is dropped
 * before anything reads quotes: an apostrophe in `# it's` would otherwise open a quote that hides
 * every later line from the rules.
 */
export function withoutHeredocs(command, bodies = []) {
  const s = command;
  const frames = [{ close: '', quote: null }]; // the open `$(`, `(`, backtick, `${` or arithmetic
  let out = '';
  let pending = []; // heredocs started on this line: their bodies begin after its newline
  let lines = null;
  let started = 0; // heredocs seen so far, which numbers their bodies
  let wordStart = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const f = frames.at(-1);
    const atWordStart = wordStart;
    wordStart = false;
    if (f.quote === "'") {
      if (c === "'") f.quote = null;
      out += c;
      continue;
    }
    if (c === '\\') {
      out += s.slice(i, i + 2);
      i++;
      continue;
    }
    if (f.quote === "$'") {
      if (c === "'") f.quote = null;
      out += c;
      continue;
    }
    if (c === '$' && s[i + 1] === "'" && f.quote === null) {
      const end = ansiCEnd(s, i + 2);
      if (end !== -1) {
        out += ansiCWord(s.slice(i + 2, end));
        i = end;
        continue;
      }
      f.quote = "$'";
      out += "$'";
      i++;
      continue;
    }
    if (c === '$' && s[i + 1] === '"' && f.quote === null) continue; // `$"…"` reads as `"…"`
    if (c === '\n' && f.quote === null && pending.length) {
      lines ??= lineIndex(s);
      const read = readBodies(s, i + 1, pending, lines);
      pending = [];
      wordStart = true;
      out += '\n';
      if (read) {
        for (const [n, body, expanding] of read.bodies) {
          bodies[n] = body;
          if (expanding) (bodies.expanding ??= new Set()).add(n);
        }
        out += read.text;
        i = read.end - 1;
      }
      continue;
    }
    if (f.arithmetic) {
      // Inside `$(( ))` only the nesting matters: `<<` there is a shift.
      out += c;
      if (f.quote === '"') {
        if (c === '"') f.quote = null;
      } else if (c === '"' || c === "'") f.quote = c;
      else if (c === f.open) f.depth++;
      else if (c === f.close && --f.depth === 0) frames.pop();
      continue;
    }
    if (c === '$' && s[i + 1] === '(' && s[i + 2] === '(') {
      frames.push({ arithmetic: true, open: '(', close: ')', depth: 2, quote: null });
      out += '$((';
      i += 2;
      continue;
    }
    if (c === '$' && s[i + 1] === '[') {
      frames.push({ arithmetic: true, open: '[', close: ']', depth: 1, quote: null });
      out += '$[';
      i += 1;
      continue;
    }
    if (c === '$' && (s[i + 1] === '(' || s[i + 1] === '{')) {
      frames.push({ close: s[i + 1] === '(' ? ')' : '}', quote: null });
      out += s.slice(i, i + 2);
      i += 1;
      wordStart = s[i] === '(';
      continue;
    }
    if (c === '`') {
      if (f.close === '`' && f.quote === null) frames.pop();
      else {
        frames.push({ close: '`', quote: null });
        wordStart = true;
      }
      out += c;
      continue;
    }
    if (f.quote === '"') {
      if (c === '"') f.quote = null;
      out += c;
      continue;
    }
    if (c === "'" || c === '"') {
      f.quote = c;
      out += c;
      continue;
    }
    if (f.close === '}') {
      if (c === '}') frames.pop();
      out += c;
      continue;
    }
    if (c === '(' && s[i + 1] === '(') {
      frames.push({ arithmetic: true, open: '(', close: ')', depth: 2, quote: null });
      out += '((';
      i += 1;
      continue;
    }
    if (c === '(' || c === ')') {
      if (c === '(') frames.push({ close: ')', quote: null });
      else if (f.close === ')') frames.pop();
      out += c;
      wordStart = true;
      continue;
    }
    if (c === '#' && atWordStart) {
      const end = s.indexOf('\n', i);
      i = (end === -1 ? s.length : end) - 1;
      continue;
    }
    if (c === '<' && s[i + 1] === '<') {
      if (s[i + 2] === '<') {
        out += '<<<';
        i += 2;
        continue;
      }
      const heredoc = heredocStart(s, i);
      if (heredoc) {
        heredoc.index = started++;
        pending.push(heredoc);
        out += `<<HEREDOC${heredoc.index}`;
        i = heredoc.end - 1;
        continue;
      }
    }
    if (/[\s;&|]/.test(c)) wordStart = true;
    out += c;
  }
  refuseOpenQuote(frames.some((f) => f.quote !== null));
  return out;
}

// The index of the `'` that closes an ANSI-C quote whose text starts at `from`, or -1 when it never closes.
function ansiCEnd(s, from) {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '\\') j++;
    else if (s[j] === "'") return j;
  }
  return -1;
}

const ANSI_C_SIMPLE = new Map([
  ['a', '\x07'], ['b', '\b'], ['e', '\x1b'], ['E', '\x1b'], ['f', '\f'], ['n', '\n'], ['r', '\r'],
  ['t', '\t'], ['v', '\v'], ['\\', '\\'], ["'", "'"], ['"', '"'], ['?', '?'],
]);

/**
 * The text of an ANSI-C quote (`$'…'`, without its quotes) as bash reads it: `\xHH`, `\NNN` (octal),
 * `\uHHHH`, `\UHHHHHHHH`, `\cX`, `\a \b \e \E \f \n \r \t \v`, and a backslash before `\`, `'`, `"` or
 * `?`. Any other escape keeps its backslash, as in bash. A NUL ends the string, as in bash. The
 * rules judge this text, so `cat $'.\x65nv'` is a read of `.env`.
 */
export function decodeAnsiC(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '\\' || i + 1 >= text.length) {
      out += c;
      continue;
    }
    const e = text[++i];
    let code = null;
    if (ANSI_C_SIMPLE.has(e)) out += ANSI_C_SIMPLE.get(e);
    else if (e >= '0' && e <= '7') {
      const digits = /^[0-7]{1,3}/.exec(text.slice(i))[0];
      i += digits.length - 1;
      code = parseInt(digits, 8) & 0xff;
    } else if (e === 'x' || e === 'u' || e === 'U') {
      const digits = new RegExp(`^[0-9a-fA-F]{1,${e === 'x' ? 2 : e === 'u' ? 4 : 8}}`).exec(text.slice(i + 1))?.[0];
      if (digits === undefined) out += `\\${e}`;
      else {
        i += digits.length;
        code = parseInt(digits, 16);
      }
    } else if (e === 'c' && i + 1 < text.length) {
      let x = text[++i];
      if (x === '\\' && text[i + 1] === '\\') i++;
      code = x === '?' ? 0x7f : x.charCodeAt(0) & 0x1f;
    } else out += `\\${e}`;
    if (code === 0) break;
    if (code !== null) out += code > 0x10ffff ? '' : String.fromCodePoint(code);
  }
  return out;
}

// What replaces `$'…'` in the text the rules read: the decoded word, bare when it is made only of
// characters a shell leaves alone (`.env`, `pkill`), so a rule that blanks quoted text still sees
// it, and otherwise in single quotes.
function ansiCWord(text) {
  const word = decodeAnsiC(text);
  return /^[\w./:=@%+,-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`;
}

/** The heredoc whose `<<` is at `i`: its delimiter, whether that was quoted, and where it ends. */
function heredocStart(s, i) {
  let j = i + 2;
  if (s[j] === '-') j++;
  while (s[j] === ' ' || s[j] === '\t') j++;
  let delimiter = '';
  let quoted = false;
  for (; j < s.length && !/[\s;&|<>()]/.test(s[j]); j++) {
    const c = s[j];
    if (c === '$' && s[j + 1] === "'") {
      // `$'…'` is a quote in bash, escapes decoded: the delimiter of `<<$'A'` is `A`, not `$A`.
      const end = ansiCEnd(s, j + 2);
      if (end === -1) return null;
      delimiter += decodeAnsiC(s.slice(j + 2, end));
      quoted = true;
      j = end;
    } else if (c === '$' && s[j + 1] === '"') {
      continue; // `$"…"` is the double-quoted string that follows
    } else if (c === "'" || c === '"') {
      const end = s.indexOf(c, j + 1);
      if (end === -1) return null;
      delimiter += s.slice(j + 1, end);
      quoted = true;
      j = end;
    } else if (c === '\\') {
      quoted = true;
      delimiter += s[++j] ?? '';
    } else delimiter += c;
  }
  return delimiter || quoted ? { delimiter, quoted, end: j } : null;
}

// Every line of the command by its trimmed text, so finding a terminator does not rescan the
// command for each `<<`. A terminator is matched with spaces around it ignored: ending a body too
// early only shows more lines to the rules.
function lineIndex(s) {
  const byText = new Map();
  for (let start = 0; start <= s.length; ) {
    let end = s.indexOf('\n', start);
    if (end === -1) end = s.length;
    const text = s.slice(start, end).trim();
    if (!byText.has(text)) byText.set(text, []);
    byText.get(text).push({ start, end });
    start = end + 1;
  }
  return byText;
}

/**
 * The bodies of the pending heredocs, read from `from`: what stays of them, each body's text by
 * its heredoc's number, and the index of the newline after the last terminator. Null when a
 * terminator is missing.
 */
function readBodies(s, from, pending, lines) {
  const kept = [];
  const bodies = [];
  let start = from;
  let end = from;
  for (const { delimiter, quoted, index } of pending) {
    const terminator = firstFrom(lines.get(delimiter) ?? [], start);
    if (!terminator) return null;
    const body = s.slice(start, terminator.start);
    bodies.push([index, body, !quoted && expands(body)]);
    if (!quoted) kept.push(...substitutions(body));
    end = terminator.end;
    start = terminator.end + 1;
  }
  return { text: kept.join('\n'), bodies, end };
}

// The first line in `list` (sorted by start) that starts at `start` or later.
function firstFrom(list, start) {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (list[mid].start < start) low = mid + 1;
    else high = mid;
  }
  return list[low];
}

// Whether bash expands something in an unquoted heredoc body: `$name`, `${…}`, `$1`, `$$`, `$(…)`,
// `$((…))` or a backtick. A backslash makes the next character plain text.
function expands(body) {
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') i++;
    else if (c === '`' || (c === '$' && /[\w{(\[@*#?$!-]/.test(body[i + 1] ?? ''))) return true;
  }
  return false;
}

// The `$(…)` and backtick substitutions in an unquoted heredoc body, the only part bash runs.
function substitutions(body) {
  const found = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\') i++;
    else if (body[i] === '`' || (body[i] === '$' && body[i + 1] === '(')) {
      const end = substitutionEnd(body, i);
      found.push(body.slice(i, end));
      i = end - 1;
    }
  }
  return found;
}

// The index just past the substitution that starts at `i`, or the end when it never closes.
function substitutionEnd(s, i) {
  if (s[i] === '`') {
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === '\\') j++;
      else if (s[j] === '`') return j + 1;
    }
    return s.length;
  }
  let depth = 0;
  let quote = null;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (quote === "'") {
      if (c === "'") quote = null;
    } else if (c === '\\') j++;
    else if (quote === "$'") {
      if (c === "'") quote = null;
    } else if (quote === '"') {
      if (c === '"') quote = null;
    } else if (c === '$' && s[j + 1] === "'") {
      quote = "$'";
      j++;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return j + 1;
  }
  return s.length;
}

/**
 * Each simple command's words, unquoted. Redirections are words of their own (`<`, `>`, `>>`), so
 * `cat<.env` gives `['cat', '<', '.env']`. A `$(…)` or backtick substitution leaves `*` in the word
 * it stood in: its output is unknown, so `kill $(cat pidfile)` still has a target and
 * `cat .e$(x)nv` still reads as a glob that can be `.env`. Leading `VAR=value`, wrappers such as
 * `sudo` and their options are dropped, and the command name is reduced to its last path part
 * (`/bin/cat` → `cat`).
 */
export function shellCommands(command) {
  return commandParts(command).map((part) => part.words);
}

/**
 * Like `shellCommands`, with the wrapper words each command dropped: `{ words, dropped, expanded, pgrep }`.
 * `pgrep` is true when a `$(…)` or backtick substitution among the command's words runs `pgrep`.
 * `expanded[k]` is true when `words[k]` holds an expansion this shell makes before the command
 * runs (`$name`, `${…}`, `$(…)` or backticks outside single quotes), so its text is not known. The
 * heredoc bodies are collected into `bodies` (see `withoutHeredocs`).
 */
export function commandParts(command, bodies = []) {
  return splitCommands(command, bodies)
    .map(stripWrappers)
    .filter((part) => part.words.length);
}

function splitCommands(command, bodies) {
  const s = withoutHeredocs(command, bodies);
  const commands = [];
  const frames = []; // open substitutions: the command each one interrupted
  // A command's words, with `expanded` beside them: whether each holds an expansion.
  const fresh = () => Object.assign([], { expanded: [] });
  let words = fresh();
  let word = null; // null: no word started; '' is a real (empty, quoted) word
  let quote = null; // null, "'", "$'" or '"'
  let expanded = false; // the word being read holds an expansion

  const add = (text) => (word = (word ?? '') + text);
  const endWord = () => {
    if (word !== null) {
      words.push(word);
      words.expanded.push(expanded);
    }
    word = null;
    expanded = false;
  };
  let ranPgrep = false; // a command in the current substitution is `pgrep`, or holds a substitution that runs it
  const endCommand = () => {
    endWord();
    if (words.length) {
      commands.push(words);
      if (words.pgrep || stripWrappers(words).words[0] === 'pgrep') ranPgrep = true;
    }
    words = fresh();
  };
  const open = (kind, substitution) => {
    frames.push({ kind, substitution, words, word, quote, expanded, ranPgrep });
    ranPgrep = false;
    words = fresh();
    word = null;
    quote = null;
    expanded = false;
  };
  const close = (kind) => {
    endCommand();
    if (frames.at(-1)?.kind !== kind) return; // unbalanced: treat it as a separator
    const frame = frames.pop();
    const ranInside = ranPgrep;
    ({ words, word, quote, expanded, ranPgrep } = frame);
    if (frame.substitution) {
      add('*');
      expanded = true;
      // Remember that the substitution runs `pgrep`, so `'kill' $(pgrep x)` can be told from `kill $(cat f)`.
      if (ranInside) words.pgrep = true;
    }
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else add(c);
      continue;
    }
    if (quote === "$'") {
      // `withoutHeredocs` has decoded every closed `$'…'`, so this is the rest of one that never closes.
      if (c === '\\') {
        if (s[i + 1] !== undefined) add(s[++i]);
      } else if (c === "'") quote = null;
      else add(c);
      continue;
    }
    if (c === '\\') {
      const next = s[i + 1];
      if (next === undefined) continue;
      // Inside double quotes a backslash escapes only these; before anything else it stays as text.
      if (quote === '"' && !'"\\$`\n'.includes(next)) {
        add(c);
        continue;
      }
      i++;
      if (next !== '\n') add(next);
      continue;
    }
    if (c === '$' && s[i + 1] === '(') {
      i++;
      open(')', true);
      continue;
    }
    if (c === '`') {
      if (frames.at(-1)?.kind === '`' && quote === null) close('`');
      else open('`', true);
      continue;
    }
    // A parameter expansion (`$name`, `$1`, `$@`, `${…}`) stays in the word as text, and marks it.
    if (c === '$' && /[\w{@*#?$!-]/.test(s[i + 1] ?? '')) expanded = true;
    if (quote === '"') {
      if (c === '"') quote = null;
      else add(c);
      continue;
    }
    if (c === '$' && s[i + 1] === "'") {
      i++;
      quote = "$'";
      add('');
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      add('');
      continue;
    }
    if (c === '=' && s[i + 1] === '(' && word === null) {
      // zsh's `=(…)`: a file holding a command's output, like `<(…)`; its `(` opens the substitution next.
      words.push(PROCESS_SUBSTITUTION);
      words.expanded.push(false);
    } else if (c === '(') open(')', false);
    else if (c === ')') close(')');
    else if (c === '&' && s[i + 1] === '>') {
      // `&>file` and `&>>file` redirect both outputs: they are not a `&` that ends the command.
      endWord();
      i++;
      let op = '&>';
      if (s[i + 1] === '>') op += s[++i];
      words.push(op);
      words.expanded.push(false);
    } else if (c === '\n' || c === ';' || c === '&' || c === '|') endCommand();
    else if (/\s/.test(c)) endWord();
    else if (c === '<' || c === '>') {
      endWord();
      let op = c;
      while (s[i + 1] === c) op += s[++i];
      // `>&2` and `<&3` copy a descriptor: the `&` belongs to the redirect, not to a new command.
      if (s[i + 1] === '&' && s[i + 2] !== '&') op += s[++i];
      // `<(…)` is a file whose text the command does not show; `>(…)` is one a command writes to.
      // Either way the `(` opens the substitution next.
      if (op === '<' && s[i + 1] === '(') words.push(PROCESS_SUBSTITUTION);
      else if (op === '>' && s[i + 1] === '(') words.push(PROCESS_OUTPUT);
      else words.push(op);
      words.expanded.push(false);
    } else add(c);
  }
  refuseOpenQuote(quote !== null || frames.some((f) => f.quote !== null));
  endCommand();
  while (frames.length) {
    ({ words, word, quote, expanded } = frames.pop());
    endCommand();
  }
  return commands;
}

// Words that only open a block or negate; dropped so `if kill 1; then` is judged as `kill 1`.
const KEYWORDS = new Set(['builtin', '{', '!', 'if', 'then', 'elif', 'else', 'while', 'until', 'do']);

// Each wrapper's options (GNU and BSD together): short letters and long names that take a value,
// and those that do not. Any other option could take a value, which would make the next word look
// like the command, so the guard cannot tell what runs and refuses (`Unclear`).
const WRAPPERS = new Map([
  ['sudo', { value: 'CDghpRrTtUu', flag: 'AbEeHiKklnPSsVv', long: ['close-from', 'chdir', 'group', 'host', 'prompt', 'chroot', 'role', 'type', 'command-timeout', 'other-user', 'user'], longFlag: ['askpass', 'background', 'preserve-env', 'edit', 'help', 'set-home', 'login', 'remove-timestamp', 'reset-timestamp', 'list', 'non-interactive', 'preserve-groups', 'stdin', 'shell', 'version', 'validate'] }],
  ['env', { value: 'CPSu', flag: '0iv', long: ['chdir', 'split-string', 'unset'], longFlag: ['ignore-environment', 'null', 'debug', 'list-signal-handling', 'block-signal', 'default-signal', 'ignore-signal'] }],
  ['nice', { value: 'n', flag: '', long: ['adjustment'], longFlag: [] }],
  ['timeout', { value: 'ks', flag: 'fpv', long: ['kill-after', 'signal'], longFlag: ['foreground', 'preserve-status', 'verbose'] }],
  ['nohup', { value: '', flag: '', long: [], longFlag: [] }],
  ['command', { value: '', flag: 'pvV', long: [], longFlag: [] }],
  ['exec', { value: 'a', flag: 'cl', long: [], longFlag: [] }],
  ['time', { value: 'fo', flag: 'ahlpqvV', long: ['format', 'output'], longFlag: ['append', 'portability', 'quiet', 'verbose'] }],
  ['doas', { value: 'aCu', flag: 'Lns', long: [], longFlag: [] }],
  ['xargs', { value: 'adEIJLnPRSs', flag: '0eiloprtx', long: ['arg-file', 'delimiter', 'max-args', 'max-chars', 'max-procs', 'process-slot-var'], longFlag: ['eof', 'exit', 'interactive', 'max-lines', 'no-run-if-empty', 'null', 'open-tty', 'replace', 'show-limits', 'verbose'] }],
]);

/**
 * Drops leading `VAR=value`, keywords, and wrappers with their options: `{ words, dropped, expanded }`.
 * `expanded` follows `words` from the end, since words are only dropped or added at the front.
 */
export function stripWrappers(words) {
  let ws = [...words];
  const dropped = [];
  while (ws.length) {
    const first = ws[0];
    if (/^\w+=/.test(first) || KEYWORDS.has(first)) {
      dropped.push(ws.shift());
      continue;
    }
    const wrapper = first.split('/').pop();
    const spec = WRAPPERS.get(wrapper);
    if (!spec) break;
    dropped.push(ws.shift());
    ws = dropOptions(wrapper, spec, ws, dropped);
  }
  if (ws.length) ws[0] = ws[0].split('/').pop();
  const offset = words.length - ws.length;
  const expanded = ws.map((_, k) => words.expanded?.[k + offset] ?? false);
  return { words: ws, dropped, expanded, pgrep: Boolean(words.pgrep) };
}

// Drops a wrapper's options and their values from the front of `ws`, and `timeout`'s duration.
function dropOptions(wrapper, spec, ws, dropped) {
  const take = () => dropped.push(ws.shift());
  while (ws.length && ws[0].startsWith('-')) {
    const w = ws[0];
    if (w === '-' && wrapper !== 'env') break; // `env -` is `env -i`; elsewhere `-` is an argument
    take();
    if (w === '--') break;
    if (w.startsWith('--')) {
      const long = w.slice(2).split('=')[0];
      if (spec.long.includes(long)) {
        const value = w.includes('=') ? w.slice(w.indexOf('=') + 1) : ws[0];
        if (!w.includes('=') && ws.length) take();
        if (long === 'split-string' && value !== undefined) ws.unshift(...value.split(/\s+/).filter(Boolean));
      } else if (!spec.longFlag.includes(long)) throw new Unclear(`it does not know \`${wrapper} --${long}\``);
      continue;
    }
    if (wrapper === 'nice' && /^-\d+$/.test(w)) continue; // `nice -10 cmd`
    for (let k = 1; k < w.length; k++) {
      const letter = w[k];
      if (spec.value.includes(letter)) {
        let value = w.slice(k + 1);
        if (!value && ws.length) {
          value = ws[0];
          take();
        }
        // `env -S 'cat x'` splits its value into the command it runs.
        if (wrapper === 'env' && letter === 'S') ws.unshift(...value.split(/\s+/).filter(Boolean));
        break;
      }
      if (!spec.flag.includes(letter)) throw new Unclear(`it does not know \`${wrapper} -${letter}\``);
    }
  }
  if (wrapper === 'timeout' && ws.length) take();
  return ws;
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const MAX_NESTING = 3;
// A shell's long options that take the next word as their value; any other long option is a flag.
const SHELL_LONG_VALUE = new Set(['--rcfile', '--init-file', '--emulate']);
// Redirect operators, each followed by its target word (`2>&1` is `2`, `>&`, `1`).
const REDIRECT = /^(<|<<|<<<|>|>>|>&|<&|&>|&>>)$/;

/**
 * What a script path stands for: 'stdin' for the shell's own input (`/dev/stdin`, `/dev/fd/0`,
 * `/proc/self/fd/0`), 'descriptor' for any other file descriptor (`/dev/fd/3`, `/proc/12/fd/5`,
 * `/proc/$$/fd/0`), null for a file. The path is normalised first, so `//dev/./stdin` and
 * `/dev/fd//0` count. What a descriptor holds is whatever the enclosing command opened on it
 * (`3< <(curl x)`), which the hook cannot see.
 */
function inputPath(path) {
  const p = posix.normalize(path);
  if (/^\/(dev\/stdin|dev\/fd\/0+|proc\/self\/fd\/0+)$/.test(p)) return 'stdin';
  return /^\/(dev\/fd|proc\/.*\/fd)(\/|$)/.test(p) ? 'descriptor' : null;
}

// The word `commandParts` gives for a `<(…)`: the file it stands for holds the output of a command.
const PROCESS_SUBSTITUTION = '<(';
// The word for a `>(…)`: a file whose writes go to a command. It is not a redirect, so it has no target.
const PROCESS_OUTPUT = '>(';

/**
 * The command, and every string it hands to another shell to run (`bash -c '…'`, `sh -c "…"`,
 * `eval …`, a heredoc or here-string a shell reads as its script), with one level of quoting
 * removed, nested up to three levels. Deeper nesting throws: the hook refuses what it will not
 * unwrap.
 */
export function scriptsToJudge(command) {
  const all = [command, ...decodedView(command)];
  let level = [command];
  for (let depth = 1; level.length; depth++) {
    const next = level.flatMap(innerScripts);
    if (next.length && depth > MAX_NESTING) throw new Unclear(`it nests shells more than ${MAX_NESTING} levels deep`);
    all.push(...next, ...next.flatMap(decodedView));
    level = next;
  }
  return all;
}

// A script with its `$'…'` words decoded and `$"…"` read as `"…"`, for the rules that read the raw text (`cat $'.\x65nv'` is
// `cat .env`). It comes in addition to the script itself, so no rule sees less than before.
function decodedView(script) {
  return script.includes("$'") || script.includes('$"') ? [withoutHeredocs(script)] : [];
}

// The strings this command's simple commands hand to a shell (`-c`, a heredoc) or to `eval`.
function innerScripts(command) {
  const bodies = [];
  const found = [];
  for (const { words } of commandParts(command, bodies)) {
    const [name, ...args] = words;
    if (name === 'eval') {
      if (args.length) found.push(args.join(' '));
    } else if (SHELLS.has(name)) found.push(...shellSource(args, bodies).scripts);
  }
  return found;
}

/**
 * What runs a script the guard cannot see, as text for the question, or null. One is a shell that
 * reads its script from its input when that input is not a heredoc, a here-string or a file
 * (`< x`): a pipe (`curl … | bash`) or whatever the enclosing command feeds it, which the hook
 * cannot read. A shell with `-c` and no string (`xargs bash -c`) counts too. The other is a shell
 * whose `-c` string or here-string is built from an expansion (`bash -c "$CMD"`,
 * `bash -c "$(curl …)"`): the text it runs is known only when the command runs. `eval` is not
 * asked about, so that setup lines such as `eval "$(ssh-agent -s)"` pass.
 */
export function unseenScript(command) {
  const bodies = [];
  for (const { words, expanded } of commandParts(command, bodies)) {
    if (words[0] === 'source' || words[0] === '.') {
      if (sourcesUnseenText(words.slice(1))) return `\`${words[0]}\` runs a script from its input, a file descriptor or a process substitution (\`<(…)\`, \`=(…)\`)`;
      continue;
    }
    if (!SHELLS.has(words[0])) continue;
    const { unseen } = shellSource(words.slice(1), bodies, expanded.slice(1));
    if (unseen === 'input') return `\`${words[0]}\` runs a script from its input (a pipe, or whatever feeds it)`;
    if (unseen === 'substitution') return `\`${words[0]}\` runs a script from a process substitution (\`<(…)\` or \`=(…)\`)`;
    if (unseen === 'descriptor') return `\`${words[0]}\` runs a script from a file descriptor (\`/dev/fd/3\`), whatever the command opened on it`;
    if (unseen === 'expansion') return `\`${words[0]}\` runs a script built from an expansion (\`$name\`, \`$(…)\` or backticks)`;
  }
  return null;
}

// Whether `source` / `.` is given its own input, a file descriptor or a `<(…)` / `=(…)` as the file to
// read: the text it runs is then whatever a pipe or a command sends, which the hook cannot see.
// Redirects (`2>/dev/null`, `2>&1`, `&>`), their targets and fd digits come before the file in
// bash's reading, so they are skipped; so are `--` and bash 5.3's `-p PATH`.
function sourcesUnseenText(args) {
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (w === PROCESS_OUTPUT || w === '--') continue;
    if (REDIRECT.test(w) || w === '-p') i++;
    else if (!(/^\d+$/.test(w) && REDIRECT.test(args[i + 1] ?? ''))) return w === '-' || w === PROCESS_SUBSTITUTION || inputPath(w) !== null;
  }
  return false;
}

/**
 * Where a shell gets its script, from its words after the name: `{ scripts, unseen }`. With `-c`
 * the script is the first plain word. Otherwise a plain word is a script file, which the guard
 * does not open (like `bash script.sh`), and its input is data for it. With no file, or with `-s`
 * or a file that is the shell's own input, the script is the input: a heredoc's body or a
 * here-string's word is judged as a script, a file redirect (`< x`) is not opened, and anything
 * else is unseen (`unseen: 'input'`). A `-c` string or here-string whose word holds an expansion
 * (`expanded`, from `commandParts`) is still judged for what it shows, and is unseen too
 * (`unseen: 'expansion'`). A redirect's target and the digits of `2>` are never a script file. A
 * script file that is a descriptor other than 0 (`/dev/fd/3`) is unseen (`unseen: 'descriptor'`).
 * Of several redirects of the input the last one counts, as in bash, and a descriptor other than 0
 * (`3< file`) is not the input.
 */
function shellSource(args, bodies, expanded = []) {
  const operands = [];
  const inputs = [];
  let withC = false;
  let withS = false;
  let optionsDone = false;
  let fd = null; // the digits written right before a redirect: `3<` is not the shell's input
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (w === PROCESS_OUTPUT) continue;
    if (REDIRECT.test(w)) {
      i++;
      if (fd === null || /^0+$/.test(fd)) inputs.push([w, args[i], expanded[i]]);
      fd = null;
    } else if (/^\d+$/.test(w) && REDIRECT.test(args[i + 1] ?? '')) fd = w;
    else if (optionsDone || operands.length) operands.push(i);
    else if (w === '--' || w === '-') optionsDone = true;
    else if (SHELL_LONG_VALUE.has(w)) i++;
    else if (w.startsWith('--')) continue;
    else if (/^[-+][a-zA-Z]+$/.test(w)) {
      if (w[0] === '-' && w.includes('c')) withC = true;
      if (w[0] === '-' && w.includes('s')) withS = true;
      if (/[oO]/.test(w)) i++; // `-o pipefail`, `-eo pipefail`: the value is not the script
    } else operands.push(i);
  }
  if (withC) {
    if (!operands.length) return { scripts: [], unseen: 'input' };
    return { scripts: [args[operands[0]]], unseen: expanded[operands[0]] ? 'expansion' : false };
  }
  if (operands.length && args[operands[0]] === PROCESS_SUBSTITUTION) return { scripts: [], unseen: 'substitution' };
  const file = operands.length ? inputPath(args[operands[0]]) : null;
  if (file === 'descriptor') return { scripts: [], unseen: 'descriptor' };
  if (operands.length && !withS && file !== 'stdin') return { scripts: [], unseen: false };
  const scripts = [];
  let seen = false;
  let built = false;
  let substituted = false;
  for (const [op, target, targetExpanded] of inputs) {
    if (op === '<<') {
      // A heredoc with no terminator line has no body: its lines stayed in the command and were judged there.
      seen = true;
      const n = /^HEREDOC(\d+)$/.exec(target ?? '')?.[1];
      if (n !== undefined && bodies[n] !== undefined) scripts.push(bodies[n]);
      if (n !== undefined && bodies.expanding?.has(Number(n))) built = true;
    } else if (op === '<<<' && target !== undefined) {
      seen = true;
      if (targetExpanded) built = true;
      scripts.push(target);
    } else if (op === '<' && target === PROCESS_SUBSTITUTION) {
      substituted = true;
    } else if (op === '<' && target !== undefined) seen = inputPath(target) === null; // `< /dev/stdin` is the pipe
    else if (op === '<&') seen = false; // a descriptor: the hook cannot see what it holds
  }
  if (substituted) return { scripts, unseen: 'substitution' };
  if (built) return { scripts, unseen: 'expansion' };
  return { scripts, unseen: seen ? false : 'input' };
}
