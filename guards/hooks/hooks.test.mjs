// Runs each hook the way Claude Code does: JSON on stdin, exit code 2 means blocked.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protectingRule } from './protected.mjs';

const here = import.meta.dirname;

function run(hook, toolInput, projectDir) {
  return spawnSync('node', [join(here, hook)], {
    input: JSON.stringify({ cwd: projectDir, tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
}

function project(rules) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-dev-guild-'));
  mkdirSync(join(dir, '.claude'));
  if (rules) writeFileSync(join(dir, '.claude', 'protected-paths'), rules);
  return dir;
}

test('default rules protect dotenv files but not the example', () => {
  const rules = ['.env', '.env.*', '!.env.example'];
  assert.equal(protectingRule('.env', rules), '.env');
  assert.equal(protectingRule('apps/web/.env.local', rules), '.env.*');
  assert.equal(protectingRule('.env.example', rules), null);
  assert.equal(protectingRule('src/env.ts', rules), null);
});

test('guard-paths blocks a protected file and allows others', () => {
  const dir = project('db/migrations/**\n');
  assert.equal(run('guard-paths.mjs', { file_path: join(dir, 'db/migrations/0001_init.sql') }, dir).status, 2);
  assert.equal(run('guard-paths.mjs', { file_path: join(dir, 'src/app.ts') }, dir).status, 0);
});

test('guard-paths judges a symlink by its target', () => {
  const dir = project();
  writeFileSync(join(dir, '.env'), 'X=1\n');
  symlinkSync(join(dir, '.env'), join(dir, 'harmless.txt'));
  const result = run('guard-paths.mjs', { file_path: join(dir, 'harmless.txt') }, dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /\.env/);
});

test('guard-paths fails open on malformed input', () => {
  const result = spawnSync('node', [join(here, 'guard-paths.mjs')], { input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
});

test('bash-guard refuses pattern kills and allows a PID kill', () => {
  const dir = project();
  for (const command of ['pkill -f vitest', 'killall node', 'kill -9 $(pgrep -f jest)', 'pgrep node | xargs kill']) {
    assert.equal(run('bash-guard.mjs', { command }, dir).status, 2, command);
  }
  assert.equal(run('bash-guard.mjs', { command: 'kill 12345' }, dir).status, 0);
});

test('bash-guard refuses skipped git hooks', () => {
  const dir = project();
  assert.equal(run('bash-guard.mjs', { command: 'git commit --no-verify -m x' }, dir).status, 2);
  assert.equal(run('bash-guard.mjs', { command: 'HUSKY=0 git push' }, dir).status, 2);
  assert.equal(run('bash-guard.mjs', { command: 'git commit -m "verify things"' }, dir).status, 0);
});

test('bash-guard refuses shell writes to protected paths', () => {
  const dir = project('.env\nmigrations/**\n');
  for (const command of ['echo X=1 > .env', 'echo X=1 >> ./.env', 'cat a | tee .env', "sed -i '' 's/a/b/' migrations/0001.sql", 'cp backup.sql migrations/0001.sql']) {
    assert.equal(run('bash-guard.mjs', { command }, dir).status, 2, command);
  }
  for (const command of ['npm test 2>&1 | tail', 'echo hi > out.txt', 'cat .env.example > /dev/null']) {
    assert.equal(run('bash-guard.mjs', { command }, dir).status, 0, command);
  }
});

test('bash-guard ignores the words inside quotes, messages and searches', () => {
  const dir = project();
  for (const command of [
    'grep -rn pkill docs/',
    'git commit -m "explain why --no-verify is refused"',
    "echo 'never run killall node' >> notes.md",
    'rg "kill \\$(pgrep" src/',
    "cat <<'EOF' > notes.md\nkill $(pgrep node)\npkill -f x\nEOF",
  ]) {
    assert.equal(run('bash-guard.mjs', { command }, dir).status, 0, command);
  }
});

test('bash-guard refuses the other ways of skipping hooks', () => {
  const dir = project();
  for (const command of ['git commit -n -m x', 'git -c core.hooksPath=/dev/null commit -m x', 'cd app && pkill -f jest', 'sudo killall node']) {
    assert.equal(run('bash-guard.mjs', { command }, dir).status, 2, command);
  }
  assert.equal(run('bash-guard.mjs', { command: 'git push -n origin feature' }, dir).status, 0);
});

test('after-edit reports the project command failing, and does nothing without one', () => {
  const dir = project();
  const file = join(dir, 'a.txt');
  writeFileSync(file, 'x');
  assert.equal(run('after-edit.mjs', { file_path: file }, dir).status, 0);
  writeFileSync(join(dir, '.claude', 'after-edit'), '#!/bin/sh\necho "lint: bad $1"\nexit 1\n');
  chmodSync(join(dir, '.claude', 'after-edit'), 0o755);
  const result = run('after-edit.mjs', { file_path: file }, dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /lint: bad/);
});
