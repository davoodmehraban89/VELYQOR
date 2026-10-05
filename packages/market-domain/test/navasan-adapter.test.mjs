import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNavasanLatest,
  NAVASAN_SYMBOLS,
} from '../src/adapters/navasan.mjs';

test('maps Navasan usd_sell to canonical USD_IRT_FREE and converts IRR to IRT', () => {
  const payload = {
    usd_sell: {
      value: '1200000',
      change: 1000,
      timestamp: 1791194400,
      date: '1405-07-13 12:00:00',
    },
  };

  const result = parseNavasanLatest({
    payload,
    receivedAt: new Date('2026-10-05T08:00:02Z'),
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].canonicalSymbol, 'USD_IRT_FREE');
  assert.equal(result[0].price, 120000);
  assert.equal(result[0].rawUnit, 'IRR_PER_USD');
  assert.equal(result[0].providerCode, 'navasan');
});

test('maps Navasan 18ayar to canonical GOLD18_IRT and converts IRR to IRT', () => {
  const payload = {
    '18ayar': {
      value: '90000000',
      change: 0,
      timestamp: 1791194400,
      date: '1405-07-13 12:00:00',
    },
  };

  const result = parseNavasanLatest({
    payload,
    receivedAt: new Date('2026-10-05T08:00:02Z'),
  });

  assert.equal(result[0].canonicalSymbol, 'GOLD18_IRT');
  assert.equal(result[0].price, 9000000);
  assert.equal(result[0].rawUnit, 'IRR_PER_GRAM');
});

test('ignores unmapped Navasan instruments rather than guessing', () => {
  const payload = {
    sekkeh: { value: '1000000', timestamp: 1791194400, date: 'x' },
  };
  const result = parseNavasanLatest({
    payload,
    receivedAt: new Date('2026-10-05T08:00:02Z'),
  });
  assert.deepEqual(result, []);
});

test('rejects malformed mapped observations', () => {
  assert.throws(() => parseNavasanLatest({
    payload: { usd_sell: { value: 'not-a-number', timestamp: 1791194400 } },
    receivedAt: new Date('2026-10-05T08:00:02Z'),
  }), /numeric/i);
});

test('locks the explicit Navasan symbol map', () => {
  assert.deepEqual(NAVASAN_SYMBOLS, {
    usd_sell: { canonicalSymbol: 'USD_IRT_FREE', rawUnit: 'IRR_PER_USD' },
    '18ayar': { canonicalSymbol: 'GOLD18_IRT', rawUnit: 'IRR_PER_GRAM' },
  });
});
