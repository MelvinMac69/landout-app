# Data Sources — Backcountry Map MVP

> Last updated: 2026-03-31
> Status key: ✅ Verified | ⚠️ Unverified | ❌ Not viable

---

## Source Priority Policy

When multiple sources exist for the same data, the following hierarchy applies:

1. **Official government source (primary)** — Direct from the agency that owns/manages the data
2. **Official government aggregator (secondary)** — An official interagency or official government-curated source
3. **Non-governmental curated source (fallback only)** — Community or third-party curated, only if government source is unavailable or unusable

This policy ensures every data point in the app can be traced to a authoritative origin.

---

## Reference Overlays

### 1. BLM Surface Management Agency (SMA) — Land Status

| Property | Value |
|---|---|
| **Source name** | BLM National SMA — Limited Scale |
| **Agency** | Bureau of Land Management (BLM) |
| **Official URL** | https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer |
| **Direct download (shapefile)** | https://gbp-blm-egis.hub.arcgis.com/datasets/blm-national-sma-surface-management-agency-area-polygons |
| **Layer used** | Layer 1 — "Surface Management Agency" |
| **Geometry type** | Polygon |
| **Spatial ref** | EPSG:3857 (Web Mercator) |
| **Query format** | GeoJSON supported (`f=geojson`) |
| **Scale** | Limited/generalized — appropriate for nationwide overview mapping |
| **Coverage** | CONUS, Alaska, Hawaii, Puerto Rico, Guam, American Samoa, Virgin Islands |
| **Update cadence** | As-needed; republished when BLM acquires/disposes land |
| **Use in app** | Land status overlay — distinguishes BLM, USFS, NPS, FWS, BOR, DOE ownership |
| **Status** | ✅ Verified |
| **Why LimitedScale?** | Full-detail SMA (scheme level 14+) is too large for nationwide web rendering. LimitedScale is pre-generalized and designed for overview mapping. Correct choice for MVP. |

**SMA Unit Types and Colors:**

| Unit Code | Agency | Map Color |
|---|---|---|
| BLM | Bureau of Land Management | `#8B6914` |
| FS | Forest Service | `#2D5016` |
| NPS | National Park Service | `#6B3FA0` |
| FWS | Fish & Wildlife Service | `#1E5A8A` |
| BOR | Bureau of Reclamation | `#1A7A7A` |
| DOE | Dept. of Energy | `#C45A00` |
| DOD | Dept. of Defense | `#4A4A4A` |
| PRIVATE | Private land | No fill |
| STATE | State land | No fill |

**Fields available from service:**
- `ADMIN_UNIT_NAME` / `SMA_UNIT` — agency code (BLM, FS, NPS, etc.)
- `SMA_NAME` — name of the unit
- `GIS_ACRES` — area in acres

**Note on precision:** SMA shows which agency has *jurisdiction* over federal land — it does not show exact ownership boundaries or land status (e.g., whether BLM land is open to dispersed camping vs. a designated recreation area). That level of detail requires BLM's more detailedcadastral data and is out of scope for MVP.

---

### 2. BLM NLCS Wilderness Areas

| Property | Value |
|---|---|
| **Source name** | BLM National NLCS Wilderness Areas |
| **Agency** | Bureau of Land Management |
| **ArcGIS service** | https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer |
| **Layer** | Layer 0 — NLCS Wilderness Area |
| **Format** | GeoJSON via ArcGIS query (`f=geojson`) |
| **Geometry** | Polygon |
| **Coverage** | BLM-managed wilderness areas only (national) |
| **Update cadence** | Annually |
| **Use in app** | Avoidance overlay — designated wilderness where landing is prohibited without explicit authorization |
| **Status** | ✅ Verified |

**Important:** This dataset covers only BLM-administered wilderness. USFS, NPS, and FWS wilderness areas require separate sources. See Section 4 below.

---

### 3. BLM NLCS Wilderness Study Areas (WSA)

