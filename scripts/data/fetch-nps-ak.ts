import * as fs from 'fs';

/**
 * Fetches Alaska NPS park boundaries.
 *
 * Sources tried:
 * 1. UNM RGIS NPS Boundaries — GeoJSON URL returns zip file (not directly accessible)
 * 2. ArcGIS Online NPS Boundaries — service exists but query returns Bad Request
 * 3. NPS ArcGIS REST API — service returns 404
 *
 * NOTE: Alaska NPS parks ARE included in the BLM Alaska SMA dataset
 * (sma-blm-ak.geojson) with agency_code === 'NPS'. The sma-blm-ak-fill
 * layer will display NPS parks in Alaska with agency_code-based coloring.
 * This file is kept as a placeholder for future enhancement when a direct
 * NPS GeoJSON source becomes available.
 */

const OUTPUT_PATH = 'public/data/nps-ak.geojson';

async function main() {
  console.log('Note: Direct NPS Alaska GeoJSON source not currently accessible.');
  console.log('NPS parks in Alaska are covered by sma-blm-ak.geojson (agency_code=NPS).');

  // Write an empty placeholder with metadata
  const out: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
    _metadata: {
      name: 'nps-ak',
      label: 'Alaska National Parks (NPS)',
      source: 'placeholder — NPS parks included in sma-blm-ak.geojson (agency_code=NPS)',
      sourceClassification: 'official authoritative',
      importDate: new Date().toISOString().split('T')[0],
      notes: 'NPS parks are displayed via sma-blm-ak-fill layer with agency_code=NPS, colored #6B21A8 (purple).',
      featureCount: 0,
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out));
  const sizeKB = fs.statSync(OUTPUT_PATH).size / 1024;
  console.log(`Wrote placeholder ${OUTPUT_PATH} (${sizeKB.toFixed(1)} KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
