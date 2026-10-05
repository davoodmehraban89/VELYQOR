import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateObservationQuality } from '../src/data-quality.mjs';

test('classifies a fresh agreeing observation as GOOD', () => {
  const result = evaluateObservationQuality({
    price: 100_000,
    ageMs: 5_000,
    maxAgeMs: 60_000,
    referencePrice: 100_200,
    maxDivergencePct: 1,
  });
  assert.equal(result.state, 'GOOD');
  assert.deepEqual(result.flags, []);
});

test('classifies stale data before considering market divergence', () => {
  const result = evaluateObservationQuality({
    price: 100_000,
    ageMs: 120_000,
    maxAgeMs: 60_000,
    referencePrice: 100_000,
    maxDivergencePct: 1,
  });
  assert.equal(result.state, 'STALE');
  assert.ok(result.flags.includes('STALE_SOURCE'));
});

test('classifies excessive provider disagreement as DEGRADED', () => {
  const result = evaluateObservationQuality({
    price: 103_000,
    ageMs: 10_000,
    maxAgeMs: 60_000,
    referencePrice: 100_000,
    maxDivergencePct: 1,
  });
  assert.equal(result.state, 'DEGRADED');
  assert.ok(result.flags.includes('PROVIDER_DIVERGENCE'));
});

test('rejects zero/negative prices as INVALID', () => {
  const result = evaluateObservationQuality({
    price: 0,
    ageMs: 0,
    maxAgeMs: 60_000,
    referencePrice: 100_000,
    maxDivergencePct: 1,
  });
  assert.equal(result.state, 'INVALID');
  assert.ok(result.flags.includes('NON_POSITIVE_PRICE'));
});
