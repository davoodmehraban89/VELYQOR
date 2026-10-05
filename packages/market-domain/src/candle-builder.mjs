const TIMEFRAMES_MS = Object.freeze({
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
});

const QUALITY_RANK = Object.freeze({ GOOD: 0, DEGRADED: 1, STALE: 2, INVALID: 3 });

function parseTick(tick, index) {
  if (!tick || typeof tick !== 'object' || Array.isArray(tick)) throw new TypeError(`tick[${index}] must be an object`);
  const timestampMs = new Date(tick.timestamp).valueOf();
  if (!Number.isFinite(timestampMs)) throw new TypeError(`tick[${index}].timestamp must be valid`);
  if (!Number.isFinite(tick.price) || tick.price <= 0) throw new RangeError(`tick[${index}].price must be positive and finite`);
  if (!(tick.quality in QUALITY_RANK)) throw new RangeError(`tick[${index}].quality is unsupported`);
  return { timestampMs, price: tick.price, quality: tick.quality };
}

function worstQuality(items) {
  return items.reduce((worst, item) => QUALITY_RANK[item.quality] > QUALITY_RANK[worst] ? item.quality : worst, 'GOOD');
}

export function buildCandles({ ticks, timeframe }) {
  if (!Array.isArray(ticks)) throw new TypeError('ticks must be an array');
  const intervalMs = TIMEFRAMES_MS[timeframe];
  if (!intervalMs) throw new RangeError(`unsupported timeframe: ${timeframe}`);

  const seen = new Set();
  const parsed = ticks.map(parseTick).filter((tick) => {
    const key = `${tick.timestampMs}:${tick.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.timestampMs - b.timestampMs);

  const buckets = new Map();
  for (const tick of parsed) {
    const openMs = Math.floor(tick.timestampMs / intervalMs) * intervalMs;
    const bucket = buckets.get(openMs) ?? [];
    bucket.push(tick);
    buckets.set(openMs, bucket);
  }

  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([openMs, items]) => {
    const prices = items.map((item) => item.price);
    return {
      openTime: new Date(openMs).toISOString(),
      closeTime: new Date(openMs + intervalMs).toISOString(),
      open: items[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: items.at(-1).price,
      observationCount: items.length,
      quality: worstQuality(items),
    };
  });
}

export const SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAMES_MS));
