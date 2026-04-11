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
  const [position, setPosition] = useState<{ lat: number; lon: number; heading?: number; speed?: number; altitude?: number | null } | null>(null);
  const watchId = useRef<number | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const isRequesting = useRef(false);
  const followModeRef = useRef(false);
  const trackUpRef = useRef(false);
  const positionRef = useRef<{ lat: number; lon: number; heading?: number; speed?: number; altitude?: number | null } | null>(null);
  const programmaticRef = useRef(false);
  // Suppresses the next "initial locate" flyTo without affecting hasEverInitiallyLocatedRef.
  // Used when GPS is started programmatically (e.g. dropPin) to avoid fighting the map's flyTo.
  const suppressNextInitialFlyToRef = useRef(false);
  // Timeout handle for clearing programmaticRef without relying on moveend
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the zoom level established by the first LocateButton tap — restored on re-center taps
  const establishedZoomRef = useRef<number>(13);
  // True on the very first position update after locate is pressed
  const initialLocateRef = useRef(false);
  // True after the FIRST-EVER locate zoom completes — prevents zooming on subsequent re-center taps
  const hasEverInitiallyLocatedRef = useRef(false);
  // Track the last map center we set (in screen pixels) so we can measure movement
  const lastSetCenterRef = useRef<{ x: number; y: number } | null>(null);
  // Prevents duplicate GPS starts from concurrent onDirectToGps calls
  const directToGpsStartRef = useRef(false);

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
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
      programmaticTimerRef.current = null;
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
    if (!on && map) {
      // Turning off track-up: reset bearing to north
      map.setBearing(0);
    }
  }

  function startWatching(lat: number, lon: number, heading?: number, speed?: number, altitude?: number | null) {
    stopWatching();
    setPosition({ lat, lon, heading, speed, altitude });
    positionRef.current = { lat, lon, heading, speed, altitude };
    updateMarker(lat, lon, heading);
    // Notify DataDashboard of position update
    window.dispatchEvent(new CustomEvent('landoutPositionUpdate', {
      detail: { lat, lon, heading, speed, altitude }
    }));
    followModeRef.current = true;
    initialLocateRef.current = true; // first update gets the full flyTo treatment
    setFollowMode(true);
    setState('active');

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const la = p.coords.latitude;
        const lo = p.coords.longitude;
        const h = p.coords.heading ?? undefined;
        const s = p.coords.speed ?? undefined; // m/s
        const alt = p.coords.altitude ?? null;
        setPosition({ lat: la, lon: lo, heading: h, speed: s, altitude: alt });
        positionRef.current = { lat: la, lon: lo, heading: h, speed: s, altitude: alt };
        updateMarker(la, lo, h);
        window.dispatchEvent(new CustomEvent('landoutPositionUpdate', {
          detail: { lat: la, lon: lo, heading: h, speed: s, altitude: alt }
        }));
        const map = getMap();
        if (followModeRef.current && map) {
          if (initialLocateRef.current && !hasEverInitiallyLocatedRef.current) {
            if (suppressNextInitialFlyToRef.current) {
              // GPS was started by onStartGpsOnly (dropPin case) — skip flyTo, we already
              // flew to the site. GPS continues as-is.
              // Clear both flags so subsequent GPS fixes go straight to normal tracking
              // (no flyTo, no re-entry into this block).
              suppressNextInitialFlyToRef.current = false;
              initialLocateRef.current = false;
              hasEverInitiallyLocatedRef.current = true;
            } else {
              // FIRST-EVER locate: fly to center AND zoom in — only happens once ever
              initialLocateRef.current = false;
              hasEverInitiallyLocatedRef.current = true;
              programmaticRef.current = true;
              try {
                map.flyTo({ center: [lo, la], zoom: 13, duration: 800 });
              } catch {
                map.setCenter([lo, la]);
                map.zoomTo(13);
              }
              // Track where we set the center so we can measure movement from it
              try {
                lastSetCenterRef.current = map.project([lo, la]);
              } catch { /* ignore */ }
              if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
              programmaticTimerRef.current = setTimeout(() => { programmaticRef.current = false; }, 1000);
            }
          } else {
            // Track-up mode: always keep device centered on screen (map rotates around device)
            // No dead zone — recenter every GPS update to keep device at center
            if (trackUpRef.current) {
              programmaticRef.current = true;
              try { map.setCenter([lo, la]); } catch {}
              requestAnimationFrame(() => { programmaticRef.current = false; });
            } else {
              // North-up mode: only recenter if user has moved significantly off-center
              const DEAD_ZONE_PX = 150;
              const lastCenter = lastSetCenterRef.current;
              const projectedPos = (() => { try { return map.project([lo, la]); } catch { return null; } })();
              if (lastCenter && projectedPos) {
                const dx = projectedPos.x - lastCenter.x;
                const dy = projectedPos.y - lastCenter.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > DEAD_ZONE_PX) {
                  // User has moved significantly — recenter without animation
                  programmaticRef.current = true;
                  map.setCenter([lo, la]);
                  lastSetCenterRef.current = projectedPos;
                  requestAnimationFrame(() => { programmaticRef.current = false; });
                }
                // If within dead zone, do nothing — don't recenter
              }
            }
            // Clear the suppress flag — we've now handled the GPS fix without flying
            suppressNextInitialFlyToRef.current = false;
          }
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
        // Restore following mode (user panned, then tapped to re-center).
        // Don't call setCenter — the watch callback handles recentering on the
        // next GPS tick. Just enable follow and re-initialize dead zone tracking.
        followModeRef.current = true;
        setFollowMode(true);
        setState('following');
        const map = getMap();
        const pos = positionRef.current ?? position;
        if (map && pos) {
          // setCenter() fires movestart synchronously — must set flag BEFORE
          // so the movestart handler sees it and doesn't exit follow mode.
          programmaticRef.current = true;
          if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
          try {
            // Save current zoom then restore established zoom — no animation (unlike flyTo
            // which can interfere with GPS callbacks on iOS via UIWebView timing issues)
            const prevZoom = map.getZoom();
            map.setCenter([pos.lon, pos.lat]);
            map.setZoom(establishedZoomRef.current);
            establishedZoomRef.current = prevZoom;
          } catch {}
          try { lastSetCenterRef.current = map.project([pos.lon, pos.lat]); } catch {}
          // Safety: clear flag after 1s in case moveend never fires (stationary case)
          programmaticTimerRef.current = setTimeout(() => { programmaticRef.current = false; }, 1000);
        }
      }
      return;
    }

    if (state === 'denied') {
      setState('acquiring');
      isRequesting.current = true;
      try {
        const pos = await getCurrentPositionOnce();
        isRequesting.current = false;
        const { latitude: lat, longitude: lon, heading, speed, altitude } = pos.coords;
        const map = getMap();
        if (map) {
          try {
            map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 });
            // Save zoom — subsequent re-center taps will restore to this level
            establishedZoomRef.current = 13;
            // After flyTo animation ends, enforce zoom level
            map.once('moveend', () => { try { if (map.getZoom() < 12) map.zoomTo(13, { duration: 400 }); } catch {} });
          } catch { /* queued */ }
        } else {
          // Map not ready — poll until it is, then flyTo
          let waited = 0;
          const poll = setInterval(() => {
            waited += 100;
            const m = getMap();
            if (m) {
              clearInterval(poll);
              try {
                m.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 });
                establishedZoomRef.current = 13;
                m.once('moveend', () => { try { if (m.getZoom() < 12) m.zoomTo(13, { duration: 400 }); } catch {} });
              } catch {}
            }
            else if (waited >= 5000) { clearInterval(poll); }
          }, 100);
        }
        startWatching(lat, lon, heading ?? undefined, speed ?? undefined, altitude ?? null);
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
      const { latitude: lat, longitude: lon, heading, speed, altitude } = pos.coords;
      const map = getMap();
      if (map) {
        try { map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 }); } catch { /* queued */ }
      } else {
        // Map not ready — poll until it is, then flyTo
        let waited = 0;
        const poll = setInterval(() => {
          waited += 100;
          const m = getMap();
          if (m) { clearInterval(poll); try { m.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 }); } catch {} }
          else if (waited >= 5000) { clearInterval(poll); }
        }, 100);
      }
      startWatching(lat, lon, heading ?? undefined, speed ?? undefined, altitude ?? null);
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


  // Start tracking when DirectTo is set from anywhere in the app
  useEffect(() => {
    function onStartTracking() { handleLocate(); }
    window.addEventListener('landoutStartTracking', onStartTracking);
    // Lightweight GPS start — just starts watch, no marker, no map manipulation
    // Used by BackcountryMap when it needs to show distance to a dropped pin
    function onStartGpsOnly() {
      if (watchId.current !== null) return; // already tracking
      if (!('geolocation' in navigator)) return;
      // Suppress the "initial flyTo" on the next GPS fix — we already flew to the site.
      suppressNextInitialFlyToRef.current = true;
      // Get initial position then start watch.
      // No timeout — on iOS the permission prompt can take time on first use.
      // maximumAge: 60000 reuses a position from the last 60s if available (instant),
      // otherwise waits for a fresh fix. This handles both cold-start and warm-cache cases.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;
          startWatching(lat, lon);
        },
        () => { /* ignore permission denied / unavailable */ },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 0 }
      );
    }
    window.addEventListener('landoutStartGpsTracking', onStartGpsOnly);
    // Direct To GPS — starts GPS without calling handleLocate.
    // Preserves follow/locate state: if locate was ON it stays ON, if OFF it stays OFF.
    // GPS is needed for the magenta line to render, but follow mode is unaffected.
    function onDirectToGps() {
      if (watchId.current !== null) return;
      if (directToGpsStartRef.current) return;
      if (!('geolocation' in navigator)) return;
      suppressNextInitialFlyToRef.current = true;
      directToGpsStartRef.current = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          directToGpsStartRef.current = false;
          const { latitude: lat, longitude: lon } = pos.coords;
          startWatching(lat, lon);
        },
        (err) => {
          directToGpsStartRef.current = false;
          // getCurrentPosition failed — try startWatching anyway.
          // watchPosition will fire when/if GPS becomes available, and the magenta
          // line will render when that first position arrives. This handles iOS cases
          // where getCurrentPosition times out but watchPosition can still get a fix.
          startWatching(positionRef.current?.lat ?? 0, positionRef.current?.lon ?? 0);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 0 }
      );
    }
    window.addEventListener('landoutDirectToGps', onDirectToGps);

    // Check for pending DirectTo GPS request from page.tsx effect that may have
    // fired before this listener was registered (React useEffect ordering: parent
    // effects run before child effects, so the URL-param effect fires before we
    // register this listener). pendingDirectToGps is captured at effect creation

    return () => {
      window.removeEventListener('landoutStartTracking', onStartTracking);
      window.removeEventListener('landoutStartGpsTracking', onStartGpsOnly);
      window.removeEventListener('landoutDirectToGps', onDirectToGps);
    };
  });

  // Expose location state to window
  const stateRef = useRef({ state, followMode, position, trackUp });
  useEffect(() => {
    stateRef.current = { state, followMode, position, trackUp };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).landoutLocationState = stateRef.current;
  });

  // Exit follow mode when user manually pans the map
  useEffect(() => {
    function onMapMoveStart(e: maplibregl.MapMouseEvent) {
      // Skip for our own programmatic movements
      if (e.originalEvent === undefined && programmaticRef.current) return;

      if (!followModeRef.current) return;

      const map = getMap();
      if (!map) return;

      // Track-up mode: ANY user pan exits follow mode immediately.
      // The map is already centered on the device — no dead zone applies.
      // User needs to be able to explore away from their position.
      if (trackUpRef.current) {
        console.log('[Locate] movestart — trackUp on, exiting follow mode');
        followModeRef.current = false;
        setFollowMode(false);
        setState('active');
        return;
      }

      // North-up mode: only exit if user has panned outside the dead zone.
      const pos = positionRef.current;
      if (!pos) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const dz = { left: w * 0.15, right: w * 0.85, top: h * 0.20, bottom: h * 0.80 };
      let screenPt: maplibregl.Point | null = null;
      try { screenPt = map.project([pos.lon, pos.lat]); } catch { return; }
      if (!screenPt) return;
      if (screenPt.x >= dz.left && screenPt.x <= dz.right && screenPt.y >= dz.top && screenPt.y <= dz.bottom) {
        return; // Still inside dead zone — stay in follow mode
      }
      // Outside dead zone — exit follow mode
      console.log('[Locate] movestart — outside dead zone, exiting follow mode');
      followModeRef.current = false;
      setFollowMode(false);
      setState('active');
    }
    const map = getMap();
    if (map) {
      map.on('movestart', onMapMoveStart);
      return () => { map.off('movestart', onMapMoveStart); };
    }
  }, [state]);

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
          background: followMode ? '#141414' : state === 'active' ? '#1A1A1A' : state === 'denied' ? '#1A1A1A' : '#141414',
          border: `1.5px solid ${followMode ? '#D4621A' : state === 'active' ? '#D4621A' : state === 'denied' ? '#EF4444' : '#4A5568'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: followMode ? '#D4621A' : state === 'active' ? '#C9B99A' : state === 'denied' ? '#EF4444' : '#718096',
          transition: 'all 0.2s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={followMode ? '#141414' : 'none'} stroke={followMode ? 'white' : stateColors[state]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
