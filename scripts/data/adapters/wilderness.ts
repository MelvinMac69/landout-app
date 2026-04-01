/**
 * Wilderness / WSA Adapter
 *
 * Fetches wilderness and Wilderness Study Area boundaries from BLM NLCS MapServer.
 *
 * Service: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer
 *   Layer 0 = NLCS Wilderness Area (designated wilderness)
 *   Layer 1 = NLCS WSA (Wilderness Study Areas)
 *
 * Source verified: 2026-03-31 via BLM ArcGIS services directory
 *
 * Note: wilderness.net aggregates ALL federal wilderness (BLM + USFS + NPS + FWS)
 * and is recommended as a future primary source if full national coverage is needed.
 * BLM NLCS covers only BLM-administered wilderness.
 */

import * as fs from 'fs';
import * as path from 'path';

const BLM_NLCS_SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer';

export const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data');
export const WILDERNESS_OUTPUT = path.join(OUTPUT_DIR, 'wilderness.geojson');
export const WSA_OUTPUT = path.join(OUTPUT_DIR, 'wsa.geojson');

export const LAYER = {
  WILDERNESS: 0,
  WSA: 1,
} as const;

// BLM NLCS layer field names (from ArcGIS service)
interface BLMNLCSProperties {
  NLCS_NAME?: string;
  WLD_DESIG?: string;
  WLD_NAME?: string;
  WSA_NAME?: string;
  WSA_DESIG?: string;
  AGENCY?: string;
  GIS_ACRES?: number;
  STATE?: string;
  WLD_CODE?: string;
  WSA_CODE?: string;
}

type BLMFeature = GeoJSON.Feature<GeoJSON.Geometry, BLMNLCSProperties>;

/**
 * Fetch all features from an ArcGIS MapServer layer with pagination.
 * Using f=geojson returns GeoJSON format directly.
 */
async function fetchLayer(
  serviceUrl: string,
  layerIndex: number,
  layerName: string
): Promise<BLMFeature[]> {
  const allFeatures: BLMFeature[] = [];
  let resultOffset = 0;
  const batchSize = 1000;
  let hasMore = true;

  console.log(`\n  Fetching ${layerName} (layer ${layerIndex})...`);

  while (hasMore) {
    const url = new URL(`${serviceUrl}/${layerIndex}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('resultOffset', resultOffset.toString());
    url.searchParams.set('resultRecordCount', batchSize.toString());
    url.searchParams.set('outSR', '4326'); // WGS84

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(
        `ArcGIS fetch failed for layer ${layerIndex} (${layerName}): ${response.status}`
      );
    }

    const data: GeoJSON.FeatureCollection = await response.json();
    const features = (data.features || []) as BLMFeature[];
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
 * Normalize field names from BLM NLCS service to app-standard property names.
 */
function toAppGeoJSON(
  features: BLMFeature[],
  propertyMap: Record<string, keyof BLMNLCSProperties>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: Object.fromEntries(
        Object.entries(propertyMap).map(([dest, src]) => [
          dest,
          f.properties?.[src] ?? null,
        ])
      ),
    })),
  };
}

/**
 * Fetch and save Wilderness Areas (BLM NLCS Layer 0)
 */
async function fetchWilderness(): Promise<{ data: GeoJSON.FeatureCollection; count: number }> {
  const features = await fetchLayer(BLM_NLCS_SERVICE, LAYER.WILDERNESS, 'Wilderness');

  const geojson = toAppGeoJSON(features, {
    name: 'WLD_NAME',
    designation: 'WLD_DESIG',
    agency: 'AGENCY',
    acres: 'GIS_ACRES',
    state: 'STATE',
    wld_code: 'WLD_CODE',
  });

  return { data: geojson, count: features.length };
}

/**
 * Fetch and save Wilderness Study Areas (BLM NLCS Layer 1)
 */
async function fetchWSA(): Promise<{ data: GeoJSON.FeatureCollection; count: number }> {
  const features = await fetchLayer(BLM_NLCS_SERVICE, LAYER.WSA, 'WSA');

  const geojson = toAppGeoJSON(features, {
    name: 'WSA_NAME',
    designation: 'WSA_DESIG',
    agency: 'AGENCY',
    acres: 'GIS_ACRES',
    state: 'STATE',
    wsa_code: 'WSA_CODE',
  });

  return { data: geojson, count: features.length };
}

/**
 * Main import — fetches both wilderness and WSA layers.
 */
export async function importWildernessData(): Promise<
  Array<{ layer: string; count: number; path: string }>
> {
  console.log('='.repeat(50));
  console.log('Wilderness / WSA Import — BLM NLCS');
  console.log('='.repeat(50));
  console.log(`Service: ${BLM_NLCS_SERVICE}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: Array<{ layer: string; count: number; path: string }> = [];

  // Fetch both layers in parallel
  const [wildernessResult, wsaResult] = await Promise.all([
    fetchWilderness().catch((err) => {
      console.error(`  ❌ Wilderness fetch failed: ${err.message}`);
      return null;
    }),
    fetchWSA().catch((err) => {
      console.error(`  ❌ WSA fetch failed: ${err.message}`);
      return null;
    }),
  ]);

  if (wildernessResult) {
    fs.writeFileSync(WILDERNESS_OUTPUT, JSON.stringify(wildernessResult.data, null, 2));
    const size = (fs.statSync(WILDERNESS_OUTPUT).size / 1024 / 1024).toFixed(2);
    console.log(`\n  ✅ Wilderness: ${wildernessResult.count} features → ${WILDERNESS_OUTPUT} (${size} MB)`);
    results.push({ layer: 'wilderness', count: wildernessResult.count, path: WILDERNESS_OUTPUT });
  }

  if (wsaResult) {
    fs.writeFileSync(WSA_OUTPUT, JSON.stringify(wsaResult.data, null, 2));
    const size = (fs.statSync(WSA_OUTPUT).size / 1024 / 1024).toFixed(2);
    console.log(`\n  ✅ WSA: ${wsaResult.count} features → ${WSA_OUTPUT} (${size} MB)`);
    results.push({ layer: 'wsa', count: wsaResult.count, path: WSA_OUTPUT });
  }

  return results;
}

// CLI entry point
if (require.main === module) {
  importWildernessData()
    .then((results) => {
      if (results.length > 0) {
        console.log('\n✅ Import complete:', JSON.stringify(results, null, 2));
      } else {
        console.log('\n⚠️  No layers imported — check service availability.');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Import failed:', err.message);
      process.exit(1);
    });
}
