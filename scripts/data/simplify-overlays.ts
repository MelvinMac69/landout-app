/**
 * Simplify overlay GeoJSON files for web rendering.
 *
 * Usage:
 *   npx tsx scripts/data/simplify-overlays.ts
 *
 * Tolerance in coordinate degrees. Lower = more accurate.
 * 0.001° ≈ 100m at equator. Use higher values for big files.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

const FILES = [
  { name: 'wilderness.geojson',       tolerance: 0.001, description: 'Wilderness Areas' },
  { name: 'wsa.geojson',             tolerance: 0.001, description: 'Wilderness Study Areas' },
  { name: 'fs-wilderness.geojson',    tolerance: 0.001, description: 'USFS Wilderness' },
  { name: 'sma-blm.geojson',         tolerance: 0.002, description: 'BLM Land' },
  { name: 'sma-usfs.geojson',        tolerance: 0.002, description: 'USFS Land' },
  { name: 'sma-fws.geojson',         tolerance: 0.002, description: 'FWS Land' },
  { name: 'sma-nps.geojson',         tolerance: 0.002, description: 'NPS Land' },
];

async function simplifyFile(filename: string, tolerance: number): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ ${filename} not found — skipping`);
    return;
  }

  const originalSize = fs.statSync(filePath).size;
  console.log(`  ${filename}: ${(originalSize / 1024 / 1024).toFixed(2)} MB before simplification`);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GeoJSON.FeatureCollection;
  console.log(`  ${raw.features.length} features`);

  // Filter out null geometries before processing
  const validFeatures = raw.features.filter((f) => f.geometry !== null);
  if (validFeatures.length < raw.features.length) {
    console.log(`  ⚠ Skipped ${raw.features.length - validFeatures.length} features with null geometry`);
  }

  if (validFeatures.length === 0) {
    console.log(`  ⚠ No valid features — skipping`);
    return;
  }

  const { featureCollection, simplify } = await import('@turf/turf');

  const fc = featureCollection(validFeatures);
  const simplified = simplify(fc, {
    tolerance,
    highQuality: true,
  });

  const outPath = filePath + '.tmp';
  fs.writeFileSync(outPath, JSON.stringify(simplified));

  const newSize = fs.statSync(outPath).size;
  console.log(`  → ${(newSize / 1024 / 1024).toFixed(2)} MB after (${((1 - newSize / originalSize) * 100).toFixed(0)}% reduction)`);

  if (newSize < originalSize * 0.85 && newSize < 5 * 1024 * 1024) {
    fs.renameSync(outPath, filePath);
    console.log(`  ✓ Replaced original`);
  } else if (newSize >= 5 * 1024 * 1024) {
    console.log(`  ⚠ Exceeds 5MB — keeping original`);
    fs.unlinkSync(outPath);
  } else {
    console.log(`  ⚠ Marginal savings — keeping original`);
    fs.unlinkSync(outPath);
  }
}

async function main() {
  console.log('Simplifying overlay GeoJSON files...\n');

  for (const file of FILES) {
    console.log(`Processing ${file.description} (tolerance=${file.tolerance})...`);
    try {
      await simplifyFile(file.name, file.tolerance);
    } catch (err) {
      console.log(`  ✗ Error: ${err}`);
    }
  }

  console.log('\nDone. Commit the updated public/data/*.geojson files.');
}

main().catch(console.error);