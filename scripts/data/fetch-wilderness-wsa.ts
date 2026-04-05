/**
 * Fetch Wilderness and WSA Overlays from BLM NLCS Generalized
 *
 * Replaces existing wilderness.geojson and wsa.geojson with data from the
 * BLM National NLCS Generalized service, which has significantly better
 * geometry resolution:
 *   Wilderness: 159 coords/polygon (vs 14 in previous data)
 *   WSA:        66 coords/polygon  (vs 8 in previous data)
 *
 * NOTE: The previous imports used wrong field names (WLD_NAME, WLD_DESIG, etc.)
 * from the NLCS WLD WSA source, resulting in all-null properties.
 * NLCS Generalized uses: NLCS_NAME, CASEFILE_NO, ADMIN_ST, Shape__Area, NLCS_ID.
 *
 * Sources:
 *   Wilderness: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/1
 *   WSA:       https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/2
 *
 * Usage:
 *   npx tsx scripts/data/fetch-wilderness-wsa.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const NLCS_GENERALIZED =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer';

const IMPORT_DATE = '2026-04-03';

// NLCS Generalized field names
interface NLCSProperties {
  OBJECTID?: number;
  NLCS_ID?: string;
  NLCS_NAME?: string;
  CASEFILE_NO?: string | null;
  DESIG_DATE?: number | null;   // wilderness only
  ROD_DATE?: number | null;     // WSA only
  WSA_RCMND?: string | null;    // WSA only
  ADMIN_ST?: string;
  Shape__Area?: number;
  Shape__Length?: number;
  DESCRIPTION?: string | null;
  WEBLINK?: string | null;
  GlobalID?: string;
}

type NLCSFeature = GeoJSON.Feature<GeoJSON.Geometry, NLCSProperties>;

function countCoords(geometry: GeoJSON.Geometry): number {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0]?.length ?? 0;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce(
      (sum, poly) => sum + (poly[0]?.length ?? 0),
      0
    );
  }
  return 0;
}

function computeBBox(
  features: GeoJSON.Feature[]
): [number, number, number, number] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  for (const f of features) {
    if (!f.geometry) continue;
    let coords: [number, number][] = [];
    if (f.geometry.type === 'Polygon') {
      coords = f.geometry.coordinates[0] as [number, number][];
    } else if (f.geometry.type === 'MultiPolygon') {
      coords = f.geometry.coordinates.flatMap(p => p[0] as [number, number][]);
    }
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

async function fetchLayer(layerId: number): Promise<NLCSFeature[]> {
  const allFeatures: NLCSFeature[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${NLCS_GENERALIZED}/${layerId}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('resultOffset', offset.toString());
    url.searchParams.set('resultRecordCount', batchSize.toString());
    url.searchParams.set('outSR', '4326');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for layer ${layerId}`);
    }

    const data: GeoJSON.FeatureCollection = await res.json();
    const features = (data.features || []) as NLCSFeature[];
    allFeatures.push(...features);

    if (features.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      console.log(`    Fetched ${allFeatures.length}...`);
    }
  }

  return allFeatures;
}

function transformWilderness(f: NLCSFeature): GeoJSON.Feature {
  const p = f.properties ?? {};

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      name: p.NLCS_NAME ?? null,
      designation: p.CASEFILE_NO ?? null,
      agency: 'BLM',
      acres: null, // NLCS Generalized does not include GIS_ACRES
      state: p.ADMIN_ST ?? null,
      wld_code: p.NLCS_ID ?? null,
      area_sqdeg: p.Shape__Area ?? null,
      _meta: {
        source: `${NLCS_GENERALIZED}/1`,
        importDate: IMPORT_DATE,
        state: p.ADMIN_ST ?? null,
        sourceClassification: 'authoritative public source - higher resolution',
      },
    },
  };
}

function transformWSA(f: NLCSFeature): GeoJSON.Feature {
  const p = f.properties ?? {};

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      name: p.NLCS_NAME ?? null,
      designation: p.CASEFILE_NO ?? null,
      agency: 'BLM',
      acres: null,
      state: p.ADMIN_ST ?? null,
      wsa_code: p.NLCS_ID ?? null,
      wsa_rcmnd: p.WSA_RCMND ?? null,
      area_sqdeg: p.Shape__Area ?? null,
      _meta: {
        source: `${NLCS_GENERALIZED}/2`,
        importDate: IMPORT_DATE,
        state: p.ADMIN_ST ?? null,
        sourceClassification: 'authoritative public source - higher resolution',
      },
    },
  };
}

async function processLayer(
  layerId: number,
  name: string,
  label: string,
  transformFn: (f: NLCSFeature) => GeoJSON.Feature
) {
  console.log(`\n  Fetching ${label} (layer ${layerId})...`);

  const rawFeatures = await fetchLayer(layerId);
  console.log(`  Total fetched: ${rawFeatures.length}`);

  // Filter null geometries
  const valid = rawFeatures.filter(f => f.geometry != null);
  const nullGeom = rawFeatures.length - valid.length;
  if (nullGeom > 0) {
    console.warn(`  ⚠️  Rejected ${nullGeom} null-geometry features`);
  }

  // Coordinate stats
  const coordCounts = valid.map(f => countCoords(f.geometry));
  const minC = Math.min(...coordCounts);
  const maxC = Math.max(...coordCounts);
  const avgC = coordCounts.reduce((a, b) => a + b, 0) / coordCounts.length;
  console.log(
    `  Geometry — features: ${valid.length} | coords: min=${minC}, max=${maxC}, avg=${avgC.toFixed(1)}`
  );

  // Transform
  const transformed = valid.map(transformFn);

  // BBox
  const bbox = computeBBox(transformed);
  if (bbox) {
    console.log(
      `  BBox: [${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}, ` +
        `${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]`
    );
  }

  const output = {
    type: 'FeatureCollection',
    _metadata: {
      name,
      label,
      source: `${NLCS_GENERALIZED}/${layerId}`,
      sourceClassification: 'authoritative public source - higher resolution',
      importDate: IMPORT_DATE,
      notes: `Re-imported from BLM NLCS Generalized. Geometry significantly improved vs prior NLCS WLD WSA source. ` +
        `area_sqdeg is Shape__Area in square-degrees (WGS84) — relative measure, not acres.`,
    },
    features: transformed,
  } as GeoJSON.FeatureCollection;

  const outDir = path.join(process.cwd(), 'public', 'data');
  const outPath = path.join(outDir, `${name}.geojson`);
  fs.writeFileSync(outPath, JSON.stringify(output));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  ✅ ${name}.geojson: ${valid.length} features (${sizeKb} KB)`);

  return { layer: name, count: valid.length, path: outPath };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Wilderness / WSA Re-import — BLM NLCS Generalized');
  console.log('═══════════════════════════════════════════════════════════');

  const results: { layer: string; count: number; path: string }[] = [];

  // Wilderness (layer 1)
  try {
    const r = await processLayer(
      1,
      'wilderness',
      'Wilderness Areas',
      transformWilderness
    );
    results.push(r);
  } catch (err) {
    console.error(`\n  ❌ wilderness failed: ${(err as Error).message}`);
  }

  // WSA (layer 2)
  try {
    const r = await processLayer(2, 'wsa', 'Wilderness Study Areas', transformWSA);
    results.push(r);
  } catch (err) {
    console.error(`\n  ❌ wsa failed: ${(err as Error).message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (results.length > 0) {
    console.log('Done. Results:');
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('No layers imported successfully.');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
