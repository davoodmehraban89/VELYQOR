const REQUIRED = Object.freeze(['GOLD18_IRT', 'USD_IRT_FREE', 'XAU_USD']);

export function buildDataProofArtifact({ generatedAt, reports }) {
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.valueOf())) throw new TypeError('generatedAt must be a valid Date');
  if (!Array.isArray(reports)) throw new TypeError('reports must be an array');

  const seen = new Set();
  for (const report of reports) {
    if (!report || typeof report !== 'object') throw new TypeError('each report must be an object');
    if (!report.providerCode || !report.canonicalSymbol) throw new TypeError('report providerCode and canonicalSymbol are required');
    if (!['PASS', 'FAIL'].includes(report.status)) throw new RangeError('report status must be PASS or FAIL');
    if (seen.has(report.canonicalSymbol)) throw new RangeError(`duplicate report for ${report.canonicalSymbol}`);
    seen.add(report.canonicalSymbol);
    const checked = new Date(report.checkedAt);
    if (Number.isNaN(checked.valueOf())) throw new TypeError('report checkedAt must be valid');
    if (checked > generatedAt) throw new RangeError('report checkedAt cannot be after generatedAt');
  }

  const missing = REQUIRED.filter(symbol => !seen.has(symbol));
  if (missing.length) throw new RangeError(`required Phase 1 reports missing: ${missing.join(', ')}`);

  const requiredReports = reports
    .filter(report => REQUIRED.includes(report.canonicalSymbol))
    .sort((a, b) => a.canonicalSymbol.localeCompare(b.canonicalSymbol));

  return Object.freeze({
    phase: 1,
    generatedAt: generatedAt.toISOString(),
    status: requiredReports.every(report => report.status === 'PASS') ? 'PASS' : 'FAIL',
    requiredSymbols: [...REQUIRED],
    reports: requiredReports.map(report => Object.freeze({ ...report })),
  });
}
