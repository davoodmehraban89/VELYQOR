import test from 'node:test';
import assert from 'node:assert/strict';
import { theoreticalGold18Irt, goldPremium, alignSources } from '../src/gold-pricing.mjs';

test('calculates theoretical 18K gold in IRT per gram', () => {
  const result = theoreticalGold18Irt({ xauUsdPerTroyOunce: 4000, usdIrt: 100000 });
  const expected = (4000 / 31.1034768) * 0.75 * 100000;
  assert.ok(Math.abs(result - expected) < 1e-8);
});

test('calculates absolute and percentage premium', () => {
  const result = goldPremium({ marketIrtPerGram: 10_500_000, theoreticalIrtPerGram: 10_000_000 });
  assert.deepEqual(result, { absoluteIrt: 500_000, percent: 5 });
});

test('rejects zero or negative market inputs', () => {
  assert.throws(() => theoreticalGold18Irt({ xauUsdPerTroyOunce: 0, usdIrt: 100000 }), /positive/);
  assert.throws(() => goldPremium({ marketIrtPerGram: -1, theoreticalIrtPerGram: 10 }), /positive/);
});

test('marks aligned sources stale when either source exceeds threshold', () => {
  const target = new Date('2026-10-05T12:00:00Z');
  const aligned = alignSources({
    target,
    xau: { value: 4000, timestamp: new Date('2026-10-05T11:59:40Z') },
    usdIrt: { value: 100000, timestamp: new Date('2026-10-05T11:57:00Z') },
    maxAgeMs: 60_000,
  });
  assert.equal(aligned.quality, 'STALE');
  assert.equal(aligned.xauAgeMs, 20_000);
  assert.equal(aligned.usdIrtAgeMs, 180_000);
});

test('rejects future source observations for a target timestamp', () => {
  assert.throws(() => alignSources({
    target: new Date('2026-10-05T12:00:00Z'),
    xau: { value: 4000, timestamp: new Date('2026-10-05T12:00:01Z') },
    usdIrt: { value: 100000, timestamp: new Date('2026-10-05T11:59:59Z') },
    maxAgeMs: 60_000,
  }), /after target/);
});
