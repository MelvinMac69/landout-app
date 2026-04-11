'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Header, MobileHeader } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import dynamic from 'next/dynamic';
import { MapLegend, MapLayerToggle, DataDashboard, OVERLAY_LAYERS } from '@/components/map';
import { DirectToPanel } from '@/components/map/DirectTo';
import type maplibregl from 'maplibre-gl';

// Dynamically import BackcountryMap with ssr:false — MapLibre requires browser APIs.
const BackcountryMap = dynamic(
  () => import('@/components/map/BackcountryMap').then((m) => m.BackcountryMap),
  { ssr: false, loading: () => <div style={{ position: 'fixed', inset: 0, background: '#1a2030' }} /> }
);

const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '';
const BUILD_BRANCH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? '';
const BUILD_VERSION = BUILD_SHA
  ? `${BUILD_BRANCH || '?'} @ ${BUILD_SHA.slice(0, 7)}`
  : '';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mapReady, setMapReady] = useState(false);
  const [trackUp, setTrackUp] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );
  const [compassBearing, setCompassBearing] = useState(0);
  const setCompassBearingRef = useRef(setCompassBearing);
  setCompassBearingRef.current = setCompassBearing;
  const buildClickRef = useRef(0);
  const [showBuildInfo, setShowBuildInfo] = useState(false);
  const [directToShift, setDirectToShift] = useState(0);
  const [dataDashboardShift, setDataDashboardShift] = useState(0);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    setMapReady(true);
    (window as any).__landoutMap = map;
    (window as any).landoutSetTrackUp = (on: boolean) => {
      setTrackUp(on);
      window.dispatchEvent(new CustomEvent('landoutSetTrackUp', { detail: on }));
    };
    setCompassBearingRef.current(map.getBearing());
    map.on('rotate', () => setCompassBearingRef.current(map.getBearing()));
    map.on('moveend', () => setCompassBearingRef.current(map.getBearing()));
  }, []);

  const handleToggle = useCallback((layerId: string) => {
    const fn = (window as typeof window & { landoutSetOverlayVisibility: (id: string, v: boolean) => void }).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, [activeLayers]);

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

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
    return () => {
      window.removeEventListener('buildinfo-click', handleBuildClick);
      clearTimeout(timer);
    };
  }, []);

  // Listen for DirectTo panel events and data dashboard height
  useEffect(() => {
    function onDirectToChange(e: Event) {
      const detail = (e as CustomEvent<{ dest: any; currentPos: any }>).detail;
      if (detail?.dest) {
        document.documentElement.style.setProperty('--direct-to-offset', '95px');
        setDirectToShift(95);
      } else {
        document.documentElement.style.setProperty('--direct-to-offset', '0px');
        setDirectToShift(0);
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
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      onClick={() => window.dispatchEvent(new Event('buildinfo-click'))}
    >
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
        {/* Persistent full-screen map */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <BackcountryMap onMapLoad={handleMapLoad} />
        </div>

        {/* Map UI controls (rendered above the persistent map) */}
        {mapReady && (
          <>
            <DataDashboard />

            {/* Layers button */}
            <div
              className="absolute right-1 z-50"
              style={{
                top: `calc(var(--data-dashboard-offset, 0px) + var(--direct-to-offset, 0px) + 19px)`,
                pointerEvents: 'auto',
              }}
            >
              <MapLayerToggle layers={layers} onToggle={handleToggle} />
            </div>

            {/* Compass rose */}
            {trackUp && (
              <div
                style={{
                  position: 'fixed',
                  bottom: `calc(env(safe-area-inset-bottom) + 182px + var(--direct-to-offset, 0px))`,
                  right: 8,
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(20,20,20,0.95)',
                    border: '1.5px solid #4A5568',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#EF4444', fontFamily: 'system-ui' }}>N</span>
                  <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>S</span>
                  <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>W</span>
                  <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 7, fontWeight: 600, color: '#94A3B8', fontFamily: 'system-ui' }}>E</span>
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: 2,
                      height: 20,
                      transformOrigin: '50% 100%',
                      transform: `translate(-50%, -100%) rotate(${-compassBearing}deg)`,
                    }}
                  >
                    <div style={{ width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: '12px solid #EF4444', margin: '0 auto' }} />
                    <div style={{ width: 0, height: 0, borderLeft: '2.5px solid transparent', borderRight: '2.5px solid transparent', borderTop: '8px solid #94A3B8', margin: '0 auto' }} />
                  </div>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: '50%', background: '#D4621A', transform: 'translate(-50%, -50%)' }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#3B82F6', fontWeight: 600 }}>
                  {Math.round(compassBearing)}°
                </span>
              </div>
            )}

            {/* North-Up button */}
            <div
              style={{
                position: 'fixed',
                bottom: `calc(env(safe-area-inset-bottom) + 136px + var(--direct-to-offset, 0px))`,
                right: 8,
                zIndex: 60,
                pointerEvents: 'auto',
              }}
            >
              <button
                onClick={() => {
                  const next = !trackUp;
                  setTrackUp(next);
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

            {/* Disclaimer — dark amber, dismissible, bottom-center */}
            {!disclaimerDismissed && (
              <div
                style={{
                  position: 'fixed',
                  bottom: `calc(env(safe-area-inset-bottom) + 200px)`,
                  left: '50%',
                  transform: 'translate(-50%, 0)',
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
          </>
        )}

        {/* Build info easter egg */}
        {showBuildInfo && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              cursor: 'pointer',
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
                {BUILD_VERSION || 'dev build'}
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

        {/* Page content overlay */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>

        <MapLegend />
      </main>
      <MobileNav />
    </div>
  );
}
