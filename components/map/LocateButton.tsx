'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

type LocState = 'idle' | 'acquiring' | 'active' | 'denied' | 'unavailable';

interface LocateButtonProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

export function LocateButton({ mapRef }: LocateButtonProps) {
  const [state, setState] = useState<LocState>('idle');
  const [followMode, setFollowMode] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lon: number; heading?: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // Prevent double-taps during permission dialog on iOS
  const isRequesting = useRef(false);

  /** Stable map accessor — uses window singleton as fallback in case mapRef isn't set yet */
  function getMap(): maplibregl.Map | null {
    if (mapRef.current) return mapRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__landoutMap ?? null;
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

  /** Start live tracking after we have an initial position */
  function startWatching(lat: number, lon: number, heading?: number) {
    stopWatching();
    setPosition({ lat, lon, heading });
    updateMarker(lat, lon, heading);
    setState('active');

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const la = p.coords.latitude;
        const lo = p.coords.longitude;
        const h = p.coords.heading ?? undefined;
        setPosition({ lat: la, lon: lo, heading: h });
        updateMarker(la, lo, h);
        // Use stateRef to avoid stale closure on followMode changes
        if (stateRef.current.followMode) {
          const map = getMap();
          if (map) map.panTo([lo, la], { duration: 500 });
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

    // Prevent double-tap during permission dialog on iOS
    if (isRequesting.current) return;

    // Already tracking — tap = stop
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

    // Already denied — try once more (user may have reset in Settings)
    if (state === 'denied') {
      setState('acquiring');
      isRequesting.current = true;
      try {
        const pos = await getCurrentPositionOnce();
        isRequesting.current = false;
        const { latitude: lat, longitude: lon } = pos.coords;
        const heading = pos.coords.heading ?? undefined;
        const map = getMap();
        if (map) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12), duration: 1000 });
        startWatching(lat, lon, heading);
      } catch {
        isRequesting.current = false;
        // Still denied — stay in denied state
      }
      return;
    }

    setState('acquiring');
    isRequesting.current = true;

    // On iOS Safari: if permission was previously denied (user dismissed prompt without
    // choosing), getCurrentPosition fails immediately with PERMISSION_DENIED before
    // the native dialog can appear. Use the Permissions API to check the current
    // state first — if 'denied', show denied UI without calling getCurrentPosition.
    let permissionState: PermissionState | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (navigator.permissions as any).query({ name: 'geolocation' });
      permissionState = result.state as PermissionState;
    } catch {
      // Permissions API not available — proceed with getCurrentPosition
    }

    if (permissionState === 'denied') {
      isRequesting.current = false;
      setState('denied');
      return;
    }

    // permissionState is 'granted' or 'prompt' (or unknown) — proceed
    try {
      const pos = await getCurrentPositionOnce();
      isRequesting.current = false;
      const { latitude: lat, longitude: lon } = pos.coords;
      const heading = pos.coords.heading ?? undefined;
      const map = getMap();
      if (map) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12), duration: 1000 });
      startWatching(lat, lon, heading);
    } catch (err: unknown) {
      isRequesting.current = false;
      const geolocationErr = err as { code?: number };
      if (geolocationErr.code === 1 /* PERMISSION_DENIED */) {
        setState('denied');
      } else {
        setState('unavailable');
      }
    }
  }

  /** getCurrentPosition as a Promise, timeout 20s */
  function getCurrentPositionOnce(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      // Use low accuracy for initial fix on iOS — faster Time To First Fix,
      // then watchPosition with high accuracy for live tracking
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 20000,
      });
    });
  }

  function toggleFollow() {
    setFollowMode((f) => {
      const next = !f;
      if (next && position) {
        const map = mapRef.current;
        if (map) map.panTo([position.lon, position.lat], { duration: 500 });
      }
      return next;
    });
  }

  // Expose location state to window for BackcountryMap's Direct To feature.
  // Update window IMMEDIATELY on any change (not just on re-render) using a stable ref.
  const stateRef = useRef({ state, followMode, position });
  useEffect(() => {
    stateRef.current = { state, followMode, position };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutLocationState = stateRef.current;
  });
  // Also write on cleanup
  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).landoutLocationState;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopWatching();
      clearMarker();
    };
  }, []);

  const icons: Record<LocState, string> = {
    idle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
    acquiring: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="5 3"/><circle cx="12" cy="12" r="3" fill="#F59E0B"/></svg>`,
    active: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" fill="none" stroke="#3B82F6"/></svg>`,
    denied: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    unavailable: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const stateColors: Record<LocState, string> = {
    idle: '#64748B',
    acquiring: '#F59E0B',
    active: '#3B82F6',
    denied: '#EF4444',
    unavailable: '#94A3B8',
  };

  const buttonTitle =
    state === 'idle' ? 'Show my location' :
    state === 'acquiring' ? 'Acquiring GPS…' :
    state === 'active' ? 'Location active — tap to stop' :
    state === 'denied' ? 'Location denied — tap to retry' :
    'GPS unavailable';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={handleLocate}
        title={buttonTitle}
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          background: state === 'active' ? '#EFF6FF' : state === 'denied' ? '#FEF2F2' : 'white',
          border: `1.5px solid ${state === 'active' ? '#BFDBFE' : state === 'denied' ? '#FECACA' : '#E2E8F0'}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: stateColors[state],
          transition: 'all 0.2s',
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: icons[state] }} />
      </button>

      {/* Follow mode toggle — only visible when tracking */}
      {state === 'active' && (
        <button
          onClick={toggleFollow}
          title={followMode ? 'Stop following' : 'Follow me'}
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: followMode ? '#3B82F6' : 'white',
            border: `1.5px solid ${followMode ? '#2563EB' : '#E2E8F0'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: followMode ? 'white' : '#64748B',
            transition: 'all 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {followMode ? (
              // Filled crosshair — following
              <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" fill="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></>
            ) : (
              // Open crosshair — static
              <><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></>
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
