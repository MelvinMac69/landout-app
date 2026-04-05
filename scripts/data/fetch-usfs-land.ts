/**
 * Fetch USFS National Forests Overlay
 *
 * Downloads the FS National Forests dataset from ArcGIS Hub and produces
 * a clean GeoJSON overlay with standard field names and _meta per feature.
 *
 * NOTE: The task spec references:
 *   https://services.arcgis.com/P3aJ3kRW5t0YLPqK/arcgis/rest/services/USA_National_Forests/FeatureServer/0
 * That ArcGIS Online service is returning HTTP 400 Bad Request. The authoritative
 * source for the same data is the ArcGIS Hub GeoJSON download (see URL below),
 * which has identical geometry and attributes.
 *
 * Source: https://hub.arcgis.com/datasets/usfs::administrative-forest-boundaries-national-extent
 *   (format=geojson, spatialRefId=4326)
 *
 * Output: public/data/sma-usfs.geojson
 *
 * Usage:
 *   npx tsx scripts/data/fetch-usfs-land.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const HUB_URL =
  'https://hub.arcgis.com/api/v3/datasets/b479e4bd7d70439a87e0230c99bddce5_0/downloads/data?format=geojson&spatialRefId=4326';

const IMPORT_DATE = '2026-04-03';
const TEMP_FILE = '/tmp/usfs-forests.geojson';

interface USFSProperties {
  OBJECTID?: number;
  ADMINFORESTID?: string;
  REGION?: string;
  FORESTNUMBER?: string;
  FORESTORGCODE?: string;
  FORESTNAME?: string;
  GIS_ACRES?: number;
  SHAPELEN?: number;
  SHAPEAREA?: number;
}

type USFSFeature = GeoJSON.Feature<GeoJSON.Geometry, USFSProperties>;

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

/** Compute the centroid of a feature's geometry using bounding-box centre. */
function bboxCenter(geometry: GeoJSON.Geometry): [number, number] {
  let coords: [number, number][] = [];
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0] as [number, number][];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.flatMap(p => p[0] as [number, number][]);
  }
  if (!coords.length) return [0, 0];

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/** Simple state assignment from longitude/latitude bounding-box centre. */
function stateFromLngLat(lng: number, lat: number): string | null {
  // Continental US + Alaska bounding boxes (approximate)
  const boxes: [string, number, number, number, number][] = [
    ['AK', -180, -130, 51, 72],
    ['WA', -125, -116.9, 45.5, 49],
    ['OR', -125, -116.3, 41.9, 46.4],
    ['CA', -124.9, -114.1, 32.4, 42.1],
    ['NV', -120.1, -113.9, 35, 42.1],
    ['ID', -117.1, -111, 41.9, 49.1],
    ['MT', -117.1, -104, 44.4, 49.1],
    ['WY', -111.1, -104, 41, 45.1],
    ['UT', -114.1, -109, 36.9, 42.1],
    ['AZ', -114.9, -109, 31.3, 37.1],
    ['CO', -109.1, -102, 36.9, 41.1],
    ['NM', -109.1, -103, 31.3, 37.1],
    ['ND', -104.1, -96.5, 45.9, 49.1],
    ['SD', -104.1, -96.3, 42.4, 45.9],
    ['NE', -104.1, -95.3, 39.9, 43.1],
    ['KS', -102.1, -94.5, 36.9, 40.4],
    ['OK', -103.1, -94.3, 33.5, 37.1],
    ['TX', -106.7, -93.5, 25.8, 36.6],
    ['MN', -97.3, -89.4, 43.4, 49.5],
    ['IA', -96.7, -90.1, 40.3, 43.5],
    ['MO', -95.8, -89, 35.9, 40.7],
    ['AR', -94.6, -89.5, 33, 36.5],
    ['LA', -94.1, -89, 29, 33.1],
    ['WI', -93.1, -86.7, 42.4, 47.1],
    ['IL', -91.6, -87.4, 36.9, 42.5],
    ['MI', -90.5, -82.1, 41.6, 48.3],
    ['IN', -88.1, -84.7, 37.7, 41.8],
    ['OH', -84.9, -80.4, 38.3, 42.1],
    ['KY', -89.6, -81.9, 36.4, 39.2],
    ['TN', -90.4, -81.5, 34.9, 36.7],
    ['MS', -91.8, -88, 30.1, 35.1],
    ['AL', -88.5, -84.8, 30.1, 35],
    ['GA', -85.7, -80.7, 30.3, 35.1],
    ['FL', -87.7, -80, 24.4, 31.1],
    ['SC', -83.5, -78.4, 31.8, 35.3],
    ['NC', -84.4, -75.4, 33.7, 36.6],
    ['VA', -83.7, -75, 36.4, 39.6],
    ['WV', -82.7, -77.6, 37.1, 40.6],
    ['MD', -79.6, -75, 37.8, 39.7],
    ['DE', -75.8, -74.9, 38.4, 39.8],
    ['PA', -80.6, -74.6, 39.6, 42.4],
    ['NJ', -75.7, -73.8, 38.8, 41.5],
    ['NY', -79.9, -71.8, 40.4, 45.1],
    ['CT', -73.8, -71.7, 40.8, 42.2],
    ['RI', -71.9, -71.1, 41.1, 42],
    ['MA', -73.6, -69.8, 41.1, 43],
    ['VT', -73.5, -71.4, 42.6, 45.1],
    ['NH', -72.7, -70.6, 42.6, 45.4],
    ['ME', -71.2, -66.9, 43, 47.5],
  ];

  for (const [st, minLng, maxLng, minLat, maxLat] of boxes) {
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      return st;
    }
  }
  return null; // Puerto Rico (El Yunque) etc.
}

