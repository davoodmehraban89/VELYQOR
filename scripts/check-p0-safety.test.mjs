import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateP0Safety } from './check-p0-safety.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'velyqor-p0-'));
  await mkdir(join(root, 'db', 'migrations'), { recursive: true });
  await mkdir(join(root, 'packages', 'market-domain', 'src', 'adapters'), { recursive: true });
  await writeFile(join(root, 'db', 'migrations', '0001_market_core.sql'), 'CREATE TABLE harmless(id int);');
  await writeFile(join(root, 'packages', 'market-domain', 'src', 'adapters', 'navasan.mjs'), "rawUnit: 'IRR_PER_USD'; rawUnit: 'IRR_PER_GRAM';");
  await writeFile(join(root, 'AGENTS.md'), 'AI/signals may never directly execute an order.');
  return root;
}

async function withFixture(fn) {
  const root = await fixture();
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('baseline passes without altering source files', () => withFixture(async (root) => {
  assert.deepEqual(await evaluateP0Safety(root), { ok: true, violations: [] });
}));

test('unreviewed 0005 OHLC migration is blocked', () => withFixture(async (root) => {
  await writeFile(join(root, 'db', 'migrations', '0005_navasan_private_daily_ohlc.sql'), 'SELECT 1;');
  const result = await evaluateP0Safety(root);
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /0005_navasan_private_daily_ohlc/);
}));

test('renamed Navasan OHLC migration is blocked', () => withFixture(async (root) => {
  await writeFile(join(root, 'db', 'migrations', '0006_more.sql'), "INSERT INTO providers(code) VALUES ('navasan_ohlc');");
  assert.equal((await evaluateP0Safety(root)).ok, false);
}));

test('changed unit assumptions are blocked', () => withFixture(async (root) => {
  await writeFile(join(root, 'packages', 'market-domain', 'src', 'adapters', 'navasan.mjs'), "rawUnit: 'IRT_PER_USD'; rawUnit: 'IRT_PER_GRAM';");
  assert.match((await evaluateP0Safety(root)).violations.join('\n'), /raw-unit contract/);
}));

test('removing no-AI-order rule is blocked', () => withFixture(async (root) => {
  await writeFile(join(root, 'AGENTS.md'), '# Rules\n');
  assert.match((await evaluateP0Safety(root)).violations.join('\n'), /AI-to-live-order/);
}));

test('missing migration directory fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velyqor-p0-empty-'));
  try { assert.equal((await evaluateP0Safety(root)).ok, false); }
  finally { await rm(root, { recursive: true, force: true }); }
});
