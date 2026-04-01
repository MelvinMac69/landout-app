# Local Setup Instructions

## Prerequisites

- Node.js 18+ (tested with Node 20)
- npm or pnpm
- A Supabase project (free tier works for MVP)

---

## 1. Clone and Install

```bash
cd backcountry-map
npm install
```

---

## 2. Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: custom map tile server
# NEXT_PUBLIC_MAPLIBRE_STYLE_URL=https://your-tileserver.com/style.json
```

To get your Supabase keys:
1. Go to [supabase.com](https://supabase.com) and create a project
2. Go to **Settings → API** in the Supabase dashboard
3. Copy the `Project URL` and `anon public` key
4. For `SUPABASE_SERVICE_ROLE_KEY`, use the `service_role` secret (keep this server-side only)

---

## 3. Database Setup

### Run migrations

```bash
npm run db:migrate
```

This pushes the schema to your Supabase project. It runs:
- `001_initial_schema.sql` — core tables, RLS policies, PostGIS
- `002_data_sources.sql` — source_type, site_type, overlay_metadata

### Verify PostGIS is enabled

In Supabase SQL Editor, run:
```sql
SELECT PostGIS_Version();
```

If it returns a version number, you're good. If not, enable the PostGIS extension:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## 4. Import Data

### Step 1: Import Overlays (map layers)

```bash
# Import BLM SMA land status
npm run import:blm

# Import Wilderness + WSA boundaries
npm run import:wilderness

# Or run both at once
npm run import:overlays
```

This fetches official GIS data from BLM ArcGIS services and saves GeoJSON files to `public/data/`.

**Note:** The BLM SMA dataset is large. First import may take 5-15 minutes depending on connection speed.

### Step 2: Import FAA Airport Data

```bash
# Preview data without writing to database (recommended first)
npm run import:faa:dry-run

# Actually import into Supabase
npm run import:faa
```

This downloads FAA NASR data (via pre-processed GitHub CSV) and seeds the `landing_sites` table with `source_type = 'faa_reference'` records.

**Expected records:** ~20,000-30,000 airports and landing sites.

### Step 3: Import All Data

```bash
npm run import:all
```

---

## 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app should:
- Show the map centered on the US
- Display BLM/USFS/NPS/FWS land overlays (once imported)
- Show Wilderness and WSA overlays (once imported)
- Allow search for FAA airports (once FAA data is imported)

---

## 6. Map Layer Files (what gets created)

After running import scripts, these files will exist in `public/data/`:

```
public/data/
├── blm-sma.geojson       # BLM Surface Management Agency (all federal agencies)
├── wilderness.geojson     # Designated wilderness areas
├── wsa.geojson           # Wilderness Study Areas
└── faa-airports.csv       # Local FAA data cache
```

These are static files served by Next.js. In production, consider:
- Hosting GeoJSON files on a CDN instead of in the repo (they can be 10-100 MB)
- Using vector tiles (MBTiles) instead of raw GeoJSON for better performance

---

## 7. Updating Data

### Manual refresh

```bash
# Refresh all overlays
npm run import:overlays

# Refresh FAA data
npm run import:faa
```

### Automated refresh (future)

Set up a GitHub Actions cron job or local cron script to run imports periodically:

- BLM/Wilderness overlays: every 6 months
- FAA NASR: every 28 days (FAA cycle)

---

## Troubleshooting

### "ArcGIS fetch failed: 499"
The BLM ArcGIS service may rate-limit or timeout on large requests. Try:
- Running imports during off-peak hours
- Using a VPN if blocked
- Downloading a pre-processed national extract manually from the BLM hub

### "PostGIS not enabled"
In Supabase dashboard → SQL Editor → run:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### "FAA import fails with auth error"
Make sure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local`. The service role key is needed for bulk inserts (anon key only has limited permissions).

### Map is slow / overlays don't render
The GeoJSON files may be too large. After first successful import, consider:
1. Simplifying geometries (`tolerance: 0.001` in the adapter instead of `0.0005`)
2. Converting to vector tiles with `tippecanoe`
3. Only importing subset (e.g., specific states)

---

## Production Deployment Notes

Before deploying to production:

1. **Move large GeoJSON files to object storage** (S3, Supabase Storage, etc.) — don't commit 50 MB GeoJSON files to Git
2. **Set `NEXT_PUBLIC_APP_URL`** to your production URL
3. **Enable Supabase Row Level Security** — the migrations set up policies but test them
4. **Set up a refresh schedule** for FAA 28-day cycle updates
5. **Add a data freshness footer** to the app (`<MapDataFreshness />` component)
