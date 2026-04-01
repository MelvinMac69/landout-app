/**
 * BLM Surface Management Agency (SMA) — State-by-State Fetcher
 *
 * Fetches the BLM NLCS SMA layer (Layer 1) by querying state-by-state
 * to work around ArcGIS server limitations on unfiltered queries.
 *
 * Service: https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer
 * Layer 1 = Surface Management Agency polygons
 *
 * Output: public/data/sma-{agency}.geojson for each agency
 * Agencies: BLM, USFS, NPS, FWS, BOR, DOD, DOE, STATE, PRIVATE
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data');

// US states + DC
const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

// Only fetch these agencies (not UND or PRIVATE)
const AGENCIES = ['BLM', 'USFS', 'NPS', 'FWS', 'BOR', 'DOD', 'DOE', 'ST', 'LG'];

const OUT_FIELDS = 'ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,GIS_ACRES,SHAPE_Area,ADMIN_ST';

async function fetchStateAgency(
  state: string,
  agency: string
): Promise<GeoJSON.Feature[]> {
  const where = encodeURIComponent(`ADMIN_AGENCY_CODE='${agency}' AND ADMIN_ST='${state}'`);
  const url =
    `${SERVICE}/1/query?where=${where}&outFields=${OUT_FIELDS}&f=geojson` +
    `&resultOffset=0&resultRecordCount=1000&outSR=4326`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return [];
    const data: GeoJSON.FeatureCollection = await res.json();
    return (data.features || []) as GeoJSON.Feature[];
  } catch {
    return [];
  }
}

async function fetchAll(): Promise<Record<string, GeoJSON.Feature[]>> {
  const byAgency: Record<string, GeoJSON.Feature[]> = {};

  for (const agency of AGENCIES) {
    byAgency[agency] = [];
  }

  for (const state of STATES) {
    for (const agency of AGENCIES) {
      process.stdout.write(`  ${state}/${agency}...`);
      const features = await fetchStateAgency(state, agency);
      byAgency[agency].push(...features);
      console.log(` ${features.length} features`);
    }
  }

  return byAgency;
}

function simplifyGeoJSON(
  features: GeoJSON.Feature[],
  tolerance = 0.003
): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Fetching BLM SMA by state and agency...\n');

  const byAgency = await fetchAll();

  for (const [agency, features] of Object.entries(byAgency)) {
    if (features.length === 0) {
      console.log(`\n  ${agency}: no features — skipped`);
      continue;
    }

    const outFile = path.join(OUTPUT_DIR, `sma-${agency.toLowerCase()}.geojson`);
    const simplified = simplifyGeoJSON(features as GeoJSON.Feature[]);
    fs.writeFileSync(outFile, JSON.stringify(simplified));
    const size = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log(`\n  ✅ ${agency}: ${features.length} features → ${outFile} (${size} KB)`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
