import test from 'node:test';
import assert from 'node:assert/strict';
import { marketExpectedOpen, classifyGap } from '../src/market-calendar.mjs';

const crypto = {
  timezone: 'UTC',
  mode: '24x7',
};

const weekdayMarket = {
  timezone: 'UTC',
  mode: 'weekly',
  sessions: {
    1: [['09:00','17:00']],
    2: [['09:00','17:00']],
    3: [['09:00','17:00']],
    4: [['09:00','17:00']],
    5: [['09:00','17:00']],
  },
  holidays: ['2026-10-06'],
};

test('24x7 calendar is always expected open', () => {
  assert.equal(marketExpectedOpen(new Date('2026-10-04T03:00:00Z'), crypto), true);
});

test('weekly calendar observes session windows', () => {
  assert.equal(marketExpectedOpen(new Date('2026-10-05T10:00:00Z'), weekdayMarket), true);
  assert.equal(marketExpectedOpen(new Date('2026-10-05T18:00:00Z'), weekdayMarket), false);
});

test('weekly calendar observes explicit holidays', () => {
  assert.equal(marketExpectedOpen(new Date('2026-10-06T10:00:00Z'), weekdayMarket), false);
});

test('gap during closed market is not classified as outage', () => {
  assert.equal(classifyGap({
    from: new Date('2026-10-05T17:30:00Z'),
    to: new Date('2026-10-06T08:30:00Z'),
    calendar: weekdayMarket,
    probeMinutes: 30,
  }), 'EXPECTED_CLOSED');
});

test('gap during expected-open session is classified as missing data', () => {
  assert.equal(classifyGap({
    from: new Date('2026-10-05T10:00:00Z'),
    to: new Date('2026-10-05T10:30:00Z'),
    calendar: weekdayMarket,
    probeMinutes: 5,
  }), 'MISSING_DATA');
});
