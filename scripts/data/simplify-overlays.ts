/**
 * Simplify large GeoJSON overlay files for web rendering.
 *
 * Usage:
 *   npx tsx scripts/data/simplify-overlays.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

const FILES = [
  { name: 'wilderness.geojson', tolerance: 0.005, description: 'Wilderness Areas' },
  { name: 'wsa.geojson', tolerance: 0.005, description: 'Wilderness Study Areas' },
  { name: 'blm-sma.geojson', tolerance: 0.003, description: 'BLM Surface Management Agency' },
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

  // Simplify using @turf/simplify (loaded lazily to avoid memory issues)
  const { featureCollection, simplify } = await import('@turf/turf');

  const fc = featureCollection(raw.features);
  const simplified = simplify(fc, {
    tolerance,
    highQuality: true,
  });

  const outPath = filePath.replace('.geojson', '-simplified.geojson');
  fs.writeFileSync(outPath, JSON.stringify(simplified));

  const newSize = fs.statSync(outPath).size;
  console.log(`  → ${(newSize / 1024 / 1024).toFixed(2)} MB after simplification (${((1 - newSize / originalSize) * 100).toFixed(0)}% reduction)`);

  // Replace original with simplified if much smaller
  if (newSize < originalSize * 0.8) {
    fs.renameSync(outPath, filePath);
    console.log(`  ✓ Replaced original with simplified version`);
  } else {
    console.log(`  ⚠ Simplified file not small enough — keeping original`);
    fs.unlinkSync(outPath);
  }
}

async function main() {
  console.log('Simplifying overlay GeoJSON files for web performance...\n');

  for (const file of FILES) {
    console.log(`Processing ${file.description}...`);
    await simplifyFile(file.name, file.tolerance);
  }

  console.log('\nDone.');
}

main().catch(console.error);
