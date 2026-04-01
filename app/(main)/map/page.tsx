'use client';

import dynamic from 'next/dynamic';
import { useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapLegend, MapLayerToggle, BackcountryMap, OVERLAY_LAYERS } from '@/components/map';
import { Search } from 'lucide-react';

const BackcountryMapClient = dynamic(
  () => import('@/components/map/BackcountryMap').then((mod) => mod.BackcountryMap),
  { ssr: false, loading: () => <Loading /> }
);

function Loading() {
  return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <span className="text-slate-500">Loading map…</span>
    </div>
  );
}

export default function MapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);

  // All overlays start visible
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
  }, []);

  const handleToggle = useCallback(
    (layerId: string) => {
      const map = mapRef.current;
      if (!map) return;
      const next = !activeLayers[layerId];
      // setOverlayVisibility is attached to the map instance in BackcountryMap
      const fn = (map as typeof map & { setOverlayVisibility: (id: string, v: boolean) => void }).setOverlayVisibility;
      if (fn) fn(layerId, next);
      setActiveLayers((prev) => ({ ...prev, [layerId]: next }));
    },
    [activeLayers]
  );

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  return (
    <div className="h-[calc(100vh-3.5rem)] relative">
      <BackcountryMapClient onMapLoad={handleMapLoad} />

      <MapLayerToggle layers={layers} onToggle={handleToggle} />
      <MapLegend />

      {/* Search bar */}
      <div className="absolute top-4 left-4 right-4 md:left-auto md:right-auto md:w-80 md:left-4 z-10">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search airports, strips, sites…"
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="absolute bottom-24 md:bottom-8 right-4 z-10 max-w-xs">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
          <strong>⚠️ NOT FOR NAVIGATION</strong>
          <br />
          Shows land status context only. Does not authorize landings.
        </div>
      </div>
    </div>
  );
}
