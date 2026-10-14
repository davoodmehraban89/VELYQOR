import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Resolve from this source file, not process.cwd(). This test must also work
// under CI, a Windows Desktop Commander shell, and an unrelated launch folder.
const runnerPath = fileURLToPath(new URL('../../../scripts/phase1-live-data-proof.mjs', import.meta.url));

test('live proof runner fails closed without provider credentials, independent of cwd', () => {
  const env = { ...process.env };
  delete env.NAVASAN_API_KEY;
  delete env.ALPHAVANTAGE_API_KEY;

  const run = spawnSync(process.execPath, [runnerPath], {
    cwd: tmpdir(),
    env,
    encoding: 'utf8',
    timeout: 15_000,
  });

  assert.equal(run.error, undefined, 'child process must start');
  assert.notEqual(run.status, 0, 'live data proof must fail closed');
  assert.match(
    `${run.stderr ?? ''}\n${run.stdout ?? ''}`,
    /NAVASAN_API_KEY is required/,
  );
});
