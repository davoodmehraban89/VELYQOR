const VALID_STATUS = new Set(['HEALTHY', 'DEGRADED', 'DOWN']);

function iso(value, name) {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) throw new TypeError(`${name} must be a valid date/time`);
  return d.toISOString();
}

function latestTimestamp(previous) {
  const values = [previous?.lastSuccessAt, previous?.lastFailureAt, previous?.recoveredAt]
    .filter(Boolean)
    .map(v => new Date(v).valueOf())
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

export function nextProviderState({
  previous,
  event,
  downAfterFailures = 3,
}) {
  if (!previous || typeof previous !== 'object') throw new TypeError('previous is required');
  if (!VALID_STATUS.has(previous.status)) throw new RangeError(`unsupported provider status: ${previous.status}`);
  if (!Number.isInteger(previous.consecutiveFailures) || previous.consecutiveFailures < 0) {
    throw new RangeError('consecutiveFailures must be a non-negative integer');
  }
  if (!event || !['SUCCESS', 'FAILURE'].includes(event.type)) {
    throw new RangeError('event.type must be SUCCESS or FAILURE');
  }
  if (!Number.isInteger(downAfterFailures) || downAfterFailures < 1) {
    throw new RangeError('downAfterFailures must be a positive integer');
  }

  const at = iso(event.at, 'event.at');
  const atMs = new Date(at).valueOf();
  const previousLatest = latestTimestamp(previous);
  if (previousLatest !== null && atMs < previousLatest) {
    throw new RangeError('provider event chronology cannot move backwards');
  }

  if (event.type === 'SUCCESS') {
    return {
      status: 'HEALTHY',
      consecutiveFailures: 0,
      lastSuccessAt: at,
      lastFailureAt: previous.lastFailureAt ?? null,
      recoveredAt: previous.status === 'DOWN' ? at : null,
    };
  }

  const consecutiveFailures = previous.consecutiveFailures + 1;
  return {
    status: consecutiveFailures >= downAfterFailures ? 'DOWN' : 'DEGRADED',
    consecutiveFailures,
    lastSuccessAt: previous.lastSuccessAt ?? null,
    lastFailureAt: at,
    recoveredAt: null,
  };
}
