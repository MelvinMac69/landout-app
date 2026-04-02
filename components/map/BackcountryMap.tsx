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
  const popup = useRef<maplibregl.Popup | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Keep onMapLoad stable
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

    // Create popup once, reuse it
    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: 'landout-popup',
    });

    map.current.on('load', async () => {
      if (!map.current) return;
      setLoaded(true);

      await Promise.all([
        loadOverlay('/data/sma-blm.geojson', 'sma-blm-src', 'sma-blm-fill', '#8B6914', 0.5),
        loadOverlay('/data/sma-usfs.geojson', 'sma-usfs-src', 'sma-usfs-fill', '#2D5016', 0.55),
        loadOverlay('/data/sma-fws.geojson', 'sma-fws-src', 'sma-fws-fill', '#DC2626', 0.55),
        loadOverlay('/data/sma-nps.geojson', 'sma-nps-src', 'sma-nps-fill', '#DC2626', 0.55),
        loadOverlay('/data/fs-wilderness.geojson', 'fs-wilderness-src', 'fs-wilderness-fill', '#DC2626', 0.6),
        loadOverlay('/data/wsa.geojson', 'wsa-src', 'wsa-fill', '#DC2626', 0.6),
        loadOverlay('/data/wilderness.geojson', 'wilderness-src', 'wilderness-fill', '#DC2626', 0.6),
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

      ;(map.current as maplibregl.Map & { setOverlayVisibility: typeof setOverlayVisibility }).setOverlayVisibility = setOverlayVisibility;

      // Click/tap inspector — find ALL layers at click point, pick most restrictive
      map.current.on('click', (e) => {
        if (!map.current || !popup.current) return;

        const lng = e.lngLat.lng.toFixed(4);
        const lat = e.lngLat.lat.toFixed(4);
        console.log('[click]', lng + ',' + lat);

        const allFeatures = map.current.queryRenderedFeatures(e.point);
        if (allFeatures.length === 0) {
          console.log('[click] -> Unknown/Private');
          popup.current.remove();
          return;
        }

        const hitLayers = allFeatures.map((f) => f.layer!.id);
        console.log('[click] hit layers:', hitLayers.join(', '));

        const LAYER_INFO: Record<string, { agency: string; label: string; restriction: 'no-landing' | 'restricted' | 'multiple-use'; color: string }> = {
          'wilderness-fill':     { agency: 'Bureau of Land Management', label: 'BLM Wilderness',         restriction: 'no-landing',   color: '#DC2626' },
          'wsa-fill':           { agency: 'Bureau of Land Management', label: 'Wilderness Study Area', restriction: 'no-landing',   color: '#DC2626' },
          'fs-wilderness-fill': { agency: 'US Forest Service',         label: 'USFS Wilderness',       restriction: 'no-landing',   color: '#DC2626' },
          'sma-nps-fill':      { agency: 'National Park Service',     label: 'National Park',         restriction: 'no-landing',   color: '#DC2626' },
          'sma-fws-fill':      { agency: 'Fish & Wildlife Service',   label: 'Wildlife Refuge',       restriction: 'restricted',   color: '#DC2626' },
          'sma-blm-fill':      { agency: 'Bureau of Land Management', label: 'BLM Land',             restriction: 'multiple-use', color: '#8B6914' },
          'sma-usfs-fill':     { agency: 'US Forest Service',         label: 'National Forest',       restriction: 'multiple-use', color: '#2D5016' },
        };

        const RESTRICTION_RANK: Record<string, number> = { 'no-landing': 0, 'restricted': 1, 'multiple-use': 2 };
        let bestFeature = allFeatures[0];
        let bestLayer = LAYER_INFO[bestFeature.layer!.id];
        let bestRank = RESTRICTION_RANK[bestLayer?.restriction] ?? 3;

        for (const feat of allFeatures) {
          const info = LAYER_INFO[feat.layer!.id];
          if (!info) continue;
          const rank = RESTRICTION_RANK[info.restriction] ?? 3;
          if (rank < bestRank) {
            bestFeature = feat;
            bestLayer = info;
            bestRank = rank;
          }
        }

        if (!bestLayer) {
          popup.current.remove();
          return;
        }

        const props = bestFeature.properties || {};
        const name = props.name || props.WILDERNESS || props.ADMIN_UNIT_NAME || '';

        const restrictionColor = bestLayer.restriction === 'no-landing' ? '#DC2626' : bestLayer.restriction === 'restricted' ? '#D97706' : '#16A34A';
        const restrictionBg = bestLayer.restriction === 'no-landing' ? '#FEE2E2' : bestLayer.restriction === 'restricted' ? '#FEF3C7' : '#DCFCE7';
        const restrictionText = bestLayer.restriction === 'no-landing' ? '🚫 No landing' : bestLayer.restriction === 'restricted' ? '⚠️ Restricted — verify before landing' : '✅ Multiple use — landing generally OK';

        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;min-width:180px;max-width:220px">
            <div style="display:flex;align-items:center;margin-bottom:4px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${bestLayer.color};margin-right:8px;flex-shrink:0"></span>
              <span style="font-weight:600;color:#1E293B">${bestLayer.agency}</span>
            </div>
            ${bestLayer.label ? `<div style="color:#64748B;font-size:12px;font-style:italic;margin-bottom:3px;padding-left:18px">${bestLayer.label}</div>` : ''}
            ${name ? `<div style="color:#475569;font-size:12px;margin-bottom:3px;padding-left:18px">${name}</div>` : ''}
            <div style="margin-top:4px;padding:4px 8px;border-radius:6px;background:${restrictionBg};color:${restrictionColor};font-size:11px;font-weight:600;text-align:center">
              ${restrictionText}
            </div>
          </div>
        `;

        popup.current.setLngLat(e.lngLat).setHTML(html).addTo(map.current);
        console.log('[click] ->', bestLayer.agency, '|', bestLayer.label, '|', bestLayer.restriction);
      });

      // Hover cursor
      map.current.on('mousemove', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point);
        map.current.getCanvas().style.cursor = features.length ? 'pointer' : '';
      });

      if (onMapLoadRef.current) onMapLoadRef.current(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      popup.current = null;
    };
  }, [initialCenter, initialZoom, routesGeoJson]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <span className="text-slate-500">Loading map…</span>
        </div>
      )}
    </div>
  );
}
