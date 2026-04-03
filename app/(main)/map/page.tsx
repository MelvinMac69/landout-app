'use client';

import { useState, useCallback } from 'react';
import { MapLegend, MapLayerToggle, BackcountryMap, OVERLAY_LAYERS } from '@/components/map';
import { NearestPanel } from '@/components/map/NearestPanel';

export default function MapPage() {
  // isMounted check removed — BackcountryMap handles its own loading state internally.
  // Keeping isMounted at the page level caused a double-overlay bug on mobile where
  // the page-level loading div (pointerEvents: auto) blocked all map touch events
  // if isMounted was not set to true after hydration (particularly on mobile Safari).

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    // Belt-and-suspenders: also expose on window so LocateButton can find the map
    // even if mapRef isn't propagated yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__landoutMap = map;
  }, []);

  const handleToggle = useCallback((layerId: string) => {
    const fn = (window as typeof window & { landoutSetOverlayVisibility: (id: string, v: boolean) => void }).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, [activeLayers]);

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  return (
    <div
      className="h-[calc(100vh-3.5rem)] relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <BackcountryMap onMapLoad={handleMapLoad} />

      {/* TEMPORARY BUILD VERIFICATION MARKER */}
      <div style={{
        position: 'absolute', top: 4, left: 4, zIndex: 9999,
        background: '#1B3D2F', color: '#E8DCC8',
        padding: '6px 10px', borderRadius: 8,
        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        letterSpacing: '0.05em',
        border: '2px solid #D4621A',
      }}>
        <div style={{ color: '#D4621A', marginBottom: 2 }}>LANDOUT BUILD TEST</div>
        <div>SHA: f5eb185</div>
        <div>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>

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

      {/* Locate button — bottom-right corner */}
      <div
        style={{ position: 'absolute', bottom: 12, right: 8, zIndex: 30 }}
      >
        {/* LocateButton is rendered inside BackcountryMap */}
      </div>

      {/* Nearest airports panel — bottom-left */}
      <NearestPanel />

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
