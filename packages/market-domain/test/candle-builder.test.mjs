import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandles } from '../src/candle-builder.mjs';

const ticks = [
  { timestamp: '2026-10-05T12:00:10Z', price: 100, quality: 'GOOD' },
  { timestamp: '2026-10-05T12:00:40Z', price: 105, quality: 'GOOD' },
  { timestamp: '2026-10-05T12:01:10Z', price: 103, quality: 'DEGRADED' },
  { timestamp: '2026-10-05T12:01:50Z', price: 101, quality: 'GOOD' },
];

test('builds deterministic 1m OHLC candles', () => {
  const candles = buildCandles({ ticks, timeframe: '1m' });
  assert.equal(candles.length, 2);
  assert.deepEqual(candles[0], {
    openTime: '2026-10-05T12:00:00.000Z', closeTime: '2026-10-05T12:01:00.000Z',
    open: 100, high: 105, low: 100, close: 105, observationCount: 2, quality: 'GOOD',
  });
  assert.equal(candles[1].open, 103);
  assert.equal(candles[1].close, 101);
  assert.equal(candles[1].quality, 'DEGRADED');
});

test('sorts out-of-order ticks and collapses exact duplicate timestamp/price pairs', () => {
  const candles = buildCandles({ ticks: [ticks[1], ticks[0], ticks[0]], timeframe: '1m' });
  assert.equal(candles[0].open, 100);
  assert.equal(candles[0].close, 105);
  assert.equal(candles[0].observationCount, 2);
});

test('does not synthesize empty candles across gaps', () => {
  const candles = buildCandles({ ticks: [ticks[0], { timestamp: '2026-10-05T12:05:10Z', price: 110, quality: 'GOOD' }], timeframe: '1m' });
  assert.equal(candles.length, 2);
  assert.equal(candles[1].openTime, '2026-10-05T12:05:00.000Z');
});

test('rejects unsupported timeframes and invalid prices', () => {
  assert.throws(() => buildCandles({ ticks, timeframe: '2m' }), /unsupported timeframe/i);
  assert.throws(() => buildCandles({ ticks: [{ timestamp: ticks[0].timestamp, price: 0, quality: 'GOOD' }], timeframe: '1m' }), /price/i);
});
