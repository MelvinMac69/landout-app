'use client';

import { createContext, useContext, useRef, useCallback, useState, type ReactNode } from 'react';
import type maplibregl from 'maplibre-gl';

/**
 * MapContext — provides shared map state and commands across the (map) route group.
 *
 * Key design decisions:
 * - mapRef: stable ref to the MapLibre instance (survives React remounts)
 * - commandQueue: if a command is called before the map is ready, it's queued
 *   and replayed on load. This solves the timing problem where overlay pages
 *   call flyToSite() before the map has finished initializing.
 * - overlayOpen: derived from URL/parallel route, not manual state (Phase 2+)
 *
 * Phase 1: Context wraps BackcountryMap in the layout, page.tsx uses useMapContext()
 * instead of local refs. Window globals still work as belt-and-suspenders.
 */

export interface MapCommand {
  type: 'flyTo' | 'setDirectTo' | 'dropPin' | 'showInfoCard';
  payload: Record<string, unknown>;
}

export interface MapContextValue {
  /** Stable ref to the MapLibre map instance (null before load) */
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  /** Whether the map has finished loading */
  mapLoaded: boolean;
  /** Fly to a site by coordinates — queues if map not ready */
  flyToSite: (lng: number, lat: number, zoom?: number) => void;
  /** Start Direct To navigation to a site */
  startDirectTo: (lng: number, lat: number, name: string) => void;
  /** Drop a pin on the map */
  dropPin: (lng: number, lat: number, name?: string) => void;
  /** Show an airport InfoCard at the given location */
  showInfoCard: (data: {
    lng: number;
    lat: number;
    name: string;
    faa_ident?: string;
    airportType?: string;
    municipality?: string;
    state?: string;
    runway_length_ft?: number | null;
    elevation_ft?: number | null;
  }) => void;
  /** Whether an overlay (search/site-info) is currently open */
  overlayOpen: boolean;
  /** Set overlay state — used by overlay pages */
  setOverlayOpen: (open: boolean) => void;
  /** Register map as loaded — called by BackcountryMap on mount */
  registerMapLoaded: (map: maplibregl.Map) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const commandQueue = useRef<MapCommand[]>([]);

  /** Process any queued commands now that the map is ready */
  const processQueue = useCallback((map: maplibregl.Map) => {
    const queue = commandQueue.current;
    commandQueue.current = [];
    for (const cmd of queue) {
      switch (cmd.type) {
        case 'flyTo': {
          const { lng, lat, zoom } = cmd.payload as { lng: number; lat: number; zoom?: number };
          try {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) break;
            map.flyTo({
              center: [lng, lat],
              zoom: zoom ?? map.getZoom(),
              duration: 1500,
              essential: true,
            });
          } catch (e) {
            console.warn('[MapContext] flyTo error:', e);
            try { map.setCenter([lng, lat]); if (zoom) map.setZoom(zoom); } catch {}
          }
          break;
        }
        case 'setDirectTo': {
          const { lng, lat, name } = cmd.payload as { lng: number; lat: number; name: string };
          // Use window global for backward compat during Phase 1
          const fn = (window as any).__landoutSetDirectToDest; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (fn) fn({ lng, lat, name, type: 'map' });
          window.dispatchEvent(new CustomEvent('landoutDirectToGps'));
          break;
        }
        case 'dropPin': {
          const { lng, lat, name } = cmd.payload as { lng: number; lat: number; name?: string };
          const fn = (window as any).landoutDropPin; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (fn) fn(lng, lat, name);
          break;
        }
        case 'showInfoCard': {
          window.dispatchEvent(new CustomEvent('landoutSearchSelect', { detail: cmd.payload }));
          break;
        }
      }
    }
  }, []);

  const registerMapLoaded = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
    processQueue(map);
  }, [processQueue]);

  const flyToSite = useCallback((lng: number, lat: number, zoom?: number) => {
    if (mapRef.current && mapLoaded) {
      try {
        // Validate coordinates before flying
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          console.warn('[MapContext] flyToSite: invalid coordinates', { lng, lat });
          return;
        }
        // Exit GPS follow mode so the map doesn't snap back to the user's
        // position after the flyTo animation completes.
        // LocateButton listens for this event and disables followMode.
        window.dispatchEvent(new CustomEvent('landoutExitFollowMode'));
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: zoom ?? mapRef.current.getZoom(),
          duration: 1500,
          essential: true,
        });
      } catch (e) {
        console.warn('[MapContext] flyTo error:', e);
        // Fallback to instant setCenter if flyTo fails
        try {
          mapRef.current.setCenter([lng, lat]);
          if (zoom) mapRef.current.setZoom(zoom);
        } catch {}
      }
    } else {
      commandQueue.current.push({ type: 'flyTo', payload: { lng, lat, zoom } });
    }
  }, [mapLoaded]);

  const startDirectTo = useCallback((lng: number, lat: number, name: string) => {
    try {
      if (mapRef.current && mapLoaded) {
        const fn = (window as any).__landoutSetDirectToDest; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (fn) fn({ lng, lat, name, type: 'map' });
        window.dispatchEvent(new CustomEvent('landoutDirectToGps'));
      } else {
        commandQueue.current.push({ type: 'setDirectTo', payload: { lng, lat, name } });
      }
    } catch (e) {
      console.error('[MapContext] startDirectTo error:', e);
    }
  }, [mapLoaded]);

  const dropPin = useCallback((lng: number, lat: number, name?: string) => {
    if (mapRef.current && mapLoaded) {
      const fn = (window as any).landoutDropPin; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (fn) fn(lng, lat, name);
    } else {
      commandQueue.current.push({ type: 'dropPin', payload: { lng, lat, name } });
    }
  }, [mapLoaded]);

  const showInfoCard = useCallback((data: Parameters<MapContextValue['showInfoCard']>[0]) => {
    if (mapRef.current && mapLoaded) {
      window.dispatchEvent(new CustomEvent('landoutSearchSelect', { detail: data }));
    } else {
      commandQueue.current.push({ type: 'showInfoCard', payload: data as unknown as Record<string, unknown> });
    }
  }, [mapLoaded]);

  const value: MapContextValue = {
    mapRef,
    mapLoaded,
    flyToSite,
    startDirectTo,
    dropPin,
    showInfoCard,
    overlayOpen,
    setOverlayOpen,
    registerMapLoaded,
  };

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return ctx;
}

export function useMapIfAvailable() {
  return useContext(MapContext);
}