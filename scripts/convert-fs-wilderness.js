/**
 * Convert USFS Wilderness shapefile to simplified GeoJSON
 * Source: https://data.fs.usda.gov/geodata/edw/edw_resources/shp/S_USA.Wilderness.zip
 */
const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const INPUT_SHP = '/tmp/S_USA.Wilderness.shp';
const INPUT_DBF = '/tmp/S_USA.Wilderness.dbf';
const OUTPUT = path.join(__dirname, '..', 'public', 'data', 'fs-wilderness.geojson');

async function convert() {
  console.log('Converting USFS Wilderness shapefile to GeoJSON...');
  const source = await shapefile.open(INPUT_SHP, INPUT_DBF);
  const features = [];
  let result;
  let count = 0;

  while (!(result = await source.read()).done) {
    count++;
    const props = result.value.properties || {};
    features.push({
      type: 'Feature',
      geometry: result.value,
      properties: {
        name: props.WILDERNESS || props.WILDERNE_1 || null,
        designation: props.BOUNDARYST || null,
        agency: 'USFS',
        acres: props.GIS_ACRES || null,
        wid: props.WID || null,
        areaid: props.AREAID || null,
      }
    });
    if (count % 100 === 0) console.log(`  Read ${count} features...`);
  }

  console.log(`Total: ${count} features`);

  const geojson = {
    type: 'FeatureCollection',
    features
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(geojson));
  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`Wrote ${OUTPUT} (${size} KB)`);
}

convert().catch(console.error);
