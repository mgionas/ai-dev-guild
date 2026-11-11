/**
 * PreToolUse hook for shell commands: refuses four things agents keep doing, and asks about two.
 *
 * 1. Killing processes by pattern (`pkill -f vitest`, `killall node`, `kill $(pgrep …)`). On a
 *    machine where several agents run, a pattern kill stops every agent's tests and the CI run
 *    too. Stop only what you started: your own background task, or a job (`kill %1`).
 * 2. Skipping git hooks (`--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`, `LEFTHOOK=0`). The hooks are the check.
 * 3. Writing a protected path from the shell (`> .env`, `tee`, `sed -i`, `cp`/`mv` onto it), the
 *    side door around the file-edit guard.
 * 4. Reading or sending a secret file from the shell (`cat .env`, `curl -d @.env`), the side door
 *    around the settings' read deny rules. See `secrets.mjs`.
 * 5. Asked, not refused: any `kill` that is not of the agent's own job (`kill %1`) or last
 *    background process (`kill $!`), and not `kill -l`. One command does not say which processes
 *    this agent started, so a number, a variable or a substitution (`kill $PID`,
 *    `kill $(lsof -ti :3000)`, `xargs kill`) may name someone else's. A refusal always wins over
 *    the question.
 * 6. Asked, not refused: a shell that runs a script from its input when that input is not a
 *    heredoc, a here-string or a file (`curl … | bash`, `echo … | sh -s`): the hook cannot see what
 *    the pipe sends.
 *
 * Every rule also judges the strings the command hands to another shell (`bash -c '…'`, `eval …`,
 * a heredoc a shell runs as its script), up to three levels deep, and the command behind a wrapper
 * (`sudo -u root …`, `doas …`, `env -i …`, `timeout 5 …`). When the guard cannot tell what a
 * command does (an unknown wrapper option, deeper nesting, an error while reading it) it refuses,
 * and a command too long to read is asked about: a hook that fails or runs out of time would let
 * the command through.
 *
 * This reads the command as text, with comments and heredoc bodies taken out first, and quoted
 * text too except for a `$(…)` inside double quotes, which runs, and where a rule needs the words a
 * command names (rules 4 and 5, see `shell-words.mjs`); it is not a shell parser. It catches the
 * common spellings, not every possible one, and the project's pre-commit and CI checks remain the
 * authority.
 */
import { loadRules, protectingRule } from './protected.mjs';
import { ask, block, readInput } from './read-input.mjs';
import { secretAccess } from './secrets.mjs';
import { commandParts, scriptsToJudge, stripWrappers, Unclear, unseenScript, withoutHeredocs } from './shell-words.mjs';

// Longer commands get the question without being read: the reading time grows with the length,
// and no one writes a command this long by hand.
const MAX_LENGTH = 20_000;

/**
 * The command with the text inside quotes, heredocs and comments blanked out, so that `grep pkill`
 * or a commit message that mentions `--no-verify` is not mistaken for doing it. A `$(…)` or
 * backtick substitution inside double quotes runs, so it stays: `echo "$(pkill -f x)"` becomes
 * `echo "$(pkill -f x)"` and `git commit -m "a $(b) c"` becomes `git commit -m "$(b)"`. Quotes are
 * read in order, one scan, so an apostrophe inside double quotes (`"it's"`) opens nothing.
 */
export function withoutQuotedText(command) {
  const s = withoutHeredocs(command);
  const frames = [{ close: '', quote: null, depth: 0 }]; // the open `$(` or backtick, innermost last
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const f = frames.at(-1);
    if (f.quote === "'") {
      if (c === "'") {
        f.quote = null;
        out += c;
      }
      continue;
    }
    if (c === '\\') {
      if (f.quote === null) out += s.slice(i, i + 2);
      i++;
      continue;
    }
    if (c === '$' && s[i + 1] === '(') {
      frames.push({ close: ')', quote: null, depth: 0 });
      out += '$(';
      i++;
      continue;
    }
    if (c === '`') {
      if (f.close === '`' && f.quote === null) frames.pop();
      else frames.push({ close: '`', quote: null, depth: 0 });
      out += c;
      continue;
    }
    if (f.quote === '"') {
      if (c === '"') {
        f.quote = null;
        out += c;
      }
      continue;
    }
    if (c === "'" || c === '"') f.quote = c;
    else if (f.close === ')' && c === '(') f.depth++;
    else if (f.close === ')' && c === ')' && f.depth-- === 0) frames.pop();
    out += c;
  }
  return out;
}

