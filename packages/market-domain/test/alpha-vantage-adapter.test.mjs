import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlphaVantageGoldSpotUrl,
  parseAlphaVantageGoldSpot,
} from '../src/adapters/alpha-vantage.mjs';

test('builds Alpha Vantage GOLD_SILVER_SPOT request without mutating key', () => {
  const url = buildAlphaVantageGoldSpotUrl('secret-key');
  assert.equal(
    url,
    'https://www.alphavantage.co/query?function=GOLD_SILVER_SPOT&symbol=GOLD&apikey=secret-key',
  );
});

test('parses Alpha Vantage gold spot payload into canonical XAU_USD observation', () => {
  const result = parseAlphaVantageGoldSpot({
    payload: {
      price: '4001.25',
      unit: 'USD per troy ounce',
      timestamp: '2026-10-05T12:00:00Z',
    },
    receivedAt: new Date('2026-10-05T12:00:02Z'),
  });

  assert.equal(result.providerCode, 'alpha_vantage');
  assert.equal(result.canonicalSymbol, 'XAU_USD');
  assert.equal(result.price, 4001.25);
  assert.equal(result.canonicalUnit, 'USD_PER_TROY_OUNCE');
  assert.equal(result.providerTimestamp, '2026-10-05T12:00:00.000Z');
});

test('accepts equivalent documented unit spelling', () => {
  const result = parseAlphaVantageGoldSpot({
    payload: {
      price: 3999.5,
      unit: 'USD/troy ounce',
      timestamp: '2026-10-05T12:00:00Z',
    },
    receivedAt: new Date('2026-10-05T12:00:01Z'),
  });
  assert.equal(result.price, 3999.5);
});

test('rejects non-USD-per-troy-ounce units', () => {
  assert.throws(() => parseAlphaVantageGoldSpot({
    payload: {
      price: '4000',
      unit: 'USD per gram',
      timestamp: '2026-10-05T12:00:00Z',
    },
    receivedAt: new Date('2026-10-05T12:00:01Z'),
  }), /unit/i);
});

test('rejects provider timestamps after receive time', () => {
  assert.throws(() => parseAlphaVantageGoldSpot({
    payload: {
      price: '4000',
      unit: 'USD per troy ounce',
      timestamp: '2026-10-05T12:00:03Z',
    },
    receivedAt: new Date('2026-10-05T12:00:01Z'),
  }), /before providerTimestamp/i);
});