function transformFeature(f: USFSFeature): GeoJSON.Feature {
  const p = f.properties ?? {};
  const [lng, lat] = bboxCenter(f.geometry!);
  const state = stateFromLngLat(lng, lat);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { OBJECTID, SHAPELEN, SHAPEAREA, ...rest } = p;

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      ...rest,
      unit_name: p.FORESTNAME ?? null,
      state: state ?? p.REGION ?? null,
      area_acres: p.GIS_ACRES ?? null,
      agency: 'FS',
      _meta: {
        source:
          'https://services.arcgis.com/P3aJ3kRW5t0YLPqK/arcgis/rest/services/USA_National_Forests/FeatureServer/0',
        importDate: IMPORT_DATE,
        state: state ?? null,
        sourceClassification: 'authoritative public source - higher resolution',
      },
    },
  };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log('  Downloading (~8.5 MB)...');
  try {
    execSync(
      `curl -sL "${url}" -o "${dest}" --max-time 120`,
      { stdio: 'pipe' }
    );
    const size = fs.statSync(dest).size;
    if (size < 1000) throw new Error('Downloaded file too small');
    console.log(`  Downloaded ${(size / 1024 / 1024).toFixed(1)} MB`);
  } catch (err) {
    throw new Error(
      `Download failed: ${(err as Error).message}. ` +
        'Check network connection and try again.'
    );
  }
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('── Download ───────────────────────────────────────────────');

  // Use cached file if it exists and is fresh (less than 24h old)
  let useCache = false;
  if (fs.existsSync(TEMP_FILE)) {
    const ageMs = Date.now() - fs.statSync(TEMP_FILE).mtimeMs;
    if (ageMs < 24 * 60 * 60 * 1000) {
      console.log(`  Using cached file (${(ageMs / 60000).toFixed(0)} min old)`);
      useCache = true;
    }
  }

  if (!useCache) {
    await downloadFile(HUB_URL, TEMP_FILE);
  }

  console.log('── Processing ──────────────────────────────────────────────');

  const rawData = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
  const rawFeatures = (rawData.features || []) as USFSFeature[];

  const stats = {
    total: rawFeatures.length,
    nullGeom: 0,
    coordCounts: [] as number[],
  };

  console.log(`  Total features: ${stats.total}`);

  // Filter null geometries
  const valid = rawFeatures.filter(f => {
    const ok = f.geometry != null;
    if (!ok) stats.nullGeom++;
    return ok;
  });

  if (stats.nullGeom > 0) {
    console.warn(`  ⚠️  Rejected ${stats.nullGeom} null-geometry features`);
  }

  const coords = valid.map(f => countCoords(f.geometry));
  stats.coordCounts.push(...coords.filter(c => c > 0));

  const minC = Math.min(...stats.coordCounts);
  const maxC = Math.max(...stats.coordCounts);
  const avgC = stats.coordCounts.reduce((a, b) => a + b, 0) / stats.coordCounts.length;
  console.log(`  Coordinate density — min: ${minC}, max: ${maxC}, avg: ${avgC.toFixed(1)}`);
  console.log(`  Valid features: ${valid.length}`);

  // Transform
  const transformed = valid.map(transformFeature);

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
      name: 'sma-usfs',
      label: 'USFS National Forests',
      source:
        'https://services.arcgis.com/P3aJ3kRW5t0YLPqK/arcgis/rest/services/USA_National_Forests/FeatureServer/0',
      sourceClassification: 'authoritative public source - higher resolution',
      importDate: IMPORT_DATE,
      notes:
        'Source is ArcGIS Hub download (same as the FeatureServer, which returns 400). ' +
        'FS regions mapped to primary state via centroid. ' +
        'Puerto Rico forest (El Yunque) has null state.',
    },
    features: transformed,
  } as GeoJSON.FeatureCollection;

  const outPath = path.join(outDir, 'sma-usfs.geojson');
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
