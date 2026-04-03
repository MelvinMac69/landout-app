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

  // Build or update the marker on the map
  function updateMarker(lat: number, lon: number, heading?: number) {
    const map = mapRef.current;
    if (!map) return;

    if (!markerRef.current) {
      // Create heading element (triangle/arrow)
      const el = document.createElement('div');
      el.style.cssText = `
        width: 20px; height: 20px;
        background: #3B82F6; border: 2.5px solid white;
        border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        cursor: pointer;
      `;

      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-bottom: 8px solid #3B82F6;
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

  function handleLocate() {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }

    // If already watching, toggle follow mode or stop
    if (watchId.current !== null) {
      if (followMode) {
        // Turn off follow mode but keep watching
        setFollowMode(false);
        setState('active');
      } else {
        // Stop watching entirely
        stopWatching();
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        setPosition(null);
        setState('idle');
      }
      return;
    }

    // Start acquiring
    setState('acquiring');

    // First get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const heading = pos.coords.heading ?? undefined;
        setPosition({ lat, lon, heading });
        updateMarker(lat, lon, heading);
        setState('active');

        // Center map on first fix
        const map = mapRef.current;
        if (map) {
          map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12), duration: 1000 });
        }

        // Start watching for movement
        watchId.current = navigator.geolocation.watchPosition(
          (p) => {
            const la = p.coords.latitude;
            const lo = p.coords.longitude;
            const h = p.coords.heading ?? undefined;
            setPosition({ lat: la, lon: lo, heading: h });
            updateMarker(la, lo, h);
            setState('active');

            if (followMode && mapRef.current) {
              mapRef.current.panTo([lo, la], { duration: 500 });
            }
          },
          (err) => {
            console.warn('Geolocation error:', err.message);
            if (err.code === err.PERMISSION_DENIED) {
              setState('denied');
              stopWatching();
            }
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
        } else {
          setState('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
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

  // Expose location state to window for DiagnosticsPanel
  useEffect(() => {
    (window as typeof window & { landoutLocationState?: { state: LocState; followMode: boolean; position: { lat: number; lon: number; heading?: number } | null } }).landoutLocationState = {
      state,
      followMode,
      position,
    };
  }, [state, followMode, position]);

  useEffect(() => {
    return () => {
      stopWatching();
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  // Icon SVGs for each state
  const icons: Record<LocState, string> = {
    idle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
    acquiring: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="4 2"/><circle cx="12" cy="12" r="3"/></svg>`,
    active: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" fill="none"/></svg>`,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Main locate button */}
      <button
        onClick={handleLocate}
        title={`${state === 'idle' ? 'Show my location' : state === 'acquiring' ? 'Acquiring GPS…' : state === 'active' ? 'Location active — tap to stop' : state === 'denied' ? 'Location denied' : 'GPS unavailable'}`}
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          background: state === 'active' ? '#EFF6FF' : 'white',
          border: `1.5px solid ${state === 'active' ? '#BFDBFE' : '#E2E8F0'}`,
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

      {/* Follow mode toggle — only show when active */}
      {state === 'active' && (
        <button
          onClick={toggleFollow}
          title={followMode ? 'Stop following (map stays centered)' : 'Follow me (map tracks my position)'}
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
              // Crosshair with dot — "following"
              <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" fill="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></>
            ) : (
              // Static crosshair — "not following"
              <><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></>
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
