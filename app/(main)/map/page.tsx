'use client';

import { useState, useCallback } from 'react';
import { MapLegend, MapLayerToggle, BackcountryMap, OVERLAY_LAYERS } from '@/components/map';
import { NearestPanel } from '@/components/map/NearestPanel';
import { BuildBanner } from '@/components/map/BuildBanner';

/** Simple prompt to enter lat/lon and trigger Direct To */
function DirectToPrompt({ onClose }: { onClose: () => void }) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [error, setError] = useState('');

  function handleGo() {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (isNaN(la) || isNaN(lo)) { setError('Enter valid numbers'); return; }
    if (la < -90 || la > 90) { setError('Latitude must be -90 to 90'); return; }
    if (lo < -180 || lo > 180) { setError('Longitude must be -180 to 180'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (window as any).landoutSetDirectTo;
    if (fn) fn({ lng: lo, lat: la, name: `${la.toFixed(4)}°, ${lo.toFixed(4)}°`, type: 'map' });
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#BE185D' }}>✈ Direct To</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latitude</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 37.7749"
              value={lat}
              onChange={e => setLat(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Longitude</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. -122.4194"
              value={lon}
              onChange={e => setLon(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
            />
          </div>
          {error && <div style={{ color: '#EF4444', fontSize: 12 }}>{error}</div>}
          <button
            onClick={handleGo}
            style={{
              marginTop: 4, padding: '10px',
              background: '#BE185D', color: 'white',
              border: 'none', borderRadius: 8,
              fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Fly To
          </button>
        </div>
      </div>
    </div>
  );
}

// Build version indicator — injected at deploy time via NEXT_PUBLIC_GIT_SHA / NEXT_PUBLIC_GIT_BRANCH
const BUILD_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? '';
const BUILD_BRANCH = process.env.NEXT_PUBLIC_GIT_BRANCH ?? '';

function BuildTag() {
  if (!BUILD_SHA) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 72, right: 8, zIndex: 30,
      background: 'rgba(26,32,44,0.85)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6, padding: '3px 8px', fontSize: 10,
      color: '#718096', fontFamily: 'monospace', pointerEvents: 'none',
      letterSpacing: '0.02em',
    }}>
      {BUILD_BRANCH} @ {BUILD_SHA}
    </div>
  );
}

export default function MapPage() {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [trackUp, setTrackUp] = useState(false);
  const [directToPrompt, setDirectToPrompt] = useState(false);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__landoutMap = map;
    // Expose track-up setter for LocateButton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutSetTrackUp = (on: boolean) => {
      setTrackUp(on);
      window.dispatchEvent(new CustomEvent('landoutSetTrackUp', { detail: on }));
    };
    // Expose direct-to trigger from prompt button
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutTriggerDirectTo = () => setDirectToPrompt(true);
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

      {/* Layers button — top-right, dark charcoal, aviation orange accent */}
      <div className="absolute right-1 top-1 z-50" style={{ pointerEvents: 'auto' }}>
        <MapLayerToggle layers={layers} onToggle={handleToggle} />
      </div>

      {/* Land Status legend — bottom-left, just above mobile nav, default collapsed */}
      {/* bottom: 72 = 7px above the 65px mobile nav */}
      <div style={{ position: 'absolute', bottom: 72, left: 8, zIndex: 30, pointerEvents: 'auto' }}>
        <MapLegend />
      </div>

      {/* Nearest airports panel — bottom-left, above legend */}
      <NearestPanel />

      {/* North-Up button — bottom-right, directly above Locate button */}
      <div style={{ position: 'absolute', bottom: 166, right: 8, zIndex: 60, pointerEvents: 'auto' }}>
        <button
          onClick={() => {
            const next = !trackUp;
            setTrackUp(next);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fn = (window as any).landoutSetTrackUp;
            if (fn) fn(next);
          }}
          title={trackUp ? 'North-Up ON — tap for Track-Up' : 'North-Up — tap for Track-Up'}
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: '#1A202C',
            border: `1.5px solid ${trackUp ? '#3B82F6' : '#4A5568'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: trackUp ? '#3B82F6' : '#718096',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
            transition: 'all 0.2s',
          }}
        >
          N
        </button>
      </div>

      {/* Build banner — top, shows on first visit */}
      <BuildBanner sha={BUILD_SHA} branch={BUILD_BRANCH} buildTime={new Date().toISOString()} />

      {/* Build version tag — bottom-right */}
      <BuildTag />

      {/* Grid toggle — bottom-right, above NorthUp */}
      <button
        onClick={() => { (window as any).landoutToggleGrid?.(); }}
        title="Toggle debug grid (G)"
        style={{
          position: 'absolute',
          bottom: 212,
          right: 8,
          zIndex: 60,
          width: 34,
          height: 28,
          background: 'rgba(26,32,44,0.85)',
          border: '1.5px solid #4A5568',
          borderRadius: 6,
          color: '#718096',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          letterSpacing: '0.02em',
        }}
      >
        GRID
      </button>

      {/* DISCLAIMER — dark amber, dismissible, bottom-center */}
      {!disclaimerDismissed && (
        <div
          style={{
            position: 'absolute',
            top: '85%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            maxWidth: 280,
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
              textAlign: 'center',
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