| Property | Value |
|---|---|
| **Source name** | BLM National NLCS Wilderness Study Areas |
| **Agency** | Bureau of Land Management |
| **ArcGIS service** | https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer |
| **Layer** | Layer 1 — NLCS WSA |
| **Format** | GeoJSON via ArcGIS query |
| **Geometry** | Polygon |
| **Coverage** | BLM-managed WSAs only |
| **Update cadence** | As-needed (WSAs are frequently re-evaluated) |
| **Use in app** | Avoidance overlay — WSAs have special restrictions but status may change |
| **Status** | ✅ Verified |
| **Freshness notice** | WSA status changes frequently. App must display data-freshness date and link to BLM for current status. |

---

### 4. USFS / Interagency Wilderness (Supplementary)

| Property | Value |
|---|---|
| **Source name** | Wilderness Connect — National Wilderness Preservation System |
| **Custodian** | The Wilderness Institute (University of Montana) on behalf of federal agencies |
| **Official URL** | https://wilderness.net/visit-wilderness/gis-gps.php |
| **Feature service** | https://umontana.maps.arcgis.com/home/item.html?id=52c7896cdfab4660a595e6f6a7ef0e4d |
| **Format** | Shapefile download or ArcGIS feature service |
| **Coverage** | ALL designated US wilderness (BLM, USFS, NPS, FWS) — single source |
| **Update cadence** | Annually or as designations change |
| **Use in app** | **Recommended as primary source for wilderness overlays** rather than BLM-only data |
| **Status** | ✅ Verified |
| **Role** | **Primary for wilderness polygons** — provides complete national coverage including USFS and NPS wilderness that BLM NLCS service doesn't cover |
| **Why wilderness.net?** | Official interagency aggregator; maintained by federal land agencies; single source for all wilderness rather than stitching BLM + USFS + NPS separately |

**Source priority for wilderness:**
1. **wilderness.net** — primary (all agencies, one source)
2. BLM NLCS MapServer — fallback/validation (BLM-only, for verifying BLM data)
3. USFS FSGeodata — secondary/supplementary (USFS only)

---

## Site & Strip Records

### 5. FAA NASR — Airport Reference Data (Primary)

| Property | Value |
|---|---|
| **Source name** | FAA 28-Day NASR Subscription — APT_CSV |
| **Agency** | Federal Aviation Administration |
| **Data files** | `APT_BASE.csv` (airports), `APT_RWY.csv` (runways), `APT_RWY_END.csv` (runway ends) |
| **Package download** | https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/ |
| **Alternate download** | https://nfdc.faa.gov/webContent/28DaySub/ |
| **Format** | Fixed-width/CSV (described in FAA NASR README) |
| **Update cadence** | Every 28 days (AIRAC cycle) |
| **Use in app** | Seed `landing_sites` with `source_type = 'official_reference'` |
| **Status** | ✅ Verified |

**Package contents:**

```
APT_CSV.zip (or dd_Mon_yyyy_APT_CSV.zip from nfdc)
├── APT_BASE.csv     — airport identifiers, coordinates, elevation, traffic, fuel, etc.
├── APT_RWY.csv      — runway dimensions, surfaces, lighting
├── APT_RWY_END.csv  — runway ends with approach info
└── (other files not used for MVP)
```

**Download steps:**
1. Go to https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/
2. Download "28 Day NASR Subscription" ZIP for the current cycle
3. Extract to `data/faa/APT_CSV/`
4. Run `npm run import:faa -- --base data/faa/APT_CSV/APT_BASE.csv`

**Important notes:**
- The FAA is sunsetting legacy `.txt` subscriber files targeted for Dec 24, 2026. CSV format is current and preferred.
- The `APT_BASE.csv` is the primary file for airport data. `APT_RWY.csv` and `APT_RWY_END.csv` provide runway details.
- FAA NASR does NOT include unofficial strips, private landing sites, or emergency landing areas — those come from community submissions only.

---

### 6. Community-Submitted Sites

| Property | Value |
|---|---|
| **Source** | User submissions via `/sites/new` form |
| **Stored in** | `landing_sites` table, `source_type = 'community_submitted'` |
| **Moderation** | Required — all go to `pending`, reviewed before public |
| **Editability** | Submitter can edit own submissions; moderators can edit any community record |
| **Provenance** | Recorded as `submitted_by` user ID + `created_at` |
| **Status** | ✅ Verified (feature exists, workflow defined) |

---

## On Third-Party Reference Data (OurAirports, etc.)

