import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGoldMetrics } from '../src/pipeline.mjs';

test('derived gold exposes numeric quality score and source-quality provenance', () => {
  const result = deriveGoldMetrics({
    target: new Date('2026-10-05T12:00:00Z'),
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:59:50Z'), quality: { state: 'GOOD', score: 98 } },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:59:45Z'), quality: { state: 'DEGRADED', score: 76 } },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T11:59:40Z'), quality: { state: 'GOOD', score: 95 } },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  });

  assert.equal(result.quality, 'DEGRADED');
  assert.equal(result.qualityScore, 76);
  assert.equal(result.sourceSnapshot.xau.quality.score, 98);
  assert.equal(result.sourceSnapshot.usdIrt.quality.score, 76);
  assert.equal(result.sourceSnapshot.marketGold.quality.score, 95);
});

test('staleness caps derived score even when supplied source scores are high', () => {
  const result = deriveGoldMetrics({
    target: new Date('2026-10-05T12:00:00Z'),
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:55:00Z'), quality: { state: 'GOOD', score: 99 } },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:59:45Z'), quality: { state: 'GOOD', score: 99 } },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T11:59:40Z'), quality: { state: 'GOOD', score: 99 } },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  });

  assert.equal(result.quality, 'STALE');
  assert.ok(result.qualityScore <= 30);
});

test('derived quality falls back safely when legacy inputs have no numeric scores', () => {
  const result = deriveGoldMetrics({
    target: new Date('2026-10-05T12:00:00Z'),
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:59:50Z') },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:59:45Z') },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T11:59:40Z') },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  });

  assert.equal(result.quality, 'GOOD');
  assert.equal(result.qualityScore, 100);
});
