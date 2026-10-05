import test from 'node:test';
import assert from 'node:assert/strict';
import { qualityScore } from '../src/quality-score.mjs';

test('scores healthy fresh observations at 100', () => {
  assert.equal(qualityScore({ state: 'GOOD', flags: [], ageRatio: 0.1 }), 100);
});

test('penalizes divergence and approaching staleness deterministically', () => {
  const score = qualityScore({ state: 'DEGRADED', flags: ['PROVIDER_DIVERGENCE'], ageRatio: 0.8 });
  assert.equal(score, 55);
});

test('caps stale observations below healthy presentation threshold', () => {
  assert.ok(qualityScore({ state: 'STALE', flags: ['STALE_SOURCE'], ageRatio: 2 }) <= 30);
});

test('invalid observations always score zero', () => {
  assert.equal(qualityScore({ state: 'INVALID', flags: ['NON_POSITIVE_PRICE'], ageRatio: 0 }), 0);
});