The current schema does **not** include a third `imported_third_party` category and we are **not** adding one at this time.

**Reasoning:**

The two-tier model (`official_reference` / `community_submitted`) is sufficient because:

- `official_reference` means: the record comes from an authoritative government source and is managed by data maintainers. The specific provenance (FAA, BLM, USGS, or a third-party aggregator acting as a代理) can be recorded in `source_url` / `source_name` fields on the record.
- If OurAirports data is added later, it would be curated reference data (not user-submitted), but it is not an official government source. It could reasonably be considered `official_reference` with a clear `source_url` attribution noting it came from a community aggregator.

**If a third category is needed in the future**, it would be added as a migration with these semantics:
- `imported_third_party` — reference data sourced from a non-government curated aggregator (e.g., OurAirports, third-party aviation databases)
- Would include required `source_url`, `source_name`, and `source_license` fields
- Would be treated as reference data (moderator-editable) but clearly labeled with third-party provenance

**Current decision: no third category.** The two existing categories handle the MVP scope cleanly.

---

## Data Architecture Summary

```
OVERLAYS (static GeoJSON files, /public/data/)
├── blm-sma.geojson        Source: BLM gis.blm.gov/MapServer (LimitedScale)
│                          Status: ✅ Verified
│                          Refresh: As-needed (manual)
├── wilderness.geojson      Source: wilderness.net or BLM NLCS MapServer
│                          Status: ✅ Verified
│                          Refresh: Annually
└── wsa.geojson            Source: BLM NLCS MapServer
                            Status: ✅ Verified
                            Refresh: As-needed

SITE RECORDS (Supabase / PostGIS)
┌─────────────────────────────────────────────┐
│ landing_sites                                │
│  source_type = 'official_reference'         │
│    ← FAA NASR APT_CSV (primary)             │
│    ← BLM/USFS data (future land records)    │
│                                              │
│  source_type = 'community_submitted'        │
│    ← User form submissions                   │
│    ← Moderated before public                 │
└─────────────────────────────────────────────┘
```

---

## Schema Source Tracking

Every record in `landing_sites` carries provenance fields:

| Column | Purpose |
|---|---|
| `source_type` | `official_reference` or `community_submitted` |
| `source` | Original source identifier (e.g., `'faa_nasr'`, `'blm_sma'`) |
| `source_url` | URL of the official source (for reference records) |
| `nasr_cycle_date` | FAA NASR cycle date (for FAA reference records) |
| `submitted_by` | User ID (for community submissions) |
| `approval_status` | `pending` / `approved` / `rejected` (for community) |

The `overlay_metadata` table tracks layer file provenance:

| Column | Purpose |
|---|---|
| `layer_key` | `blm_sma`, `wilderness`, `wsa` |
| `official_source_name` | Full name of the authoritative source |
| `official_source_url` | Direct URL of the source service/page |
| `last_refreshed_at` | When the local GeoJSON was last updated |
| `source_data_hash` | SHA-256 of source data for change detection |

---

## Update Cadence

| Data | Freshness target | Refresh method |
|---|---|---|
| BLM SMA | 6–12 months | Manual download + import script |
| Wilderness / WSA | 6–12 months | Manual or script |
| FAA NASR | Every 28 days | Script + verify |
| Community sites | Ongoing | Moderation queue |
| Overlay metadata | Updated on each refresh | Manual |

---

## Verified vs To Verify

| Source | Status | Notes |
|---|---|---|
| BLM National SMA (LimitedScale) | ✅ Verified | Service confirmed live |
| BLM NLCS Wilderness (MapServer L0) | ✅ Verified | Service confirmed |
| BLM NLCS WSA (MapServer L1) | ✅ Verified | Service confirmed |
| wilderness.net | ✅ Verified | Official aggregator |
| FAA NASR APT_CSV | ✅ Verified | FAA official, no-auth download |
| FAA NFDC direct URL | ✅ Verified | Confirmed via README |
| OurAirports | ⚠️ Not used | Fallback only, not needed for MVP |
| AirNav | ❌ Not used | Third-party, not authoritative |
| io-aero / GitHub pre-processed | ⚠️ Dev convenience only | Not a production source |
