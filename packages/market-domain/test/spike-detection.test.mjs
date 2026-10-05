import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateObservationQuality } from '../src/data-quality.mjs';

test('flags an excessive move from the previous observation as a price spike', () => {
  const result = evaluateObservationQuality({
    price: 110,
    previousPrice: 100,
    maxMovePct: 5,
    ageMs: 1_000,
    maxAgeMs: 60_000,
  });

  assert.equal(result.state, 'DEGRADED');
  assert.ok(result.flags.includes('PRICE_SPIKE'));
  assert.ok(Math.abs(result.movePct - 10) < 1e-9);
});

test('does not flag a move at the configured boundary', () => {
  const result = evaluateObservationQuality({
    price: 105,
    previousPrice: 100,
    maxMovePct: 5,
    ageMs: 1_000,
    maxAgeMs: 60_000,
  });

  assert.equal(result.state, 'GOOD');
  assert.ok(Math.abs(result.movePct - 5) < 1e-9);
});

test('staleness remains the dominant state when a stale observation also spikes', () => {
  const result = evaluateObservationQuality({
    price: 120,
    previousPrice: 100,
    maxMovePct: 5,
    ageMs: 120_000,
    maxAgeMs: 60_000,
  });

  assert.equal(result.state, 'STALE');
  assert.ok(result.flags.includes('STALE_SOURCE'));
  assert.ok(result.flags.includes('PRICE_SPIKE'));
});

test('rejects an invalid previous price or spike threshold', () => {
  assert.throws(() => evaluateObservationQuality({
    price: 100,
    previousPrice: 0,
    maxMovePct: 5,
    ageMs: 1_000,
    maxAgeMs: 60_000,
  }), /previousPrice/);

  assert.throws(() => evaluateObservationQuality({
    price: 100,
    previousPrice: 99,
    maxMovePct: -1,
    ageMs: 1_000,
    maxAgeMs: 60_000,
  }), /maxMovePct/);
});
