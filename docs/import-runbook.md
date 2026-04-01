# Import Runbook

> How to download, import, verify, and refresh data in the Backcountry Map app.

---

## Overview

The app uses two types of data:

| Type | Location | How updated |
|---|---|---|
| **Overlay layers** | `public/data/*.geojson` | Downloaded and processed via import scripts |
| **Site/strip records** | Supabase `landing_sites` table | Seeded via import script |

---

## Part 1: FAA Airport Reference Data

### Download Official FAA NASR Data

**Source:** FAA 28-Day NASR Subscription

1. Go to: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/

2. Find the **"28 Day NASR Subscription"** section and click **"Download"**

3. Save the ZIP file (named something like `28-Day-NASR-Subscription-2026-XX-XX.zip`)

4. Extract the ZIP. Navigate to the `APT_CSV` subdirectory inside.

5. You should see:
   ```
   APT_CSV/
   ├── APT_BASE.csv        ← primary file (airport data)
   ├── APT_RWY.csv         ← runway details
   ├── APT_RWY_END.csv     ← runway end details
   └── (other files — not needed for MVP)
   ```

6. Copy the path to `APT_BASE.csv`. You'll use it in the next step.

**Note:** A new NASR package is published every 28 days. The filename includes the effective date (e.g., `dd_Mon_yyyy_APT_CSV.zip`).

---

### Import FAA Data

```bash
# Using a local FAA CSV file (after downloading from FAA)
npm run import:faa -- --base ./path/to/APT_BASE.csv

# Dry run (preview what would be imported — no writes)
npm run import:faa -- --dry-run --base ./path/to/APT_BASE.csv

# Full import with Supabase
npm run import:faa -- --base ./path/to/APT_BASE.csv
```

The script will:
1. Parse `APT_BASE.csv` using the FAA NASR field mapping
2. Insert records into `landing_sites` with `source_type = 'official_reference'`
3. Batch insert (500 records per batch)
4. Report success/error counts

**What gets imported:**

| FAA field | App field |
|---|---|
| ICAO code | `icao_code` |
| FAA identifier | `faa_id` |
| Airport name | `name` |
| Latitude, Longitude | `location` (PostGIS POINT) |
| Field elevation | `elevation_ft` |
| Longest runway length | `runway_length_ft` |
| Primary runway surface | `runway_surface` |
| Traffic type | stored in `description` |

---

### Verify FAA Import Success

1. **Check Supabase:**
   ```sql
   -- Count FAA reference records
   SELECT COUNT(*) FROM landing_sites WHERE source_type = 'official_reference';

   -- Sample some records
   SELECT name, icao_code, elevation_ft, runway_length_ft, runway_surface
   FROM landing_sites
   WHERE source_type = 'official_reference'
   LIMIT 10;

   -- Check for any import errors (null locations, etc.)
   SELECT COUNT(*) FROM landing_sites
   WHERE source_type = 'official_reference' AND location IS NULL;
   ```

2. **Check app:**
   - Go to `/sites/search`
   - Search for `KLAX`, `KSAN`, or a known airport
   - Verify the site detail page shows correct data

3. **Expected record count:** ~20,000–30,000 FAA-registered airports and facilities

---

## Part 2: BLM Land Status Overlays

### Import BLM SMA

```bash
# Fetch directly from BLM ArcGIS service
npm run import:blm

# This pulls from:
# https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer/1
```

The script will:
1. Paginate through the BLM ArcGIS service (1000 features per request)
2. Convert to GeoJSON with color-coded properties by agency unit
3. Save to `public/data/blm-sma.geojson`
4. Report feature count and file size

**Expected output:**
```
Fetching SMA records offset 0...
Fetching SMA records offset 1000...
...
Written to public/data/blm-sma.geojson
File size: ~15-50 MB (varies by simplification)
```

---

### Import Wilderness / WSA

```bash
# Import both wilderness and WSA from BLM NLCS MapServer
npm run import:wilderness

# BLM NLCS service:
# https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer
# Layer 0 = Wilderness Areas
# Layer 1 = WSA
```

---

### Import All Overlays at Once

```bash
npm run import:overlays
```

---

### Verify Overlay Import

1. **Check file existence:**
   ```bash
   ls -lh public/data/*.geojson
   ```

2. **Check feature counts:**
   ```bash
   # Quick count via jq (if installed)
   jq '.features | length' public/data/blm-sma.geojson
   jq '.features | length' public/data/wilderness.geojson
   jq '.features | length' public/data/wsa.geojson
   ```

