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
 * `$'it\'s'` closes where bash closes it. A command that ends inside an open quote throws `Unclear`:
 * the rest of it would be hidden from the rules, and bash would not run it anyway.
 *
 * This is not a shell parser. It catches the common spellings, not every possible one. Where it
 * cannot tell what a command runs, it throws `Unclear` and the hook refuses the command.
 */

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
 * that runs a heredoc as its script (`bash <<'EOF'`) can be judged on it (`innerScripts`).
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
      f.quote = "$'";
      out += "$'";
      i++;
      continue;
    }
    if (c === '\n' && f.quote === null && pending.length) {
      lines ??= lineIndex(s);
      const read = readBodies(s, i + 1, pending, lines);
      pending = [];
      wordStart = true;
      out += '\n';
      if (read) {
        for (const [n, body] of read.bodies) bodies[n] = body;
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
    bodies.push([index, body]);
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
 * Like `shellCommands`, with the wrapper words each command dropped: `{ words, dropped, expanded }`.
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
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = fresh();
  };
  const open = (kind, substitution) => {
    frames.push({ kind, substitution, words, word, quote, expanded });
    words = fresh();
    word = null;
    quote = null;
    expanded = false;
  };
  const close = (kind) => {
    endCommand();
    if (frames.at(-1)?.kind !== kind) return; // unbalanced: treat it as a separator
    const frame = frames.pop();
    ({ words, word, quote, expanded } = frame);
    if (frame.substitution) {
      add('*');
      expanded = true;
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
      // A backslash escapes the next character; the escape is kept as that character, not decoded.
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
    if (c === '(') open(')', false);
    else if (c === ')') close(')');
    else if (c === '\n' || c === ';' || c === '&' || c === '|') endCommand();
    else if (/\s/.test(c)) endWord();
    else if (c === '<' || c === '>') {
      endWord();
      let op = c;
      while (s[i + 1] === c) op += s[++i];
      words.push(op);
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
  return { words: ws, dropped, expanded };
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
// Files that are the shell's own input: `bash /dev/stdin` reads its script from the pipe too.
const STDIN_FILE = /^\/(dev\/stdin|dev\/fd\/0|proc\/self\/fd\/0)$/;
const REDIRECT = /^(<|<<|<<<|>|>>)$/;

/**
 * The command, and every string it hands to another shell to run (`bash -c '…'`, `sh -c "…"`,
 * `eval …`, a heredoc or here-string a shell reads as its script), with one level of quoting
 * removed, nested up to three levels. Deeper nesting throws: the hook refuses what it will not
 * unwrap.
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
  for (const { words, expanded } of commandParts(command)) {
    if (!SHELLS.has(words[0])) continue;
    const { unseen } = shellSource(words.slice(1), [], expanded.slice(1));
    if (unseen === 'input') return `\`${words[0]}\` runs a script from its input (a pipe, or whatever feeds it)`;
    if (unseen === 'expansion') return `\`${words[0]}\` runs a script built from an expansion (\`$name\`, \`$(…)\` or backticks)`;
  }
  return null;
}

/**
 * Where a shell gets its script, from its words after the name: `{ scripts, unseen }`. With `-c`
 * the script is the first plain word. Otherwise a plain word is a script file, which the guard
 * does not open (like `bash script.sh`), and its input is data for it. With no file, or with `-s`
 * or a file that is the shell's own input, the script is the input: a heredoc's body or a
 * here-string's word is judged as a script, a file redirect (`< x`) is not opened, and anything
 * else is unseen (`unseen: 'input'`). A `-c` string or here-string whose word holds an expansion
 * (`expanded`, from `commandParts`) is still judged for what it shows, and is unseen too
 * (`unseen: 'expansion'`). A redirect's target and the digits of `2>` are never a script file.
 */
function shellSource(args, bodies, expanded = []) {
  const operands = [];
  const inputs = [];
  let withC = false;
  let withS = false;
  let optionsDone = false;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (REDIRECT.test(w)) {
      i++;
      inputs.push([w, args[i], expanded[i]]);
    } else if (/^\d+$/.test(w) && REDIRECT.test(args[i + 1] ?? '')) continue;
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
  if (operands.length && !withS && !STDIN_FILE.test(args[operands[0]])) return { scripts: [], unseen: false };
  const scripts = [];
  let seen = false;
  let built = false;
  for (const [op, target, targetExpanded] of inputs) {
    if (op === '<<') {
      // A heredoc with no terminator line has no body: its lines stayed in the command and were judged there.
      seen = true;
      const n = /^HEREDOC(\d+)$/.exec(target ?? '')?.[1];
      if (n !== undefined && bodies[n] !== undefined) scripts.push(bodies[n]);
    } else if (op === '<<<' && target !== undefined) {
      seen = true;
      if (targetExpanded) built = true;
      scripts.push(target);
    } else if (op === '<' && target !== undefined) seen = true;
  }
  if (built) return { scripts, unseen: 'expansion' };
  return { scripts, unseen: seen ? false : 'input' };
}
