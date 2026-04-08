'use client';

import { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { point, polygon, booleanPointInPolygon } from '@turf/turf';

// Land overlay data — loaded once at module level
type LandOverlay = {
  name: string;
  color: string; // CSS color
  label: string;
};

type Position = {
  lat: number;
  lon: number;
  altitude?: number | null; // meters
  speed?: number | null; // m/s
  heading?: number | null;
};

type LandStatus = LandOverlay | null;

// Load GeoJSON data for point-in-polygon checks
async function loadLandData(): Promise<{
  blm: GeoJSON.FeatureCollection | null;
  usfs: GeoJSON.FeatureCollection | null;
  nps: GeoJSON.FeatureCollection | null;
  fws: GeoJSON.FeatureCollection | null;
  wilderness: GeoJSON.FeatureCollection | null;
  wsa: GeoJSON.FeatureCollection | null;
}> {
  try {
    const [blm, usfs, nps, fws, wilderness, wsa] = await Promise.all([
      fetch('/data/sma-blm.geojson').then(r => r.json()),
      fetch('/data/sma-usfs.geojson').then(r => r.json()),
      fetch('/data/sma-nps.geojson').then(r => r.json()),
      fetch('/data/sma-fws.geojson').then(r => r.json()),
      fetch('/data/wilderness.geojson').then(r => r.json()),
      fetch('/data/wsa.geojson').then(r => r.json()),
    ]);
    return { blm, usfs, nps, fws, wilderness, wsa };
  } catch {
    return { blm: null, usfs: null, nps: null, fws: null, wilderness: null, wsa: null };
  }
}

function pointInAny(pt: ReturnType<typeof point>, data: GeoJSON.FeatureCollection | null): GeoJSON.Feature | null {
  if (!data) return null;
  for (const feature of data.features) {
    try {
      const geom = feature.geometry;
      if (geom.type === 'Polygon') {
        if (booleanPointInPolygon(pt, polygon(geom.coordinates))) return feature;
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          if (booleanPointInPolygon(pt, polygon(poly))) return feature;
        }
      }
    } catch { /* skip invalid geometry */ }
  }
  return null;
}

function checkLandStatus(lat: number, lon: number, landData: Awaited<ReturnType<typeof loadLandData>>): LandStatus {
  try {
    const pt = point([lon, lat]);

    // Check in priority order (most restrictive first)
    if (pointInAny(pt, landData.blm)) {
      return { name: 'blm', color: '#DC2626', label: 'BLM' };
    }
    if (pointInAny(pt, landData.usfs)) {
      return { name: 'usfs', color: '#DC2626', label: 'USFS' };
    }
    if (pointInAny(pt, landData.nps)) {
      return { name: 'nps', color: '#DC2626', label: 'NPS' };
    }
    if (pointInAny(pt, landData.fws)) {
      return { name: 'fws', color: '#DC2626', label: 'FWS' };
    }
    if (pointInAny(pt, landData.wilderness)) {
      return { name: 'wilderness', color: '#DC2626', label: 'Wilderness' };
    }
    if (pointInAny(pt, landData.wsa)) {
      return { name: 'wsa', color: '#D97706', label: 'WSA' };
    }

    // Not in any restricted overlay — treat as open
    return { name: 'open', color: '#16A34A', label: 'Open' };
  } catch {
    return { name: 'open', color: '#16A34A', label: 'Open' };
  }
}

function formatSpeed(speedMps: number | null | undefined, unit: 'kts' | 'mph'): string {
  if (speedMps == null || isNaN(speedMps)) return unit === 'kts' ? '0 kts' : '0 mph';
  const kts = speedMps * 1.94384;
  if (unit === 'kts') return `${Math.round(kts)} kts`;
  const mph = speedMps * 2.23694;
  return `${Math.round(mph)} mph`;
}

function formatAltitude(altMeters: number | null | undefined): string {
  if (altMeters == null || isNaN(altMeters)) return '— ft';
  const ft = altMeters * 3.28084;
  return `${Math.round(ft).toLocaleString()} ft`;
}

export function DataDashboard() {
  const [position, setPosition] = useState<Position | null>(null);
  const [landStatus, setLandStatus] = useState<LandStatus>({ name: 'open', color: '#16A34A', label: 'Open' });
  const [speedUnit, setSpeedUnit] = useState<'kts' | 'mph'>('kts');
  const landDataRef = useRef<Awaited<ReturnType<typeof loadLandData>> | null>(null);

  // Load land overlay data once
  useEffect(() => {
    loadLandData().then(data => { landDataRef.current = data; });
  }, []);

  // Listen for position updates from BackcountryMap
  useEffect(() => {
    function onPositionUpdate(e: Event) {
      const pos = (e as CustomEvent<Position>).detail;
      setPosition(pos);
      // Check land status
      if (pos && pos.lat != null && pos.lon != null && landDataRef.current) {
        const status = checkLandStatus(pos.lat, pos.lon, landDataRef.current);
        setLandStatus(status);
      }
    }
    window.addEventListener('landoutPositionUpdate', onPositionUpdate);
    return () => window.removeEventListener('landoutPositionUpdate', onPositionUpdate);
  }, []);

  const speed = position?.speed ?? null;
  const altitude = position?.altitude ?? null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 67px)',
        left: 8,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      {/* Land status — color-coded by overlay */}
      <div
        onClick={() => {}} // future: could show overlay name
        style={{
          background: '#141414',
          border: `1.5px solid ${landStatus?.color ?? '#16A34A'}`,
          borderRadius: 8,
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: landStatus?.color ?? '#16A34A',
          textAlign: 'center',
          minWidth: 72,
          boxShadow: `0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)`,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {landStatus?.label ?? 'Open'}
      </div>

      {/* Speed + Altitude */}
      <div
        style={{
          background: '#141414',
          border: '1.5px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '5px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
          minWidth: 80,
        }}
      >
        {/* Speed — tap to toggle kts/mph */}
        <div
          onClick={() => setSpeedUnit(u => u === 'kts' ? 'mph' : 'kts')}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#F97316', // aviation orange
            cursor: 'pointer',
            userSelect: 'none',
            lineHeight: 1.2,
          }}
          title="Tap to toggle kts/mph"
        >
          {formatSpeed(speed, speedUnit)}
        </div>

        {/* Altitude */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#94A3B8',
            lineHeight: 1.2,
          }}
        >
          {formatAltitude(altitude)}
        </div>
      </div>
    </div>
  );
}
