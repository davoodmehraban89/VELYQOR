import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNavasanOhlc } from '../src/adapters/navasan.mjs';

test('parses Navasan daily OHLC and converts IRR values to canonical IRT', () => {
  const payload = [{
    timestamp: 1791131400,
    date: '1405-07-13',
    open: '1200000',
    high: '1220000',
    low: '1190000',
    close: '1210000',
  }];

  const candles = parseNavasanOhlc({
    providerSymbol: 'usd_sell',
    payload,
  });

  assert.equal(candles.length, 1);
  assert.equal(candles[0].canonicalSymbol, 'USD_IRT_FREE');
  assert.equal(candles[0].timeframe, '1d');
  assert.equal(candles[0].open, 120000);
  assert.equal(candles[0].high, 122000);
  assert.equal(candles[0].low, 119000);
  assert.equal(candles[0].close, 121000);
});

test('rejects invalid OHLC ordering from Navasan', () => {
  assert.throws(() => parseNavasanOhlc({
    providerSymbol: '18ayar',
    payload: [{
      timestamp: 1791131400,
      date: '1405-07-13',
      open: '90000000',
      high: '89000000',
      low: '88000000',
      close: '88500000',
    }],
  }), /OHLC/i);
});

test('rejects unmapped historical Navasan symbols', () => {
  assert.throws(() => parseNavasanOhlc({
    providerSymbol: 'sekkeh',
    payload: [],
  }), /unsupported/i);
});
