/**
 * VELYQOR paper-only position risk simulation.
 * NO BROKER, WALLET, EXCHANGE, NETWORK, DATABASE or LIVE ORDER calls.
 * Price inputs are caller-supplied scenarios, NEVER claimed as executable market quotes.
 */
const MAX_BPS = 500;
const asPositive = (value, name) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x <= 0) throw new RangeError(name + ' must be positive and finite');
  return x;
};
const asPercent = (value, name) => {
  const x = asPositive(value, name);
  if (x >= 100) throw new RangeError(name + ' must be below 100%');
  return x;
};
const asBps = (value, name) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x < 0 || x > MAX_BPS) {
    throw new RangeError(name + ' must be in [0, 500] basis points');
  }
  return x;
};
const asTimestamp = (timestamp, name) => {
  if (typeof timestamp !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError(name + ' must be a valid ISO timestamp with timezone');
  }
  return new Date(timestamp).toISOString();
};
const decimal = (x) => {
  const rounded = Math.round(x * 1e10) / 1e10;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const sideSign = (side) => side === 'LONG' ? 1 : -1;

export function openPaperPosition({
  symbol, side = 'LONG', entryPrice, capital, stopLossPercent,
  takeProfitPercent, trailingStopPercent = null, commissionBps = 0,
  slippageBps = 0, at
}) {
  if (typeof symbol !== 'string' || !/^[A-Z0-9_]{3,48}$/.test(symbol)) {
    throw new TypeError('invalid canonical symbol');
  }
  if (!['LONG', 'SHORT'].includes(side)) throw new TypeError('side must be LONG or SHORT');
  const entry = asPositive(entryPrice, 'entryPrice');
  const budget = asPositive(capital, 'capital');
  const loss = asPercent(stopLossPercent, 'stopLossPercent');
  const profit = asPercent(takeProfitPercent, 'takeProfitPercent');
  const trailing = trailingStopPercent === null || trailingStopPercent === '' ?
    null : asPercent(trailingStopPercent, 'trailingStopPercent');
  const fee = asBps(commissionBps, 'commissionBps');
  const slip = asBps(slippageBps, 'slippageBps');
  const enteredAt = asTimestamp(at, 'at');
  const direction = sideSign(side);
  const initialStop = decimal(entry * (1 - direction * loss / 100));
  const takeProfit = decimal(entry * (1 + direction * profit / 100));
  const trailStop = trailing === null ? null : decimal(entry * (1 - direction * trailing / 100));
  const stopPrice = trailing === null ? initialStop :
    side === 'LONG' ? Math.max(initialStop, trailStop) : Math.min(initialStop, trailStop);
  const quantity = budget / entry;
  return {
    kind: 'PAPER_POSITION', version: 1, symbol, side, status: 'OPEN',
    currency: 'QUOTE_UNIT', capital: budget, entryPrice: entry, quantity,
    entryAt: enteredAt, lastAt: enteredAt, markPrice: entry,
    highestPrice: entry, lowestPrice: entry,
    rules: { stopLossPercent: loss, takeProfitPercent: profit,
      trailingStopPercent: trailing, commissionBps: fee, slippageBps: slip },
    initialStop, stopPrice, takeProfitPrice: takeProfit,
    estimatedPnL: decimal(-budget * fee / 10000 * 2),
    realizedPnL: null, exit: null,
    events: [{ type: 'OPEN', at: enteredAt, price: entry, source: 'MANUAL_SCENARIO' }]
  };
}
function checkOpen(position) {
  if (!position || position.kind !== 'PAPER_POSITION' || position.status !== 'OPEN')
    throw new TypeError('an OPEN paper position is required');
}
function outcome(position, price) {
  const sign = sideSign(position.side);
  const { commissionBps, slippageBps } = position.rules;
  const executed = price * (1 - sign * slippageBps / 10000);
  const entryFee = position.entryPrice * position.quantity * commissionBps / 10000;
  const exitFee = executed * position.quantity * commissionBps / 10000;
  return {
    fillPrice: decimal(executed),
    netPnL: decimal(sign * (executed - position.entryPrice) * position.quantity - entryFee - exitFee),
    fees: decimal(entryFee + exitFee)
  };
}
export function markPaperPosition(position, { price, at }) {
  checkOpen(position);
  const quote = asPositive(price, 'scenario price');
  const timestamp = asTimestamp(at, 'at');
  if (Date.parse(timestamp) <= Date.parse(position.lastAt))
    throw new RangeError('scenario timestamps must strictly increase');
  const high = Math.max(position.highestPrice, quote);
  const low = Math.min(position.lowestPrice, quote);
  const { trailingStopPercent } = position.rules;
  let stop = position.initialStop;
  if (trailingStopPercent !== null) {
    const trailingStop = position.side === 'LONG' ?
      high * (1 - trailingStopPercent / 100) :
      low * (1 + trailingStopPercent / 100);
    stop = position.side === 'LONG' ? Math.max(stop, trailingStop) : Math.min(stop, trailingStop);
  }
  stop = decimal(stop);
  const stopHit = position.side === 'LONG' ? quote <= stop : quote >= stop;
  const profitHit = position.side === 'LONG' ? quote >= position.takeProfitPrice : quote <= position.takeProfitPrice;
  const event = { type: 'MARK', at: timestamp, price: quote, source: 'MANUAL_SCENARIO' };
  const changed = {
    ...position, lastAt: timestamp, markPrice: quote,
    highestPrice: high, lowestPrice: low, stopPrice: stop,
    events: [...position.events, event]
  };
  if (stopHit || profitHit) return exitPaperPosition(changed, {
    price: quote, at: timestamp, reason: stopHit ? 'STOP' : 'TAKE_PROFIT', alreadyMarked: true
  });
  return { ...changed, estimatedPnL: outcome(changed, quote).netPnL };
}
function exitPaperPosition(position, { price, at, reason, alreadyMarked = false }) {
  const fill = outcome(position, price);
  return {
    ...position, status: 'CLOSED', markPrice: price,
    lastAt: at, estimatedPnL: fill.netPnL, realizedPnL: fill.netPnL,
    exit: { reason, at, observedPrice: price, fillPrice: fill.fillPrice, fees: fill.fees,
      caution: 'scenario observed price and conservative model slippage; not a guaranteed executable fill' },
    events: [...position.events, { type: 'CLOSE', reason, at, observedPrice: price,
      fillPrice: fill.fillPrice, source: 'MANUAL_SCENARIO' }]
  };
}
export function closePaperPosition(position, { price, at }) {
  checkOpen(position);
  const quote = asPositive(price, 'price');
  const timestamp = asTimestamp(at, 'at');
  if (Date.parse(timestamp) <= Date.parse(position.lastAt)) throw new RangeError('timestamp must increase');
  return exitPaperPosition(position, { price: quote, at: timestamp, reason: 'MANUAL' });
}
export function paperRiskSummary(position) {
  if (!position || position.kind !== 'PAPER_POSITION') throw new TypeError('invalid paper position');
  return {
    symbol: position.symbol, side: position.side, status: position.status,
    entryPrice: position.entryPrice, markPrice: position.markPrice,
    stopPrice: position.stopPrice, takeProfitPrice: position.takeProfitPrice,
    capital: position.capital, quantity: position.quantity,
    netPnL: position.status === 'CLOSED' ? position.realizedPnL : position.estimatedPnL,
    netPnLPct: decimal(100 * (position.status === 'CLOSED' ?
      position.realizedPnL : position.estimatedPnL) / position.capital),
    exitReason: position.exit?.reason ?? null,
    eventCount: position.events.length,
  };
}
