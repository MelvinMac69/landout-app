/**
 * Combined data import script.
 *
 * Runs all (or selected) data adapters in sequence.
 *
 * Usage:
 *   npx tsx scripts/data/import-all.ts                 # All data
 *   npx tsx scripts/data/import-all.ts --overlays      # BLM + wilderness only
 *   npx tsx scripts/data/import-all.ts --faa           # FAA only
 *   npx tsx scripts/data/import-all.ts --dry-run       # Preview all (no writes)
 *
 * For FAA imports, also specify the local CSV path:
 *   npx tsx scripts/data/import-all.ts --faa --base ./data/APT_BASE.csv
 */

import { importBLMSMA } from './adapters/blm-sma';
import { importWildernessData } from './adapters/wilderness';
import { seedFAAAirports } from './adapters/faa-nasr';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface ImportFlags {
  dryRun: boolean;
  overlaysOnly: boolean;
  faaOnly: boolean;
  faaBasePath?: string;
}

function parseArgs(): ImportFlags {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    overlaysOnly: args.includes('--overlays'),
    faaOnly: args.includes('--faa'),
    faaBasePath: (() => {
      const idx = args.indexOf('--base');
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
    })(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs();
  const results: Record<string, unknown> = {};

  console.log('='.repeat(50));
  console.log('Backcountry Map — Data Import Pipeline');
  console.log('='.repeat(50));
  console.log(`Mode: ${flags.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (flags.faaOnly) console.log('Scope: FAA data only');
  else if (flags.overlaysOnly) console.log('Scope: Overlays only');
  else console.log('Scope: All data');
  console.log('');

  // ── Overlays ───────────────────────────────────────────────────────────
  if (!flags.faaOnly) {
    console.log('\n### OVERLAYS ###\n');

    try {
      console.log('[1/2] BLM Surface Management Agency...');
      results.blmSMA = await importBLMSMA();
    } catch (err) {
      console.error('BLM SMA import failed:', (err as Error).message);
      results.blmSMA = { error: (err as Error).message };
    }

    try {
      console.log('\n[2/2] Wilderness / WSA...');
      results.wilderness = await importWildernessData();
    } catch (err) {
      console.error('Wilderness/WSA import failed:', (err as Error).message);
      results.wilderness = { error: (err as Error).message };
    }
  }

  // ── FAA data ────────────────────────────────────────────────────────────
  if (!flags.overlaysOnly) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('\n⚠️  Skipping FAA import — Supabase credentials not set.');
      console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    } else if (!flags.faaBasePath) {
      console.error('\n⚠️  Skipping FAA import — --base <path> not specified.');
      console.error('   Usage: --base ./path/to/APT_BASE.csv');
      console.error('   Download FAA data from: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/');
    } else {
      console.log('\n### FAA AIRPORT DATA ###\n');

      try {
        results.faa = await seedFAAAirports({
          csvPath: flags.faaBasePath,
          supabaseUrl,
          serviceRoleKey,
          dryRun: flags.dryRun,
        });
      } catch (err) {
        console.error('FAA import failed:', (err as Error).message);
        results.faa = { error: (err as Error).message };
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('Import Summary');
  console.log('='.repeat(50));
  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
