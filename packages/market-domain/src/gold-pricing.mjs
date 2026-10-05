export const TROY_OUNCE_GRAMS = 31.1034768;
export const GOLD_18K_PURITY = 0.75;

function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
}

export function theoreticalGold18Irt({ xauUsdPerTroyOunce, usdIrt }) {
  positiveFinite(xauUsdPerTroyOunce, 'xauUsdPerTroyOunce');
  positiveFinite(usdIrt, 'usdIrt');
  return (xauUsdPerTroyOunce / TROY_OUNCE_GRAMS) * GOLD_18K_PURITY * usdIrt;
}

export function goldPremium({ marketIrtPerGram, theoreticalIrtPerGram }) {
  positiveFinite(marketIrtPerGram, 'marketIrtPerGram');
  positiveFinite(theoreticalIrtPerGram, 'theoreticalIrtPerGram');
  return {
    absoluteIrt: marketIrtPerGram - theoreticalIrtPerGram,
    percent: (marketIrtPerGram / theoreticalIrtPerGram - 1) * 100,
  };
}

export function alignSources({ target, xau, usdIrt, maxAgeMs }) {
  if (!(target instanceof Date) || Number.isNaN(target.valueOf())) throw new TypeError('target must be a valid Date');
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new RangeError('maxAgeMs must be non-negative and finite');
  positiveFinite(xau.value, 'xau.value');
  positiveFinite(usdIrt.value, 'usdIrt.value');

  const targetMs = target.valueOf();
  const xauMs = xau.timestamp?.valueOf();
  const usdMs = usdIrt.timestamp?.valueOf();
  if (!Number.isFinite(xauMs) || !Number.isFinite(usdMs)) throw new TypeError('source timestamps must be valid Dates');
  if (xauMs > targetMs || usdMs > targetMs) throw new RangeError('source timestamp cannot be after target');

  const xauAgeMs = targetMs - xauMs;
  const usdIrtAgeMs = targetMs - usdMs;
  return {
    targetTimestamp: target.toISOString(),
    xau: { value: xau.value, timestamp: xau.timestamp.toISOString() },
    usdIrt: { value: usdIrt.value, timestamp: usdIrt.timestamp.toISOString() },
    xauAgeMs,
    usdIrtAgeMs,
    quality: xauAgeMs <= maxAgeMs && usdIrtAgeMs <= maxAgeMs ? 'GOOD' : 'STALE',
  };
}
