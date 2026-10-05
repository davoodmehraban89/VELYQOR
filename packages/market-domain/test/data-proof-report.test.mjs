import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataProofReport } from '../src/data-proof-report.mjs';

test('passes a clean provider window with explicit thresholds', () => {
  const report = buildDataProofReport({
    providerCode: 'navasan',
    canonicalSymbol: 'USD_IRT_FREE',
    observations: [
      { timestamp: '2026-10-05T12:00:00Z', price: 100000 },
      { timestamp: '2026-10-05T12:01:00Z', price: 100100 },
      { timestamp: '2026-10-05T12:02:00Z', price: 100050 },
    ],
    checkedAt: new Date('2026-10-05T12:02:10Z'),
    thresholds: { maxGapMs: 90_000, maxFreshnessMs: 60_000, maxDuplicateCount: 0, maxOutOfOrderCount: 0 },
  });
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.failures, []);
  assert.equal(report.metrics.freshnessMs, 10_000);
});

test('fails stale, gapped and duplicate data with auditable reasons', () => {
  const report = buildDataProofReport({
    providerCode: 'navasan',
    canonicalSymbol: 'GOLD18_IRT',
    observations: [
      { timestamp: '2026-10-05T12:00:00Z', price: 100 },
      { timestamp: '2026-10-05T12:00:00Z', price: 100 },
      { timestamp: '2026-10-05T12:05:00Z', price: 101 },
    ],
    checkedAt: new Date('2026-10-05T12:10:00Z'),
    thresholds: { maxGapMs: 120_000, maxFreshnessMs: 60_000, maxDuplicateCount: 0, maxOutOfOrderCount: 0 },
  });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.failures.includes('MAX_GAP_EXCEEDED'));
  assert.ok(report.failures.includes('STALE_LATEST_OBSERVATION'));
  assert.ok(report.failures.includes('DUPLICATE_TIMESTAMPS'));
});

test('refuses to certify an empty observation window', () => {
  assert.throws(() => buildDataProofReport({
    providerCode: 'alpha_vantage', canonicalSymbol: 'XAU_USD', observations: [],
    checkedAt: new Date('2026-10-05T12:00:00Z'),
    thresholds: { maxGapMs: 60_000, maxFreshnessMs: 60_000, maxDuplicateCount: 0, maxOutOfOrderCount: 0 },
  }), /observation/i);
});
