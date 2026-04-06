'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

type LocState = 'idle' | 'acquiring' | 'active' | 'following' | 'denied' | 'unavailable';

interface LocateButtonProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

export function LocateButton({ mapRef }: LocateButtonProps) {
  const [state, setState] = useState<LocState>('idle');
  const [followMode, setFollowMode] = useState(false);
  const [trackUp, setTrackUpState] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lon: number; heading?: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const isRequesting = useRef(false);
  const followModeRef = useRef(false);
  const trackUpRef = useRef(false);

  function getMap(): maplibregl.Map | null {
    // Try mapRef first (set during Map mount), then window fallback
    if (mapRef.current) return mapRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winMap = (window as any).__landoutMap ?? null;
    if (winMap) return winMap;
    return null;
  }

  function updateMarker(lat: number, lon: number, heading?: number) {
    const map = getMap();
    if (!map) return;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 22px; height: 22px;
        background: #3B82F6; border: 2.5px solid white;
        border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      `;
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-bottom: 9px solid #3B82F6;
      `;
      el.appendChild(arrow);
      markerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([lon, lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([lon, lat]);
    }

    if (heading !== undefined && heading !== null) {
      markerRef.current.setRotation(heading);
      markerRef.current.setRotationAlignment('map');
    } else {
      markerRef.current.setRotationAlignment('viewport');
    }
  }

  function stopWatching() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }

  function clearMarker() {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }

  function applyTrackUp(on: boolean) {
    trackUpRef.current = on;
    setTrackUpState(on);
    const map = getMap();
    if (!map) return;
    if (on && position?.heading !== undefined) {
      map.setBearing(position.heading);
    } else {
      map.setBearing(0);
    }
  }

  function startWatching(lat: number, lon: number, heading?: number) {
    stopWatching();
    setPosition({ lat, lon, heading });
    updateMarker(lat, lon, heading);
    followModeRef.current = true;
    setFollowMode(true);
    setState('active');

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const la = p.coords.latitude;
        const lo = p.coords.longitude;
        const h = p.coords.heading ?? undefined;
        setPosition({ lat: la, lon: lo, heading: h });
        updateMarker(la, lo, h);
        const map = getMap();
        if (followModeRef.current && map) {
          map.panTo([lo, la], { duration: 500 });
          if (trackUpRef.current && h !== undefined) {
            map.setBearing(h);
          }
        }
      },
      (err) => {
        console.warn('watchPosition error:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
          stopWatching();
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
  }

  async function handleLocate() {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }
    if (isRequesting.current) return;

    if (watchId.current !== null) {
      if (followMode) {
        setFollowMode(false);
        setState('active');
      } else {
        stopWatching();
        clearMarker();
        setPosition(null);
        setState('idle');
      }
      return;
    }

    if (state === 'denied') {
      setState('acquiring');
      isRequesting.current = true;
      try {
        const pos = await getCurrentPositionOnce();
        isRequesting.current = false;
        const { latitude: lat, longitude: lon, heading } = pos.coords;
        const map = getMap();
        if (map) {
          // flyTo queues safely even if map not fully loaded
          try { map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 }); } catch (e) {
            // If flyTo fails (map not ready), try once it is
            map.once('idle', () => { try { map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 }); } catch {} });
          }
        }
        startWatching(lat, lon, heading ?? undefined);
      } catch {
        isRequesting.current = false;
      }
      return;
    }

    setState('acquiring');
    isRequesting.current = true;

    let permissionState: PermissionState | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (navigator.permissions as any).query({ name: 'geolocation' });
      permissionState = result.state as PermissionState;
    } catch { /* Permissions API not available */ }

    if (permissionState === 'denied') {
      isRequesting.current = false;
      setState('denied');
      return;
    }

    try {
      const pos = await getCurrentPositionOnce();
      isRequesting.current = false;
      const { latitude: lat, longitude: lon, heading } = pos.coords;
      const map = getMap();
      if (map) {
        const zoomFn = () => map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 });
        if (map.loaded()) zoomFn();
        else map.once('idle', zoomFn);
      }
      startWatching(lat, lon, heading ?? undefined);
    } catch (err: unknown) {
      isRequesting.current = false;
      const geolocationErr = err as { code?: number };
      setState(geolocationErr.code === 1 ? 'denied' : 'unavailable');
    }
  }

  function getCurrentPositionOnce(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, maximumAge: 0, timeout: 20000,
      });
    });
  }

  // Listen for track-up toggle from page.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyTrackUp((e as any).detail ?? false);
    };
    window.addEventListener('landoutSetTrackUp', handler);
    return () => window.removeEventListener('landoutSetTrackUp', handler);
  }, []);

  // Expose location state to window
  const stateRef = useRef({ state, followMode, position, trackUp });
  useEffect(() => {
    stateRef.current = { state, followMode, position, trackUp };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutLocationState = stateRef.current;
  });

  useEffect(() => {
    return () => {
      stopWatching();
      clearMarker();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).landoutLocationState;
    };
  }, []);

  const icons: Record<LocState, string> = {
    idle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
    acquiring: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="5 3"/><circle cx="12" cy="12" r="3" fill="#F59E0B"/></svg>`,
    active: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" fill="none" stroke="#3B82F6"/></svg>`,
    following: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" fill="white"/><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>`,
    denied: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    unavailable: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const stateColors: Record<LocState, string> = {
    idle: '#718096',
    acquiring: '#D4621A',
    active: '#C9B99A',
    following: '#D4621A',
    denied: '#EF4444',
    unavailable: '#718096',
  };

  const buttonTitle =
    state === 'idle' ? 'Show my location' :
    state === 'acquiring' ? 'Acquiring GPS…' :
    state === 'following' ? 'Following — tap to stop' :
    state === 'active' ? 'Location active — tap to stop' :
    state === 'denied' ? 'Location denied — tap to retry' :
    'GPS unavailable';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={handleLocate}
        title={buttonTitle}
        style={{
          width: 42, height: 42, borderRadius: 8,
          background: followMode ? '#1A202C' : state === 'active' ? '#2D3748' : state === 'denied' ? '#2D3748' : '#1A202C',
          border: `1.5px solid ${followMode ? '#D4621A' : state === 'active' ? '#D4621A' : state === 'denied' ? '#EF4444' : '#4A5568'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: followMode ? '#D4621A' : state === 'active' ? '#C9B99A' : state === 'denied' ? '#EF4444' : '#718096',
          transition: 'all 0.2s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={followMode ? '#1A202C' : 'none'} stroke={followMode ? 'white' : stateColors[state]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {state === 'acquiring' ? (
            <><circle cx="12" cy="12" r="10" strokeDasharray="5 3"/><circle cx="12" cy="12" r="3" fill="#F59E0B" stroke="none"/></>
          ) : state === 'denied' ? (
            <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>
          ) : state === 'unavailable' ? (
            <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
          ) : (
            <>
              <circle cx="12" cy="12" r={followMode ? 4 : 3} fill={followMode ? 'white' : 'none'} />
              <line x1="12" y1="2" x2="12" y2={followMode ? 4 : 6}/>
              <line x1="12" y1={followMode ? 20 : 18} x2="12" y2="22"/>
              <line x1="2" y1="12" x2={followMode ? 4 : 6} y2="12"/>
              <line x1={followMode ? 20 : 18} y1="12" x2="22" y2="12"/>
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
