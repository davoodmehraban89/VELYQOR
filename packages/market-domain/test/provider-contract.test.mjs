import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIranianQuote,
  canonicalObservation,
  providerHealth,
} from '../src/provider-contract.mjs';

test('normalizes provider rial values to canonical toman', () => {
  assert.equal(normalizeIranianQuote({ value: 1_000_000, unit: 'IRR_PER_USD' }), 100_000);
});

test('keeps canonical toman values unchanged', () => {
  assert.equal(normalizeIranianQuote({ value: 100_000, unit: 'IRT_PER_USD' }), 100_000);
});

test('rejects unsupported units instead of guessing', () => {
  assert.throws(() => normalizeIranianQuote({ value: 100, unit: 'UNKNOWN' }), /unsupported unit/i);
});

test('creates an auditable canonical observation with distinct source and receive timestamps', () => {
  const observation = canonicalObservation({
    providerCode: 'example',
    canonicalSymbol: 'USD_IRT_FREE',
    providerTimestamp: new Date('2026-10-05T12:00:00Z'),
    receivedAt: new Date('2026-10-05T12:00:02Z'),
    price: 100_000,
    rawUnit: 'IRT_PER_USD',
  });
  assert.deepEqual(observation, {
    providerCode: 'example',
    canonicalSymbol: 'USD_IRT_FREE',
    providerTimestamp: '2026-10-05T12:00:00.000Z',
    receivedAt: '2026-10-05T12:00:02.000Z',
    price: 100_000,
    canonicalUnit: 'IRT_PER_USD',
    rawUnit: 'IRT_PER_USD',
  });
});

test('marks provider stale when last successful observation exceeds threshold', () => {
  const result = providerHealth({
    now: new Date('2026-10-05T12:05:00Z'),
    lastSuccessAt: new Date('2026-10-05T12:00:00Z'),
    staleAfterMs: 60_000,
  });
  assert.equal(result.status, 'STALE');
  assert.equal(result.ageMs, 300_000);
});
