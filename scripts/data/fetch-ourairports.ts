import * as fs from 'fs';

/**
 * Downloads and converts OurAirports public CSV to GeoJSON for the Landout app.
 * Joins runway data (longest runway per airport) from OurAirports runways.csv.
 *
 * OurAirports License: CC-BY (Creative Commons Attribution)
 * OurAirports is used here as: 'community/FAA-derived - development convenience'
 * Per project constraint: do not use OurAirports as primary source of truth.
 */

const AIRPORTS_CSV_URL = 'https://ourairports.com/data/airports.csv';
const RUNWAYS_CSV_URL = 'https://ourairports.com/data/runways.csv';
const OUTPUT_PATH = 'public/data/airports-ourairports.geojson';

const PERTINENT_TYPES = new Set([
  'small_airport',
  'medium_airport',
  'large_airport',
  'seaplane_base',
  'closed',
]);

const US_STATES = new Set([
  'US-AL','US-AK','US-AZ','US-AR','US-CA','US-CO','US-CT','US-DE','US-FL',
  'US-GA','US-HI','US-ID','US-IL','US-IN','US-IA','US-KS','US-KY','US-LA',
  'US-ME','US-MD','US-MA','US-MI','US-MN','US-MS','US-MO','US-MT','US-NE',
  'US-NV','US-NH','US-NJ','US-NM','US-NY','US-NC','US-ND','US-OH','US-OK',
  'US-OR','US-PA','US-RI','US-SC','US-SD','US-TN','US-TX','US-UT','US-VT',
  'US-VA','US-WA','US-WV','US-WI','US-WY','US-DC','US-AS','US-GU','US-MP',
  'US-PR','US-VI'
]);

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

async function fetchCSV(url: string, label: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  console.log(`Downloaded ${label}: ${(text.length / 1024 / 1024).toFixed(1)} MB`);
  return text;
}

/** Parse runways.csv → map of airport_ident → longest runway length (ft) */
function parseRunways(text: string): Map<string, number> {
  const lines = text.trim().split('\n');
  const header = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
  const identIdx = header.findIndex(h => h.includes('airport_ident'));
  const lengthIdx = header.findIndex(h => h.includes('length_ft'));
  const closedIdx = header.findIndex(h => h.includes('closed'));

  const map = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const ident = (vals[identIdx] || '').replace(/^["']|["']$/g, '').trim();
    const closed = (vals[closedIdx] || '').replace(/^["']|["']$/g, '').trim();
    const lenStr = (vals[lengthIdx] || '').replace(/^["']|["']$/g, '').trim();
    const len = parseInt(lenStr, 10);
    if (!ident || closed === '1' || isNaN(len) || len <= 0) continue;
    const existing = map.get(ident) ?? 0;
    if (len > existing) map.set(ident, len);
  }
  console.log(`Parsed ${map.size} airports with runway data`);
  return map;
}

async function main() {
  console.log('Fetching OurAirports data...\n');
  const [airportsText, runwaysText] = await Promise.all([
    fetchCSV(AIRPORTS_CSV_URL, 'airports.csv'),
    fetchCSV(RUNWAYS_CSV_URL, 'runways.csv'),
  ]);

  const runwayByIdent = parseRunways(runwaysText);

  const lines = airportsText.trim().split('\n');
  const header = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));

  const idx = (name: string) => header.findIndex(h =>
    h.toLowerCase() === name.toLowerCase() || h.toLowerCase().includes(name.toLowerCase())
  );

  const Icao = idx('icao_code');
  const Gps = idx('gps_code');
  const Iata = idx('iata_code');
  const Name = idx('name');
  const Type = idx('type');
  const Lat = idx('latitude_deg');
  const Lon = idx('longitude_deg');
  const Elev = idx('elevation_ft');
  const Region = idx('iso_region');
  const Muni = idx('municipality');
  const HomeLink = idx('home_link');
  const WikiLink = idx('wikipedia_link');

  const features: GeoJSON.Feature[] = [];
  let skippedNoRegion = 0;
  let skippedBadType = 0;
  let skippedNoCoords = 0;
  let withRunway = 0;

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < header.length) continue;
    const get = (c: number) => c >= 0 && c < vals.length ? vals[c]?.trim().replace(/^["']|["']$/g, '') || '' : '';
    const getNum = (c: number): number | null => {
      const v = get(c).replace(/[^\d.\-]/g, '');
      return (v && !isNaN(parseFloat(v))) ? parseFloat(v) : null;
    };

    const region = get(Region);
    if (!US_STATES.has(region)) { skippedNoRegion++; continue; }
    const aptType = get(Type);
    if (!PERTINENT_TYPES.has(aptType)) { skippedBadType++; continue; }
    const lat = getNum(Lat);
    const lon = getNum(Lon);
    if (lat === null || lon === null) { skippedNoCoords++; continue; }

    const icao = get(Icao).toUpperCase();
    const gps = get(Gps).toUpperCase();
    const iata = get(Iata);
    const faa_ident = icao || gps;

    // Look up runway — try ICAO first, then GPS code
    let runwayLength: number | null = null;
    if (icao) {
      runwayLength = runwayByIdent.get(icao) ?? runwayByIdent.get(gps) ?? null;
    } else if (gps) {
      runwayLength = runwayByIdent.get(gps) ?? null;
    }
    if (runwayLength !== null) withRunway++;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        icao: icao || null,
        gps_code: gps || null,
        iata: iata || null,
        faa_ident: faa_ident || null,
        name: get(Name) || 'Unknown Airport',
        type: aptType,
        elevation_ft: getNum(Elev),
        state: region.slice(3),
        region,
        municipality: get(Muni) || null,
        home_link: get(HomeLink) || null,
        wikipedia_link: get(WikiLink) || null,
        runway_length_ft: runwayLength,
        source: 'ourairports',
        source_url: 'https://ourairports.com',
        source_license: 'CC-BY',
        source_classification: 'community/FAA-derived - development convenience',
      }
    });
  }

  const fc: GeoJSON.FeatureCollection & { _metadata: Record<string, unknown> } = {
    type: 'FeatureCollection',
    features,
    _metadata: {
      name: 'airports',
      label: 'Airport / Strip Reference',
      source: 'https://ourairports.com/data/airports.csv',
      sourceClassification: 'community/FAA-derived - development convenience',
      importDate: new Date().toISOString().split('T')[0],
      notes: 'Runway data from ourairports.com/data/runways.csv joined by airport_ident (longest runway per airport).',
      featureCount: features.length,
      airportsWithRunway: withRunway,
      typeBreakdown: features.reduce((acc, f) => {
        const t = (f.properties as any).type;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fc));
  const sizeMB = fs.statSync(OUTPUT_PATH).size / 1024 / 1024;
  console.log(`\nWrote ${features.length} airports (${sizeMB.toFixed(1)} MB)`);
  console.log(`Airports with runway: ${withRunway} (${((withRunway / features.length) * 100).toFixed(1)}%)`);
  console.log(`Skipped: ${skippedNoRegion} wrong region, ${skippedBadType} bad type, ${skippedNoCoords} no coords`);
  console.log('\nType breakdown:');
  for (const [t, c] of Object.entries(fc._metadata.typeBreakdown as Record<string, number>).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
