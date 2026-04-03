import * as fs from 'fs';

/**
 * Fetches Alaska-specific designated wilderness and WSAs from BLM AK GIS.
 * Sources:
 * 1. BLM AK Designated National Boundary
 *    URL: https://gis.blm.gov/akarcgis/rest/services/Administrative_Boundaries/BLM_AK_Designated_National_Boundary/FeatureServer/0
 *    — Has 4 features (SMA, NRA, PR, NRHP — no wilderness/WSAs)
 * 2. BLM AK NLCS (WSA layer)
 *    URL: https://gis.blm.gov/akarcgis/rest/services/Land_Management/BLM_AK_National_Landscape_Conservation_System_NLCS/MapServer/3
 *    — Has 9+ WSA features
 */

const OND_SERVICE_URL = 'https://gis.blm.gov/akarcgis/rest/services/Administrative_Boundaries/BLM_AK_Designated_National_Boundary/FeatureServer/0';
const NLCS_WSA_URL = 'https://gis.blm.gov/akarcgis/rest/services/Land_Management/BLM_AK_National_Landscape_Conservation_System_NLCS/MapServer/3';
const OUTPUT_PATH = 'public/data/ak-ond.geojson';

async function fetchAllFeatures(serviceUrl: string, outFields: string, LIMIT = 2000): Promise<any[]> {
  const features: any[] = [];
  let offset = 0;
  while (true) {
    const url = `${serviceUrl}/query?where=1%3D1&outFields=${outFields}&returnGeometry=true&f=geojson&resultOffset=${offset}&resultRecordCount=${LIMIT}`;
    const res = await fetch(url);
    if (!res.ok) { console.log(`  HTTP ${res.status} at offset ${offset}`); break; }
    const data = await res.json() as any;
    const batch = data.features ?? [];
    if (!batch.length) break;
    features.push(...batch);
    if (batch.length < LIMIT) break;
    offset += LIMIT;
  }
  return features;
}

async function main() {
  console.log('Fetching BLM Alaska Designated Areas...');

  // Fetch OND (4 features — SMA, NRA, PR, NRHP only)
  console.log('\n--- OND Service ---');
  const ondFeatures = await fetchAllFeatures(
    OND_SERVICE_URL,
    'OND_NAME,OND_TYPE,AUTH_NAME,AUTH_DATE,GIS_Acres'
  );
  console.log(`OND features: ${ondFeatures.length}`);

  // Fetch NLCS WSA (9+ features)
  console.log('\n--- NLCS WSA Service ---');
  const nlcFeatures = await fetchAllFeatures(
    NLCS_WSA_URL,
    'NLCS_NAME,CASEFILE_NO,WSA_RCMND,ADMIN_ST,ROD_DATE,GIS_Acres'
  );
  console.log(`NLCS WSA features: ${nlcFeatures.length}`);

  const features: GeoJSON.Feature[] = [];

  // Process OND features
  for (const f of ondFeatures) {
    const p = f.properties ?? {};
    const ondType = p.OND_TYPE ?? '';
    let landType: string;
    if (ondType.includes('Wilderness Study Area')) landType = 'wsa';
    else if (ondType.includes('Wilderness')) landType = 'wilderness';
    else if (ondType.includes('National Monument')) landType = 'national_monument';
    else if (ondType.includes('Recreation Area')) landType = 'recreation_area';
    else landType = 'other';

    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: p.OND_NAME ?? '',
        designation_type: ondType,
        land_type: landType,
        auth_name: p.AUTH_NAME ?? '',
        auth_date: p.AUTH_DATE ?? '',
        area_acres: p.GIS_Acres ?? null,
        state: 'AK',
        source: 'blm-ak-ond',
      }
    });
  }

  // Process NLCS WSA features
  for (const f of nlcFeatures) {
    const p = f.properties ?? {};
    const wsaRcmnd = p.WSA_RCMND ?? '';
    // WSA_RCMND: 'Suitable' or 'Not Suitable' — both are WSAs but with different status
    // Treat all WSAs as 'wsa' land_type for display purposes
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: p.NLCS_NAME ?? '',
        designation_type: 'Wilderness Study Area',
        land_type: 'wsa',
        wsa_rcmnd: wsaRcmnd,
        casefile_no: p.CASEFILE_NO ?? '',
        auth_date: p.ROD_DATE ? new Date(p.ROD_DATE).toISOString().split('T')[0] : null,
        area_acres: p.GIS_Acres ?? null,
        state: 'AK',
        source: 'blm-ak-nlcs',
      }
    });
  }

  console.log(`\nTotal: ${features.length} Alaska designated areas`);
  const byType: Record<string,number> = {};
  for (const f of features) {
    const lt = (f.properties as any).land_type;
    byType[lt] = (byType[lt] || 0) + 1;
  }
  console.log('By type:', byType);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    type: 'FeatureCollection',
    features,
    _metadata: {
      name: 'ak-ond',
      label: 'Alaska Designated Areas (Wilderness, WSA, Monuments)',
      sources: [OND_SERVICE_URL, NLCS_WSA_URL],
      sourceClassification: 'official authoritative - full resolution Alaska',
      importDate: new Date().toISOString().split('T')[0],
      notes: `Alaska nationally designated areas. ${ondFeatures.length} from OND (SMA/NRA/PR/NRHP), ${nlcFeatures.length} from NLCS WSA. WSAs from NLCS: classified as 'wsa' land_type for display.`,
      featureCount: features.length,
      typeBreakdown: byType,
    }
  }, null, 2));

  const sizeMB = fs.statSync(OUTPUT_PATH).size / 1024 / 1024;
  console.log(`Wrote ${OUTPUT_PATH} (${sizeMB.toFixed(1)} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
