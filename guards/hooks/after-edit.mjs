/**
 * PostToolUse hook for file edits: runs the project's own after-edit command, if it has one.
 *
 * A plugin cannot know a project's formatter and linter, so the project supplies them as an
 * executable `.claude/after-edit` that takes the edited file's path. When it exits non-zero, its
 * output goes back to Claude (exit 2) so the file is fixed while it is still in context. The edit
 * itself has already happened; this only reports. With no such file, the hook does nothing.
 */
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readInput } from './read-input.mjs';

const read = readInput();
const filePath = read?.input?.tool_input?.file_path;
const script = read && join(read.projectDir, '.claude', 'after-edit');
if (typeof filePath === 'string' && script && existsSync(script) && existsSync(filePath)) {
  let runnable = true;
  try {
    accessSync(script, constants.X_OK);
  } catch {
    runnable = false;
  }
  if (runnable) {
    const result = spawnSync(script, [filePath], { cwd: read.projectDir, encoding: 'utf8', timeout: 110_000 });
    if (result.status !== 0 && result.status !== null) {
      process.stderr.write(`.claude/after-edit reported problems in ${filePath}:\n${result.stdout || ''}${result.stderr || ''}`);
      process.exit(2);
    }
  }
}
