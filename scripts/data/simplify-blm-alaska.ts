/**
 * Simplify only Alaska features in sma-blm.geojson.
 * Alaska has ~11M coords making the file 92MB.
 * Simplifying Alaska to ~100m tolerance reduces it to ~5MB.
 * Non-Alaska features are kept as-is.
 * 
 * Usage: npx tsx scripts/data/simplify-blm-alaska.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT = path.join(process.cwd(), 'public', 'data', 'sma-blm.geojson');
const OUTPUT = path.join(process.cwd(), 'public', 'data', 'sma-blm.geojson.tmp');
const META_OUTPUT = path.join(process.cwd(), 'public', 'data', 'sma-blm.geojson');

async function main() {
  console.log('Loading sma-blm.geojson...');
  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8')) as GeoJSON.FeatureCollection;
  console.log(`Total features: ${raw.features.length}`);

  const { featureCollection, simplify } = await import('@turf/turf');

  // Separate Alaska vs non-Alaska
  const alaska: GeoJSON.Feature[] = [];
  const others: GeoJSON.Feature[] = [];

  for (const f of raw.features) {
    if (!f.geometry) continue;
    const state = (f.properties as Record<string, unknown>)?.state as string;
    if (state === 'AK') {
      alaska.push(f);
    } else {
      others.push(f);
    }
  }

  console.log(`Alaska: ${alaska.length} features, others: ${others.length} features`);

  // Simplify Alaska features with 0.001° tolerance (~100m at 64°N)
  // Only simplify if feature has more than 50 coordinates (not already very simple)
  const SIMPLIFY_TOLERANCE = 0.001;

  const simplifiedAlaska: GeoJSON.Feature[] = [];
  let skipped = 0;
  let totalOriginal = 0;
  let totalSimplified = 0;

  for (const f of alaska) {
    if (!f.geometry) continue;
    // Count coords
    let coordCount = 0;
    if (f.geometry.type === 'Polygon') {
      coordCount = (f.geometry as GeoJSON.Polygon).coordinates.reduce((s, r) => s + r.length, 0);
    } else if (f.geometry.type === 'MultiPolygon') {
      coordCount = (f.geometry as GeoJSON.MultiPolygon).coordinates.reduce(
        (s, poly) => s + poly.reduce((s2, r) => s2 + r.length, 0), 0
      );
    }
    totalOriginal += coordCount;

    if (coordCount > 50) {
      try {
        const fc = featureCollection([f]);
        const simplified = simplify(fc, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true });
        const sf = simplified.features[0];
        if (sf.geometry) {
          let newCount = 0;
          if (sf.geometry.type === 'Polygon') {
            newCount = (sf.geometry as GeoJSON.Polygon).coordinates.reduce((s, r) => s + r.length, 0);
          } else if (sf.geometry.type === 'MultiPolygon') {
            newCount = (sf.geometry as GeoJSON.MultiPolygon).coordinates.reduce(
              (s, poly) => s + poly.reduce((s2, r) => s2 + r.length, 0), 0
            );
          }
          totalSimplified += newCount;
          simplifiedAlaska.push(sf);
        } else {
          skipped++;
          simplifiedAlaska.push(f);
        }
      } catch {
        skipped++;
        simplifiedAlaska.push(f);
      }
    } else {
      totalSimplified += coordCount;
      simplifiedAlaska.push(f);
    }
  }

  console.log(`Alaska simplification: ${alaska.length} features`);
  console.log(`  Original coords: ${totalOriginal.toLocaleString()}`);
  console.log(`  Simplified coords: ${totalSimplified.toLocaleString()}`);
  console.log(`  Reduction: ${((1 - totalSimplified/totalOriginal)*100).toFixed(1)}%`);
  console.log(`  Skipped (already simple): ${skipped}`);

  // Combine: simplified Alaska + original others
  const result: GeoJSON.FeatureCollection = {
    ...raw,
    features: [...simplifiedAlaska, ...others],
  };

  // Update metadata
  (result as Record<string, unknown>)._metadata = {
    name: 'sma-blm',
    label: 'BLM Land',
    source: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer/1',
    sourceClassification: 'official generalized - interim',
    importDate: '2026-04-03',
    notes: 'Alaska simplified to ~100m tolerance. Limited-scale dataset — better than field-office breakdown which is not available in this service.',
    simplificationNote: `Alaska reduced from ${totalOriginal.toLocaleString()} to ${totalSimplified.toLocaleString()} coords (${((1-totalSimplified/totalOriginal)*100).toFixed(0)}% reduction)`,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(result));

  const outSize = fs.statSync(OUTPUT).statSize;
  console.log(`\nOutput size: ${(outSize/1024/1024).toFixed(1)} MB`);
  console.log(`Reduction: ${((1-outSize/fs.statSync(INPUT).statSize)*100).toFixed(0)}%`);

  if (outSize < 50 * 1024 * 1024) {
    fs.renameSync(OUTPUT, META_OUTPUT);
    console.log('✓ Replaced original with simplified version');
  } else {
    console.log('⚠ Still too large, need more simplification');
    fs.unlinkSync(OUTPUT);
  }
}

main().catch(console.error);
