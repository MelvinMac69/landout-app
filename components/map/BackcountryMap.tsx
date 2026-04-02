'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapFeatureInfo {
  agency: string;
  unitName: string;
  restriction: 'no-landing' | 'restricted' | 'multiple-use' | 'unknown';
  agencyColor: string;
  layerLabel: string;
  layerId: string;
}

interface MapInspectorProps {
  info: MapFeatureInfo | null;
  x: number;
  y: number;
  onClose: () => void;
}

function MapInspector({ info, x, y, onClose }: MapInspectorProps) {
  if (!info) return null;
  const isTop = y > window.innerHeight / 2;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: Math.min(x - 100, window.innerWidth - 220),
    top: isTop ? y - 10 : y + 10,
    transform: isTop ? 'translateY(-100%)' : 'none',
    zIndex: 10,
    background: 'white',
    borderRadius: 10,
    boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    padding: '10px 14px',
    minWidth: 180,
    maxWidth: 220,
    fontSize: 13,
    pointerEvents: 'auto',
  };
  const dotStyle: React.CSSProperties = {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: info.agencyColor,
    marginRight: 8,
    flexShrink: 0,
  };
  const restrictionColor =
    info.restriction === 'no-landing' ? '#DC2626' :
    info.restriction === 'restricted' ? '#D97706' :
    '#16A34A';
  return (
    <div style={style}>
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
        aria-label="Close"
      >
        ×
      </button>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={dotStyle} />
        <span style={{ fontWeight: 600, color: '#1E293B' }}>{info.agency}</span>
      </div>
      {info.unitName && (
        <div style={{ color: '#475569', marginBottom: 4, paddingLeft: 18 }}>{info.unitName}</div>
      )}
      <div style={{ fontSize: 11, color: restrictionColor, fontWeight: 500, paddingLeft: 18 }}>
        {info.restriction === 'no-landing' ? '🚫 No landing' :
         info.restriction === 'restricted' ? '⚠️ Restricted — verify before landing' :
         '✅ Multiple use — landing generally OK'}
      </div>
    </div>
  );
}

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
] as const;

export function BackcountryMap({
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 4,
  routesGeoJson,
  onMapLoad,
}: BackcountryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inspector, setInspector] = useState<{ info: MapFeatureInfo | null; x: number; y: number } | null>(null);

  const setOverlayVisibility = (layerId: string, visible: boolean) => {
    if (!map.current) return;
    const ids = [layerId, layerId + '-outline'];
    ids.forEach((id) => {
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });
  };

  const loadOverlay = async (
    url: string,
    sourceId: string,
    layerId: string,
    color: string,
    opacity = 0.6
  ) => {
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
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: { 'fill-color': color, 'fill-opacity': opacity },
        });
        map.current.addLayer({
          id: layerId + '-outline',
          type: 'line',
          source: sourceId,
          paint: { 'line-color': color, 'line-width': 2 },
        });
      }
    } catch (err) {
      console.error('[BackcountryMap] load error ' + url + ':', err);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.current.on('load', async () => {
      if (!map.current) return;
      setLoaded(true);

      await Promise.all([
        loadOverlay('/data/wilderness.geojson', 'wilderness-src', 'wilderness-fill', '#DC2626', 0.6),
        loadOverlay('/data/wsa.geojson', 'wsa-src', 'wsa-fill', '#DC2626', 0.6),
        loadOverlay('/data/fs-wilderness.geojson', 'fs-wilderness-src', 'fs-wilderness-fill', '#DC2626', 0.6),
        loadOverlay('/data/sma-nps.geojson', 'sma-nps-src', 'sma-nps-fill', '#DC2626', 0.55),
        loadOverlay('/data/sma-fws.geojson', 'sma-fws-src', 'sma-fws-fill', '#DC2626', 0.55),
        loadOverlay('/data/sma-usfs.geojson', 'sma-usfs-src', 'sma-usfs-fill', '#2D5016', 0.55),
        loadOverlay('/data/sma-blm.geojson', 'sma-blm-src', 'sma-blm-fill', '#8B6914', 0.5),
      ]);

      if (routesGeoJson?.features?.length) {
        map.current.addSource('routes-source', { type: 'geojson', data: routesGeoJson });
        map.current.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes-source',
          paint: { 'line-color': '#dc2626', 'line-width': 3, 'line-dasharray': [2, 1] },
        });
      }

      // Attach visibility control to map instance so parent can call map.setOverlayVisibility(layerId, visible)
      ;(map.current as maplibregl.Map & { setOverlayVisibility: typeof setOverlayVisibility }).setOverlayVisibility = setOverlayVisibility;

      // Click/tap inspector — query all overlay layers and show info popup
      map.current.on('click', (e) => {
        const LAYER_MAP: Record<string, { label: string; agency: string; restriction: MapFeatureInfo['restriction']; color: string }> = {
          'wilderness-fill':     { label: 'BLM Wilderness',         agency: 'Bureau of Land Management', restriction: 'no-landing',    color: '#DC2626' },
          'wsa-fill':            { label: 'Wilderness Study Area',  agency: 'Bureau of Land Management', restriction: 'no-landing',    color: '#DC2626' },
          'fs-wilderness-fill':  { label: 'USFS Wilderness',        agency: 'US Forest Service',        restriction: 'no-landing',    color: '#DC2626' },
          'sma-nps-fill':        { label: 'National Park',          agency: 'National Park Service',     restriction: 'no-landing',    color: '#DC2626' },
          'sma-fws-fill':        { label: 'Wildlife Refuge',        agency: 'Fish & Wildlife Service',   restriction: 'restricted',    color: '#DC2626' },
          'sma-usfs-fill':      { label: 'National Forest',        agency: 'US Forest Service',        restriction: 'multiple-use', color: '#2D5016' },
          'sma-blm-fill':        { label: 'BLM Land',                agency: 'Bureau of Land Management', restriction: 'multiple-use', color: '#8B6914' },
        };

        const allLayers = Object.keys(LAYER_MAP);
        const features = map.current!.queryRenderedFeatures({ layers: allLayers });
        if (!features.length) { setInspector(null); return; }

        // Pick first hit (highest z-order = first in array from MapLibre)
        const hit = features[0];
        const layer = LAYER_MAP[hit.layer!.id];
        if (!layer) { setInspector(null); return; }

        const props = hit.properties || {};
        // Try common name fields
        const name = props.name || props.WILDERNESS || props.ADMIN_UNIT_NAME || props.Wilderness || props.unit_name || '';

        setInspector({
          x: e.point.x,
          y: e.point.y,
          info: {
            agency: layer.agency,
            unitName: typeof name === 'string' ? name : '',
            restriction: layer.restriction,
            agencyColor: layer.color,
            layerLabel: layer.label,
            layerId: hit.layer!.id,
          },
        });
      });

      // Close inspector on map click that finds nothing
      map.current.on('click', () => { if (inspector) setInspector(null); });
      if (onMapLoad) onMapLoad(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [initialCenter, initialZoom, routesGeoJson, onMapLoad]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <span className="text-slate-500">Loading map…</span>
        </div>
      )}
      {inspector && (
        <MapInspector
          info={inspector.info}
          x={inspector.x}
          y={inspector.y}
          onClose={() => setInspector(null)}
        />
      )}
    </div>
  );
}
