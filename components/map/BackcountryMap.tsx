'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { LocateButton } from './LocateButton';

interface BackcountryMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  routesGeoJson?: GeoJSON.FeatureCollection;
  onMapLoad?: (map: maplibregl.Map) => void;
}

export const OVERLAY_LAYERS = [
  { id: 'wilderness-fill', label: 'BLM Wilderness', color: '#DC2626', description: 'Designated BLM wilderness — no landing' },
  { id: 'wsa-fill', label: 'Wilderness Study Area', color: '#DC2626', description: 'WSA — special restrictions apply' },
  { id: 'fs-wilderness-fill', label: 'USFS Wilderness', color: '#DC2626', description: 'Forest Service wilderness — no landing' },
  { id: 'sma-nps-fill', label: 'National Parks (NPS)', color: '#DC2626', description: 'National Park Service — no landing' },
  { id: 'sma-fws-fill', label: 'Wildlife Refuge (FWS)', color: '#DC2626', description: 'Fish & Wildlife Service — restricted, verify before landing' },
  { id: 'sma-usfs-fill', label: 'National Forest', color: '#2D5016', description: 'USFS land — primitive recreation OK' },
  { id: 'sma-blm-fill', label: 'BLM Land', color: '#8B6914', description: 'Bureau of Land Management — multiple use' },
  { id: 'airport-fill', label: 'Airports / Strips', color: '#1D4ED8', description: 'FAA/OurAirports airport reference data' },
  { id: 'sma-blm-ak-fill', label: 'Alaska Land Ownership', color: '#8B6914', description: 'BLM Alaska — federal land agencies (BLM, USFS, NPS, FWS, DOD)' },
  { id: 'ak-ond-fill', label: 'AK Wilderness/WSA', color: '#DC2626', description: 'Alaska designated wilderness and WSAs — no landing' },
] as const;

export type BasemapId = 'osm' | 'topo' | 'satellite' | 'vfr';

export const BASEMAP_STYLES: Record<BasemapId, { label: string; icon: string }> = {
  osm:      { label: 'Map',      icon: '🗺️' },
  topo:     { label: 'Topo',     icon: '⛰️' },
  satellite:{ label: 'Satellite', icon: '🛰️' },
  vfr:      { label: 'VFR Chart', icon: '✈️' },
};

function buildStyle(basemap: BasemapId) {
  let tiles: string[];
  let attribution: string;
  if (basemap === 'osm') {
    tiles = [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ];
    attribution = '© OpenStreetMap contributors';
  } else if (basemap === 'topo') {
    tiles = ['https://tile.opentopomap.org/{z}/{x}/{y}.png'];
    attribution = '© OpenStreetMap contributors, © OpenTopoMap';
  } else if (basemap === 'satellite') {
    tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
    attribution = '© Esri World Imagery';
  } else {
    tiles = ['https://server.arcgisonline.com/arcgis/rest/services/Specialty/World_Navigation_Charts/MapServer/tile/{z}/{y}/{x}'];
    attribution = '© Esri — For planning only, not for navigation';
  }
  return {
    version: 8 as const,
    sources: {
      basemap: { type: 'raster' as const, tiles, tileSize: 256 as const, attribution },
    },
    layers: [{ id: 'basemap', type: 'raster' as const, source: 'basemap', minzoom: 0, maxzoom: 19 }],
  };
}

