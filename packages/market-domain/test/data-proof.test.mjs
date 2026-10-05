import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeObservationSeries } from '../src/data-proof.mjs';

test('measures cadence, max gap and duplicate timestamps', () => {
  const result = analyzeObservationSeries([
    { timestamp: '2026-10-05T12:00:00Z', price: 100 },
    { timestamp: '2026-10-05T12:01:00Z', price: 101 },
    { timestamp: '2026-10-05T12:01:00Z', price: 101 },
    { timestamp: '2026-10-05T12:03:00Z', price: 102 },
  ]);

  assert.equal(result.count, 4);
  assert.equal(result.uniqueTimestampCount, 3);
  assert.equal(result.duplicateTimestampCount, 1);
  assert.equal(result.maxGapMs, 120_000);
  assert.equal(result.medianCadenceMs, 90_000);
});

test('reports out-of-order input without silently reclassifying it as clean', () => {
  const result = analyzeObservationSeries([
    { timestamp: '2026-10-05T12:02:00Z', price: 100 },
    { timestamp: '2026-10-05T12:01:00Z', price: 101 },
    { timestamp: '2026-10-05T12:03:00Z', price: 102 },
  ]);
  assert.equal(result.outOfOrderCount, 1);
});

test('rejects invalid timestamps and prices', () => {
  assert.throws(() => analyzeObservationSeries([
    { timestamp: 'bad', price: 100 },
  ]), /timestamp/i);

  assert.throws(() => analyzeObservationSeries([
    { timestamp: '2026-10-05T12:00:00Z', price: 0 },
  ]), /price/i);
});

test('returns null cadence metrics when fewer than two unique timestamps exist', () => {
  const result = analyzeObservationSeries([
    { timestamp: '2026-10-05T12:00:00Z', price: 100 },
  ]);
  assert.equal(result.maxGapMs, null);
  assert.equal(result.medianCadenceMs, null);
});
