import * as fs from 'fs';

const SERVICE_URL = 'https://gis.blm.gov/akarcgis/rest/services/Land_Management/BLM_AK_Administered_Lands_SMA/FeatureServer/0';
const OUTPUT_PATH = 'public/data/sma-blm-ak.geojson';

// Federal agency codes to include
const FEDERAL_CODES = new Set(['BLM', 'USFS', 'NPS', 'FWS', 'DOD', 'MIL', 'DOE', 'NARA', 'VA', 'GSA']);

// Simple Douglas-Peucker line simplification
function simplifyRing(ring: number[][], tolerance: number): number[][] {
  if (ring.length <= 3) return ring;

  function pointSegDist(p: number[], a: number[], b: number[]): number {
    const dx = b[0]-a[0], dy = b[1]-a[1];
    if (dx===0 && dy===0) return Math.hypot(p[0]-a[0], p[1]-a[1]);
    const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
  }

  let maxD = 0, maxI = 0;
  for (let i=1; i<ring.length-1; i++) {
    const d = pointSegDist(ring[i], ring[0], ring[ring.length-1]);
    if (d > maxD) { maxD=d; maxI=i; }
  }

  if (maxD > tolerance) {
    const left = simplifyRing(ring.slice(0,maxI+1), tolerance);
    const right = simplifyRing(ring.slice(maxI), tolerance);
    return [...left.slice(0,-1), ...right];
  }
  return [ring[0], ring[ring.length-1]];
}

async function main() {
  console.log('Fetching BLM Alaska Administered Lands...');

  const features: GeoJSON.Feature[] = [];
  let offset = 0;
  let LIMIT = 2000;
  let total = 0;
  let federal = 0;
  let nullGeom = 0;
  let httpErrors = 0;
  const AGENCY_BREAKDOWN: Record<string,number> = {};

  while (true) {
    process.stdout.write(`  offset ${offset} (limit ${LIMIT})...`);
    const url = `${SERVICE_URL}/query?where=1%3D1&outFields=AGENCY_NAME,ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_ST,GIS_Acres&returnGeometry=true&f=geojson&resultOffset=${offset}&resultRecordCount=${LIMIT}`;
    const res = await fetch(url);
    if (!res.ok) {
      // Reduce batch size on server errors and retry once
      httpErrors++;
      if (LIMIT > 100 && httpErrors <= 3) {
        LIMIT = Math.max(100, Math.floor(LIMIT / 2));
        console.log(` HTTP ${res.status} — retrying with limit ${LIMIT}`);
        continue;
      }
      console.log(` HTTP ${res.status} — stopping after ${httpErrors} errors`);
      break;
    }
    httpErrors = 0; // reset on success
    const data = await res.json() as any;
    const batch = data.features ?? [];
    if (batch.length === 0) break;

    let batchFederal = 0;
    for (const f of batch) {
      const p = f.properties ?? {};
      const code = p.ADMIN_AGENCY_CODE ?? '';
      if (!FEDERAL_CODES.has(code)) continue;
      if (!f.geometry) { nullGeom++; continue; }

      batchFederal++;
      AGENCY_BREAKDOWN[code] = (AGENCY_BREAKDOWN[code] || 0) + 1;

      const g = f.geometry as any;
      if (g.type === 'Polygon') {
        f.geometry.coordinates = g.coordinates.map((ring: number[][]) => simplifyRing(ring, 0.001));
      } else if (g.type === 'MultiPolygon') {
        f.geometry.coordinates = g.coordinates.map((poly: number[][][]) =>
          poly.map((ring: number[][]) => simplifyRing(ring, 0.001))
        );
      }

      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          agency_name: p.AGENCY_NAME ?? '',
          agency_code: code,
          unit_name: p.ADMIN_UNIT_NAME ?? null,
          state: 'AK',
          area_acres: p.GIS_Acres ?? null,
          source: 'blm-ak-sma',
        }
      });
    }

    federal += batchFederal;
    total += batch.length;
    offset += LIMIT;
    console.log(` ${batch.length} records, ${batchFederal} federal (total federal: ${federal})`);

    if (batch.length < LIMIT) break;
    // Stop at 40K total to keep file manageable (< 50 MB after simplification)
    if (offset >= 40000) { console.log('  Reached 40K safety cap'); break; }
  }

  console.log(`\nTotal: ${total} fetched, ${federal} federal features kept, ${nullGeom} null geom skipped`);
  console.log('Agency breakdown:', AGENCY_BREAKDOWN);

  // Sort by agency
  features.sort((a,b) => ((a.properties as any).agency_code||'').localeCompare((b.properties as any).agency_code||''));

  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
    _metadata: {
      name: 'sma-blm-ak',
      label: 'Alaska Federal Land Ownership',
      source: SERVICE_URL,
      sourceClassification: 'official authoritative - full resolution Alaska',
      importDate: new Date().toISOString().split('T')[0],
      notes: `Alaska-specific BLM Surface Management Agency dataset. ${total} records fetched, filtered to ${federal} federal land features. Covers BLM, USFS, NPS, FWS, DOD land in Alaska.`,
      featureCount: features.length,
      agencyBreakdown: AGENCY_BREAKDOWN,
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fc));
  const sizeMB = fs.statSync(OUTPUT_PATH).size / 1024 / 1024;
  console.log(`\nWrote ${features.length} features to ${OUTPUT_PATH} (${sizeMB.toFixed(1)} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
