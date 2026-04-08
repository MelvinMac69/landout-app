'use client';

import { useEffect, useRef, useState } from 'react';
import { point, polygon, booleanPointInPolygon } from '@turf/turf';

// Land overlay data
type LandOverlay = {
  name: string;
  color: string;
  label: string;
};

type Position = {
  lat: number;
  lon: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
};

type LandStatus = LandOverlay | null;

async function loadLandData(): Promise<{
  blm: GeoJSON.FeatureCollection | null;
  usfs: GeoJSON.FeatureCollection | null;
  nps: GeoJSON.FeatureCollection | null;
  fws: GeoJSON.FeatureCollection | null;
  wilderness: GeoJSON.FeatureCollection | null;
  fsWilderness: GeoJSON.FeatureCollection | null;
  wsa: GeoJSON.FeatureCollection | null;
}> {
  try {
    const [blm, usfs, nps, fws, wilderness, fsWilderness, wsa] = await Promise.all([
      fetch('/data/sma-blm.geojson').then(r => r.json()),
      fetch('/data/sma-usfs.geojson').then(r => r.json()),
      fetch('/data/sma-nps.geojson').then(r => r.json()),
      fetch('/data/sma-fws.geojson').then(r => r.json()),
      fetch('/data/wilderness.geojson').then(r => r.json()),
      fetch('/data/fs-wilderness.geojson').then(r => r.json()),
      fetch('/data/wsa.geojson').then(r => r.json()),
    ]);
    return { blm, usfs, nps, fws, wilderness, fsWilderness, wsa };
  } catch {
    return { blm: null, usfs: null, nps: null, fws: null, wilderness: null, fsWilderness: null, wsa: null };
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
    } catch { /* skip */ }
  }
  return null;
}

function checkLandStatus(lat: number, lon: number, landData: Awaited<ReturnType<typeof loadLandData>>): LandStatus {
  try {
    const pt = point([lon, lat]);

    // Red: Wilderness (BLM or USFS) / WSA = no-go federal restricted
    if (pointInAny(pt, landData.wilderness)) return { name: 'wilderness', color: '#DC2626', label: 'Wilderness' };
    if (pointInAny(pt, landData.fsWilderness)) return { name: 'fs-wilderness', color: '#DC2626', label: 'Wilderness' };
    if (pointInAny(pt, landData.wsa)) return { name: 'wsa', color: '#DC2626', label: 'WSA' };

    // Green: BLM / USFS / NPS / FWS = open multiple-use federal land
    if (pointInAny(pt, landData.blm)) return { name: 'blm', color: '#16A34A', label: 'BLM' };
    if (pointInAny(pt, landData.usfs)) return { name: 'usfs', color: '#16A34A', label: 'USFS' };
    if (pointInAny(pt, landData.nps)) return { name: 'nps', color: '#16A34A', label: 'NPS' };
    if (pointInAny(pt, landData.fws)) return { name: 'fws', color: '#16A34A', label: 'FWS' };

    // Orange: not in any federal overlay = private land
    return { name: 'private', color: '#D97706', label: 'Private' };
  } catch {
    return { name: 'private', color: '#D97706', label: 'Private' };
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
  const [landStatus, setLandStatus] = useState<LandStatus>({ name: 'private', color: '#D97706', label: 'Private' });
  const [speedUnit, setSpeedUnit] = useState<'kts' | 'mph'>('kts');
  const [isVisible, setIsVisible] = useState(false);
  const landDataRef = useRef<Awaited<ReturnType<typeof loadLandData>> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  // Load land overlay data once
  useEffect(() => {
    loadLandData().then(data => { landDataRef.current = data; });
  }, []);

  // Measure height and fire event when visible
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0 && h !== lastHeightRef.current) {
          lastHeightRef.current = h;
          window.dispatchEvent(new CustomEvent('landoutDataDashboardHeight', { detail: h }));
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Listen for position updates from LocateButton
  useEffect(() => {
    function onPositionUpdate(e: Event) {
      const pos = (e as CustomEvent<Position>).detail;
      setPosition(pos);
      setIsVisible(true);
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

  // Full bright backgrounds per land status
  const statusBg = landStatus?.name === 'wilderness' || landStatus?.name === 'fs-wilderness' || landStatus?.name === 'wsa'
    ? '#DC2626'  // bright red for no-go
    : landStatus?.name === 'blm' || landStatus?.name === 'usfs' || landStatus?.name === 'nps' || landStatus?.name === 'fws'
    ? '#16A34A'  // bright green for open
    : '#D97706'; // bright orange for private

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease',
        paddingTop: 'calc(8px + env(safe-area-inset-top))',
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        background: statusBg,
        borderBottom: `3px solid #000000`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Speed */}
        <div
          onClick={() => setSpeedUnit(u => u === 'kts' ? 'mph' : 'kts')}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#000000',
            cursor: 'pointer',
            userSelect: 'none',
            minWidth: 64,
          }}
          title="Tap to toggle kts/mph"
        >
          {formatSpeed(speed, speedUnit)}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.25)' }} />

        {/* Altitude */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>
          {formatAltitude(altitude)}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Land status label */}
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#000000',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {landStatus?.label ?? 'Private'}
        </span>
      </div>
    </div>
  );
}
