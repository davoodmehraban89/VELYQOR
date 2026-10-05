import { canonicalObservation } from './provider-contract.mjs';
import { evaluateObservationQuality } from './data-quality.mjs';
import { alignSources, theoreticalGold18Irt, goldPremium } from './gold-pricing.mjs';

function validDate(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
}

export function normalizeProviderObservation({
  providerCode,
  canonicalSymbol,
  providerTimestamp,
  receivedAt,
  price,
  rawUnit,
  rawPayload = null,
  referencePrice = null,
  maxDivergencePct = null,
  maxAgeMs,
}) {
  validDate(providerTimestamp, 'providerTimestamp');
  validDate(receivedAt, 'receivedAt');

  const canonical = canonicalObservation({
    providerCode,
    canonicalSymbol,
    providerTimestamp,
    receivedAt,
    price,
    rawUnit,
  });

  const ageMs = receivedAt.valueOf() - providerTimestamp.valueOf();
  const quality = evaluateObservationQuality({
    price: canonical.price,
    ageMs,
    maxAgeMs,
    referencePrice,
    maxDivergencePct,
  });

  return {
    raw: {
      providerCode,
      canonicalSymbol,
      providerTimestamp: providerTimestamp.toISOString(),
      receivedAt: receivedAt.toISOString(),
      price,
      rawUnit,
      rawPayload,
    },
    tick: {
      providerCode,
      canonicalSymbol,
      timestamp: canonical.providerTimestamp,
      receivedAt: canonical.receivedAt,
      price: canonical.price,
      canonicalUnit: canonical.canonicalUnit,
      quality,
    },
  };
}

export function deriveGoldMetrics({
  target,
  xau,
  usdIrt,
  marketGold,
  maxAgeMs,
  formulaVersion,
}) {
  validDate(target, 'target');
  validDate(marketGold?.timestamp, 'marketGold.timestamp');
  positiveFinite(marketGold?.value, 'marketGold.value');
  if (!formulaVersion) throw new TypeError('formulaVersion is required');

  const aligned = alignSources({ target, xau, usdIrt, maxAgeMs });

  const targetMs = target.valueOf();
  const marketMs = marketGold.timestamp.valueOf();
  if (marketMs > targetMs) throw new RangeError('marketGold timestamp cannot be after target');

  const marketAgeMs = targetMs - marketMs;
  const theoreticalIrtPerGram = theoreticalGold18Irt({
    xauUsdPerTroyOunce: xau.value,
    usdIrt: usdIrt.value,
  });
  const premium = goldPremium({
    marketIrtPerGram: marketGold.value,
    theoreticalIrtPerGram,
  });

  const quality = aligned.quality === 'STALE' || marketAgeMs > maxAgeMs ? 'STALE' : 'GOOD';

  return {
    targetTimestamp: target.toISOString(),
    formulaVersion,
    theoreticalIrtPerGram,
    premium,
    quality,
    sourceSnapshot: {
      targetTimestamp: target.toISOString(),
      xau: aligned.xau,
      usdIrt: aligned.usdIrt,
      marketGold: {
        value: marketGold.value,
        timestamp: marketGold.timestamp.toISOString(),
      },
      agesMs: {
        xau: aligned.xauAgeMs,
        usdIrt: aligned.usdIrtAgeMs,
        marketGold: marketAgeMs,
      },
    },
  };
}
