/**
 * Fetch BLM Land Overlay
 *
 * Queries BLM National SMA LimitedScale MapServer (Layer 1) by state
 * to build a high-quality BLM land overlay GeoJSON.
 *
 * NOTE: ADMIN_UNIT_NAME NOT LIKE 'Bureau of Land Management' was requested
 * in the task spec, but this returns 0 features because all BLM land in this
 * service uses "Bureau of Land Management" as ADMIN_UNIT_NAME — there is no
 * field-office breakdown at this limited scale. We query all BLM land.
 *
 * Service: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer
 * Output: public/data/sma-blm.geojson
 *
 * Usage:
 *   npx tsx scripts/data/fetch-blm-land.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer';

const BLM_STATES = ['AK', 'AZ', 'CA', 'CO', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WY'];

// Available fields in this service: OBJECTID, SHAPE, SMA_ID, ADMIN_DEPT_CODE,
// ADMIN_AGENCY_CODE, ADMIN_UNIT_NAME, ADMIN_UNIT_TYPE, HOLD_*, SHAPE_Length,
// SHAPE_Area, ADMIN_ST, FAU_ID
// NOTE: GIS_ACRES does not exist in this layer — use SHAPE_Area (m²) instead.
const OUT_FIELDS =
  'ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_ST,SHAPE_Area,SHAPE_Length';

const IMPORT_DATE = '2026-04-03';
// SHAPE_Area is in square meters (Web Mercator projection); convert to acres.
const SQM_TO_ACRES = 0.000247105;

interface BLMProperties {
  OBJECTID?: number;
  ADMIN_AGENCY_CODE?: string;
  ADMIN_UNIT_NAME?: string;
  ADMIN_UNIT_TYPE?: string;
  ADMIN_ST?: string;
  SHAPE_Area?: number;
  SHAPE_Length?: number;
}

type BLMFeature = GeoJSON.Feature<GeoJSON.Geometry, BLMProperties>;

interface ValidationStats {
  totalFetched: number;
  nullGeometry: number;
  coordCounts: number[];
  rejected: { reason: string; count: number }[];
}

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

async function fetchState(state: string): Promise<BLMFeature[]> {
  // Query all BLM land for this state. The ADMIN_UNIT_NAME NOT LIKE filter
  // (task spec) returns 0 features — all BLM land is "Bureau of Land Management".
  const where = encodeURIComponent(`ADMIN_AGENCY_CODE='BLM' AND ADMIN_ST='${state}'`);
  const url =
    `${SERVICE}/1/query?where=${where}&outFields=${OUT_FIELDS}&f=geojson` +
    `&resultOffset=0&resultRecordCount=2000&outSR=4326`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      console.warn(`  ⚠️  ${state}: HTTP ${res.status}`);
      return [];
    }
    const data: GeoJSON.FeatureCollection = await res.json();
    return (data.features || []) as BLMFeature[];
  } catch (err) {
    console.error(`  ❌ ${state}: ${(err as Error).message}`);
    return [];
  }
}

function transformFeature(f: BLMFeature): GeoJSON.Feature {
  const p = f.properties ?? {};
  const shapeAreaSqM = p.SHAPE_Area ?? 0;
  const areaAcres = shapeAreaSqM * SQM_TO_ACRES;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { OBJECTID, SHAPE_Area, ...rest } = p;

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      ...rest,
      unit_name: p.ADMIN_UNIT_NAME ?? null,
      state: p.ADMIN_ST ?? null,
      area_acres: Math.round(areaAcres * 100) / 100,
      agency: 'BLM',
      _meta: {
        source: `${SERVICE}/1`,
        importDate: IMPORT_DATE,
        state: p.ADMIN_ST ?? null,
        sourceClassification: 'official generalized - interim',
      },
    },
  };
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const stats: ValidationStats = {
    totalFetched: 0,
    nullGeometry: 0,
    coordCounts: [],
    rejected: [],
  };

  console.log('Fetching BLM land by state...');
  console.log('');

  const allFeatures: BLMFeature[] = [];

  for (const state of BLM_STATES) {
    process.stdout.write(`  ${state}...`);
    const features = await fetchState(state);
    stats.totalFetched += features.length;

    const nullGeom = features.filter(f => !f.geometry).length;
    stats.nullGeometry += nullGeom;
    if (nullGeom > 0) {
      stats.rejected.push({ reason: 'null geometry', count: nullGeom });
      console.warn(` ⚠️ ${nullGeom} null-geom`);
    }

    const coords = features.map(f => countCoords(f.geometry));
    stats.coordCounts.push(...coords.filter(c => c > 0));

    allFeatures.push(...features);
    console.log(` ${features.length} features`);
  }

  console.log('');
  console.log('── Validation ─────────────────────────────────────────────');
  console.log(`  Total fetched: ${stats.totalFetched}`);
  console.log(`  Null geometry: ${stats.nullGeometry}`);

  // Filter null geometries
  const valid = allFeatures.filter(f => f.geometry != null);
  const nullRejected = allFeatures.length - valid.length;
  if (nullRejected > 0) {
    console.warn(`  ⚠️  Rejected ${nullRejected} null-geometry features`);
  }

  // Validate coord count (>3 per ring)
  const coordMin = 3;
  const geomValid = valid.filter(f => countCoords(f.geometry) > coordMin);
  const coordRejected = valid.length - geomValid.length;
  if (coordRejected > 0) {
    console.warn(`  ⚠️  Rejected ${coordRejected} features with ≤${coordMin} coordinates`);
    stats.rejected.push({ reason: `≤${coordMin} coords`, count: coordRejected });
  }

  console.log(`  After filtering: ${geomValid.length} valid features`);

  if (stats.coordCounts.length > 0) {
    const minC = Math.min(...stats.coordCounts);
    const maxC = Math.max(...stats.coordCounts);
    const avgC = stats.coordCounts.reduce((a, b) => a + b, 0) / stats.coordCounts.length;
    console.log(
      `  Coordinate density — min: ${minC}, max: ${maxC}, avg: ${avgC.toFixed(1)}`
    );
  }

  // Transform
  const transformed = geomValid.map(transformFeature);

  // BBox
  const bbox = computeBBox(transformed);
  if (bbox) {
    console.log(
      `  Bounding box: [${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}, ` +
        `${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]`
    );
  }

  // Output
  const output = {
    type: 'FeatureCollection',
    _metadata: {
      name: 'sma-blm',
      label: 'BLM Land',
      source: `${SERVICE}/1`,
      sourceClassification: 'official generalized - interim',
      importDate: IMPORT_DATE,
      notes:
        'Limited-scale dataset. All BLM land uses ADMIN_UNIT_NAME="Bureau of Land Management" at this scale. Consider upgrading to full BLM SMA in future.',
    },
    features: transformed,
  } as GeoJSON.FeatureCollection;

  const outPath = path.join(outDir, 'sma-blm.geojson');
  fs.writeFileSync(outPath, JSON.stringify(output));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('');
  console.log(`  ✅ Written: ${outPath} (${sizeKb} KB)`);
  console.log(`     Features: ${transformed.length}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
