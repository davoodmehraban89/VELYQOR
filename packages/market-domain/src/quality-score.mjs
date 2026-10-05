const BASE = Object.freeze({ GOOD: 100, DEGRADED: 80, STALE: 30, INVALID: 0 });

export function qualityScore({ state, flags = [], ageRatio = 0 }) {
  if (!(state in BASE)) throw new RangeError(`unsupported quality state: ${state}`);
  if (!Array.isArray(flags)) throw new TypeError('flags must be an array');
  if (!Number.isFinite(ageRatio) || ageRatio < 0) throw new RangeError('ageRatio must be non-negative and finite');
  if (state === 'INVALID') return 0;

  let score = BASE[state];
  if (flags.includes('PROVIDER_DIVERGENCE')) score -= 15;
  if (flags.includes('STALE_SOURCE')) score -= 10;
  if (ageRatio >= 0.75 && ageRatio <= 1) score -= 10;
  if (ageRatio > 1) score -= Math.min(20, Math.floor(ageRatio - 1) * 5);

  if (state === 'STALE') score = Math.min(score, 30);
  return Math.max(0, Math.min(100, score));
}
