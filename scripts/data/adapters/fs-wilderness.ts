/**
 * USFS Wilderness Adapter
 *
 * Fetches USFS-managed wilderness boundaries from the wilderness.net ArcGIS feature service.
 * wilderness.net is the official interagency aggregator covering ALL federal wilderness
 * (BLM, USFS, NPS, FWS) — recommended primary source per docs/data-sources.md.
 *
 * Service: https://services1.arcgis.com/v8f3knFlrJ9vhWj3/arcgis/rest/services/NWPS_Wilderness/FeatureServer
 * (from wilderness.net ArcGIS Online item: 52c7896cdfab4660a595e6f6a7ef0e4d)
 *
 * Fields: Wilderness, Agency, State, GISAcres, WLDWY, designation_type
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE_URL =
  'https://services1.arcgis.com/v8f3knFlrJ9vhWj3/arcgis/rest/services/NWPS_Wilderness/FeatureServer';

export const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data');
export const FS_WILDERNESS_OUTPUT = path.join(OUTPUT_DIR, 'fs-wilderness.geojson');

interface FSFeatureProperties {
  Wilderness?: string;
  Agency?: string;
  State?: string;
  GISAcres?: number;
  WLDWY?: string;
  Designation?: string;
}

type FSFeature = GeoJSON.Feature<GeoJSON.Geometry, FSFeatureProperties>;

/**
 * Fetch all features from a MapServer layer with pagination.
 */
async function fetchLayer(layerIndex: number, layerName: string): Promise<FSFeature[]> {
  const allFeatures: FSFeature[] = [];
  let resultOffset = 0;
  const batchSize = 1000;
  let hasMore = true;

  console.log(`\n  Fetching ${layerName} (layer ${layerIndex})...`);

  while (hasMore) {
    const url = new URL(`${SERVICE_URL}/${layerIndex}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('resultOffset', resultOffset.toString());
    url.searchParams.set('resultRecordCount', batchSize.toString());
    url.searchParams.set('outSR', '4326');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`ArcGIS fetch failed for layer ${layerIndex} (${layerName}): ${response.status}`);
    }

    const data: GeoJSON.FeatureCollection = await response.json();
    const features = (data.features || []) as FSFeature[];
    allFeatures.push(...features);

    if (features.length < batchSize) {
      hasMore = false;
    } else {
      resultOffset += batchSize;
      console.log(`    Fetched ${allFeatures.length}...`);
    }
  }

  console.log(`  ${layerName}: ${allFeatures.length} features`);
  return allFeatures;
}

/**
 * Filter to USFS-only wilderness from the full wilderness.net dataset.
 * wilderness.net covers ALL agencies; we only want FS (Forest Service).
 */
function filterFS(features: FSFeature[]): FSFeature[] {
  return features.filter((f) => {
    const agency = (f.properties?.Agency || '').toUpperCase();
    return agency === 'USFS' || agency === 'USDA FOREST SERVICE' || agency === 'FS';
  });
}

/**
 * Normalize to app-standard property names.
 */
function toAppGeoJSON(features: FSFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        name: f.properties?.Wilderness ?? null,
        agency: f.properties?.Agency ?? null,
        state: f.properties?.State ?? null,
        acres: f.properties?.GISAcres ?? null,
        wldwy: f.properties?.WLDWY ?? null,
        designation: f.properties?.Designation ?? null,
      },
    })),
  };
}

/**
 * Main import — fetches wilderness.net and filters to USFS-only.
 */
export async function importFSWilderness(): Promise<{ layer: string; count: number; path: string } | null> {
  console.log('='.repeat(50));
  console.log('USFS Wilderness Import — wilderness.net');
  console.log('='.repeat(50));
  console.log(`Service: ${SERVICE_URL}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Layer 0 = wilderness polygons
    const allFeatures = await fetchLayer(0, 'Wilderness (all agencies)');
    const fsFeatures = filterFS(allFeatures);
    console.log(`  USFS-only: ${fsFeatures.length} features`);

    if (fsFeatures.length === 0) {
      // Try alternative field name for agency
      console.warn('  ⚠️  No FS features found with Agency field — trying alternative lookup');
      return null;
    }

    const geojson = toAppGeoJSON(fsFeatures);
    fs.writeFileSync(FS_WILDERNESS_OUTPUT, JSON.stringify(geojson, null, 2));
    const size = (fs.statSync(FS_WILDERNESS_OUTPUT).size / 1024).toFixed(1);
    console.log(`\n  ✅ FS Wilderness: ${fsFeatures.length} features → ${FS_WILDERNESS_OUTPUT} (${size} KB)`);
    return { layer: 'fs-wilderness', count: fsFeatures.length, path: FS_WILDERNESS_OUTPUT };
  } catch (err) {
    console.error(`\n  ❌ FS Wilderness import failed: ${(err as Error).message}`);
    return null;
  }
}

// CLI entry point
if (require.main === module) {
  importFSWilderness()
    .then((result) => {
      if (result) {
        console.log('\n✅ Import complete:', JSON.stringify(result, null, 2));
      } else {
        console.log('\n⚠️  No data imported — check service availability.');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Import failed:', (err as Error).message);
      process.exit(1);
    });
}
