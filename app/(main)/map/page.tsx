'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapLegend, MapLayerToggle, BackcountryMap, BasemapToggle, OVERLAY_LAYERS } from '@/components/map';
import { Search } from 'lucide-react';

export default function MapPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const handleMapLoad = useCallback(() => {
    // Map is now managed entirely in BackcountryMap — no ref needed
  }, []);

  const handleToggle = useCallback((layerId: string) => {
    // Call directly via window — no React state change touches the map
    const fn = (window as typeof window & { landoutSetOverlayVisibility: (id: string, v: boolean) => void }).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, [activeLayers]);

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  if (!isMounted) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex items-center justify-center">
        <span className="text-slate-500">Loading map…</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] relative">
      <BackcountryMap onMapLoad={handleMapLoad} />

      {/* Basemap buttons — top-right, above layer panel */}
      <BasemapToggle />

      {/* Layer toggle — below basemap buttons */}
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
