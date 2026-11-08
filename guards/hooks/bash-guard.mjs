/**
 * PreToolUse hook for shell commands: refuses three things agents keep doing.
 *
 * 1. Killing processes by pattern (`pkill -f vitest`, `killall node`, `kill $(pgrep …)`). On a
 *    machine where several agents run, a pattern kill stops every agent's tests and the CI run
 *    too. Stop your own process by its PID instead.
 * 2. Skipping git hooks (`--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`, `LEFTHOOK=0`). The hooks are the check.
 * 3. Writing a protected path from the shell (`> .env`, `tee`, `sed -i`, `cp`/`mv` onto it), the
 *    side door around the file-edit guard.
 *
 * This reads the command as text, with quoted text and heredocs blanked out first; it is not a
 * shell parser. It catches the common spellings, not every possible one, and the project's
 * pre-commit and CI checks remain the authority. Killing by port (`kill $(lsof -ti :3000)`) is
 * allowed: it names one listener, not every process with a name.
 */
import { loadRules, protectingRule } from './protected.mjs';
import { block, readInput } from './read-input.mjs';

/**
 * The command with the text inside quotes and heredocs blanked out, so that `grep pkill` or a
 * commit message that mentions `--no-verify` is not mistaken for doing it.
 */
export function withoutQuotedText(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, '<<HEREDOC')
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
    block(`${kill} kills by pattern, which stops other agents' runs too. Stop only a process you started, by its PID (\`kill <pid>\`).`);
  }
  const skip = skipsHooks(command);
  if (skip) block(`${skip} skips git hooks. Hooks are never skipped: fix what the hook reports instead.`);
  const rules = loadRules(read.projectDir);
  for (const target of writeTargets(command)) {
    const rel = target.replace(/^\.\//, '');
    const rule = protectingRule(rel, rules);
    if (rule) block(`the command writes ${target}, which is protected by "${rule}" in .claude/protected-paths.`);
  }
}
