import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataProofArtifact } from '../src/data-proof-artifact.mjs';

test('builds immutable evidence artifact from three required Phase 1 reports', () => {
  const artifact = buildDataProofArtifact({
    generatedAt: new Date('2026-10-05T12:10:00Z'),
    reports: [
      { providerCode: 'navasan', canonicalSymbol: 'USD_IRT_FREE', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
      { providerCode: 'navasan', canonicalSymbol: 'GOLD18_IRT', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
      { providerCode: 'alpha_vantage', canonicalSymbol: 'XAU_USD', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
    ],
  });
  assert.equal(artifact.phase, 1);
  assert.equal(artifact.status, 'PASS');
  assert.deepEqual(artifact.requiredSymbols, ['GOLD18_IRT','USD_IRT_FREE','XAU_USD']);
});

test('fails aggregate proof when any required report fails', () => {
  const artifact = buildDataProofArtifact({
    generatedAt: new Date('2026-10-05T12:10:00Z'),
    reports: [
      { providerCode: 'navasan', canonicalSymbol: 'USD_IRT_FREE', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
      { providerCode: 'navasan', canonicalSymbol: 'GOLD18_IRT', status: 'FAIL', checkedAt: '2026-10-05T12:09:00Z' },
      { providerCode: 'alpha_vantage', canonicalSymbol: 'XAU_USD', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
    ],
  });
  assert.equal(artifact.status, 'FAIL');
});

test('refuses to certify Phase 1 when a required symbol is missing or duplicated', () => {
  const base = [
    { providerCode: 'navasan', canonicalSymbol: 'USD_IRT_FREE', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
    { providerCode: 'navasan', canonicalSymbol: 'GOLD18_IRT', status: 'PASS', checkedAt: '2026-10-05T12:09:00Z' },
  ];
  assert.throws(() => buildDataProofArtifact({ generatedAt: new Date('2026-10-05T12:10:00Z'), reports: base }), /required/i);
  assert.throws(() => buildDataProofArtifact({ generatedAt: new Date('2026-10-05T12:10:00Z'), reports: [...base, base[0]] }), /duplicate/i);
});
