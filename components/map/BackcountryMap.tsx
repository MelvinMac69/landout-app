'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface BackcountryMapProps {
  blmGeoJson?: GeoJSON.FeatureCollection;
  wildernessGeoJson?: GeoJSON.FeatureCollection;
  wsaGeoJson?: GeoJSON.FeatureCollection;
  sitesGeoJson?: GeoJSON.FeatureCollection;
  routesGeoJson?: GeoJSON.FeatureCollection;
  onSiteClick?: (siteId: string) => void;
  onMapLoad?: (map: maplibregl.Map) => void;
}

export function BackcountryMap({
  blmGeoJson,
  wildernessGeoJson,
  wsaGeoJson,
  sitesGeoJson,
  routesGeoJson,
  onSiteClick,
  onMapLoad,
}: BackcountryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const defaultCenter: [number, number] = [-98.5795, 39.8283]; // Center of US
  const defaultZoom = 4;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || {
        version: 8,
        sources: {
          'osm': {
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
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: defaultCenter,
      zoom: defaultZoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);
      if (map.current && onMapLoad) {
        onMapLoad(map.current);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [onMapLoad]);

  // Add/update land status layers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const addFillLayer = (
      sourceId: string,
      data: GeoJSON.FeatureCollection | undefined,
      layerId: string,
      color: string | { property: string; default: string },
      opacity: number
    ) => {
      if (!map.current) return;

      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(
          data || { type: 'FeatureCollection', features: [] }
        );
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: data || { type: 'FeatureCollection', features: [] },
        });

        // If color is an object, use property-based coloring (SMA layer)
        // Otherwise use a static color
        const fillColor:
          | string
          | maplibregl.ExpressionSpecification =
          typeof color === 'string'
            ? color
            : ['get', (color as { property: string }).property];

        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': fillColor,
            'fill-opacity': opacity,
          },
        });
      }
    };

    // BLM SMA uses per-feature color from properties.unit
    addFillLayer('blm-source', blmGeoJson, 'blm-fill', { property: 'color', default: '#888888' }, 0.4);
    addFillLayer('wilderness-source', wildernessGeoJson, 'wilderness-fill', '#1D4D1D', 0.5);
    addFillLayer('wsa-source', wsaGeoJson, 'wsa-fill', '#7B3F00', 0.5);
  }, [mapLoaded, blmGeoJson, wildernessGeoJson, wsaGeoJson]);

  // Add sites layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (!map.current.getSource('sites-source')) {
      map.current.addSource('sites-source', {
        type: 'geojson',
        data: sitesGeoJson || { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'sites-layer',
        type: 'circle',
        source: 'sites-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#2563eb',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.current.on('click', 'sites-layer', (e) => {
        if (e.features && e.features[0]?.properties?.id && onSiteClick) {
          onSiteClick(e.features[0].properties.id);
        }
      });

      map.current.on('mouseenter', 'sites-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'sites-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    } else {
      (map.current.getSource('sites-source') as maplibregl.GeoJSONSource).setData(
        sitesGeoJson || { type: 'FeatureCollection', features: [] }
      );
    }
  }, [mapLoaded, sitesGeoJson, onSiteClick]);

  // Add routes layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (!map.current.getSource('routes-source')) {
      map.current.addSource('routes-source', {
        type: 'geojson',
        data: routesGeoJson || { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes-source',
        paint: {
          'line-color': '#dc2626',
          'line-width': 3,
          'line-dasharray': [2, 1],
        },
      });

      map.current.addLayer({
        id: 'routes-points',
        type: 'circle',
        source: 'routes-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#dc2626',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    } else {
      (map.current.getSource('routes-source') as maplibregl.GeoJSONSource).setData(
        routesGeoJson || { type: 'FeatureCollection', features: [] }
      );
    }
  }, [mapLoaded, routesGeoJson]);

  const toggleLayer = useCallback((layerId: string) => {
    if (!map.current) return;

    const visibility = map.current.getLayoutProperty(layerId, 'visibility');

    if (visibility === 'visible') {
      map.current.setLayoutProperty(layerId, 'visibility', 'none');
    } else {
      map.current.setLayoutProperty(layerId, 'visibility', 'visible');
    }
  }, []);

  const flyTo = useCallback((lng: number, lat: number, zoom?: number) => {
    if (!map.current) return;
    map.current.flyTo({
      center: [lng, lat],
      zoom: zoom || map.current.getZoom(),
      duration: 1000,
    });
  }, []);

  // Expose methods via ref or callback
  useEffect(() => {
    if (map.current && (window as any).__mapControls) {
      (window as any).__mapControls.toggleLayer = toggleLayer;
      (window as any).__mapControls.flyTo = flyTo;
    }
  }, [toggleLayer, flyTo]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="text-slate-500">Loading map...</div>
        </div>
      )}
    </div>
  );
}
