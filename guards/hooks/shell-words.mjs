/**
 * Splits a shell command into simple commands and their words, keeping what was inside quotes.
 *
 * `bash-guard`'s `simpleCommands` blanks quoted text so a commit message that mentions a command is
 * not mistaken for running it. That is wrong for rules about what a command names: `cat ".env"`
 * reads `.env` and `kill "1234"` kills process 1234. Here a quoted word keeps its text without the
 * quotes, while quotes still stop `;`, `|` and the like from splitting commands, so
 * `echo "kill 1234"` stays one `echo`. A `$(…)` or backtick substitution runs even inside double
 * quotes, so its body is read as commands of its own.
 *
 * This is not a shell parser. It catches the common spellings, not every possible one. Where it
 * cannot tell what a command runs, it throws `Unclear` and the hook refuses the command.
 */

/** Thrown when the guard cannot tell what a command runs. The hooks refuse such a command. */
export class Unclear extends Error {}

/**
 * The command with heredoc bodies taken out: their lines are text, not commands. Only a real `<<`
 * starts a heredoc: not one inside quotes, a comment or `$(( ))`, and not `<<<`. A body is dropped
 * only up to a line holding the delimiter; with no such line nothing is dropped. With a quoted
 * delimiter (`<<'EOF'`) the body is plain text. With an unquoted one bash still runs the body's
 * `$(…)` and backticks, so those stay, each on a line of its own.
 */
export function withoutHeredocs(command) {
  const s = command;
  const frames = [{ close: '', quote: null }]; // the open `$(`, `(`, backtick, `${` or arithmetic
  let out = '';
  let pending = []; // heredocs started on this line: their bodies begin after its newline
  let lines = null;
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
    if (c === '\n' && f.quote === null && pending.length) {
      lines ??= lineIndex(s);
      const bodies = readBodies(s, i + 1, pending, lines);
      pending = [];
      wordStart = true;
      out += '\n';
      if (bodies) {
        out += bodies.text;
        i = bodies.end - 1;
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
      const stop = end === -1 ? s.length : end;
      out += s.slice(i, stop);
      i = stop - 1;
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
        pending.push(heredoc);
        out += '<<HEREDOC';
        i = heredoc.end - 1;
        continue;
      }
    }
    if (/[\s;&|]/.test(c)) wordStart = true;
    out += c;
  }
  return out;
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
    if (c === "'" || c === '"') {
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
 * The bodies of the pending heredocs, read from `from`: what stays of them, and the index of the
 * newline after the last terminator. Null when a terminator is missing.
 */
function readBodies(s, from, pending, lines) {
  const kept = [];
  let start = from;
  let end = from;
  for (const { delimiter, quoted } of pending) {
    const terminator = firstFrom(lines.get(delimiter) ?? [], start);
    if (!terminator) return null;
    if (!quoted) kept.push(...substitutions(s.slice(start, terminator.start)));
    end = terminator.end;
    start = terminator.end + 1;
  }
  return { text: kept.join('\n'), end };
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
    else if (quote === '"') {
      if (c === '"') quote = null;
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

/** Like `shellCommands`, with the wrapper words each command dropped: `{ words, dropped }`. */
export function commandParts(command) {
  return splitCommands(command)
    .map(stripWrappers)
    .filter((part) => part.words.length);
}

function splitCommands(command) {
  const s = withoutHeredocs(command);
  const commands = [];
  const frames = []; // open substitutions: the command each one interrupted
  let words = [];
  let word = null; // null: no word started; '' is a real (empty, quoted) word
  let quote = null; // null, "'" or '"'

  const add = (text) => (word = (word ?? '') + text);
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  const open = (kind, substitution) => {
    frames.push({ kind, substitution, words, word, quote });
    words = [];
    word = null;
    quote = null;
  };
  const close = (kind) => {
    endCommand();
    if (frames.at(-1)?.kind !== kind) return; // unbalanced: treat it as a separator
    const frame = frames.pop();
    ({ words, word, quote } = frame);
    if (frame.substitution) add('*');
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
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
    if (quote === '"') {
      if (c === '"') quote = null;
      else add(c);
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      add('');
      continue;
    }
    if (c === '(') open(')', false);
    else if (c === ')') close(')');
    else if (c === '\n' || c === ';' || c === '&' || c === '|') endCommand();
    else if (/\s/.test(c)) endWord();
    else if (c === '<' || c === '>') {
      endWord();
      let op = c;
      while (s[i + 1] === c) op += s[++i];
      words.push(op);
    } else add(c);
  }
  endCommand();
  while (frames.length) {
    ({ words, word, quote } = frames.pop());
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
  ['xargs', { value: 'adEIJLnPRSs', flag: '0eiloprtx', long: ['arg-file', 'delimiter', 'max-args', 'max-chars', 'max-procs', 'process-slot-var'], longFlag: ['eof', 'exit', 'interactive', 'max-lines', 'no-run-if-empty', 'null', 'open-tty', 'replace', 'show-limits', 'verbose'] }],
]);

/** Drops leading `VAR=value`, keywords, and wrappers with their options: `{ words, dropped }`. */
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
  return { words: ws, dropped };
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

/**
 * The command, and every string it hands to another shell to run (`bash -c '…'`, `sh -c "…"`,
 * `eval …`), with one level of quoting removed, nested up to three levels. Deeper nesting throws:
 * the hook refuses what it will not unwrap.
 */
export function scriptsToJudge(command) {
  const all = [command];
  let level = [command];
  for (let depth = 1; level.length; depth++) {
    const next = level.flatMap(innerScripts);
    if (next.length && depth > MAX_NESTING) throw new Unclear(`it nests shells more than ${MAX_NESTING} levels deep`);
    all.push(...next);
    level = next;
  }
  return all;
}

// The strings this command's simple commands hand to `bash -c` (and the like) or to `eval`.
function innerScripts(command) {
  const found = [];
  for (const [name, ...args] of shellCommands(command)) {
    if (name === 'eval') {
      if (args.length) found.push(args.join(' '));
      continue;
    }
    if (!SHELLS.has(name)) continue;
    let withC = false;
    for (let i = 0; i < args.length; i++) {
      const w = args[i];
      if (w === '--') {
        if (withC && i + 1 < args.length) found.push(args[i + 1]);
        break;
      }
      if (/^[-+][oO]$/.test(w) || w === '--rcfile' || w === '--init-file') i++;
      else if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(w)) withC = true;
      else if (!/^[-+]/.test(w)) {
        if (withC) found.push(w);
        break;
      }
    }
  }
  return found;
}
