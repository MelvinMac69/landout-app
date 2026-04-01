/**
 * BLM Surface Management Agency (SMA) Adapter
 *
 * Fetches BLM National SMA polygons from the ArcGIS Limited Scale MapServer.
 *
 * IMPORTANT: We use the "LimitedScale" service (pre-generalized for overview
 * mapping) which is the correct choice for a nationwide web app at zoom levels 4-12.
 * The full-detail service (scheme level 14+) would be too large for nationwide
 * rendering performance.
 *
 * Service: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer
 * Layer: 1 (Surface Management Agency polygons — Layer 0 is a group/identify layer)
 *
 * Source verified: 2026-03-31 via BLM ArcGIS services directory
 *   https://gis.blm.gov/arcgis/rest/services/lands
 *
 * Alternative: manual download from
 *   https://gbp-blm-egis.hub.arcgis.com/datasets/blm-national-sma-surface-management-agency-area-polygons
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ARCGIS_SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer';

const LAYER_INDEX = 1; // Layer 1 = Surface Management Agency

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'blm-sma.geojson');

// Color mapping — matches data-sources.md
export const SMA_UNIT_COLORS: Record<string, string> = {
  BLM: '#8B6914',
  FS: '#2D5016',
  NPS: '#6B3FA0',
  FWS: '#1E5A8A',
  BOR: '#1A7A7A',
  DOE: '#C45A00',
  DOD: '#4A4A4A',
  PRIVATE: 'transparent',
  STATE: 'transparent',
  PRIUNK: 'transparent',
};

// Properties exposed by the BLM SMA ArcGIS service
interface SMAGeoJSONProperties {
  SMA_UNIT?: string;
  UNIT?: string;
  SMA_NAME?: string;
  NAME?: string;
  ADMIN_UNIT_NAME?: string;
  GIS_ACRES?: number;
}

type SMAFeature = GeoJSON.Feature<GeoJSON.Geometry, SMAGeoJSONProperties>;

/**
 * Fetch all features from an ArcGIS MapServer layer with pagination.
 * Using f=geojson returns GeoJSON format directly.
 * ArcGIS MapServer has a default max of 1000 features per request.
 */
async function fetchAllSMARecords(): Promise<SMAFeature[]> {
  const allFeatures: SMAFeature[] = [];
  let resultOffset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${ARCGIS_SERVICE}/${LAYER_INDEX}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('resultOffset', resultOffset.toString());
    url.searchParams.set('resultRecordCount', batchSize.toString());
    url.searchParams.set('outSR', '4326'); // WGS84

    console.log(`  Fetching offset ${resultOffset}...`);
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(
        `ArcGIS fetch failed: ${response.status} ${response.statusText}\nURL: ${url.toString()}`
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
 * Fetches BLM SMA data and writes GeoJSON to public/data/.
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

  console.log('\nFetching features from ArcGIS service (paginated)...');

  let features: SMAFeature[];
  try {
    features = await fetchAllSMARecords();
  } catch (err) {
    console.error('\nFailed to fetch from ArcGIS service.');
    console.error('If the service is unavailable, download manually from:');
    console.error('  https://gbp-blm-egis.hub.arcgis.com/datasets/blm-national-sma-surface-management-agency-area-polygons');
    throw err;
  }

  console.log(`\nTotal features fetched: ${features.length}`);

  // Build output GeoJSON with standardized properties
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const props = f.properties || {};
      const unit = (props.SMA_UNIT || props.UNIT || 'UNKNOWN').toUpperCase();
      return {
        type: 'Feature' as const,
        geometry: f.geometry,
        properties: {
          unit,
          unit_name: props.SMA_NAME || props.NAME || null,
          admin_unit: props.ADMIN_UNIT_NAME || null,
          acres: props.GIS_ACRES || null,
          color: SMA_UNIT_COLORS[unit] || '#888888',
        },
      };
    }),
  };

  // Compute hash of source data for change detection (sample of first 1000)
  const sourceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(features.slice(0, 1000)))
    .digest('hex')
    .slice(0, 16);

  // Write output
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
  console.log(`Source hash (sample): ${sourceHash}`);

  return {
    totalFeatures: features.length,
    outputPath: OUTPUT_PATH,
    fileSizeBytes: fileSize,
    sourceHash,
  };
}

// CLI entry point
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
