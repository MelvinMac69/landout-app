/**
 * FAA NASR Airport Adapter
 *
 * Parses FAA NASR APT_CSV data and seeds the landing_sites table.
 *
 * PRIMARY SOURCE: Official FAA 28-Day NASR Subscription
 *   https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/
 *
 * Download the "28 Day NASR Subscription" ZIP, extract it, and use the
 * APT_BASE.csv file inside the APT_CSV subdirectory.
 *
 * Expected files from FAA NASR package:
 *   APT_CSV/APT_BASE.csv    ← airport identifiers, coordinates, elevation
 *   APT_CSV/APT_RWY.csv    ← runway dimensions, surfaces
 *   APT_CSV/APT_RWY_END.csv ← runway end details
 *
 * DEV CONVENIENCE (NOT for production):
 *   The GitHub-processed CSV from tlarsendataguy/us_airspace_data may be used
 *   for local development only if you have not yet downloaded the FAA package.
 *   Mark clearly as "FAA-derived (pre-processed by third party)" in source.
 *
 * FAA data cycle: Every 28 days (AIRAC)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FAAAirportRecord {
  icao: string;
  iata: string | null;
  faa_ident: string;
  name: string;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  country: string;
  state: string | null;
  county: string | null;
  city: string | null;
  runway_length_ft: number | null;
  runway_width_ft: number | null;
  runway_surface: string | null;
  traffic_type: string | null;
  control_tower: string | null;
  fuel_types: string | null;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  basePath: string;
  dryRun: boolean;
  supabaseUrl?: string;
  serviceRoleKey?: string;
} {
  const args = process.argv.slice(2);
  const flags: ReturnType<typeof parseArgs> = {
    basePath: '',
    dryRun: false,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') flags.dryRun = true;
    if (arg === '--base' && args[i + 1]) flags.basePath = args[++i];
    if (arg === '--url' && args[i + 1]) flags.supabaseUrl = args[++i];
    if (arg === '--key' && args[i + 1]) flags.serviceRoleKey = args[++i];
  }

  return flags;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line — handles quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse FAA APT_BASE.csv into structured records.
 * Uses the field position mapping from the official FAA NASR CSV layout.
 */
