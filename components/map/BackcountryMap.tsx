'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { MapGrid } from './MapGrid';
import { LocateButton } from './LocateButton';
import { ActionMenu } from './DirectTo';
import { MeasureRuler } from './MeasureRuler';
import { InfoCard } from './InfoCard';
import type { AirportInfo, LandInfo } from './InfoCard';

// Module-level singleton so LocateButton can access the map without prop-drilling refs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapInstanceGetter = (): maplibregl.Map | null => (window as any).__landoutMap ?? null;

interface BackcountryMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  routesGeoJson?: GeoJSON.FeatureCollection;
  onMapLoad?: (map: maplibregl.Map) => void;
}

interface DirectToDest {
  lng: number;
  lat: number;
  name?: string;
  type: 'airport' | 'pin' | 'map';
}

interface DroppedPin {
  id: string;
  lng: number;
  lat: number;
  name?: string;
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

export type BasemapId = 'osm' | 'topo' | 'satellite';

export const BASEMAP_STYLES: Record<BasemapId, { label: string; icon: string }> = {
  osm:      { label: 'Map',      icon: '🗺️' },
  topo:     { label: 'Topo',     icon: '⛰️' },
  satellite:{ label: 'Satellite', icon: '🛰️' },
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
    // Exhaustive check — should never be reached since BasemapId = 'osm' | 'topo' | 'satellite'
    throw new Error(`Unknown basemap: ${basemap}`);
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
  const [basemap, setBasemap] = useState<BasemapId>('satellite');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const diagTapCount = useRef(0);
  const diagTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct To state
  const [directToDest, setDirectToDest] = useState<DirectToDest | null>(null);
  // Debug: visible step indicator for crash diagnosis
  const [debugStep, setDebugStep] = useState<string>('');
  // Ref wrapper for directToDest to avoid stale closure in event listeners
  const directToDestRef = useRef(directToDest);
  useEffect(() => { directToDestRef.current = directToDest; });
  // Track whether fitBounds has been called for the current Direct To session — prevents zoom loop
  const directToFitBoundsDoneRef = useRef(false);
  // Guard to prevent map operations (flyTo/setCenter) during an active flyTo animation
  const flyToInProgressRef = useRef(false);
  // Current GPS position — ref for perf (no re-render on every GPS ping), state for panel re-renders
  const currentPosRef = useRef<{ lat: number; lon: number; heading?: number; speed?: number } | null>(null);
  const [currentPosState, setCurrentPosState] = useState<{ lat: number; lon: number; heading?: number; speed?: number } | null>(null);

  // Fire window event when Direct To changes so page.tsx can render the panel
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('landoutDirectToChange', {
      detail: { dest: directToDest, currentPos: currentPosState },
    }));
  }, [directToDest, currentPosState]);
  const [droppedPins, setDroppedPins] = useState<DroppedPin[]>([]);
  const [actionMenu, setActionMenu] = useState<{ x: number; y: number; lng: number; lat: number; airportName?: string } | null>(null);
  const [infoCard, setInfoCard] = useState<{ data: AirportInfo | LandInfo; screenX: number; screenY: number } | null>(null);
  // Block click after long-press (300ms)
  const suppressClickRef = useRef(false);
  // Track measure mode so map click handler can defer to MeasureRuler
  const measurePhaseRef = useRef<'off' | 'placingB' | 'placed'>('off');
  // Suppress next InfoCard open — set when clicking outside InfoCard closes it
  // Prevents: click-outside closes → same click reopens another card
  const suppressInfoCardOpenRef = useRef(false);

  // Expose setDirectToDest so page.tsx can clear Direct To
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    (window as any).__landoutSetDirectToDest = setDirectToDest;
    return () => { delete (window as any).__landoutSetDirectToDest; };
  }, []);

  // Handle landoutDirectTo event from site detail page Direct To button.


  // Listen for landoutSearchSelect from search page navigation
  useEffect(() => {
    function onSearchSelect(e: Event) {
      const detail = (e as CustomEvent<{
        lng: number; lat: number; name: string;
        faa_ident?: string; airportType?: string; elevation_ft?: number;
        municipality?: string; state?: string; runway_length_ft?: number | null;
        directTo?: boolean;
      }>).detail;
      if (!detail) return;
      setInfoCard({
        screenX: window.innerWidth / 2,
        screenY: window.innerHeight / 2,
        data: {
          type: 'airport',
          lng: detail.lng,
          lat: detail.lat,
          name: detail.name,
          faa_ident: detail.faa_ident,
          airportType: detail.airportType,
          elevation_ft: detail.elevation_ft,
          municipality: detail.municipality,
          state: detail.state,
          runway_length_ft: detail.runway_length_ft ?? null,
        },
      });
      setActionMenu(null);
      if (detail.directTo) {
        setDirectToDest({ lng: detail.lng, lat: detail.lat, name: detail.name, type: 'map' });
      }
    }
    window.addEventListener('landoutSearchSelect', onSearchSelect);
    return () => window.removeEventListener('landoutSearchSelect', onSearchSelect);
  }, []);

  // Handle dropPin from search — show a dropped pin marker on the map
  useEffect(() => {
    function onDropPin(e: Event) {
      const { lng, lat, name } = (e as CustomEvent<{ lng: number; lat: number; name: string }>).detail;
      const map = mapInstanceRef.current;
      console.log('[DropPin] onDropPin called — map:', !!map, 'lng:', lng, 'lat:', lat);
      if (!map) {
        console.log('[DropPin] map not ready, storing pending pin');
        (window as any).__landoutPendingPin = { lng, lat, name, ts: Date.now() };
        return;
      }
      // Guard against overlapping flyTo animations
      if (flyToInProgressRef.current) { console.log('[DropPin] flyTo already in progress, skipping'); return; }
      flyToInProgressRef.current = true;
      console.log('[DropPin] calling map.flyTo to', lng, lat);
      try {
        // Use instant setCenter instead of flyTo to avoid animation on mobile Safari
        map.setCenter([lng, lat]);
        map.setZoom(13);
      } catch (err) {
        console.error('[DropPin] setCenter/setZoom failed:', err);
        flyToInProgressRef.current = false;
        return;
      }
      setTimeout(() => { flyToInProgressRef.current = false; console.log('[DropPin] setCenter complete'); }, 100);
      // Add a temporary red pin marker
      const el = document.createElement('div');
      el.style.cssText = `
        width: 20px; height: 20px;
        background: #EF4444;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 15, closeButton: false, closeOnClick: false })
          .setText(name))
        .addTo(map);
      // Auto-remove after 30 seconds
      setTimeout(() => { marker.remove(); }, 30000);
    }
    window.addEventListener('landoutDropPin', onDropPin);
    return () => window.removeEventListener('landoutDropPin', onDropPin);
  }, []);

  // Debug: count touch events reaching the map
  const touchCountRef = useRef(0);
  const [touchCount, setTouchCount] = useState(0);

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
            // Use minzoom to progressively reveal the layer — more reliable than
            // zoom filter expressions in MapLibre GL JS v4.
            // minzoom: 6 — large + medium airports visible from regional scale (~20-40km)
            // minzoom: 8 — small airstrips added at local scale
            // minzoom: 9 — seaplane bases added
            map.current!.addLayer({ id: 'airport-fill', type: 'circle', source: 'airport-src',
              minzoom: 6,
              filter: ['==', '$type', 'Point'],
              paint: {
                // Tiered visibility using Wikipedia presence as a proxy for established/public-use airports.
                // This is an imperfect heuristic — not an official classification.
                // FAA NASR will eventually give us TOWER flag and use_type for proper classification.
                // Tier 1: large_airport — always prominent
                // Tier 2: medium_airport — clearly visible
                // Tier 3: small_airport with wikipedia_link — established airports (human-curated signal)
                // Tier 4: small_airport without wikipedia_link — private strips, most heliports
                // Tier 5: seaplane_base — de-emphasized at regional zoom
                // Tier 6: closed — nearly invisible (includes heliports), visible only when zoomed in
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  6,  ['case',
                        ['==', ['get', 'type'], 'large_airport'], 9,
                        ['==', ['get', 'type'], 'medium_airport'], 5,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['!=', ['get', 'wikipedia_link'], null]], 3,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['==', ['get', 'wikipedia_link'], null]], 0,
                        0] as any,
                  8,  ['case',
                        ['==', ['get', 'type'], 'large_airport'], 11,
                        ['==', ['get', 'type'], 'medium_airport'], 7,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['!=', ['get', 'wikipedia_link'], null]], 5,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['==', ['get', 'wikipedia_link'], null]], 3,
                        ['==', ['get', 'type'], 'seaplane_base'], 4,
                        2] as any,
                  10, ['case',
                        ['==', ['get', 'type'], 'large_airport'], 13,
                        ['==', ['get', 'type'], 'medium_airport'], 9,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['!=', ['get', 'wikipedia_link'], null]], 7,
                        ['all', ['==', ['get', 'type'], 'small_airport'], ['==', ['get', 'wikipedia_link'], null]], 5,
                        ['==', ['get', 'type'], 'seaplane_base'], 6,
                        3] as any,
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
      if (!map.current.getSource('routes-source')) {
        map.current.addSource('routes-source', { type: 'geojson', data: routesRef.current });
        map.current.addLayer({
          id: 'routes-line', type: 'line', source: 'routes-source',
          paint: { 'line-color': '#dc2626', 'line-width': 3, 'line-dasharray': [2, 1] },
        });
      }
    }

    // Direct To line — magenta line from current GPS to destination
    if (!map.current.getSource('directto-source')) {
      map.current.addSource('directto-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current.addLayer({
        id: 'directto-line',
        type: 'line',
        source: 'directto-source',
        paint: {
          'line-color': '#FF00FF',
          'line-width': 4,
          'line-opacity': 0.9,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      // Circle layer for the endpoint dots (current position and destination)
      map.current.addLayer({
        id: 'directto-dots',
        type: 'circle',
        source: 'directto-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#FF00FF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Dropped pins source
    if (!map.current.getSource('pins-source')) {
      map.current.addSource('pins-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current.addLayer({
        id: 'pins-layer',
        type: 'circle',
        source: 'pins-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#3B82F6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
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

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    mapInstance.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left');

    // Custom CSS: push MapLibre zoom controls down to align with the Layers panel at top-right.
    // top: 4px aligns with Layers panel. safe-area-inset-top handles notched phones.
    const style = document.createElement('style');
    style.textContent = `
      .maplibregl-ctrl-top-left { top: max(4px, env(safe-area-inset-top)) !important; left: 8px !important; }
      .maplibregl-ctrl-bottom-left { bottom: 110px !important; left: 8px !important; }
      .maplibregl-ctrl-scale { border-color: #64748B !important; color: #64748B !important; background: rgba(255,255,255,0.85) !important; font-size: 10px !important; }
    `;
    document.head.appendChild(style);

    mapInstance.on('load', async () => {
      map.current = mapInstance;
      mapInstanceRef.current = mapInstance;
      // Expose on window for LocateButton (stable across re-renders)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landoutMap = mapInstance;
      setLoaded(true);
      await loadAllOverlays();
      if (onMapLoadRef.current) onMapLoadRef.current(mapInstance);

      // Process any pending pin that was set before map loaded
      // Only process if it hasn't already been handled by the landoutDropPin event
      const pending = (window as any).__landoutPendingPin;
      if (pending && pending.ts > Date.now() - 10000 && !(window as any).__landoutDropPinHandled) {
        (window as any).__landoutDropPinHandled = true;
        // Map is ready — use handleDropPin to add pin and clear any existing InfoCard/ActionMenu
        handleDropPin(pending.lng, pending.lat, pending.name);
      }
      delete (window as any).__landoutPendingPin;

      // Process any pending fly-to-airport that was set before map loaded
      const pendingAirport = (window as any).__landoutPendingAirport;
      if (pendingAirport && pendingAirport.ts > Date.now() - 10000) {
        delete (window as any).__landoutPendingAirport;
        handleFlyToAirport(pendingAirport.lng, pendingAirport.lat, pendingAirport.name);
      }

      // DO NOT start GPS automatically — let the user tap the locate button when they
      // want GPS. Auto-starting GPS causes permission dialogs to appear at unexpected
      // times and can conflict with subsequent GPS-based features (DirectTo).

      // Debug: count native touch events on the map canvas to verify they reach MapLibre
      const canvas = mapInstance.getCanvas();
      // Ensure iOS Safari passes touch events to MapLibre (handles gesture conflicts)
      canvas.style.touchAction = 'none';
      // Expose canvas touch-action via direct DOM access for reliability on iOS
      const incTouch = () => {
        touchCountRef.current++;
        setTouchCount(touchCountRef.current);
      };
      canvas.addEventListener('touchstart', incTouch, { passive: true });
      canvas.addEventListener('touchmove', incTouch, { passive: true });
      canvas.addEventListener('touchend', incTouch, { passive: true });
      // Also capture pointer events for iOS Safari (MapLibre v4 uses pointer events on mobile)
      canvas.addEventListener('pointerdown', incTouch, { passive: true });
      canvas.addEventListener('pointermove', incTouch, { passive: true });
      canvas.addEventListener('pointerup', incTouch, { passive: true });
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
    // ── Unified click handler ──────────────────────────────────────────────────────────
    // Priority: airport dots (ActionMenu) > dropped pins (ActionMenu) > land (inspector popup)
    mapInstance.on('click', (e) => {
      // If MeasureRuler is in placingB phase, let it handle the click
      if (measurePhaseRef.current === 'placingB') return;
      if (suppressClickRef.current) return;
      // Right-click (button=2) — contextmenu will handle it, suppress InfoCard
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e.originalEvent as any)?.button === 2) return;
      // Click-outside previously closed InfoCard — suppress this click from opening a new one
      if (suppressInfoCardOpenRef.current) {
        suppressInfoCardOpenRef.current = false;
        closeAllPopups();
        setInfoCard(null);
        return;
      }
      closeAllPopups();

      const allFeatures = mapInstance.queryRenderedFeatures(e.point);
      if (!allFeatures.length) {
        // Clicked on empty map — dismiss any open popup/card
        setInfoCard(null);
        setActionMenu(null);
        mapInstance.getCanvas().style.cursor = '';
        return;
      }
      mapInstance.getCanvas().style.cursor = 'pointer';

      // 1. Airport dot tap → InfoCard
      const airportFeature = allFeatures.find((f) => f.layer?.id === 'airport-fill');
      if (airportFeature) {
        const props = airportFeature.properties ?? {};
        setInfoCard({
          screenX: e.point.x, screenY: e.point.y,
          data: {
            type: 'airport',
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
            name: props.name || 'Unknown Airport',
            faa_ident: props.faa_ident,
            gps_code: props.gps_code,
            iata: props.iata,
            airportType: props.type,
            elevation_ft: props.elevation_ft != null ? Number(props.elevation_ft) : undefined,
            municipality: props.municipality,
            state: props.state,
            runway_length_ft: props.runway_length_ft != null ? Number(props.runway_length_ft) : null,
          },
        });
        setActionMenu(null);
        return;
      }

      // 2. Dropped pin tap → ActionMenu with pin name
      const pinFeature = allFeatures.find((f) => f.layer?.id === 'pins-layer');
      if (pinFeature) {
        const pinName = pinFeature.properties?.name || 'Dropped Pin';
        setActionMenu({
          x: e.point.x, y: e.point.y,
          lng: e.lngLat.lng, lat: e.lngLat.lat,
          airportName: pinName,
        });
        return;
      }

      // 3. Land overlay tap → inspector popup (existing behavior)
      const landFeatures = allFeatures.filter((f) => !['pins-layer', 'airport-fill'].includes(f.layer?.id ?? ''));
      if (!landFeatures.length) return;

      let best = landFeatures[0];
      let bestInfo = LAYER_INFO[best.layer?.id ?? ''];
      let bestRank = RANK[bestInfo?.restriction ?? ''] ?? 3;
      for (const f of landFeatures) {
        const info = LAYER_INFO[f.layer?.id ?? ''];
        if (!info) continue;
        const r = RANK[info.restriction];
        if ((r ?? 3) < bestRank) { best = f; bestInfo = info; bestRank = r ?? 3; }
      }

      if (!bestInfo) return;

      const props = best.properties ?? {};
      // Build land name from available properties
      const name = props.name || props.WILDERNESS || props.ADMIN_UNIT_NAME
        || props.WildernessName || props.unit_name || props.WSA_NAME
        || props.FORESTNAME || props.forestname
        || props.agency_name || props.designation_type || '';

      setInfoCard({
        screenX: e.point.x,
        screenY: e.point.y,
        data: {
          type: 'land',
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          agency: bestInfo.agency,
          label: bestInfo.label,
          name: name || undefined,
          restriction: bestInfo.restriction,
        },
      });
      return;
    });

    mapInstance.on('mousemove', (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point);
      mapInstance.getCanvas().style.cursor = features.length ? 'pointer' : '';
    });

    // ── Long-press detection (mobile) ─────────────────────────────────────────────
    // Register native touch listeners on the canvas in CAPTURE phase (before MapLibre).
    // This captures touch coords without interfering with MapLibre's pan/zoom/pinch gestures.
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let touchPos: { x: number; y: number } | null = null;
    const LONG_PRESS_MS = 400;
    const canvas = mapInstance.getCanvas();

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        touchPos = null;
        return;
      }
      touchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchTimer = setTimeout(() => {
        touchTimer = null;
        if (!touchPos) return;
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 500);
        const lngLat = mapInstance.unproject([touchPos.x, touchPos.y]);
        mapInstance.fire('longpress', { lngLat, point: touchPos });
      }, LONG_PRESS_MS);
    }, { passive: true });

    canvas.addEventListener('touchmove', () => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      touchPos = null;
    }, { passive: true, capture: true });

    canvas.addEventListener('touchend', () => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      touchPos = null;
    }, { passive: true, capture: true });

    canvas.addEventListener('touchcancel', () => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      touchPos = null;
    }, { passive: true, capture: true });

    // Desktop right-click — directly open MeasureRuler context menu.
    // Do NOT fire 'longpress' (which would also fire ActionMenu).
    mapInstance.on('contextmenu', (e) => {
      e.preventDefault();
      suppressClickRef.current = true;
      setInfoCard(null);
      setActionMenu(null);
      setTimeout(() => { suppressClickRef.current = false; }, 400);
      // Open MeasureRuler's dark context menu directly
      const win = window as typeof window & { landoutMeasureLongPress?: (lng: number, lat: number, screenX: number, screenY: number) => void };
      if (win.landoutMeasureLongPress) {
        win.landoutMeasureLongPress(e.lngLat.lng, e.lngLat.lat, e.point.x, e.point.y);
      }
    });

    // ── GPS sync from LocateButton ────────────────────────────────────────────────
    // Immediate update via event (for DirectTo line rendering)
    function onGpsUpdate(e: Event) {
      try {
        const pos = (e as CustomEvent<{ lat: number; lon: number; heading?: number; speed?: number; altitude?: number | null }>).detail;
        if (!pos) return;
        setDebugStep('5/5: GPS update received');
        if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon) ||
            Math.abs(pos.lat) > 90 || Math.abs(pos.lon) > 180) {
          return;
        }
        currentPosRef.current = { lat: pos.lat, lon: pos.lon, heading: pos.heading, speed: pos.speed };
        if (!flyToInProgressRef.current) {
          setCurrentPosState(currentPosRef.current);
        }
        if (directToDestRef.current && map.current && !flyToInProgressRef.current) {
          const src = map.current.getSource('directto-source') as maplibregl.GeoJSONSource | undefined;
          if (src) {
            src.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: [[currentPosRef.current.lon, currentPosRef.current.lat], [directToDestRef.current!.lng, directToDestRef.current!.lat]],
                  },
                  properties: {},
                },
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [currentPosRef.current.lon, currentPosRef.current.lat] },
                  properties: {},
                },
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [directToDestRef.current!.lng, directToDestRef.current!.lat] },
                  properties: {},
                },
              ],
            });
            setDebugStep('6/6: setData ok');
          }
        }
      }
      catch (err) {
        console.error('[GPS] onGpsUpdate crashed:', err);
        setDebugStep('FAIL: onGpsUpdate crashed');
      }
    }
    window.addEventListener('landoutPositionUpdate', onGpsUpdate);

    // Polling fallback (kept for non-event-based position sources)
    const gpsInterval = setInterval(() => {
      try {
        const loc = (window as any).landoutLocationState;
        if (loc?.position) {
          currentPosRef.current = loc.position;
          setCurrentPosState(loc.position);
        }
      } catch {}
    }, 2000);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY DEPS — map only mounts once

  // Update Direct To magenta line whenever destination changes.
  // Note: current position updates are handled exclusively in onGpsUpdate to avoid
  // double-redrawing the GeoJSON source (which would happen if currentPosState were
  // in the deps — it changes on every GPS tick, causing a redundant second setData call).
  useEffect(() => {
    if (!map.current) return;
    const src = map.current.getSource('directto-source') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (directToDest && currentPosRef.current) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[currentPosRef.current.lon, currentPosRef.current.lat], [directToDest.lng, directToDest.lat]] },
            properties: {},
          },
          // Dot at current device position
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [currentPosRef.current.lon, currentPosRef.current.lat] },
            properties: {},
          },
          // Dot at destination
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [directToDest.lng, directToDest.lat] },
            properties: {},
          },
        ],
      });
    } else if (!directToDest) {
      // No destination — clear the line and dots
      src.setData({ type: 'FeatureCollection', features: [] });
    } else {
      // Destination set but no GPS position yet — draw destination dot only so
      // the user sees something. Full line + device dot drawn when GPS fires.
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [directToDest.lng, directToDest.lat] },
            properties: {},
          },
        ],
      });
    }
  }, [directToDest, currentPosState, loaded]);

  // Sync dropped pins to the pins source
  useEffect(() => {
    if (!map.current) return;
    const src = map.current.getSource('pins-source') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: droppedPins.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name },
      })),
    });
  }, [droppedPins]);
  useEffect(() => {
    const win = window as typeof window & {
      landoutSwitchBasemap: (id: BasemapId) => void;
      landoutSetOverlayVisibility: (id: string, vis: boolean) => void;
      landoutGetBasemap: () => BasemapId;
      landoutToggleDiagnostics: () => void;
      landoutSetDirectTo: (dest: DirectToDest | null) => void;
      landoutDropPin: (lng: number, lat: number, name?: string) => void;
      landoutFlyToAirport: (lng: number, lat: number, name?: string) => void;
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
    (window as any).landoutToggleGrid = () => setShowGrid((v) => !v);
    // landoutSetDirectTo — called by SiteInfoBox, MeasureRuler, NearestPanel.
    // Note: InfoCard calls handleDirectTo directly, not this function.
    // This function is for EXTERNAL callers that need to set the destination
    // without going through handleDirectTo.
    win.landoutSetDirectTo = (dest) => {
      if (!dest) return;

      console.log('[DirectTo] landoutSetDirectTo called');
      directToFitBoundsDoneRef.current = false;

      // Start GPS tracking — this is the primary purpose for external callers.
      // InfoCard's handleDirectTo already sets directToDest directly.
      window.dispatchEvent(new CustomEvent('landoutDirectToGps'));

      // Notify page.tsx to show DirectToPanel
      window.dispatchEvent(new CustomEvent('landoutDirectToChange', {
        detail: {
          dest,
          currentPos: currentPosRef.current || null,
        },
      }));
    };
    // MeasureRuler calls this to drop a pin from right-click "Save Pin"
    win.landoutDropPin = (lng: number, lat: number, name?: string) => {
      handleDropPin(lng, lat, name);
    };
    win.landoutFlyToAirport = (lng: number, lat: number, name?: string) => {
      handleFlyToAirport(lng, lat, name);
    };

    // MeasureRuler listens for mobile long-press → show context menu at that location
    if (map.current) {
      try {
        map.current.on('longpress', (e: any) => {
          try {
            const point = e.point as { x: number; y: number } | undefined;
            (window as any).landoutMeasureLongPress(
              e.lngLat.lng, e.lngLat.lat,
              point?.x ?? 0, point?.y ?? 0
            );
          } catch {}
        });
      } catch {}
    }
  });



  // Actions called from ActionMenu / InfoCard
  function handleDirectTo(lng: number, lat: number, name?: string) {
    // Validate coordinates before any state change — reject NaN/Infinity
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      setDebugStep('FAIL: invalid coords');
      return;
    }
    setDebugStep('1/5: set dest');
    setDirectToDest({ lng, lat, name, type: 'map' });
    setDebugStep('2/5: dest set, start GPS');
    queueMicrotask(() => {
      setDebugStep('GPSa: event processed');
      try {
        window.dispatchEvent(new CustomEvent('landoutDirectToGps'));
        setDebugStep('GPSb: onDirectToGps entered ok');
      } catch (e) {
        setDebugStep('FAIL: GPS event threw');
      }
    });
  }

  function handleDropPin(lng: number, lat: number, name?: string) {
    // Use instant setCenter instead of flyTo to avoid animation on mobile Safari
    const map = mapInstanceRef.current;
    if (map) {
      map.setCenter([lng, lat]);
      map.setZoom(13);
    }
    const id = `pin-${Date.now()}`;
    setDroppedPins((prev) => [...prev, { id, lng, lat, name }]);
    setActionMenu(null);
    setInfoCard(null);
  }

  // Fly to an airport and automatically show the InfoCard (same as tapping an airport dot).
  // Used by "View on Map" from site detail page — replaces SiteInfoBox.
  // No marker, no popup — just center the map and show the InfoCard directly.
  function handleFlyToAirport(lng: number, lat: number, name?: string) {
    const map = mapInstanceRef.current;
    // Clear any pending airport
    delete (window as any).__landoutPendingAirport;
    if (!map) {
      (window as any).__landoutPendingAirport = { lng, lat, name, ts: Date.now() };
      return;
    }
    // Instant center — no animation to avoid mobile Safari issues
    map.setCenter([lng, lat]);
    map.setZoom(13);
    // Show InfoCard directly — same card as when tapping an airport dot
    setInfoCard({
      screenX: window.innerWidth / 2,
      screenY: window.innerHeight / 2,
      data: {
        type: 'airport',
        lng,
        lat,
        name: name || 'Airport',
      },
    });
  }

  function handleClearDirectTo() {
    setDirectToDest(null);
    // Clear the line visually
    if (map.current) {
      const src = map.current.getSource('directto-source') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  // Grid overlay toggle — press G to show/hide debug grid
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'g' || e.key === 'G') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
        setShowGrid((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Full-screen map container */}
      <div ref={mapContainer} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
      {/* DirectTo debug step indicator — remove before production */}
      {debugStep && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0,
          background: debugStep.startsWith('FAIL') ? '#EF4444' : '#1D4ED8',
          color: 'white', textAlign: 'center', fontSize: 11, fontFamily: 'monospace',
          padding: '4px 8px', zIndex: 9999,
        }}>
          🔧 DIRECTTO: {debugStep}
        </div>
      )}
      {/* Debug grid overlay — press G to toggle */}
      <MapGrid visible={showGrid} cols={10} rows={8} />
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <span className="text-slate-500">Loading map…</span>
        </div>
      )}
      {showDiagnostics && (
        <DiagnosticsPanel onClose={() => setShowDiagnostics(false)} />
      )}
      {/* Locate button — bottom-right, keeps BasemapToggle clear on left side */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 90px + var(--direct-to-offset, 0px))', right: 8, zIndex: 60, pointerEvents: 'auto' }}>
        <LocateButton mapRef={mapInstanceRef} />
      </div>
      {/* Direct To info card */}
      {/* MeasureRuler — handles right-click menu, two-finger measure, draggable endpoints */}
      <MeasureRuler
        map={mapInstanceRef.current}
        onMeasurePhaseChange={(phase) => { measurePhaseRef.current = phase; }}
        onCtxMenuOpen={() => { suppressClickRef.current = true; }}
      />

      {/* Long-0press action menu */}
      {actionMenu && (
        <ActionMenu
          x={actionMenu.x}
          y={actionMenu.y}
          lat={actionMenu.lat}
          lng={actionMenu.lng}
          items={[
            {
              label: 'Drop Pin',
              icon: '📍',
              onClick: () => handleDropPin(actionMenu.lng, actionMenu.lat),
            },
            { label: 'Cancel', icon: '✕', onClick: () => setActionMenu(null) },
          ]}
          onClose={() => setActionMenu(null)}
        />
      )}
      {/* InfoCard for airport and land overlays */}
      {infoCard && (
        <InfoCard
          card={infoCard.data}
          screenX={infoCard.screenX}
          screenY={infoCard.screenY}
          onClose={() => setInfoCard(null)}
          onCloseOutside={() => { suppressInfoCardOpenRef.current = true; }}
          onDirectTo={(lng, lat, name) => handleDirectTo(lng, lat, name)}
          onDropPin={infoCard.data.type === 'land' ? (lng, lat) => handleDropPin(lng, lat) : undefined}
        />
      )}
    </div>
  );
}