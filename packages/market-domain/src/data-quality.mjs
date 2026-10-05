function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be non-negative and finite`);
  }
}

export function evaluateObservationQuality({
  price,
  ageMs,
  maxAgeMs,
  referencePrice = null,
  maxDivergencePct = null,
  previousPrice = null,
  maxMovePct = null,
}) {
  finiteNonNegative(ageMs, 'ageMs');
  finiteNonNegative(maxAgeMs, 'maxAgeMs');

  const flags = [];

  if (!Number.isFinite(price) || price <= 0) {
    return { state: 'INVALID', flags: ['NON_POSITIVE_PRICE'], divergencePct: null, movePct: null };
  }

  if (ageMs > maxAgeMs) {
    flags.push('STALE_SOURCE');
  }

  let divergencePct = null;
  if (referencePrice !== null) {
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
      throw new RangeError('referencePrice must be positive and finite when provided');
    }
    finiteNonNegative(maxDivergencePct, 'maxDivergencePct');
    divergencePct = Math.abs(price / referencePrice - 1) * 100;
    if (divergencePct > maxDivergencePct) flags.push('PROVIDER_DIVERGENCE');
  }

  let movePct = null;
  if (previousPrice !== null) {
    if (!Number.isFinite(previousPrice) || previousPrice <= 0) {
      throw new RangeError('previousPrice must be positive and finite when provided');
    }
    finiteNonNegative(maxMovePct, 'maxMovePct');
    movePct = Math.abs(price / previousPrice - 1) * 100;
    const epsilon = Math.max(1e-12, Math.abs(maxMovePct) * Number.EPSILON * 8);
    if (movePct - maxMovePct > epsilon) flags.push('PRICE_SPIKE');
  }

  if (flags.includes('STALE_SOURCE')) return { state: 'STALE', flags, divergencePct, movePct };
  if (flags.length > 0) return { state: 'DEGRADED', flags, divergencePct, movePct };
  return { state: 'GOOD', flags, divergencePct, movePct };
}
