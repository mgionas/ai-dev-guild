/**
 * Reads the hook's JSON from stdin and finds the project root.
 *
 * Input that is not the JSON a hook expects passes: the hook has nothing to judge, and the
 * project's own pre-commit and CI checks stay the authority. An error while judging a call is
 * different and refuses it, because a hook that crashes is read as "allow": the three PreToolUse
 * hooks catch what they throw, and `guard-paths` and `bash-guard` also refuse when this Node cannot
 * run them (`protected.mjs`).
 */
import { readFileSync, writeSync } from 'node:fs';

/** Returns `{ input, projectDir }`, or null when stdin is not the JSON a hook expects. */
export function readInput() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    return { input, projectDir };
  } catch {
    return null;
  }
}

/** Blocks the tool call: exit code 2 sends the reason back to Claude. */
export function block(reason) {
  process.stderr.write(`Blocked by ai-dev-guild: ${reason}\n`);
  process.exit(2);
}

/**
 * Asks the user to confirm the tool call instead of refusing it: PreToolUse's "ask" decision,
 * which Claude Code reads from JSON on stdout with exit code 0 (on exit 2 it would block). The
 * reason is shown to the user in the permission prompt.
 */
export function ask(reason) {
  const decision = { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `ai-dev-guild: ${reason}` };
  // writeSync: process.stdout to a pipe can be asynchronous, and exit would drop the answer.
  writeSync(1, `${JSON.stringify({ hookSpecificOutput: decision })}\n`);
  process.exit(0);
}
