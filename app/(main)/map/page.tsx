'use client';

import { useState, useCallback } from 'react';
import { MapLegend, MapLayerToggle, BackcountryMap, OVERLAY_LAYERS } from '@/components/map';
import { NearestPanel } from '@/components/map/NearestPanel';

export default function MapPage() {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
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
        background: '#1A202C', color: '#E8DCC8',
        padding: '6px 10px', borderRadius: 8,
        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        letterSpacing: '0.05em',
        border: '2px solid #D4621A',
      }}>
        <div style={{ color: '#D4621A', marginBottom: 2 }}>LANDOUT BUILD TEST</div>
        <div>SHA: f5eb185</div>
        <div>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* Layers button — top-right, dark theme */}
      <div className="absolute right-1 top-1 z-50" style={{ pointerEvents: 'auto' }}>
        <MapLayerToggle layers={layers} onToggle={handleToggle} />
      </div>

      {/* Land Status legend — bottom-left, default collapsed, dark theme */}
      <div style={{ position: 'absolute', bottom: 80, left: 8, zIndex: 30, pointerEvents: 'auto' }}>
        <MapLegend />
      </div>

      {/* Nearest airports panel — bottom-left above legend */}
      <NearestPanel />

      {/* DISCLAIMER — subtle dark amber, dismissible */}
      {!disclaimerDismissed && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 56,   // sit to the left of the Layers button
            zIndex: 40,
            maxWidth: 200,
            cursor: 'pointer',
          }}
          onClick={() => setDisclaimerDismissed(true)}
          title="Click to dismiss"
        >
          <div
            style={{
              background: 'rgba(26, 32, 44, 0.92)',
              border: '1px solid #D4621A',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              color: '#C9B99A',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <strong style={{ color: '#D4621A' }}>⚠️ NOT FOR NAVIGATION</strong>
            <br />
            Land status context only. Does not authorize landings.
          </div>
        </div>
      )}
    </div>
  );
}