3. **Check in app:**
   - Go to `/map`
   - Open the Layer Toggle panel
   - Enable BLM layer — verify you see colored polygons covering western US federal lands
   - Enable Wilderness layer — verify green overlays appear
   - Check MapLegend for correct colors

4. **Overlay metadata in Supabase:**
   ```sql
   SELECT layer_key, last_refreshed_at, record_count, file_size_bytes
   FROM overlay_metadata
   ORDER BY layer_key;
   ```

---

## Part 3: Refreshing Data

### FAA Data Refresh (Every 28 Days)

The FAA publishes a new NASR package every 28 days. To refresh:

1. **Download the new package:**
   ```
   https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/
   → 28 Day NASR Subscription → Download
   ```

2. **Extract and note the new path:**
   ```bash
   ls ~/Downloads/APT_CSV/
   # Look for APT_BASE.csv with recent date
   ```

3. **Import with the new file:**
   ```bash
   npm run import:faa -- --base ~/Downloads/APT_CSV/APT_BASE.csv
   ```

4. **Verify in Supabase:**
   ```sql
   -- Check the NASR cycle date on recent records
   SELECT nasr_cycle_date, COUNT(*)
   FROM landing_sites
   WHERE source_type = 'official_reference'
   GROUP BY nasr_cycle_date
   ORDER BY nasr_cycle_date DESC
   LIMIT 5;
   ```

5. **Update overlay_metadata:**
   ```sql
   UPDATE overlay_metadata
   SET last_refreshed_at = NOW(),
       last_refreshed_by = 'manual'
   WHERE layer_key = 'faa_nasr';
   ```

**Important:** The FAA import script does **upsert** (update existing, insert new) based on ICAO code — it will update records that changed in the new cycle and insert new airports.

---

### BLM Overlay Refresh (Every 6–12 Months)

1. **Run the import scripts:**
   ```bash
   npm run import:overlays
   ```

2. **Verify the new files**

3. **Update overlay_metadata:**
   ```sql
   UPDATE overlay_metadata
   SET last_refreshed_at = NOW(),
       last_refreshed_by = 'manual',
       source_data_hash = '<new hash>'
   WHERE layer_key = 'blm_sma';
   ```

4. **Commit the updated GeoJSON files to git** (or host them on a CDN)

---

## Part 4: Troubleshooting

### "ArcGIS fetch failed: 404"
The service URL has changed or the layer index is wrong. Check the BLM services directory:
```
https://gis.blm.gov/arcgis/rest/services/lands
```
Verify the service name and layer number before re-running.

### "ArcGIS fetch failed: 499" or timeout
Large requests can timeout. Try:
- Running during off-peak hours
- The script handles pagination automatically; if it's still timing out, the BLM service may be experiencing load

### FAA import creates duplicate records
The script should use ICAO code as a unique key for upserts. If duplicates appear, verify the Supabase constraint:
```sql
-- Check if there's a unique index on icao_code
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'landing_sites';
```
If no unique index exists on `icao_code`, add one:
```sql
CREATE UNIQUE INDEX idx_landing_sites_icao_faa_ref
ON landing_sites(icao_code)
WHERE source_type = 'official_reference';
```

### Overlay layer doesn't appear on map
1. Check the file exists and has features: `jq '.features | length' public/data/blm-sma.geojson`
2. Check the map page is loading the file (network tab in dev tools)
3. Check the `layer visibility` is enabled in the Layer Toggle panel

### Supabase insert fails with RLS error
The FAA import requires `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) because it bypasses RLS. Make sure your `.env.local` has:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
The service role key is in Supabase Dashboard → Settings → API → `service_role` secret.

---

## Part 5: Environment Variables Reference

```bash
# Required for Supabase imports
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # needed for FAA import

# Required for local file imports
# (passed via --base flag, not env var)
```

---

## Quick Reference Card

```bash
# First-time setup
npm run import:overlays        # BLM + wilderness + WSA
npm run import:faa -- --dry-run --base ./data/APT_BASE.csv   # Preview
npm run import:faa -- --base ./data/APT_BASE.csv            # Import

# Refresh
npm run import:overlays        # Refresh overlays
npm run import:faa -- --base ./new-data/APT_BASE.csv  # Refresh FAA

# Verify
npm run dev                    # Start app
# → /sites/search → test search
# → /map → test layer toggles
```