export function BackcountryMap({
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 4,
  routesGeoJson,
  onMapLoad,
}: BackcountryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const diagTapCount = useRef(0);
  const diagTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePopups = useRef<maplibregl.Popup[]>([]);

  const onMapLoadRef = useRef(onMapLoad);
  useEffect(() => { onMapLoadRef.current = onMapLoad; });
  const routesRef = useRef(routesGeoJson);
  useEffect(() => { routesRef.current = routesGeoJson; });

  // Overlay visibility — tracked in ref, applied directly to map (no state = no re-render)
  const overlayVis = useRef<Record<string, boolean>>(
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  function applyVisibility(layerId: string) {
    if (!map.current) return;
    const vis = overlayVis.current[layerId] ?? true ? 'visible' : 'none';
    for (const id of [layerId, layerId + '-outline', layerId + '-fill-outline']) {
      if (map.current.getLayer(id)) map.current.setLayoutProperty(id, 'visibility', vis);
    }
  }

  function closeAllPopups() {
    activePopups.current.forEach((p) => p.remove());
    activePopups.current = [];
  }

  // Load a single overlay GeoJSON — sources survive basemap changes via shared style
  async function loadOverlay(url: string, sourceId: string, layerId: string, color: string, opacity = 0.4) {
    if (!map.current) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: GeoJSON.FeatureCollection = await res.json();
      if (!data.features?.length) return;
      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
      } else {
        map.current.addSource(sourceId, { type: 'geojson', data });
        map.current.addLayer({ id: layerId, type: 'fill', source: sourceId, paint: { 'fill-color': color, 'fill-opacity': opacity } });
        map.current.addLayer({ id: layerId + '-outline', type: 'line', source: sourceId, paint: { 'line-color': color, 'line-width': 1, 'line-opacity': 0.6 } });
        if (!overlayVis.current[layerId]) {
          map.current.setLayoutProperty(layerId, 'visibility', 'none');
          map.current.setLayoutProperty(layerId + '-outline', 'visibility', 'none');
        }
      }
    } catch (err) { console.error('[load]', url, err); }
  }

  // Alaska land ownership — agency_code-driven fill colors
  async function loadAlaskaLand() {
    if (!map.current) return;
    const url = '/data/sma-blm-ak.geojson';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: GeoJSON.FeatureCollection = await res.json();
      if (!data.features?.length) return;
      const srcId = 'sma-blm-ak-src';
      const fillId = 'sma-blm-ak-fill';
      const outlineId = 'sma-blm-ak-fill-outline';
      const fillColor = ['match', ['get', 'agency_code'],
        'BLM', '#8B6914',
        'USFS', '#2D5016',
        'NPS', '#6B21A8',
        'FWS', '#0369A1',
        '#374151',
      ] as maplibregl.ExpressionSpecification;
      if (map.current.getSource(srcId)) {
        (map.current.getSource(srcId) as maplibregl.GeoJSONSource).setData(data);
      } else {
        map.current.addSource(srcId, { type: 'geojson', data });
        map.current.addLayer({
          id: fillId, type: 'fill', source: srcId,
          paint: { 'fill-color': fillColor, 'fill-opacity': 0.45 },
        });
        map.current.addLayer({
          id: outlineId, type: 'line', source: srcId,
          paint: { 'line-color': fillColor, 'line-width': 0.75, 'line-opacity': 0.7 },
        });
        if (!overlayVis.current[fillId]) {
          map.current.setLayoutProperty(fillId, 'visibility', 'none');
          map.current.setLayoutProperty(outlineId, 'visibility', 'none');
        }
      }
    } catch (err) { console.error('[load]', url, err); }
  }

  // Alaska Designated Areas (wilderness, WSA, monuments) — only wilderness/WSA shown
  async function loadAlaskaOND() {
    if (!map.current) return;
    const url = '/data/ak-ond.geojson';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: GeoJSON.FeatureCollection = await res.json();
      if (!data.features?.length) return;
      // Filter to wilderness/WSA only
      const filtered = {
        ...data,
        features: data.features.filter((f) => {
          const lt = (f.properties as any)?.land_type;
          return lt === 'wilderness' || lt === 'wsa';
        }),
      };
      if (!filtered.features.length) return;
      const srcId = 'ak-ond-src';
      const fillId = 'ak-ond-fill';
      const outlineId = 'ak-ond-fill-outline';
      if (map.current.getSource(srcId)) {
        (map.current.getSource(srcId) as maplibregl.GeoJSONSource).setData(filtered);
      } else {
        map.current.addSource(srcId, { type: 'geojson', data: filtered });
        map.current.addLayer({
          id: fillId, type: 'fill', source: srcId,
          paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.45 },
        });
        map.current.addLayer({
          id: outlineId, type: 'line', source: srcId,
          paint: { 'line-color': '#DC2626', 'line-width': 0.75, 'line-opacity': 0.7 },
        });
        if (!overlayVis.current[fillId]) {
          map.current.setLayoutProperty(fillId, 'visibility', 'none');
          map.current.setLayoutProperty(outlineId, 'visibility', 'none');
        }
      }
    } catch (err) { console.error('[load]', url, err); }
  }

  async function loadAllOverlays() {
    if (!map.current) return;
    await Promise.all([
      loadOverlay('/data/sma-blm.geojson', 'sma-blm-src', 'sma-blm-fill', '#8B6914', 0.4),
      loadOverlay('/data/sma-usfs.geojson', 'sma-usfs-src', 'sma-usfs-fill', '#2D5016', 0.4),
      loadOverlay('/data/sma-fws.geojson', 'sma-fws-src', 'sma-fws-fill', '#DC2626', 0.4),
      loadOverlay('/data/sma-nps.geojson', 'sma-nps-src', 'sma-nps-fill', '#DC2626', 0.4),
      loadOverlay('/data/fs-wilderness.geojson', 'fs-wilderness-src', 'fs-wilderness-fill', '#DC2626', 0.4),
      loadOverlay('/data/wsa.geojson', 'wsa-src', 'wsa-fill', '#DC2626', 0.4),
      loadOverlay('/data/wilderness.geojson', 'wilderness-src', 'wilderness-fill', '#DC2626', 0.4),
    ]);
    // Load Alaska layers
    await Promise.all([loadAlaskaLand(), loadAlaskaOND()]);
    // Load airport reference layer
    try {
      const aptRes = await fetch('/data/airports-ourairports.geojson');
      if (aptRes.ok) {
        const aptData: GeoJSON.FeatureCollection = await aptRes.json();
        if (aptData.features?.length) {
          if (!map.current!.getSource('airport-src')) {
            map.current!.addSource('airport-src', { type: 'geojson', data: aptData });
            map.current!.addLayer({ id: 'airport-fill', type: 'circle', source: 'airport-src',
              // Filter: use MapLibre-valid zoom comparison: ['<', ['zoom'], N] hides at zoom >= N.
              // Combined with 'any': show if zoom >= 6 OR zoom >= 8 OR zoom >= 9
              // - Zoom < 6: all hidden
              // - Zoom 6-7: large + medium visible (radius 9px / 6px)
              // - Zoom 8-9: small airstrips also visible
              // - Zoom 9+: all types visible
              filter: ['all', ['==', '$type', 'Point'],
                ['any',
                  ['<', ['zoom'], 9],  // show at zoom < 9 (seaplanes + all)
                  ['<', ['zoom'], 8],  // show at zoom < 8 (small + all)
                  ['<', ['zoom'], 6],  // show at zoom < 6 (large + medium)
                ]
              ],
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  // Zoom 6: large/medium only — big enough to see at regional scale
                  6,  ['match', ['get', 'type'], 'large_airport', 10, 'medium_airport', 7, 'seaplane_base', 4, 'closed', 3, 4],
                  // Zoom 8: small airports join in
                  8,  ['match', ['get', 'type'], 'large_airport', 12, 'medium_airport', 9, 'seaplane_base', 6, 'closed', 4, 6],
                  // Zoom 10+: full detail
                  10, ['match', ['get', 'type'], 'large_airport', 14, 'medium_airport', 11, 'seaplane_base', 8, 'closed', 5, 8],
                ],
                'circle-color': '#1D4ED8',
                'circle-opacity': 0.9,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
              }
            });
            if (!overlayVis.current['airport-fill']) {
              map.current!.setLayoutProperty('airport-fill', 'visibility', 'none');
            }
          }
        }
      }
    } catch (err) { console.error('[load] airports', err); }
    if (routesRef.current?.features?.length) {
      map.current.addSource('routes-source', { type: 'geojson', data: routesRef.current });
      map.current.addLayer({
        id: 'routes-line', type: 'line', source: 'routes-source',
        paint: { 'line-color': '#dc2626', 'line-width': 3, 'line-dasharray': [2, 1] },
      });
    }
  }

  // Inject popup styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .landout-popup .maplibregl-popup-content { padding: 10px 14px; font-family: -apple-system, sans-serif; min-width: 180px; max-width: 240px; }
      .landout-popup-body { }
      .landout-popup-body.collapsed { display: none; }
      .landout-popup-minbtn { position: absolute; top: 6px; right: 28px; background: none; border: none; cursor: pointer; color: #94A3B8; font-size: 16px; line-height: 1; z-index: 2; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: buildStyle(basemap),
      center: initialCenter,
      zoom: initialZoom,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-left');
    mapInstance.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    mapInstance.on('load', async () => {
      map.current = mapInstance;
      mapInstanceRef.current = mapInstance;
      setLoaded(true);
      await loadAllOverlays();
      if (onMapLoadRef.current) onMapLoadRef.current(mapInstance);
    });

    const LAYER_INFO: Record<string, { agency: string; label: string; restriction: 'no-landing' | 'restricted' | 'multiple-use'; color: string }> = {
      'wilderness-fill':     { agency: 'Bureau of Land Management', label: 'BLM Wilderness',         restriction: 'no-landing',   color: '#DC2626' },
      'wsa-fill':           { agency: 'Bureau of Land Management', label: 'Wilderness Study Area', restriction: 'no-landing',   color: '#DC2626' },
      'fs-wilderness-fill': { agency: 'US Forest Service',         label: 'USFS Wilderness',       restriction: 'no-landing',   color: '#DC2626' },
      'sma-nps-fill':      { agency: 'National Park Service',     label: 'National Park',         restriction: 'no-landing',   color: '#DC2626' },
      'sma-fws-fill':      { agency: 'Fish & Wildlife Service',   label: 'Wildlife Refuge',       restriction: 'restricted',   color: '#DC2626' },
      'sma-blm-fill':      { agency: 'Bureau of Land Management', label: 'BLM Land',             restriction: 'multiple-use', color: '#8B6914' },
      'sma-usfs-fill':     { agency: 'US Forest Service',         label: 'National Forest',       restriction: 'multiple-use', color: '#2D5016' },
      'airport-fill':      { agency: 'Airport',                    label: 'Reference Airport',     restriction: 'multiple-use', color: '#1D4ED8' },
      // Alaska layers
      'sma-blm-ak-fill':  { agency: 'Alaska Federal Land',      label: 'Alaska Land Ownership', restriction: 'multiple-use', color: '#8B6914' },
      'ak-ond-fill':      { agency: 'BLM Alaska',               label: 'AK Wilderness/WSA',    restriction: 'no-landing',   color: '#DC2626' },
    };
    const RANK: Record<string, number> = { 'no-landing': 0, 'restricted': 1, 'multiple-use': 2, 'airport': 3 };

    // Click → close all popups, then show new one for topmost land-restriction feature
    mapInstance.on('click', (e) => {
      closeAllPopups();

      const allFeatures = mapInstance.queryRenderedFeatures(e.point);
      if (!allFeatures.length) return;
      mapInstance.getCanvas().style.cursor = 'pointer';

      let best = allFeatures[0];
      let bestInfo = LAYER_INFO[best.layer?.id ?? ''];
      let bestRank = RANK[bestInfo?.restriction ?? ''] ?? 3;
      for (const f of allFeatures) {
        const info = LAYER_INFO[f.layer?.id ?? ''];
        if (!info) continue;
        const r = RANK[info.restriction];
        if ((r ?? 3) < bestRank) { best = f; bestInfo = info; bestRank = r ?? 3; }
      }
      // Handle airport layer separately (blue-themed popup, not land-status colors)
      if (best.layer?.id === 'airport-fill') {
        const props = best.properties ?? {};
        const aptCode = props.icao || props.gps_code || '—';
        const aptName = props.name || 'Unknown Airport';
        const aptType = props.type || 'unknown';
        const aptElev = props.elevation_ft != null ? `${props.elevation_ft} ft` : '—';
        const aptLoc = [props.municipality, props.state].filter(Boolean).join(', ') || '—';
        const aptColor = '#1D4ED8';
        const aptPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, className: 'landout-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="position:relative;min-width:180px;max-width:240px">
              <button class="landout-popup-minbtn" title="Minimize">−</button>
              <div class="landout-popup-body">
                <div style="display:flex;align-items:center;margin-bottom:4px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${aptColor};margin-right:8px;flex-shrink:0"></span>
                  <span style="font-weight:600;color:#1E293B">Airport Reference</span>
                </div>
                <div style="color:#1E293B;font-size:14px;font-weight:600;margin-bottom:2px;padding-left:18px">${aptName}</div>
                <div style="color:#1D4ED8;font-size:12px;font-weight:700;font-family:monospace;margin-bottom:6px;padding-left:18px">${aptCode}</div>
                <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:11px;color:#475569;padding-left:18px">
                  <span style="color:#94A3B8">Type</span><span>${aptType}</span>
                  <span style="color:#94A3B8">Elevation</span><span>${aptElev}</span>
                  <span style="color:#94A3B8">Location</span><span>${aptLoc}</span>
                </div>
                <div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:#EFF6FF;color:#1D4ED8;font-size:10px;text-align:center">✈ Reference data — not legal authority</div>
              </div>
            </div>
          `)
          .addTo(mapInstance);
        activePopups.current.push(aptPopup);
        aptPopup.getElement().addEventListener('click', (ev) => {
          const target = ev.target as HTMLElement;
          if (target.classList.contains('landout-popup-minbtn')) {
            ev.stopPropagation();
            const body = aptPopup.getElement().querySelector('.landout-popup-body') as HTMLElement;
            const btn = aptPopup.getElement().querySelector('.landout-popup-minbtn') as HTMLElement;
            if (body && btn) {
              if (body.classList.contains('collapsed')) {
                body.classList.remove('collapsed');
                btn.textContent = '−';
              } else {
                body.classList.add('collapsed');
                btn.textContent = '+';
              }
            }
          }
        });
        return;
      }

      if (!bestInfo) return;

      const props = best.properties ?? {};
      // Support both old and new property names from different import sources
      const name = props.name || props.WILDERNESS || props.ADMIN_UNIT_NAME
        || props.WildernessName || props.unit_name || props.WSA_NAME
        || props.FORESTNAME || props.forestname
        || props.agency_name || props.designation_type || '';
      const rC = bestInfo.restriction === 'no-landing' ? '#DC2626' : bestInfo.restriction === 'restricted' ? '#D97706' : '#16A34A';
      const rBg = bestInfo.restriction === 'no-landing' ? '#FEE2E2' : bestInfo.restriction === 'restricted' ? '#FEF3C7' : '#DCFCE7';
      const rTxt = bestInfo.restriction === 'no-landing' ? '🚫 No landing' : bestInfo.restriction === 'restricted' ? '⚠️ Restricted — verify before landing' : '✅ Multiple use — landing generally OK';

      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, className: 'landout-popup' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="position:relative;min-width:180px;max-width:240px">
            <button class="landout-popup-minbtn" title="Minimize">−</button>
            <div class="landout-popup-body">
              <div style="display:flex;align-items:center;margin-bottom:4px">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${bestInfo.color};margin-right:8px;flex-shrink:0"></span>
                <span style="font-weight:600;color:#1E293B">${bestInfo.agency}</span>
              </div>
              ${bestInfo.label ? `<div style="color:#64748B;font-size:12px;font-style:italic;margin-bottom:3px;padding-left:18px">${bestInfo.label}</div>` : ''}
              ${name ? `<div style="color:#475569;font-size:12px;margin-bottom:3px;padding-left:18px">${name}</div>` : ''}
              <div style="margin-top:4px;padding:4px 8px;border-radius:6px;background:${rBg};color:${rC};font-size:11px;font-weight:600;text-align:center">${rTxt}</div>
            </div>
          </div>
        `)
        .addTo(mapInstance);

      activePopups.current.push(popup);

      popup.getElement().addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement;
        if (target.classList.contains('landout-popup-minbtn')) {
          ev.stopPropagation();
          const body = popup.getElement().querySelector('.landout-popup-body') as HTMLElement;
          const btn = popup.getElement().querySelector('.landout-popup-minbtn') as HTMLElement;
          if (body && btn) {
            if (body.classList.contains('collapsed')) {
              body.classList.remove('collapsed');
              btn.textContent = '−';
            } else {
              body.classList.add('collapsed');
              btn.textContent = '+';
            }
          }
        }
      });
    });

    mapInstance.on('mousemove', (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point);
      mapInstance.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY DEPS — map only mounts once

  // Expose window API — basemap switch patches the existing tile source, no style reload needed
  useEffect(() => {
    const win = window as typeof window & {
      landoutSwitchBasemap: (id: BasemapId) => void;
      landoutSetOverlayVisibility: (id: string, vis: boolean) => void;
      landoutGetBasemap: () => BasemapId;
      landoutToggleDiagnostics: () => void;
    };
    const switchTo = (id: BasemapId) => {
      if (!map.current || id === basemap) return;
      closeAllPopups();
      // Patch tile URLs in the existing 'basemap' raster source — no style reload, no overlay loss
      const src = map.current.getSource('basemap') as maplibregl.RasterTileSource;
      if (!src) return;
      const newStyle = buildStyle(id);
      src.setTiles((newStyle.sources.basemap as unknown as { tiles: string[] }).tiles);
      setBasemap(id);
    };
    win.landoutSwitchBasemap = switchTo;
    win.landoutSetOverlayVisibility = (id: string, vis: boolean) => {
      overlayVis.current[id] = vis;
      applyVisibility(id);
    };
    win.landoutGetBasemap = () => basemap;
    win.landoutToggleDiagnostics = () => setShowDiagnostics((v) => !v);
  });

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <span className="text-slate-500">Loading map…</span>
        </div>
      )}
      {showDiagnostics && (
        <DiagnosticsPanel onClose={() => setShowDiagnostics(false)} />
      )}
      {/* Locate button — bottom-right, keeps BasemapToggle clear on left side */}
      <div style={{ position: 'absolute', bottom: 72, right: 8, zIndex: 10 }}>
        <LocateButton mapRef={mapInstanceRef} />
      </div>
    </div>
  );
}