export function parseFAAFile(csvPath: string): FAAAirportRecord[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`FAA CSV file not found: ${csvPath}\n\nDownload from:\nhttps://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/\n\nLook for "28 Day NASR Subscription" → Download → Extract → APT_CSV/APT_BASE.csv`);
  }

  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV has no data rows');
  }

  // The FAA NASR CSV has a header row — parse it to find column positions
  const header = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  console.log(`FAA CSV headers: ${header.slice(0, 10).join(', ')}...`);

  // Field position indices (0-based)
  // These match the FAA NASR APT_BASE.csv field layout
  const idx = (name: string): number => {
    const found = header.findIndex(
      (h) => h.toUpperCase() === name.toUpperCase() || h.toUpperCase().includes(name.toUpperCase())
    );
    return found;
  };

  const ICAO = idx('ICAO');
  const IATA = idx('IATA');
  const FAA_ID = idx('FAA');
  const NAME = idx('NAME');
  const LAT = idx('LAT');
  const LON = idx('LON');
  const ELEV = idx('ELEV');
  const CTY = idx('CITY');
  const STATE = idx('STATE');
  const COUNTY = idx('COUNTY');
  const CTLR = idx('CTLR');
  const FUEL = idx('FUEL');
  const TRAF = idx('TRAF');

  // runway fields from APT_RWY (joined separately if needed)
  // For MVP, we parse runway length from APT_BASE if available

  const records: FAAAirportRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < header.length) continue;

    const get = (colIdx: number): string =>
      colIdx >= 0 && colIdx < values.length ? values[colIdx]?.trim() || '' : '';
    const getNum = (colIdx: number): number | null => {
      const v = get(colIdx).replace(/[^\d.\-]/g, '');
      return v && !isNaN(parseFloat(v)) ? parseFloat(v) : null;
    };

    const icao = get(ICAO).toUpperCase().trim();
    // Skip records without an ICAO code
    if (!icao || icao === 'NULL' || icao === '0') continue;

    records.push({
      icao,
      iata: get(IATA) || null,
      faa_ident: get(FAA_ID) || icao,
      name: get(NAME) || 'Unknown',
      lat: getNum(LAT) ?? 0,
      lon: getNum(LON) ?? 0,
      elevation_ft: getNum(ELEV),
      country: 'USA',
      state: get(STATE) || null,
      county: get(COUNTY) || null,
      city: get(CTY) || null,
      // Runway fields — may come from APT_RWY.csv in a future iteration
      runway_length_ft: null,
      runway_width_ft: null,
      runway_surface: null,
      traffic_type: get(TRAF) || null,
      control_tower: get(CTLR) || null,
      fuel_types: get(FUEL) || null,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Runway surface normalization
// ---------------------------------------------------------------------------

/**
 * Normalize FAA runway surface codes to our enum values.
 * FAA surface codes: Paved (ASP, CON), Turf (TURF), Dirt (DIRT), Gravel (GRL), etc.
 */
export function normalizeSurface(surface: string | null): string | null {
  if (!surface) return null;
  const s = surface.toUpperCase();

  if (s.includes('ASP') || s.includes('CON') || s.includes('PAV')) return 'paved';
  if (s.includes('TURF') || s.includes('GRASS')) return 'grass';
  if (s.includes('DIRT') || s.includes('EARTH') || s.includes('NATVE')) return 'dirt';
  if (s.includes('GRL') || s.includes('CALICHE')) return 'gravel';
  if (s.includes('SNOW') || s.includes('ICE')) return 'snow';
  if (s.includes('WATER')) return 'water';
  if (s.includes('SAND')) return 'dirt';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Supabase seeding
// ---------------------------------------------------------------------------

export async function seedFAAAirports(options: {
  csvPath: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  dryRun?: boolean;
}): Promise<{ total: number; inserted: number; errors: number }> {
  const { csvPath, supabaseUrl, serviceRoleKey, dryRun = false } = options;

  console.log('='.repeat(50));
  console.log('FAA NASR Import — Airport Reference Data');
  console.log('='.repeat(50));
  console.log(`Source: ${csvPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);

  // Parse CSV
  const airports = parseFAAFile(csvPath);
  console.log(`\nParsed ${airports.length} airport records`);

  if (dryRun) {
    console.log('\nSample records (first 5):');
    airports.slice(0, 5).forEach((a) => {
      console.log(`  ${a.icao} | ${a.name} | ${a.lat},${a.lon} | ${a.state || 'n/a'}`);
    });
    return { total: airports.length, inserted: 0, errors: 0 };
  }

  // Connect to Supabase
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Batch insert
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  const nasrCycleDate = extractNASRCycleDate(csvPath);

  for (let i = 0; i < airports.length; i += batchSize) {
    const batch = airports.slice(i, i + batchSize);

    const records = batch.map((a) => ({
      name: a.name,
      icao_code: a.icao,
      faa_id: a.faa_ident,
      source: 'faa_nasr',
      source_type: 'official_reference',
      source_url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/',
      approval_status: 'approved',
      location: a.lat && a.lon ? `SRID=4326;POINT(${a.lon} ${a.lat})` : null,
      elevation_ft: a.elevation_ft,
      runway_length_ft: a.runway_length_ft,
      runway_surface: a.runway_surface,
      description: buildDescription(a),
      site_type: 'airport',
      nasr_cycle_date: nasrCycleDate,
    }));

    const { error } = await supabase.from('landing_sites').insert(records);

    if (error) {
      console.error(`  Batch error at offset ${i}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${airports.length}...`);
    }
  }

  console.log(`\n\nDone: ${inserted} inserted, ${errors} errors`);

  return { total: airports.length, inserted, errors };
}

/**
 * Try to extract the NASR cycle date from the file path.
 * FAA filenames contain the effective date (e.g., dd_Mon_yyyy_APT_CSV.zip).
 */
function extractNASRCycleDate(csvPath: string): string | null {
  // Try to find a date pattern in the path
  const dateMatch = csvPath.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
  if (dateMatch) {
    return dateMatch[1].replace(/_/g, '-');
  }
  // Fallback to today's date as placeholder
  return new Date().toISOString().split('T')[0];
}

/**
 * Build a human-readable description from FAA record fields.
 */
function buildDescription(a: FAAAirportRecord): string | null {
  const parts: string[] = [];
  if (a.city && a.state) parts.push(`Near ${a.city}, ${a.state}`);
  if (a.county) parts.push(`${a.county} County`);
  if (a.traffic_type) parts.push(`Traffic: ${a.traffic_type}`);
  if (a.control_tower === 'Y') parts.push('Has control tower');
  if (a.fuel_types) parts.push(`Fuel: ${a.fuel_types}`);
  const result = parts.join('. ');
  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = parseArgs();

  if (!args.basePath) {
    console.error(`
❌ Missing --base flag.

Usage:
  npm run import:faa -- --base ./path/to/APT_BASE.csv
  npm run import:faa -- --dry-run --base ./path/to/APT_BASE.csv

To download FAA data:
  1. Go to: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/
  2. Download "28 Day NASR Subscription"
  3. Extract the ZIP
  4. Find APT_CSV/APT_BASE.csv inside
  5. Run this script with --base pointing to that file
`);
    process.exit(1);
  }

  if (!args.supabaseUrl || !args.serviceRoleKey) {
    console.error('❌ Missing Supabase credentials.');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  seedFAAAirports({
    csvPath: args.basePath,
    supabaseUrl: args.supabaseUrl,
    serviceRoleKey: args.serviceRoleKey,
    dryRun: args.dryRun,
  })
    .then((result) => {
      if (result.errors > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Import failed:', err.message);
      process.exit(1);
    });
}
