import test from 'node:test';
import assert from 'node:assert/strict';
import { nextProviderState } from '../src/provider-recovery.mjs';

test('healthy success keeps provider healthy', () => {
  const next = nextProviderState({
    previous: { status: 'HEALTHY', consecutiveFailures: 0 },
    event: { type: 'SUCCESS', at: '2026-10-05T12:00:00Z' },
  });
  assert.deepEqual(next, {
    status: 'HEALTHY',
    consecutiveFailures: 0,
    lastSuccessAt: '2026-10-05T12:00:00.000Z',
    lastFailureAt: null,
    recoveredAt: null,
  });
});

test('first failure degrades provider and increments counter', () => {
  const next = nextProviderState({
    previous: { status: 'HEALTHY', consecutiveFailures: 0 },
    event: { type: 'FAILURE', at: '2026-10-05T12:01:00Z' },
    downAfterFailures: 3,
  });
  assert.equal(next.status, 'DEGRADED');
  assert.equal(next.consecutiveFailures, 1);
});

test('provider becomes down at configured failure threshold', () => {
  const next = nextProviderState({
    previous: { status: 'DEGRADED', consecutiveFailures: 2 },
    event: { type: 'FAILURE', at: '2026-10-05T12:03:00Z' },
    downAfterFailures: 3,
  });
  assert.equal(next.status, 'DOWN');
  assert.equal(next.consecutiveFailures, 3);
});

test('success after outage records recovery and resets failures', () => {
  const next = nextProviderState({
    previous: {
      status: 'DOWN',
      consecutiveFailures: 4,
      lastFailureAt: '2026-10-05T12:03:00.000Z',
    },
    event: { type: 'SUCCESS', at: '2026-10-05T12:05:00Z' },
    downAfterFailures: 3,
  });
  assert.equal(next.status, 'HEALTHY');
  assert.equal(next.consecutiveFailures, 0);
  assert.equal(next.recoveredAt, '2026-10-05T12:05:00.000Z');
});

test('rejects invalid chronology', () => {
  assert.throws(() => nextProviderState({
    previous: { status: 'HEALTHY', consecutiveFailures: 0, lastSuccessAt: '2026-10-05T12:05:00.000Z' },
    event: { type: 'FAILURE', at: '2026-10-05T12:04:00Z' },
  }), /chronology/i);
});
