/**
 * PreToolUse hook for the Read and Grep tools: refuses reading a secret file (`secrets.mjs`).
 *
 * Projects should also deny these reads in settings; this hook keeps the refusal when those rules
 * are missing or miss a folder. It checks Read's `file_path` and Grep's `path` and `glob`, and a
 * path by where it really points too, so a symlink to `.env` is refused. A Grep over a whole
 * folder is not refused, since a hook cannot list what the search will open; the settings' deny
 * rules are the layer for that.
 */
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { block, readInput } from './read-input.mjs';
import { isSecretFile } from './secrets.mjs';

const read = readInput();
const toolInput = read?.input?.tool_input;
if (read && toolInput && typeof toolInput === 'object') {
  for (const field of ['file_path', 'path', 'glob']) {
    const value = toolInput[field];
    if (typeof value !== 'string' || !value) continue;
    const candidates = [value];
    if (field !== 'glob') {
      try {
        candidates.push(realpathSync(resolve(read.projectDir, value)));
      } catch {
        // a missing file has no target; judge the path as written
      }
    }
    const secret = candidates.find(isSecretFile);
    if (secret) {
      block(`${value} is a secret file, and reading it would put its values into the conversation. Ask the user for the one value you need.`);
    }
  }
}
