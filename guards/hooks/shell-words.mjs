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
 * This is not a shell parser. It catches the common spellings, not every possible one.
 */

/** The command with heredoc bodies replaced by `<<HEREDOC`: their lines are text, not commands. */
export function withoutHeredocs(command) {
  return command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, '<<HEREDOC');
}

// Words that only wrap the real command; dropped so `sudo kill 1` is judged as `kill 1`.
const WRAPPERS = new Set(['sudo', 'exec', 'nohup', 'command', 'builtin', 'env', 'time', '{', '!', 'if', 'then', 'elif', 'else', 'while', 'until', 'do']);

/**
 * Each simple command's words, unquoted. Redirections are words of their own (`<`, `>`, `>>`), so
 * `cat<.env` gives `['cat', '<', '.env']`. Leading `VAR=value` and wrappers such as `sudo` are
 * dropped, the command name is reduced to its last path part (`/bin/cat` → `cat`), and `xargs`
 * with its flags is dropped so the command it runs is judged.
 */
export function shellCommands(command) {
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
  const open = (kind) => {
    frames.push({ kind, words, word, quote });
    words = [];
    word = null;
    quote = null;
  };
  const close = (kind) => {
    endCommand();
    if (frames.at(-1)?.kind !== kind) return; // unbalanced: treat it as a separator
    ({ words, word, quote } = frames.pop());
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
      open(')');
      continue;
    }
    if (c === '`') {
      if (frames.at(-1)?.kind === '`' && quote === null) close('`');
      else open('`');
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
    if (c === '(') open(')');
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
  return commands.map(stripWrappers).filter((ws) => ws.length);
}

function stripWrappers(words) {
  const ws = [...words];
  while (ws.length && (/^\w+=/.test(ws[0]) || WRAPPERS.has(ws[0]))) ws.shift();
  if (ws[0] === 'xargs') {
    ws.shift();
    while (ws.length && ws[0].startsWith('-')) ws.shift();
  }
  if (ws.length) ws[0] = ws[0].split('/').pop();
  return ws;
}
