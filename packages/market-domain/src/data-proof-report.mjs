import { analyzeObservationSeries } from './data-proof.mjs';

function nonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be non-negative and finite`);
}

export function buildDataProofReport({ providerCode, canonicalSymbol, observations, checkedAt, thresholds }) {
  if (!providerCode || !canonicalSymbol) throw new TypeError('providerCode and canonicalSymbol are required');
  if (!Array.isArray(observations) || observations.length === 0) throw new RangeError('at least one observation is required');
  if (!(checkedAt instanceof Date) || Number.isNaN(checkedAt.valueOf())) throw new TypeError('checkedAt must be a valid Date');
  if (!thresholds || typeof thresholds !== 'object') throw new TypeError('thresholds are required');
  for (const key of ['maxGapMs','maxFreshnessMs','maxDuplicateCount','maxOutOfOrderCount']) nonNegative(thresholds[key], key);

  const series = analyzeObservationSeries(observations);
  const latestMs = new Date(series.lastTimestamp).valueOf();
  const freshnessMs = checkedAt.valueOf() - latestMs;
  if (freshnessMs < 0) throw new RangeError('checkedAt cannot be before the latest observation');

  const failures = [];
  if (series.maxGapMs !== null && series.maxGapMs > thresholds.maxGapMs) failures.push('MAX_GAP_EXCEEDED');
  if (freshnessMs > thresholds.maxFreshnessMs) failures.push('STALE_LATEST_OBSERVATION');
  if (series.duplicateTimestampCount > thresholds.maxDuplicateCount) failures.push('DUPLICATE_TIMESTAMPS');
  if (series.outOfOrderCount > thresholds.maxOutOfOrderCount) failures.push('OUT_OF_ORDER_OBSERVATIONS');

  return {
    providerCode,
    canonicalSymbol,
    checkedAt: checkedAt.toISOString(),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    thresholds: { ...thresholds },
    metrics: { ...series, freshnessMs },
  };
}
