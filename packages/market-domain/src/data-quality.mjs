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
}) {
  finiteNonNegative(ageMs, 'ageMs');
  finiteNonNegative(maxAgeMs, 'maxAgeMs');

  const flags = [];

  if (!Number.isFinite(price) || price <= 0) {
    return { state: 'INVALID', flags: ['NON_POSITIVE_PRICE'], divergencePct: null };
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

  if (flags.includes('STALE_SOURCE')) return { state: 'STALE', flags, divergencePct };
  if (flags.length > 0) return { state: 'DEGRADED', flags, divergencePct };
  return { state: 'GOOD', flags, divergencePct };
}
