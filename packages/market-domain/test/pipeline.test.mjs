import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProviderObservation, deriveGoldMetrics } from '../src/pipeline.mjs';

test('normalizes an Iranian rial provider observation and preserves audit input', () => {
  const result = normalizeProviderObservation({
    providerCode: 'navasan',
    canonicalSymbol: 'USD_IRT_FREE',
    providerTimestamp: new Date('2026-10-05T12:00:00Z'),
    receivedAt: new Date('2026-10-05T12:00:02Z'),
    price: 1_000_000,
    rawUnit: 'IRR_PER_USD',
    rawPayload: { value: '1000000' },
    referencePrice: 100_100,
    maxDivergencePct: 1,
    maxAgeMs: 60_000,
  });

  assert.equal(result.tick.price, 100_000);
  assert.equal(result.tick.quality.state, 'GOOD');
  assert.equal(result.raw.price, 1_000_000);
  assert.equal(result.raw.rawUnit, 'IRR_PER_USD');
  assert.deepEqual(result.raw.rawPayload, { value: '1000000' });
});

test('derives theoretical gold and premium with complete source provenance', () => {
  const target = new Date('2026-10-05T12:00:00Z');
  const result = deriveGoldMetrics({
    target,
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:59:50Z') },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:59:45Z') },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T11:59:40Z') },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  });

  assert.equal(result.quality, 'GOOD');
  assert.equal(result.formulaVersion, 'gold18-v1');
  assert.equal(result.sourceSnapshot.targetTimestamp, '2026-10-05T12:00:00.000Z');
  assert.equal(result.sourceSnapshot.xau.timestamp, '2026-10-05T11:59:50.000Z');
  assert.equal(result.sourceSnapshot.usdIrt.timestamp, '2026-10-05T11:59:45.000Z');
  assert.equal(result.sourceSnapshot.marketGold.timestamp, '2026-10-05T11:59:40.000Z');
  assert.ok(result.theoreticalIrtPerGram > 0);
  assert.ok(Number.isFinite(result.premium.absoluteIrt));
  assert.ok(Number.isFinite(result.premium.percent));
});

test('marks derived gold metrics stale when any required source is stale', () => {
  const target = new Date('2026-10-05T12:00:00Z');
  const result = deriveGoldMetrics({
    target,
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:59:50Z') },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:55:00Z') },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T11:59:40Z') },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  });
  assert.equal(result.quality, 'STALE');
});

test('rejects a market-gold observation from the future', () => {
  assert.throws(() => deriveGoldMetrics({
    target: new Date('2026-10-05T12:00:00Z'),
    xau: { value: 4_000, timestamp: new Date('2026-10-05T11:59:50Z') },
    usdIrt: { value: 100_000, timestamp: new Date('2026-10-05T11:59:45Z') },
    marketGold: { value: 10_000_000, timestamp: new Date('2026-10-05T12:00:01Z') },
    maxAgeMs: 60_000,
    formulaVersion: 'gold18-v1',
  }), /after target/);
});
