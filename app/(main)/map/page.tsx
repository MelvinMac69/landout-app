'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapLegend, MapLayerToggle, BackcountryMap, BasemapToggle, OVERLAY_LAYERS } from '@/components/map';

export default function MapPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  const handleMapLoad = useCallback(() => {}, []);

  const handleToggle = useCallback((layerId: string) => {
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
    <div
      className="h-[calc(100vh-3.5rem)] relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <BackcountryMap onMapLoad={handleMapLoad} />

      {/* =========================================================
          LAYER CONTROLS — top-right corner, always visible
          ========================================================= */}

      {/* Layers button — top-right, z-50 to float above everything */}
      <div
        className="absolute right-1 top-1 z-50"
        style={{ pointerEvents: 'auto' }}
      >
        <MapLayerToggle layers={layers} onToggle={handleToggle} />
      </div>

      {/* Land Status Key legend — below Layers button, top-right */}
      <div
        className="absolute right-1 z-40"
        style={{ top: 72, pointerEvents: 'auto' }}
      >
        <MapLegend />
      </div>

      {/* Basemap toggle — bottom-left, compact row of icons only */}
      <div
        style={{ position: 'absolute', bottom: 70, left: 8, zIndex: 30 }}
      >
        <BasemapToggle />
      </div>

      {/* Locate button — bottom-right corner */}
      <div
        style={{ position: 'absolute', bottom: 12, right: 8, zIndex: 30 }}
      >
        {/* LocateButton is rendered inside BackcountryMap */}
      </div>

      {/* DISCLAIMER — top-right, below legend */}
      {!disclaimerDismissed && (
        <div
          style={{
            position: 'absolute',
            top: 295,
            right: 4,
            zIndex: 20,
            maxWidth: 200,
            cursor: 'pointer',
          }}
          onClick={() => setDisclaimerDismissed(true)}
          title="Click to dismiss"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 hover:bg-amber-100 transition-colors">
            <strong>⚠️ NOT FOR NAVIGATION</strong>
            <br />
            Shows land status context only. Does not authorize landings.
          </div>
        </div>
      )}
    </div>
  );
}
