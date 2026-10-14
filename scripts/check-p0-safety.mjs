// P0 repository guard: static, read-only and deliberately fail-closed.
// Not a legal-license validation, runtime security audit or production deployment gate.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_BLOCK_PATTERN = /navasan_ohlc|ohlcSearch|candle_source_provenance|chartnova_navasan_candle_audit/i;

export async function evaluateP0Safety(root = ownRoot) {
  const violations = [];
  const migrationDir = join(root, 'db', 'migrations');
  let migrations;
  try {
    migrations = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql'));
  } catch {
    return { ok: false, violations: ['Cannot enumerate db/migrations; safety review required.'] };
  }
  for (const filename of migrations) {
    const contents = await readFile(join(migrationDir, filename), 'utf8');
    if (filename === '0005_navasan_private_daily_ohlc.sql' || MIGRATION_BLOCK_PATTERN.test(contents)) {
      violations.push(filename + ': Navasan/OHLC migration HOLD; verify exact units, quote-side, license, provenance and review before changing this guard.');
    }
  }

  try {
    const adapter = await readFile(join(root, 'packages', 'market-domain', 'src', 'adapters', 'navasan.mjs'), 'utf8');
    if (!/rawUnit:\s*['"]IRR_PER_USD['"]/.test(adapter) || !/rawUnit:\s*['"]IRR_PER_GRAM['"]/.test(adapter)) {
      violations.push('Navasan adapter raw-unit contract changed; manual unit/quote-side review required.');
    }
  } catch {
    violations.push('Navasan adapter missing or unreadable; manual review required.');
  }

  try {
    const agentRules = await readFile(join(root, 'AGENTS.md'), 'utf8');
    if (!/AI\/signals may never directly execute an order\./.test(agentRules)) {
      violations.push('AI-to-live-order prohibition in AGENTS.md changed or missing.');
    }
  } catch {
    violations.push('AGENTS.md missing or unreadable; manual review required.');
  }

  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? resolve(process.argv[2]) : ownRoot;
  const outcome = await evaluateP0Safety(root);
  if (outcome.ok) {
    console.log('P0 static guard: PASS (no blocked migration detected; baseline contracts present).');
  } else {
    for (const item of outcome.violations) console.error('P0 static guard: BLOCK - ' + item);
    process.exitCode = 1;
  }
  console.log('Reminder: PASS does not establish market-data licensing, valid live feeds or trading safety.');
}
