/**
 * PreToolUse hook for shell commands: refuses four things agents keep doing, and asks about one.
 *
 * 1. Killing processes by pattern (`pkill -f vitest`, `killall node`, `kill $(pgrep …)`). On a
 *    machine where several agents run, a pattern kill stops every agent's tests and the CI run
 *    too. Stop only what you started: your own background task, or a job (`kill %1`).
 * 2. Skipping git hooks (`--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`, `LEFTHOOK=0`). The hooks are the check.
 * 3. Writing a protected path from the shell (`> .env`, `tee`, `sed -i`, `cp`/`mv` onto it), the
 *    side door around the file-edit guard.
 * 4. Reading or sending a secret file from the shell (`cat .env`, `curl -d @.env`), the side door
 *    around the settings' read deny rules. See `secrets.mjs`.
 * 5. Asked, not refused: `kill <number>`. One command does not say which processes this agent
 *    started, so a process number may be someone else's. A refusal always wins over the question.
 *
 * This reads the command as text, with heredocs blanked out first, and quoted text too except
 * where a rule needs the words a command names (rules 4 and 5, see `shell-words.mjs`); it is not a
 * shell parser. It catches the common spellings, not every possible one, and the project's
 * pre-commit and CI checks remain the authority. Killing by port (`kill $(lsof -ti :3000)`) is
 * allowed: it names one listener, not every process with a name.
 */
import { loadRules, protectingRule } from './protected.mjs';
import { ask, block, readInput } from './read-input.mjs';
import { secretAccess } from './secrets.mjs';
import { shellCommands, withoutHeredocs } from './shell-words.mjs';

/**
 * The command with the text inside quotes and heredocs blanked out, so that `grep pkill` or a
 * commit message that mentions `--no-verify` is not mistaken for doing it.
 */
export function withoutQuotedText(command) {
  return withoutHeredocs(command)
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Each simple command's words, with leading `VAR=value`, `sudo`, `exec`, `nohup` and `xargs` flags dropped. */
export function simpleCommands(command) {
  return withoutQuotedText(command)
    .split(/\$\(|`|\(|\)|&&|\|\||[;&|\n]/)
    .map((part) => {
      const words = part.trim().split(/\s+/).filter(Boolean);
      while (words.length && (/^\w+=/.test(words[0]) || ['sudo', 'exec', 'nohup', 'command'].includes(words[0]))) words.shift();
      if (words[0] === 'xargs') {
        words.shift();
        while (words.length && words[0].startsWith('-')) words.shift();
      }
      return words;
    })
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
  if (/(^|\s)(HUSKY|LEFTHOOK)=0\b/.test(withoutQuotedText(command))) return 'HUSKY=0 / LEFTHOOK=0';
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
 * The process number a `kill` command targets, or null. Job specs (`kill %1`), `kill -l` and a
 * variable (`kill $!`, `kill $(lsof -ti :3000)`) are not literal numbers. Quotes are kept, so
 * `kill "1234"` counts and `echo "kill 1234"` does not.
 */
export function pidKill(command) {
  for (const words of shellCommands(command)) {
    if (words[0] !== 'kill') continue;
    let i = 1;
    if (/^-[lL]/.test(words[i] ?? '') || words[i] === '--list') continue;
    // One signal spec at most (`-9`, `-TERM`, `-s KILL`, `-n 9`), then an optional `--`; every
    // word after that is a target, so `kill -9 -1` (every process) is a number too.
    if (['-s', '-n', '--signal'].includes(words[i])) i += 2;
    else if (words[i]?.startsWith('-') && words[i] !== '--') i += 1;
    if (words[i] === '--') i += 1;
    const pid = words.slice(i).find((w) => /^-?\d+$/.test(w));
    if (pid) return pid;
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

const read = readInput();
const command = read?.input?.tool_input?.command;
if (read && typeof command === 'string') {
  const kill = patternKill(command);
  if (kill) {
    block(`${kill} kills by pattern, which stops other agents' runs too. Stop only what you started: your own background task, or a job (\`kill %1\`).`);
  }
  const skip = skipsHooks(command);
  if (skip) block(`${skip} skips git hooks. Hooks are never skipped: fix what the hook reports instead.`);
  const rules = loadRules(read.projectDir);
  for (const target of writeTargets(command)) {
    const rel = target.replace(/^\.\//, '');
    const rule = protectingRule(rel, rules);
    if (rule) block(`the command writes ${target}, which is protected by "${rule}" in .claude/protected-paths.`);
  }
  const secret = secretAccess(command);
  if (secret) block(`${secret}, which would put its values into the conversation or send them out. Ask the user for the one value you need.`);
  // Last, so that any refusal above wins over the question.
  const pid = pidKill(command);
  if (pid) ask(`\`kill ${pid}\` stops a process by number, and the hook cannot tell whether this agent started it. Allow it only if that process is the agent's own.`);
}
