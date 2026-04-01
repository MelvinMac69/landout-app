#!/usr/bin/env python3
"""Fetch BLM SMA by state/agency. Works around ArcGIS encoding issues."""
import urllib.request, urllib.parse, json, time, os

SERVICE = 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer'

STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

AGENCIES = ['BLM', 'USFS', 'NPS', 'FWS', 'ST', 'LG']

out_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data')
os.makedirs(out_dir, exist_ok=True)

results = {a: [] for a in AGENCIES}
total = len(STATES) * len(AGENCIES)
i = 0

for state in STATES:
    for agency in AGENCIES:
        i += 1
        print(f"[{i}/{total}] {state}/{agency}...", end=" ", flush=True)

        where = f"ADMIN_AGENCY_CODE='{agency}' AND ADMIN_ST='{state}'"
        params = urllib.parse.urlencode({
            'where': where,
            'outFields': 'ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,SHAPE_Area,GIS_ACRES,ADMIN_ST',
            'f': 'geojson',
            'resultRecordCount': 1000,
            'outSR': '4326'
        })
        # Build URL directly to avoid shell & interpretation issues
        url = f"{SERVICE}/1/query?{params}"

        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
                features = data.get('features', [])
                results[agency].extend(features)
                print(f"{len(features)} features (total {len(results[agency])})")
        except Exception as e:
            print(f"ERROR: {e}")

        time.sleep(1.0)  # ArcGIS rate-limits without enough delay

print("\n--- Results ---")
for agency, features in results.items():
    if not features:
        print(f"{agency}: 0 features -- skipped")
        continue
    out_file = os.path.join(out_dir, f"sma-{agency.lower()}.geojson")
    geojson = {'type': 'FeatureCollection', 'features': features}
    with open(out_file, 'w') as f:
        json.dump(geojson, f)
    size = os.path.getsize(out_file) / 1024
    print(f"{agency}: {len(features)} features -> {out_file} ({size:.1f} KB)")
