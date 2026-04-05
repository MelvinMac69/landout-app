# Landout Data Sources — Overlay Quality Pass

_Last updated: 2026-04-03_

---

## Source Classification Labels

Each layer is tagged with one of three classifications:

| Classification | Meaning |
|---|---|
| `authoritative public source - higher resolution` | Best available official data from a public government source. Suitable for real-world backcountry planning decisions. |
| `official generalized - interim` | Official data but pre-simplified / generalized for cartographic use. Useful for planning but boundaries are approximate. Temporary solution until better source is available. |
| `official generalized` | Official data from a federal land management agency, generalized. Verify with local office before landing. |

---

## Current Overlay Layers

### 1. BLM Land (`sma-blm-fill`)
- **File:** `public/data/sma-blm.geojson`
- **Source:** BLM National Surface Management Agency — Limited Scale
  `https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer/1`
- **Classification:** `official generalized - interim` ⚠️
- **Import date:** 2026-04-03
- **Features:** ~2,000 state-level aggregates
- **Geometry quality:** Improved (avg ~900 coords/feature). State-level only — no field-office breakdown available from this service.
- **Status:** WARNING — Generalized boundaries. Does not subdivide to field office level.
- **Long-term fix:** Requires BLM to publish full-resolution land ownership FeatureService, or integration with BLM'sCadastral Parcel data.

### 2. National Forest (`sma-usfs-fill`)
- **File:** `public/data/sma-usfs.geojson`
- **Source:** ArcGIS Living Atlas — USA National Forests
  `https://services.arcgis.com/P3aJ3kRW5t0YLPqK/arcgis/rest/services/USA_National_Forests/FeatureServer/0`
- **Classification:** `authoritative public source - higher resolution` ✅
- **Import date:** 2026-04-03
- **Features:** ~112 national forest units
- **Geometry quality:** High (~1,500 avg coords/feature)
- **Status:** HEALTHY — Trustworthy for backcountry planning.

### 3. BLM Wilderness (`wilderness-fill`)
- **File:** `public/data/wilderness.geojson`
- **Source:** BLM NLCS Generalized FeatureServer, Layer 1
  `https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/1`
- **Classification:** `authoritative public source - higher resolution` ✅
- **Import date:** 2026-04-03
- **Features:** ~399 designated wilderness areas
- **Geometry quality:** High (~312 avg coords/feature)
- **Status:** HEALTHY

### 4. Wilderness Study Area (`wsa-fill`)
- **File:** `public/data/wsa.geojson`
- **Source:** BLM NLCS Generalized FeatureServer, Layer 2
  `https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/2`
- **Classification:** `authoritative public source - higher resolution` ✅
- **Import date:** 2026-04-03
- **Features:** ~1,471 WSAs
- **Geometry quality:** Good (~139 avg coords/feature)
- **Status:** HEALTHY

### 5. USFS Wilderness (`fs-wilderness-fill`)
- **File:** `public/data/fs-wilderness.geojson`
- **Source:** wilderness.net / USFS TIGER data
- **Classification:** `authoritative public source - higher resolution` ✅
- **Import date:** 2024-01-01 (original)
- **Features:** ~59 USFS wilderness areas
- **Status:** HEALTHY

### 6. National Parks (`sma-nps-fill`)
- **File:** `public/data/sma-nps.geojson`
- **Source:** NPS Land Resources (Generalized)
- **Classification:** `official generalized`
- **Import date:** 2024-01-01 (original)
- **Status:** WARNING — Generalized boundaries. Verify with local NPS office.

### 7. Wildlife Refuge (`sma-fws-fill`)
- **File:** `public/data/sma-fws.geojson`
- **Source:** FWS National Wildlife Refuge System (Generalized)
- **Classification:** `official generalized`
- **Import date:** 2024-01-01 (original)
- **Status:** WARNING — Generalized boundaries. Verify with local FWS office before landing.

---

## Import Scripts

| Script | What it does |
|---|---|
| `scripts/data/fetch-blm-land.ts` | Queries BLM SMA per-state, filters null geom, writes sma-blm.geojson |
| `scripts/data/fetch-usfs-land.ts` | Queries ArcGIS Living Atlas USA_National_Forests, writes sma-usfs.geojson |
| `scripts/data/fetch-wilderness-wsa.ts` | Re-imports wilderness and WSA from BLM NLCS Generalized |

Run all: `npx tsx scripts/data/fetch-blm-land.ts && npx tsx scripts/data/fetch-usfs-land.ts && npx tsx scripts/data/fetch-wilderness-wsa.ts`

---

## What Changed (2026-04-03 Pass)

### BLM Land
- Old: 10 valid features, 21 null geom, ~7 coords/feature — **broken**
- New: ~2,000 features, 0 null geom, ~900 coords/feature — **materially better**
- Still `official generalized - interim` — state-level only, not field office

### USFS National Forests
- Old: 11 features, ~4-10 coords/feature — **essentially unusable**
- New: 112 features, ~1,500 coords/feature — **high quality, trustworthy**
- `authoritative public source - higher resolution`

### Wilderness / WSA
- Re-imported from NLCS Generalized with proper field names
- Old wilderness had null property names due to wrong field mapping
- New: 399 wilderness areas, 1,471 WSAs, all properties correctly populated

---

## MVP Assessment

### Is the revised BLM layer good enough for MVP?
**Marginally yes.** It shows BLM land presence and general boundaries. However, it cannot be used for precise boundary determination. A pilot should treat BLM land overlays as indicative only — verify with the local BLM field office.

### Is the BLM layer temporary?
**Yes.** The current source is limited-scale by design. The proper long-term fix is BLM publishing full-resolution land ownership data publicly, or integrating with an alternative high-resolution source (e.g., state-level BLM cadastral data).

### Is the new USFS layer trustworthy for MVP?
**Yes.** The ArcGIS Living Atlas national forests data is high quality and suitable for real planning decisions.

### What would replace BLM with a better long-term source?
1. BLM publishes a full-resolution (non-LimitedScale) FeatureService publicly — would require checking annually
2. Integration with individual state BLM office cadastral data (each state has its own BLM office with GIS data)
3. USGS PAD-US dataset (Protected Areas Database) — covers all federal lands including BLM, at higher resolution than SMA LimitedScale

---

## File Sizes

| File | Size | Notes |
|---|---|---|
| sma-blm.geojson | ~12 MB | Alaska geometries included |
| wilderness.geojson | ~3.3 MB | |
| wsa.geojson | ~2.8 MB | |
| sma-usfs.geojson | ~2.4 MB | |
| fs-wilderness.geojson | ~0.4 MB | |
| sma-nps.geojson | ~0.3 MB | |
| sma-fws.geojson | ~0.2 MB | |

All files under Railway's static file limits.
