function parseObservation(observation, index) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError(`observation[${index}] must be an object`);
  }

  const timestampMs = new Date(observation.timestamp).valueOf();
  if (!Number.isFinite(timestampMs)) {
    throw new TypeError(`observation[${index}].timestamp must be valid`);
  }

  if (!Number.isFinite(observation.price) || observation.price <= 0) {
    throw new RangeError(`observation[${index}].price must be positive and finite`);
  }

  return { timestampMs, price: observation.price };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function analyzeObservationSeries(observations) {
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');

  const parsed = observations.map(parseObservation);
  let outOfOrderCount = 0;
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].timestampMs < parsed[i - 1].timestampMs) outOfOrderCount += 1;
  }

  const timestampCounts = new Map();
  for (const item of parsed) {
    timestampCounts.set(item.timestampMs, (timestampCounts.get(item.timestampMs) ?? 0) + 1);
  }

  const uniqueTimestamps = [...timestampCounts.keys()].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < uniqueTimestamps.length; i += 1) {
    gaps.push(uniqueTimestamps[i] - uniqueTimestamps[i - 1]);
  }

  const duplicateTimestampCount = [...timestampCounts.values()]
    .reduce((total, count) => total + Math.max(0, count - 1), 0);

  return {
    count: parsed.length,
    uniqueTimestampCount: uniqueTimestamps.length,
    duplicateTimestampCount,
    outOfOrderCount,
    maxGapMs: gaps.length ? Math.max(...gaps) : null,
    medianCadenceMs: median(gaps),
    firstTimestamp: uniqueTimestamps.length ? new Date(uniqueTimestamps[0]).toISOString() : null,
    lastTimestamp: uniqueTimestamps.length ? new Date(uniqueTimestamps.at(-1)).toISOString() : null,
  };
}