/** Each simple command's words, with leading `VAR=value` and wrappers with their options dropped. */
export function simpleCommands(command) {
  return withoutQuotedText(command)
    .split(/\$\(|`|\(|\)|&&|\|\||[;&|\n]/)
    .map((part) => stripWrappers(part.trim().split(/\s+/).filter(Boolean)).words)
    .filter((words) => words.length);
}

/** Why the command kills by pattern, or null. */
export function patternKill(command) {
  const plain = withoutQuotedText(command);
  if (simpleCommands(command).some(([first]) => first === 'pkill' || first === 'killall')) return 'pkill/killall';
  if (/(^|[\s;&|(])kill\b[^;&|\n]*(\$\(|`)\s*pgrep\b/.test(plain)) return 'kill $(pgrep …)';
  if (/(^|[\s;&|(])pgrep\b[^;&\n]*\|\s*xargs\s+(-\S+\s+)*kill\b/.test(plain)) return 'pgrep | xargs kill';
  return null;
}

/** Why the command skips git hooks, or null. */
export function skipsHooks(command) {
  if (/(^|[\s;&|(`])(HUSKY|LEFTHOOK)=0\b/.test(withoutQuotedText(command))) return 'HUSKY=0 / LEFTHOOK=0';
  for (const words of simpleCommands(command)) {
    if (words[0] !== 'git') continue;
    if (words.includes('--no-verify')) return '--no-verify';
    if (words.some((w) => /^core\.hookspath=/i.test(w))) return 'core.hooksPath';
    const sub = words.find((w, i) => i > 0 && !w.startsWith('-') && words[i - 1] !== '-c' && words[i - 1] !== '-C');
    if (sub === 'commit' && words.some((w) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(w))) return 'git commit -n';
  }
  return null;
}

/**
 * The `kill` the hook must ask about, as text for the question, or null. Only job specs
 * (`kill %1`), the last background process (`kill $!`) and `kill -l` pass: any other target, and
 * targets `xargs` reads from its input, could be another agent's process. Quotes are kept, so
 * `kill "1234"` counts and `echo "kill 1234"` does not.
 */
export function pidKill(command) {
  for (const { words, dropped } of commandParts(command)) {
    if (words[0] !== 'kill') continue;
    let i = 1;
    if (/^-[lL]/.test(words[i] ?? '') || words[i] === '--list') continue;
    // One signal spec at most (`-9`, `-TERM`, `-s KILL`, `-n 9`), then an optional `--`; every
    // word after that is a target, so `kill -9 -1` (every process) is asked about too.
    if (['-s', '-n', '--signal'].includes(words[i])) i += 2;
    else if (words[i]?.startsWith('-') && words[i] !== '--') i += 1;
    if (words[i] === '--') i += 1;
    if (dropped.some((w) => w.split('/').pop() === 'xargs')) return '`xargs kill`';
    const target = words.slice(i).find((w) => !w.startsWith('%') && w !== '$!');
    if (target !== undefined) return `\`kill ${target === '*' ? '$(…)' : target}\``;
  }
  return null;
}

/** Paths a command may write: redirect targets, `tee` and `sed -i` files, `cp`/`mv` destinations. */
export function writeTargets(command) {
  const targets = [];
  const clean = (t) => t.replace(/^["']|["']$/g, '');
  for (const m of command.matchAll(/(?:^|[^0-9&])>{1,2}\s*([^\s;&|<>]+)/g)) targets.push(clean(m[1]));
  for (const m of command.matchAll(/\btee\s+((?:-\S+\s+)*)([^\s;&|]+)/g)) targets.push(clean(m[2]));
  // sed edits in place only with -i; its file is the last word (GNU `-i`, BSD `-i ''` alike).
  for (const m of command.matchAll(/\bsed\s+([^;&|]+)/g)) {
    const args = m[1].trim().split(/\s+/);
    if (args.some((a) => /^(-i|--in-place)/.test(a)) && args.length >= 2) targets.push(clean(args.at(-1)));
  }
  for (const m of command.matchAll(/\b(?:cp|mv)\s+([^;&|]+)/g)) {
    const args = m[1].trim().split(/\s+/).filter((a) => !a.startsWith('-'));
    if (args.length >= 2) targets.push(clean(args.at(-1)));
  }
  return targets.filter((t) => t && t !== '/dev/null' && !t.startsWith('&'));
}

// Runs every rule on the command and on each string it hands to another shell. `block` and `ask`
// end the process, so the first refusal wins, and the question comes only after every refusal.
function judge(command, projectDir) {
  const scripts = scriptsToJudge(command);
  const rules = loadRules(projectDir);
  for (const script of scripts) {
    const kill = patternKill(script);
    if (kill) {
      block(`${kill} kills by pattern, which stops other agents' runs too. Stop only what you started: your own background task, or a job (\`kill %1\`).`);
    }
    const skip = skipsHooks(script);
    if (skip) block(`${skip} skips git hooks. Hooks are never skipped: fix what the hook reports instead.`);
    for (const target of writeTargets(script)) {
      const rel = target.replace(/^\.\//, '');
      const rule = protectingRule(rel, rules);
      if (rule) block(`the command writes ${target}, which is protected by "${rule}" in .claude/protected-paths.`);
    }
    const secret = secretAccess(script);
    if (secret) block(`${secret}, which would put its values into the conversation or send them out. Ask the user for the one value you need.`);
  }
  for (const script of scripts) {
    const kill = pidKill(script);
    if (kill) ask(`${kill} stops a process the hook cannot trace: it cannot tell whether this agent started it. Allow it only if that process is the agent's own.`);
    const shell = unseenScript(script);
    if (shell) ask(`\`${shell}\` runs a script from its input (a pipe, or whatever feeds it), which the hook cannot see. Allow it only if you know what that script does.`);
  }
}

const read = readInput();
const command = read?.input?.tool_input?.command;
if (read && typeof command === 'string') {
  if (command.length > MAX_LENGTH) {
    ask(`the command is ${command.length} characters long, more than the ${MAX_LENGTH} the guard reads, so it cannot tell what the command does.`);
  }
  try {
    judge(command, read.projectDir);
  } catch (error) {
    const why = error instanceof Unclear ? error.message : 'it failed while reading it';
    block(`the guard could not check this command: ${why}. Write it as shorter, plainer commands.`);
  }
}
