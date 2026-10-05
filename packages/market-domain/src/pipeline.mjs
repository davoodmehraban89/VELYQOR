import { canonicalObservation } from './provider-contract.mjs';
import { evaluateObservationQuality } from './data-quality.mjs';
import { alignSources, theoreticalGold18Irt, goldPremium } from './gold-pricing.mjs';
import { qualityScore } from './quality-score.mjs';

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

function sourceQuality(source, fallbackState) {
  const state = source?.quality?.state ?? fallbackState;
  const score = source?.quality?.score;
  return {
    state,
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : qualityScore({ state }),
  };
}

function weakestQuality(qualities) {
  const order = { GOOD: 0, DEGRADED: 1, STALE: 2, INVALID: 3 };
  return qualities.reduce((weakest, item) => order[item.state] > order[weakest.state] ? item : weakest);
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
  quality.score = qualityScore({
    state: quality.state,
    flags: quality.flags,
    ageRatio: maxAgeMs > 0 ? ageMs / maxAgeMs : 0,
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

  const xauQuality = sourceQuality(xau, aligned.xauAgeMs > maxAgeMs ? 'STALE' : 'GOOD');
  const usdQuality = sourceQuality(usdIrt, aligned.usdIrtAgeMs > maxAgeMs ? 'STALE' : 'GOOD');
  const marketQuality = sourceQuality(marketGold, marketAgeMs > maxAgeMs ? 'STALE' : 'GOOD');
  const weakest = weakestQuality([xauQuality, usdQuality, marketQuality]);
  const ageStale = aligned.quality === 'STALE' || marketAgeMs > maxAgeMs;
  const quality = ageStale ? 'STALE' : weakest.state;
  const propagatedScore = Math.min(xauQuality.score, usdQuality.score, marketQuality.score);
  const derivedScore = ageStale ? Math.min(30, propagatedScore) : propagatedScore;

  return {
    targetTimestamp: target.toISOString(),
    formulaVersion,
    theoreticalIrtPerGram,
    premium,
    quality,
    qualityScore: derivedScore,
    sourceSnapshot: {
      targetTimestamp: target.toISOString(),
      xau: { ...aligned.xau, quality: xauQuality },
      usdIrt: { ...aligned.usdIrt, quality: usdQuality },
      marketGold: {
        value: marketGold.value,
        timestamp: marketGold.timestamp.toISOString(),
        quality: marketQuality,
      },
      agesMs: {
        xau: aligned.xauAgeMs,
        usdIrt: aligned.usdIrtAgeMs,
        marketGold: marketAgeMs,
      },
    },
  };
}
