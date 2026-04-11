'use client';

import { Header, MobileHeader } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { BackcountryMap } from '@/components/map/BackcountryMap';
import { MapLegend, DataDashboard, MapLayerToggle } from '@/components/map';
import { DirectToPanel } from '@/components/map/DirectTo';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { OVERLAY_LAYERS } from '@/components/map';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mapReady, setMapReady] = useState(false);
  const [trackUp, setTrackUp] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );
  const [directToData, setDirectToData] = useState<{
    dest: { lng: number; lat: number; name?: string; type: 'map' | 'airport' | 'pin' };
    currentPos: { lat: number; lon: number; heading?: number; speed?: number } | null;
  } | null>(null);
  const [compassBearing, setCompassBearing] = useState(0);
  const setCompassBearingRef = useRef(setCompassBearing);
  setCompassBearingRef.current = setCompassBearing;
  const buildClickRef = useRef(0);
  const [showBuildInfo, setShowBuildInfo] = useState(false);

  // Handle URL params — "View on Map" from site detail page sets dropPin=1
  // This layout stays mounted, so the useEffect runs whenever the URL changes
  const searchParams = useSearchParams();
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const name = searchParams.get('name');
    const icao = searchParams.get('icao');
    const faa_ident = searchParams.get('faa_ident');
    const airportType = searchParams.get('airportType');
    const municipality = searchParams.get('municipality');
    const state = searchParams.get('state');
    const runway = searchParams.get('runway');
    const elev = searchParams.get('elev');
    const siteId = searchParams.get('siteId');
    const dropPin = searchParams.get('dropPin') === '1';

    if (lat && lon && name && dropPin) {
      let decodedName = name;
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
      } catch {
        // use raw values
      }

      const airportData = {
        lng: parseFloat(lon),
        lat: parseFloat(lat),
        name: decodedName,
        ts: Date.now(),
      };
      // Store pending — handleFlyToAirport will process when map is ready
      (window as any).__landoutPendingAirport = airportData;
      // Trigger the event so the map's existing listener picks it up
      window.dispatchEvent(new CustomEvent('landoutFlyToAirport', { detail: airportData }));
      console.log('[Layout] dropPin=1 detected, dispatched landoutFlyToAirport');
    }
  }, [searchParams]);

  // 5-click easter egg for build info
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function handleBuildClick() {
      buildClickRef.current++;
      clearTimeout(timer);
      if (buildClickRef.current >= 5) {
        buildClickRef.current = 0;
        setShowBuildInfo(true);
      } else {
        timer = setTimeout(() => { buildClickRef.current = 0; }, 1000);
      }
    }
    window.addEventListener('buildinfo-click', handleBuildClick);
    return () => { window.removeEventListener('buildinfo-click', handleBuildClick); clearTimeout(timer); };
  }, []);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    setMapReady(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__landoutMap = map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutSetTrackUp = (on: boolean) => {
      setTrackUp(on);
      window.dispatchEvent(new CustomEvent('landoutSetTrackUp', { detail: on }));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutTriggerDirectTo = () => {
      window.dispatchEvent(new CustomEvent('landoutTriggerDirectTo'));
    };
    // Track bearing for compass
    setCompassBearingRef.current(map.getBearing());
    map.on('rotate', () => setCompassBearingRef.current(map.getBearing()));
    map.on('moveend', () => setCompassBearingRef.current(map.getBearing()));
  }, []);

  const handleToggle = useCallback((layerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (window as any).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, [activeLayers]);

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  // Listen for DirectTo panel events
  useEffect(() => {
    function onDirectToChange(e: Event) {
      const detail = (e as CustomEvent<{ dest: any; currentPos: any }>).detail;
      if (detail?.dest) {
        document.documentElement.style.setProperty('--direct-to-offset', '95px');
        setDirectToShift(95);
        setDirectToData(detail);
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
    window.addEventListener('landoutDirectToChange', onDirectToChange);
    window.addEventListener('landoutDirectToHeight', onDirectToHeight);
    return () => {
      window.removeEventListener('landoutDirectToChange', onDirectToChange);
      window.removeEventListener('landoutDirectToHeight', onDirectToHeight);
    };
  }, []);

  const [directToShift, setDirectToShift] = useState(0);

  return (
    <div className="min-h-screen flex flex-col" onClick={() => window.dispatchEvent(new Event('buildinfo-click'))}>
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
        {/* ── Persistent full-screen map ──────────────────────────────────── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <BackcountryMap onMapLoad={handleMapLoad} />
        </div>

        {/* ── Map UI controls (rendered above the persistent map) ──────────── */}
        {mapReady && (
          <>
            <DataDashboard />

            {/* Direct To navigation panel */}
            {directToData && (
              <DirectToPanel
                dest={directToData.dest}
                currentPos={directToData.currentPos}
                onClear={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const fn = (window as any).__landoutSetDirectToDest;
                  if (fn) fn(null);
                }}
              />
            )}

            {/* Layers button */}
            <div
              className="absolute right-1 z-50"
              style={{ top: `calc(var(--data-dashboard-offset, 0px) + var(--direct-to-offset, 0px) + 19px)` }}
            >
              <MapLayerToggle layers={layers} onToggle={handleToggle} />
            </div>

            {/* Compass */}
            {trackUp && (
              <div style={{
                position: 'fixed',
                bottom: `calc(env(safe-area-inset-bottom) + 182px + var(--direct-to-offset, 0px))`,
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
                  position: 'relative',
                }}>
                  <span style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#EF4444' }}>N</span>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', width: 2, height: 20,
                    transformOrigin: '50% 100%',
                    transform: `translate(-50%, -100%) rotate(${-compassBearing}deg)`,
                  }}>
                    <div style={{ width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: '12px solid #EF4444', margin: '0 auto' }} />
                    <div style={{ width: 0, height: 0, borderLeft: '2.5px solid transparent', borderRight: '2.5px solid transparent', borderTop: '8px solid #94A3B8', margin: '0 auto' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: '50%', background: '#D4621A', transform: 'translate(-50%, -50%)' }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3B82F6', fontWeight: 600 }}>{Math.round(compassBearing)}°</span>
              </div>
            )}

            {/* North-Up button */}
            <div style={{ position: 'fixed', bottom: `calc(env(safe-area-inset-bottom) + 136px + var(--direct-to-offset, 0px))`, right: 8, zIndex: 60 }}>
              <button
                onClick={() => {
                  const next = !trackUp;
                  setTrackUp(next);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const fn = (window as any).landoutSetTrackUp;
                  if (fn) fn(next);
                }}
                title={trackUp ? 'North-Up ON' : 'North-Up'}
                style={{
                  width: 42, height: 42, borderRadius: 8,
                  background: '#141414',
                  border: `1.5px solid ${trackUp ? '#3B82F6' : '#4A5568'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: trackUp ? '#3B82F6' : '#718096',
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
          </>
        )}

        {/* Build info easter egg */}
        {showBuildInfo && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, cursor: 'pointer' }} onClick={() => setShowBuildInfo(false)}>
            <div style={{ background: 'rgba(26,32,44,0.95)', border: '1.5px solid #D4621A', borderRadius: 10, padding: '16px 24px', textAlign: 'center', minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D4621A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Build Info</div>
              <div style={{ fontSize: 12, color: '#C9B99A', fontFamily: 'monospace', marginBottom: 4 }}>dev build</div>
              <button onClick={() => { (window as any).landoutToggleGrid?.(); }} style={{ marginTop: 8, padding: '4px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#94A3B8', fontSize: 11, cursor: 'pointer' }}>TOGGLE GRID</button>
              <div style={{ fontSize: 10, color: '#718096', marginTop: 8 }}>Click to dismiss</div>
            </div>
          </div>
        )}

        {/* ── Page content overlay ─────────────────────────────────────────── */}
        {/* Pages render ABOVE the map — use relative positioning and transparent/semi-transparent backgrounds */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>

        {/* Map Legend — rendered below page content but above map */}
        <MapLegend />
      </main>
      <MobileNav />
    </div>
  );
}
