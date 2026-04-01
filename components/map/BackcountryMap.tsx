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
    </div>
  );
}
