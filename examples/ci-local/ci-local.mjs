#!/usr/bin/env node
/**
 * Example strict local check: runs every CI step on the current checkout, to completion, with a
 * log per step and one verdict line at the end.
 *
 * Usage: node ci-local.mjs <outdir>
 *
 * Copy it into your project and replace STEPS with your CI workflow's steps, in the same order.
 * Then add a test that reads the workflow file and fails when the two lists differ: that test is
 * what keeps this script honest.
 *
 * Strict on purpose: no flags to skip or filter a step, one failure never prevents later steps from running,
 * and the environment is cleaned like a CI runner's so local secrets and caches cannot make a
 * step pass here that would fail there. Not included: the flake retry described in the local-ci
 * skill, because which files a branch touched depends on your test runner.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Replace with your CI steps. `run` is one shell command. */
const STEPS = [
  { name: 'install', run: 'npm ci' },
  { name: 'lint', run: 'npm run lint' },
  { name: 'typecheck', run: 'npm run typecheck' },
  { name: 'test', run: 'npm test' },
  { name: 'build', run: 'npm run build' },
];

/** Variables a CI runner would not have. Add your own local-only ones (database URLs, tokens). */
const DROP_ENV = /^(DATABASE_URL.*|NODE_ENV|.*_TOKEN|.*_SECRET)$/;

const outdir = process.argv[2];
if (!outdir) {
  console.error('Usage: node ci-local.mjs <outdir>   (outdir outside the checkout, or git-ignored)');
  process.exit(2);
}
const out = resolve(outdir);
mkdirSync(out, { recursive: true });
const summary = join(out, 'summary.txt');
writeFileSync(summary, '');

const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !DROP_ENV.test(key)));
Object.assign(env, { CI: 'true', TURBO_FORCE: 'true', NX_SKIP_NX_CACHE: 'true' });

let failed = false;
for (const step of STEPS) {
  const started = Date.now();
  const result = spawnSync(step.run, { shell: true, env, encoding: 'utf8', maxBuffer: 1 << 30 });
  writeFileSync(join(out, `${step.name}.log`), `$ ${step.run}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  const code = result.status ?? 1;
  if (code !== 0) failed = true;
  const line = `${step.name}: ${code} (${Math.round((Date.now() - started) / 1000)}s)`;
  appendFileSync(summary, `${line}\n`);
  console.log(line);
}

const head = spawnSync('git', ['rev-parse', '--short=9', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'unknown';
const verdict = `HEAD ${head} — overall: ${failed ? 'FAIL' : 'PASS'}`;
appendFileSync(summary, `${verdict}\n`);
console.log(verdict);
process.exit(failed ? 1 : 0);
