function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
}

function validDate(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

export function normalizeIranianQuote({ value, unit }) {
  positiveFinite(value, 'value');
  if (unit === 'IRT_PER_USD' || unit === 'IRT_PER_GRAM') return value;
  if (unit === 'IRR_PER_USD' || unit === 'IRR_PER_GRAM') return value / 10;
  throw new RangeError(`unsupported unit: ${unit}`);
}

export function canonicalObservation({
  providerCode,
  canonicalSymbol,
  providerTimestamp,
  receivedAt,
  price,
  rawUnit,
}) {
  if (!providerCode || !canonicalSymbol) throw new TypeError('providerCode and canonicalSymbol are required');
  validDate(providerTimestamp, 'providerTimestamp');
  validDate(receivedAt, 'receivedAt');
  if (receivedAt.valueOf() < providerTimestamp.valueOf()) {
    throw new RangeError('receivedAt cannot be before providerTimestamp');
  }

  const canonicalUnits = {
    USD_IRT_FREE: 'IRT_PER_USD',
    GOLD18_IRT: 'IRT_PER_GRAM',
    XAU_USD: 'USD_PER_TROY_OUNCE',
  };
  const canonicalUnit = canonicalUnits[canonicalSymbol];
  if (!canonicalUnit) throw new RangeError(`unsupported canonical symbol: ${canonicalSymbol}`);

  let normalizedPrice = price;
  if (canonicalSymbol === 'USD_IRT_FREE' || canonicalSymbol === 'GOLD18_IRT') {
    normalizedPrice = normalizeIranianQuote({ value: price, unit: rawUnit });
  } else {
    positiveFinite(price, 'price');
    if (rawUnit !== canonicalUnit) throw new RangeError(`unsupported unit: ${rawUnit}`);
  }

  return {
    providerCode,
    canonicalSymbol,
    providerTimestamp: providerTimestamp.toISOString(),
    receivedAt: receivedAt.toISOString(),
    price: normalizedPrice,
    canonicalUnit,
    rawUnit,
  };
}

export function providerHealth({ now, lastSuccessAt, staleAfterMs }) {
  validDate(now, 'now');
  validDate(lastSuccessAt, 'lastSuccessAt');
  if (!Number.isFinite(staleAfterMs) || staleAfterMs < 0) {
    throw new RangeError('staleAfterMs must be non-negative and finite');
  }
  if (lastSuccessAt.valueOf() > now.valueOf()) {
    throw new RangeError('lastSuccessAt cannot be in the future');
  }

  const ageMs = now.valueOf() - lastSuccessAt.valueOf();
  return {
    status: ageMs <= staleAfterMs ? 'GOOD' : 'STALE',
    ageMs,
  };
}
