'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapLegend, MapLayerToggle, DataDashboard, OVERLAY_LAYERS } from '@/components/map';
import { DirectToPanel } from '@/components/map/DirectTo';
import { SiteInfoBox } from '@/components/map/SiteInfoBox';
import { useMapContext } from '../MapContext';

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

// Build version indicator — injected at deploy time by Vercel's auto-injected env vars:
const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '';
const BUILD_BRANCH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? '';
const BUILD_VERSION = BUILD_SHA
  ? `${BUILD_BRANCH || '?'} @ ${BUILD_SHA.slice(0, 7)}`
  : '';

function BuildTag() {
  if (!BUILD_VERSION) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 72px)', right: 8, zIndex: 30,
      background: 'rgba(20,20,20,0.85)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6, padding: '3px 8px', fontSize: 10,
      color: '#718096', fontFamily: 'monospace', pointerEvents: 'none',
      letterSpacing: '0.02em',
    }}>
      {BUILD_VERSION}
    </div>
  );
}

export default function MapPage() {
  // BackcountryMap is rendered in the layout — we access it via MapContext
  const { mapRef, mapLoaded } = useMapContext();

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [trackUp, setTrackUp] = useState(false);
  const [directToPrompt, setDirectToPrompt] = useState(false);
  const [showBuildInfo, setShowBuildInfo] = useState(false);

  // Handle URL params from search page navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat');
    const lon = params.get('lon');
    const name = params.get('name');
    const icao = params.get('icao');
    const faa_ident = params.get('faa_ident');
    const airportType = params.get('airportType');
    const municipality = params.get('municipality');
    const state = params.get('state');
    const runway_length_ft = params.get('runway');
    const elev = params.get('elev');
    const siteId = params.get('siteId');
    const directTo = params.get('directTo') === '1';
    const dropPin = params.get('dropPin') === '1';
    if (lat && lon && name) {
      let decodedName: string | undefined;
      let decodedIcao: string | undefined;
      let decodedAirportType: string | undefined;
      let decodedMunicipality: string | undefined;
      let decodedState: string | undefined;
      let decodedSiteId = '';
      try {
        decodedName = decodeURIComponent(name);
        decodedIcao = icao ? decodeURIComponent(icao) : undefined;
        decodedAirportType = airportType ? decodeURIComponent(airportType) : undefined;
        decodedMunicipality = municipality ? decodeURIComponent(municipality) : undefined;
        decodedState = state ? decodeURIComponent(state) : undefined;
        decodedSiteId = siteId ? decodeURIComponent(siteId) : '';
      } catch (err) {
        console.warn('[Page] URL param decode error:', err);
        decodedName = name;
      }
      if (dropPin) {
        const airportData = {
          lng: parseFloat(lon),
          lat: parseFloat(lat),
          name: decodedName,
          ts: Date.now(),
        };
        // Store pending airport — map will pick it up when it loads (via useEffect in BackcountryMap)
        (window as any).__landoutPendingAirport = { ...airportData, autoDirectTo: directTo };
        setDisclaimerDismissed(true);
        console.log('[Page] pending airport set, autoDirectTo:', directTo);
      } else {
        const detail = {
          lng: parseFloat(lon),
          lat: parseFloat(lat),
          name: decodedName,
          faa_ident: decodedIcao || undefined,
          airportType: decodedAirportType || undefined,
          municipality: decodedMunicipality || undefined,
          state: decodedState || undefined,
          runway_length_ft: runway_length_ft ? parseInt(runway_length_ft) : null,
          elevation_ft: elev ? parseInt(elev) : null,
          directTo,
        };
        window.dispatchEvent(new CustomEvent('landoutSearchSelect', { detail }));
      }
    }
  }, []);

  const [compassBearing, setCompassBearing] = useState(0);
  const [siteInfo, setSiteInfo] = useState<{
    name: string;
    siteId: string;
    lat: number;
    lon: number;
    elev: string;
    runway: string;
    municipality: string;
    state: string;
    type: string;
  } | null>(null);
  const [directToShift, setDirectToShift] = useState(0);
  const [dataDashboardShift, setDataDashboardShift] = useState(0);
  const [directToData, setDirectToData] = useState<{
    dest: { lng: number; lat: number; name?: string; type: 'map' | 'airport' | 'pin' };
    currentPos: { lat: number; lon: number; heading?: number; speed?: number } | null;
  } | null>(null);
  const buildClickRef = useRef(0);
  const setCompassBearingRef = useRef(setCompassBearing);
  setCompassBearingRef.current = setCompassBearing;

  // 5-click easter egg: after 5 rapid clicks on the map, show build info
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function handleBuildClick() {
      buildClickRef.current++;
      clearTimeout(timer);
      if (buildClickRef.current >= 5) {
        buildClickRef.current = 0;
        setShowBuildInfo(true);
      } else {
        timer = setTimeout(() => {
          buildClickRef.current = 0;
        }, 1000);
      }
    }
    window.addEventListener('buildinfo-click', handleBuildClick);
    return () => {
      window.removeEventListener('buildinfo-click', handleBuildClick);
      clearTimeout(timer);
    };
  }, []);

  // Wire up track-up / direct-to / compass bearing with the map that's in the layout
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    // Track map bearing for compass
    setCompassBearingRef.current(mapRef.current.getBearing());
    mapRef.current.on('rotate', () => {
      setCompassBearingRef.current(mapRef.current!.getBearing());
    });
    mapRef.current.on('moveend', () => {
      setCompassBearingRef.current(mapRef.current!.getBearing());
    });

    // Expose track-up setter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutSetTrackUp = (on: boolean) => {
      setTrackUp(on);
      window.dispatchEvent(new CustomEvent('landoutSetTrackUp', { detail: on }));
    };

    // Expose direct-to trigger from prompt button
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutTriggerDirectTo = () => setDirectToPrompt(true);

    return () => {
      // Clean up exposed globals when page unmounts
      delete (window as any).landoutSetTrackUp;
      delete (window as any).landoutTriggerDirectTo;
    };
  }, [mapLoaded, mapRef]);

  const handleToggle = useCallback((layerId: string) => {
    const fn = (window as typeof window & { landoutSetOverlayVisibility: (id: string, v: boolean) => void }).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, [activeLayers]);

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  // Listen for Direct To panel activation to shift map controls down
  // fitBounds/flyTo are wrapped in requestAnimationFrame to prevent iOS Safari
  // WebGL context loss when multiple map mutations happen in one frame.
  useEffect(() => {
    let cameraRafId: number | null = null;

    function onDirectToChange(e: Event) {
      const detail = (e as CustomEvent<{ dest: any; currentPos: any }>).detail;
      if (detail?.dest) {
        document.documentElement.style.setProperty('--direct-to-offset', '95px');
        setDirectToShift(95);
        setDirectToData(detail);

        // Schedule camera movement for next animation frame — avoids WebGL crash
        // on iOS Safari when fitBounds/flyTo runs in same frame as source updates
        if (cameraRafId !== null) cancelAnimationFrame(cameraRafId);
        cameraRafId = requestAnimationFrame(() => {
          cameraRafId = null;
          const map = mapRef.current;
          if (!map) return;
          const pos = detail.currentPos;
          try {
            if (pos?.lat && pos?.lon) {
              const bounds: [[number, number], [number, number]] = [
                [Math.min(pos.lon, detail.dest.lng), Math.min(pos.lat, detail.dest.lat)],
                [Math.max(pos.lon, detail.dest.lng), Math.max(pos.lat, detail.dest.lat)],
              ];
              map.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: 1500 });
            } else if (Number.isFinite(detail.dest.lng) && Number.isFinite(detail.dest.lat)) {
              map.flyTo({ center: [detail.dest.lng, detail.dest.lat], zoom: 12, duration: 1500 });
            }
          } catch (e) {
            console.warn('[Page] DirectTo camera error:', e);
          }
        });
      } else {
        document.documentElement.style.setProperty('--direct-to-offset', '0px');
        setDirectToShift(0);
        setDirectToData(null);
      }
    }
    function onDirectToHeight(e: Event) {
      const h = (e as CustomEvent<number>).detail;
      document.documentElement.style.setProperty('--direct-to-offset', `${h}px`);
      setDirectToShift(h);
    }
    function onDataDashboardHeight(e: Event) {
      const h = (e as CustomEvent<number>).detail;
      document.documentElement.style.setProperty('--data-dashboard-offset', `${h}px`);
      setDataDashboardShift(h);
    }
    window.addEventListener('landoutDirectToChange', onDirectToChange);
    window.addEventListener('landoutDirectToHeight', onDirectToHeight);
    window.addEventListener('landoutDataDashboardHeight', onDataDashboardHeight);
    return () => {
      window.removeEventListener('landoutDirectToChange', onDirectToChange);
      window.removeEventListener('landoutDirectToHeight', onDirectToHeight);
      window.removeEventListener('landoutDataDashboardHeight', onDataDashboardHeight);
      if (cameraRafId !== null) cancelAnimationFrame(cameraRafId);
    };
  }, [mapRef]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={() => window.dispatchEvent(new Event('buildinfo-click'))}
    >
      {/* Persistent flight data dashboard — slides down from top when position available */}
      <div style={{ pointerEvents: 'auto' }}>
        <DataDashboard />
      </div>

      {/* NOTE: <BackcountryMap> is rendered in the parent (map)/layout.tsx, not here.
          This page only renders the UI controls that overlay the map. */}

      {/* Direct To navigation panel */}
      {directToData && (
        <div style={{ pointerEvents: 'auto' }}>
          <DirectToPanel
            dest={directToData.dest}
            currentPos={directToData.currentPos}
            onClear={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fn = (window as any).__landoutSetDirectToDest;
              if (fn) fn(null);
            }}
          />
        </div>
      )}

      {/* Layers button — top-right */}
      <div className="absolute right-1 z-50" style={{ top: `calc(var(--data-dashboard-offset, 0px) + var(--direct-to-offset, 0px) + 19px)`, pointerEvents: 'auto' }}>
        <MapLayerToggle layers={layers} onToggle={handleToggle} />
      </div>

      {/* Land Status legend — bottom-left */}
      <div style={{ pointerEvents: 'auto' }}>
        <MapLegend />
      </div>

      {/* Compass — visible when track-up is active */}
      {trackUp && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 182px + var(--direct-to-offset, 0px))',
          right: 8,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(20,20,20,0.95)',
            border: '1.5px solid #4A5568',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <span style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#EF4444', fontFamily: 'system-ui' }}>N</span>
            <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>S</span>
            <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>W</span>
            <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>E</span>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 2,
              height: 20,
              transformOrigin: '50% 100%',
              transform: `translate(-50%, -100%) rotate(${-compassBearing}deg)`,
            }}>
              <div style={{
                width: 0, height: 0,
                borderLeft: '3px solid transparent',
                borderRight: '3px solid transparent',
                borderBottom: '12px solid #EF4444',
                margin: '0 auto',
              }} />
              <div style={{
                width: 0, height: 0,
                borderLeft: '2.5px solid transparent',
                borderRight: '2.5px solid transparent',
                borderTop: '8px solid #94A3B8',
                margin: '0 auto',
              }} />
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: '50%', background: '#D4621A', transform: 'translate(-50%, -50%)' }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3B82F6', fontWeight: 600 }}>
            {Math.round(compassBearing)}°
          </span>
        </div>
      )}

      {/* North-Up button — bottom-right */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 136px + var(--direct-to-offset, 0px))', right: 8, zIndex: 60, pointerEvents: 'auto' }}>
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
            background: '#141414',
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
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <g transform={`rotate(${-compassBearing})`}>
              <polygon points="9,2 12,9 9,7 6,9" fill={trackUp ? '#3B82F6' : '#718096'} />
              <polygon points="9,16 12,9 9,11 6,9" fill={trackUp ? '#1E40AF' : '#4A5568'} />
            </g>
          </svg>
        </button>
      </div>

      {/* Site Info box */}
      {siteInfo && (
        <div style={{ pointerEvents: 'auto' }}>
          <SiteInfoBox
            site={siteInfo}
            onClose={() => setSiteInfo(null)}
          />
        </div>
      )}

      {/* DISCLAIMER */}
      {!disclaimerDismissed && (
        <div
          style={{
            position: 'absolute',
            top: '75%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            maxWidth: 280,
            cursor: 'pointer',
            pointerEvents: 'auto',
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

      {/* Build info easter egg — 5 clicks reveals this */}
      {showBuildInfo && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
          onClick={() => setShowBuildInfo(false)}
        >
          <div
            style={{
              background: 'rgba(26, 32, 44, 0.95)',
              border: '1.5px solid #D4621A',
              borderRadius: 10,
              padding: '16px 24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              textAlign: 'center',
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#D4621A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Build Info
            </div>
            <div style={{ fontSize: 12, color: '#C9B99A', fontFamily: 'monospace', marginBottom: 4 }}>
              {BUILD_VERSION || 'dev build (local)'}
            </div>
            <button
              onClick={() => { (window as any).landoutToggleGrid?.(); }}
              style={{
                marginTop: 8,
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                color: '#94A3B8',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              TOGGLE GRID
            </button>
            <div style={{ fontSize: 10, color: '#718096', marginTop: 8 }}>
              Click to dismiss
            </div>
          </div>
        </div>
      )}
    </div>
  );
}