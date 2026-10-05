import { canonicalObservation } from '../provider-contract.mjs';

const ACCEPTED_UNITS = new Set([
  'usd per troy ounce',
  'usd/troy ounce',
  'usd per troy oz',
  'usd/troy oz',
]);

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

function parseProviderTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError('timestamp must be a valid date/time');
  return date;
}

export function buildAlphaVantageGoldSpotUrl(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new TypeError('apiKey is required');
  }
  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'GOLD_SILVER_SPOT');
  url.searchParams.set('symbol', 'GOLD');
  url.searchParams.set('apikey', apiKey);
  return url.toString();
}

export function parseAlphaVantageGoldSpot({ payload, receivedAt }) {
  validDate(receivedAt, 'receivedAt');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be an object');
  }

  const unit = String(payload.unit ?? '').trim().toLowerCase();
  if (!ACCEPTED_UNITS.has(unit)) {
    throw new RangeError(`unsupported Alpha Vantage gold unit: ${payload.unit ?? '<missing>'}`);
  }

  const price = parsePositiveNumeric(payload.price, 'price');
  const providerTimestamp = parseProviderTimestamp(payload.timestamp);

  const canonical = canonicalObservation({
    providerCode: 'alpha_vantage',
    canonicalSymbol: 'XAU_USD',
    providerTimestamp,
    receivedAt,
    price,
    rawUnit: 'USD_PER_TROY_OUNCE',
  });

  return {
    providerCode: canonical.providerCode,
    canonicalSymbol: canonical.canonicalSymbol,
    providerTimestamp: canonical.providerTimestamp,
    receivedAt: canonical.receivedAt,
    price: canonical.price,
    canonicalUnit: canonical.canonicalUnit,
    rawUnit: 'USD_PER_TROY_OUNCE',
    raw: {
      price: payload.price,
      unit: payload.unit,
      timestamp: payload.timestamp,
      symbol: payload.symbol ?? payload.name ?? null,
    },
  };
}
