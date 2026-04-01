'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface BackcountryMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  routesGeoJson?: GeoJSON.FeatureCollection;
  onMapLoad?: (map: maplibregl.Map) => void;
}

export function BackcountryMap({
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 4,
  routesGeoJson,
  onMapLoad,
}: BackcountryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch and load a GeoJSON overlay file into the map
  const loadOverlay = async (
    url: string,
    sourceId: string,
    layerId: string,
    color: string,
    opacity = 0.4
  ) => {
    if (!map.current) return;
    try {
      const res = await fetch(url);
      console.log(`[BackcountryMap] fetch ${url} → ${res.status} ${res.statusText}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GeoJSON.FeatureCollection = await res.json();
      console.log(`[BackcountryMap] ${url}: ${data.features?.length ?? 0} features, type=${data.type}`);
      if (!data.features?.length) {
        console.warn(`[BackcountryMap] ${url} has no features — skipping layer`);
        return;
      }

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
      }
    } catch (err) {
      console.error(`[BackcountryMap] ERROR loading overlay ${url}:`, err);
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

      // Load overlays from /public/data/
      await Promise.all([
        loadOverlay('/data/blm-sma.geojson', 'blm-source', 'blm-fill', '#8B6914', 0.35),
        loadOverlay('/data/wilderness.geojson', 'wilderness-source', 'wilderness-fill', '#DC2626', 0.45),
        loadOverlay('/data/wsa.geojson', 'wsa-source', 'wsa-fill', '#DC2626', 0.45),
      ]);

      // Load route layer if provided
      if (routesGeoJson?.features?.length) {
        if (!map.current.getSource('routes-source')) {
          map.current.addSource('routes-source', { type: 'geojson', data: routesGeoJson });
          map.current.addLayer({
            id: 'routes-line',
            type: 'line',
            source: 'routes-source',
            paint: { 'line-color': '#dc2626', 'line-width': 3, 'line-dasharray': [2, 1] },
          });
          map.current.addLayer({
            id: 'routes-points',
            type: 'circle',
            source: 'routes-source',
            filter: ['==', '$type', 'Point'],
            paint: { 'circle-radius': 5, 'circle-color': '#dc2626', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
          });
        }
      }

      if (onMapLoad) onMapLoad(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [initialCenter, initialZoom, onMapLoad]);

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
