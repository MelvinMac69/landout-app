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
    '#94A3B8';
  const restrictionText =
    info.restriction === 'no-landing' ? '🚫 No landing' :
    info.restriction === 'restricted' ? (info.agency === 'Unknown / Private Land' ? '⚠️ Private land — landing not authorized' : '⚠️ Restricted — verify before landing') :
    '✅ Multiple use — landing generally OK';
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
        {restrictionText}
      </div>
    </div>
  );
}

interface BackcountryMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  routesGeoJson?: GeoJSON.FeatureCollection;
  onMapLoad?: (map: maplibregl.Map) => void;
  onInspectorUpdate?: (info: MapFeatureInfo | null) => void;
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

  // Keep onMapLoad stable — don't put it in useEffect deps or map will re-init on parent re-render
  const onMapLoadRef = useRef(onMapLoad);
  useEffect(() => { onMapLoadRef.current = onMapLoad; });

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

      // Click/tap inspector — query all layers at the click point, find the topmost rendered one
      map.current.on('click', (e) => {
        e.originalEvent.stopPropagation();

        // Always clear previous inspector first
        setInspector(null);

        const clickPoint = e.point;
        console.log('[click] at', e.lngLat.lng.toFixed(4) + ',' + e.lngLat.lat.toFixed(4));

        // Query ALL rendered features at this point (no layer filter)
        const allFeatures = map.current!.queryRenderedFeatures({ point: clickPoint });
        console.log('[click] total rendered hits:', allFeatures.length);
        if (allFeatures.length > 0) {
          console.log('[click] top feature layer:', allFeatures[0].layer?.id);
        }

        if (allFeatures.length === 0) {
          // No overlay hit — private/unknown land
          console.log('[click] -> Unknown/Private');
          setInspector({ x: e.point.x, y: e.point.y, info: {
            agency: 'Unknown / Private Land', unitName: '', restriction: 'restricted',
            agencyColor: '#94A3B8', layerLabel: 'Unknown', layerId: '',
          }});
          return;
        }

        // Use the TOPMOST rendered feature (first in the returned array — MapLibre returns in render order)
        const topFeature = allFeatures[0];
        const topLayerId = topFeature.layer!.id;
        console.log('[click] -> showing layer:', topLayerId);

        // Map layer IDs to agency info
        const LAYER_INFO: Record<string, { agency: string; label: string; restriction: MapFeatureInfo['restriction']; color: string }> = {
          'wilderness-fill':     { agency: 'Bureau of Land Management', label: 'BLM Wilderness',         restriction: 'no-landing',   color: '#DC2626' },
          'wsa-fill':           { agency: 'Bureau of Land Management', label: 'Wilderness Study Area', restriction: 'no-landing',   color: '#DC2626' },
          'fs-wilderness-fill': { agency: 'US Forest Service',         label: 'USFS Wilderness',       restriction: 'no-landing',   color: '#DC2626' },
          'sma-nps-fill':      { agency: 'National Park Service',     label: 'National Park',         restriction: 'no-landing',   color: '#DC2626' },
          'sma-fws-fill':      { agency: 'Fish & Wildlife Service',   label: 'Wildlife Refuge',       restriction: 'restricted',   color: '#DC2626' },
          'sma-blm-fill':      { agency: 'Bureau of Land Management', label: 'BLM Land',             restriction: 'multiple-use', color: '#8B6914' },
          'sma-usfs-fill':     { agency: 'US Forest Service',         label: 'National Forest',       restriction: 'multiple-use', color: '#2D5016' },
        };

        const layer = LAYER_INFO[topLayerId];
        if (!layer) {
          console.log('[click] -> layer not in LAYER_INFO, showing Unknown');
          setInspector({ x: e.point.x, y: e.point.y, info: {
            agency: 'Unknown / Private Land', unitName: '', restriction: 'restricted',
            agencyColor: '#94A3B8', layerLabel: 'Unknown', layerId: '',
          }});
          return;
        }

        const props = topFeature.properties || {};
        const name = props.name || props.WILDERNESS || props.ADMIN_UNIT_NAME || '';
        console.log('[click] -> agency:', layer.agency, '| label:', layer.label, '| name:', name);
        setInspector({ x: e.point.x, y: e.point.y, info: {
          agency: layer.agency,
          unitName: typeof name === 'string' ? name : '',
          restriction: layer.restriction,
          agencyColor: layer.color,
          layerLabel: layer.label,
          layerId: topLayerId,
        }});
      });

      if (onMapLoadRef.current) onMapLoadRef.current(map.current);
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
