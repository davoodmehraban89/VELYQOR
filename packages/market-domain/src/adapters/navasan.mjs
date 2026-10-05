import { canonicalObservation } from '../provider-contract.mjs';

export const NAVASAN_SYMBOLS = Object.freeze({
  usd_sell: Object.freeze({ canonicalSymbol: 'USD_IRT_FREE', rawUnit: 'IRR_PER_USD' }),
  '18ayar': Object.freeze({ canonicalSymbol: 'GOLD18_IRT', rawUnit: 'IRR_PER_GRAM' }),
});

function validDate(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

function parsePositiveNumeric(value, name) {
  const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new RangeError(`${name} must be numeric, positive, and finite`);
  }
  return numeric;
}

function unixSecondsToDate(value, name) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new RangeError(`${name} must be a positive Unix timestamp`);
  }
  const date = new Date(numeric * 1000);
  if (Number.isNaN(date.valueOf())) throw new RangeError(`${name} is invalid`);
  return date;
}

function toCanonicalPrice(rawPrice, rawUnit) {
  if (rawUnit === 'IRR_PER_USD' || rawUnit === 'IRR_PER_GRAM') return rawPrice / 10;
  return rawPrice;
}

export function parseNavasanLatest({ payload, receivedAt }) {
  validDate(receivedAt, 'receivedAt');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be an object');
  }

  const observations = [];

  for (const [providerSymbol, mapping] of Object.entries(NAVASAN_SYMBOLS)) {
    const item = payload[providerSymbol];
    if (item == null) continue;
    if (typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`Navasan ${providerSymbol} observation must be an object`);
    }

    const rawPrice = parsePositiveNumeric(item.value, `${providerSymbol}.value`);
    const providerTimestamp = unixSecondsToDate(item.timestamp, `${providerSymbol}.timestamp`);

    const canonical = canonicalObservation({
      providerCode: 'navasan',
      canonicalSymbol: mapping.canonicalSymbol,
      providerTimestamp,
      receivedAt,
      price: rawPrice,
      rawUnit: mapping.rawUnit,
    });

    observations.push({
      providerCode: canonical.providerCode,
      providerSymbol,
      canonicalSymbol: canonical.canonicalSymbol,
      providerTimestamp: canonical.providerTimestamp,
      receivedAt: canonical.receivedAt,
      price: canonical.price,
      canonicalUnit: canonical.canonicalUnit,
      rawUnit: mapping.rawUnit,
      raw: {
        value: item.value,
        change: item.change ?? null,
        timestamp: item.timestamp,
        date: item.date ?? null,
      },
    });
  }

  return observations;
}

export function parseNavasanOhlc({ providerSymbol, payload }) {
  const mapping = NAVASAN_SYMBOLS[providerSymbol];
  if (!mapping) throw new RangeError(`unsupported Navasan symbol: ${providerSymbol}`);
  if (!Array.isArray(payload)) throw new TypeError('payload must be an array');

  return payload.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`payload[${index}] must be an object`);
    }

    const openRaw = parsePositiveNumeric(item.open, `payload[${index}].open`);
    const highRaw = parsePositiveNumeric(item.high, `payload[${index}].high`);
    const lowRaw = parsePositiveNumeric(item.low, `payload[${index}].low`);
    const closeRaw = parsePositiveNumeric(item.close, `payload[${index}].close`);
    const open = toCanonicalPrice(openRaw, mapping.rawUnit);
    const high = toCanonicalPrice(highRaw, mapping.rawUnit);
    const low = toCanonicalPrice(lowRaw, mapping.rawUnit);
    const close = toCanonicalPrice(closeRaw, mapping.rawUnit);

    if (low > open || low > close || high < open || high < close || low > high) {
      throw new RangeError(`invalid OHLC ordering at payload[${index}]`);
    }

    return {
      providerCode: 'navasan',
      providerSymbol,
      canonicalSymbol: mapping.canonicalSymbol,
      timeframe: '1d',
      openTime: unixSecondsToDate(item.timestamp, `payload[${index}].timestamp`).toISOString(),
      open,
      high,
      low,
      close,
      canonicalUnit: mapping.canonicalSymbol === 'USD_IRT_FREE' ? 'IRT_PER_USD' : 'IRT_PER_GRAM',
      rawUnit: mapping.rawUnit,
      raw: {
        timestamp: item.timestamp,
        date: item.date ?? null,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      },
    };
  });
}
