/**
 * Data adapter exports
 *
 * All adapters follow the snapshot import pattern:
 * 1. Fetch/process from official source
 * 2. Output to /public/data/*.geojson (overlays) or Supabase (site records)
 */

export { importBLMSMA } from './blm-sma';
export { importWildernessData } from './wilderness';
export { seedFAAAirports } from './faa-nasr';
