/**
 * BLM Surface Management Agency (SMA) Adapter
 *
 * Service: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer
 * Layer: 1 (Surface Management Agency polygons)
 *
 * Important findings from service inspection (2026-04-01):
 * - Most features have ADMIN_AGENCY_CODE = 'UND' (state/private/unknown land)
 * - Federal agency land uses codes: BLM, FS, NPS, FWS, BOR, DOE, DOD
 * - Correct field names: ADMIN_AGENCY_CODE, ADMIN_UNIT_NAME, GIS_ACRES, ADMIN_ST
 * - Filter with: ADMIN_AGENCY_CODE<>'UND' to get only federal agency lands
 *
 * Why LimitedScale: pre-generalized for nationwide overview mapping (zoom 4-12)
 * Full-detail service would be too large for web rendering.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ARCGIS_SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer';

const LAYER_INDEX = 1;

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'blm-sma.geojson');

// Map agency codes to display colors — matches data-sources.md
export const SMA_UNIT_COLORS: Record<string, string> = {
  BLM: '#8B6914',    // Bureau of Land Management — amber
  FS: '#2D5016',    // Forest Service — forest green
  NPS: '#6B3FA0',   // National Park Service — purple
  FWS: '#1E5A8A',   // Fish & Wildlife Service — blue
  BOR: '#1A7A7A',   // Bureau of Reclamation — teal
  DOE: '#C45A00',   // Dept. of Energy — dark orange
  DOD: '#4A4A4A',   // Dept. of Defense — gray
};

interface SMAGeoJSONProperties {
  ADMIN_AGENCY_CODE: string;
  ADMIN_UNIT_NAME: string;
  ADMIN_UNIT_TYPE: string;
  GIS_ACRES: number;
  ADMIN_ST: string;
  SHAPE_Area?: number;
}

type SMAFeature = GeoJSON.Feature<GeoJSON.Geometry, SMAGeoJSONProperties>;

/**
 * Fetch all features from the BLM SMA ArcGIS service, filtering to only
 * federal agency lands (excluding UND = state/private/unknown).
 */
async function fetchAllSMARecords(): Promise<SMAFeature[]> {
  const allFeatures: SMAFeature[] = [];
  let resultOffset = 0;
  const batchSize = 200;
  let hasMore = true;

  // Filter to only federal agency lands (exclude UND = state/private/undetermined)
  const whereClause = "ADMIN_AGENCY_CODE<>'UND'";

  while (hasMore) {
    const fetchUrl = `${ARCGIS_SERVICE}/${LAYER_INDEX}/query?where=${encodeURIComponent(whereClause)}&outFields=ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,SHAPE_Area,ADMIN_ST&f=geojson&resultOffset=${resultOffset}&resultRecordCount=${batchSize}&outSR=4326`;

    console.log(`  Fetching offset ${resultOffset}...`);
    const response = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(
        `ArcGIS fetch failed: ${response.status} ${response.statusText}`
      );
    }

    const data: GeoJSON.FeatureCollection = await response.json();
    const features = (data.features || []) as SMAFeature[];
    allFeatures.push(...features);

    if (features.length < batchSize) {
      hasMore = false;
    } else {
      resultOffset += batchSize;
    }
  }

  return allFeatures;
}

/**
 * Main import function.
 */
export async function importBLMSMA(): Promise<{
  totalFeatures: number;
  outputPath: string;
  fileSizeBytes: number;
  sourceHash: string;
}> {
  console.log('='.repeat(50));
  console.log('BLM SMA Import — Surface Management Agency');
  console.log('='.repeat(50));
  console.log(`Service: ${ARCGIS_SERVICE}`);
  console.log(`Layer: ${LAYER_INDEX}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Filter: ADMIN_AGENCY_CODE<>'UND' (federal agency lands only)`);

  console.log('\nFetching features (paginated)...');

  let features: SMAFeature[];
  try {
    features = await fetchAllSMARecords();
  } catch (err) {
    console.error('\nFailed to fetch from ArcGIS service.');
    console.error('Manual download: https://gbp-blm-egis.hub.arcgis.com/datasets/blm-national-sma-surface-management-agency-area-polygons');
    throw err;
  }

  console.log(`\nTotal federal agency features: ${features.length}`);

  // Count by agency
  const agencyCounts: Record<string, number> = {};
  for (const f of features) {
    const agency = f.properties?.ADMIN_AGENCY_CODE || 'UNKNOWN';
    agencyCounts[agency] = (agencyCounts[agency] || 0) + 1;
  }
  console.log('Agency breakdown:', agencyCounts);

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const props = f.properties || {};
      const agency = (props.ADMIN_AGENCY_CODE || 'UNKNOWN').toUpperCase();
      // SHAPE_Area is in square meters — convert to acres
      const sqMeters = props.SHAPE_Area || 0;
      const acres = sqMeters / 4046.86;
      return {
        type: 'Feature' as const,
        geometry: f.geometry,
        properties: {
          unit: agency,
          unit_name: props.ADMIN_UNIT_NAME || null,
          state: props.ADMIN_ST || null,
          unit_type: props.ADMIN_UNIT_TYPE || null,
          acres: Math.round(acres),
          color: SMA_UNIT_COLORS[agency] || '#888888',
        },
      };
    }),
  };

  const sourceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(features.slice(0, 1000)))
    .digest('hex')
    .slice(0, 16);

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonStr = JSON.stringify(geojson);
  fs.writeFileSync(OUTPUT_PATH, jsonStr);

  const fileSize = fs.statSync(OUTPUT_PATH).size;
  console.log(`\nWritten: ${OUTPUT_PATH}`);
  console.log(`Features: ${features.length}`);
  console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  return {
    totalFeatures: features.length,
    outputPath: OUTPUT_PATH,
    fileSizeBytes: fileSize,
    sourceHash,
  };
}

if (require.main === module) {
  importBLMSMA()
    .then((result) => {
      console.log('\n✅ Import complete:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Import failed:', err.message);
      process.exit(1);
    });
}
