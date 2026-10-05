const WEEKDAY = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

function partsAt(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) throw new TypeError('date must be valid');
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return {
    weekday: WEEKDAY[parts.weekday],
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function hhmmToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new RangeError(`invalid session time: ${value}`);
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) throw new RangeError(`invalid session time: ${value}`);
  return h * 60 + m;
}

export function marketExpectedOpen(date, calendar) {
  if (!calendar || typeof calendar !== 'object') throw new TypeError('calendar is required');
  if (calendar.mode === '24x7') return true;
  if (calendar.mode !== 'weekly') throw new RangeError(`unsupported calendar mode: ${calendar.mode}`);
  if (!calendar.timezone) throw new TypeError('calendar.timezone is required');

  const local = partsAt(date, calendar.timezone);
  if (calendar.holidays?.includes(local.dateKey)) return false;

  const sessions = calendar.sessions?.[local.weekday] ?? [];
  return sessions.some(([start, end]) => {
    const startMin = hhmmToMinutes(start);
    const endMin = hhmmToMinutes(end);
    return local.minutes >= startMin && local.minutes < endMin;
  });
}

export function classifyGap({ from, to, calendar, probeMinutes = 5 }) {
  if (!(from instanceof Date) || Number.isNaN(from.valueOf())) throw new TypeError('from must be valid');
  if (!(to instanceof Date) || Number.isNaN(to.valueOf())) throw new TypeError('to must be valid');
  if (to <= from) throw new RangeError('to must be after from');
  if (!Number.isFinite(probeMinutes) || probeMinutes <= 0) throw new RangeError('probeMinutes must be positive');

  const stepMs = probeMinutes * 60_000;
  for (let t = from.valueOf(); t <= to.valueOf(); t += stepMs) {
    if (marketExpectedOpen(new Date(t), calendar)) return 'MISSING_DATA';
  }
  return 'EXPECTED_CLOSED';
}
