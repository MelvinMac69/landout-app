'use client';

import { useEffect, useRef, useState } from 'react';

interface DirectToDest {
  lng: number;
  lat: number;
  name?: string;
  type: 'airport' | 'pin' | 'map';
}

interface DroppedPin {
  id: string;
  lng: number;
  lat: number;
  name?: string;
}

interface CurrentPos {
  lat: number;
  lon: number;
  heading?: number;
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (d: number) => (d * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(x, y));
  return (brng + 360) % 360;
}

function calcDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatBearing(b: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(b / 22.5) % 16;
  return `${dirs[idx]} ${Math.round(b).toString().padStart(3, '0')}°`;
}

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function formatDist(nm: number): string {
  if (nm < 0.1) return `${Math.round(nm * 6080)} ft`;
  if (nm < 10) return `${nm.toFixed(1)} NM`;
  return `${Math.round(nm)} NM`;
}

export function DirectToPanel({
  dest,
  currentPos,
  onClear,
  onRecenter,
}: {
  dest: DirectToDest;
  currentPos: CurrentPos | null;
  onClear: () => void;
  onRecenter?: () => void;
}) {
  const [pos, setPos] = useState<CurrentPos | null>(currentPos);
  const [bearing, setBearing] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => { setPos(currentPos); }, [currentPos]);

  useEffect(() => {
    if (!pos) return;
    const b = calcBearing(pos.lat, pos.lon, dest.lat, dest.lng);
    const d = calcDistanceNm(pos.lat, pos.lon, dest.lat, dest.lng);
    setBearing(b);
    setDistance(d);
  }, [pos, dest.lat, dest.lng]);

  const destLabel = dest.name || formatCoord(dest.lat, dest.lng);
  const destSubLabel = dest.name ? formatCoord(dest.lat, dest.lng) : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        width: '90%',
        maxWidth: 320,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        padding: '10px 14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: '#BE185D', fontWeight: 700 }}>✈ Direct To</span>
        </div>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94A3B8',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 2px',
          }}
          title="Clear Direct To"
        >
          ✕
        </button>
      </div>

      {/* Destination */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 2 }}>
        {destLabel}
      </div>
      {destSubLabel && (
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>{destSubLabel}</div>
      )}

      {/* Bearing + distance row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        {pos ? (
          <>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bearing</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#BE185D', fontVariantNumeric: 'tabular-nums' }}>
                {bearing != null ? formatBearing(bearing) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                {distance != null ? formatDist(distance) : '—'}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#F59E0B', fontStyle: 'italic' }}>
            Waiting for GPS position…
          </div>
        )}
      </div>

      {/* GPS status + recenter */}
      {pos && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, color: '#10B981' }}>● GPS locked</div>
          {onRecenter && (
            <button
              onClick={onRecenter}
              style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', textDecoration: 'underline', padding: 0 }}
            >Recenter</button>
          )}
        </div>
      )}
    </div>
  );
}

// Compact bottom-sheet action menu for long-press
export function ActionMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; icon: string; onClick: () => void; color?: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    // Delay to avoid immediately closing from the same event that opened it
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  // Determine position: if y > 60% of screen height, flip menu up
  const isHigh = y > window.innerHeight * 0.6;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: isHigh ? y - 44 * items.length - 8 : y + 8,
        left: Math.min(x, window.innerWidth - 160),
        zIndex: 200,
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        padding: '4px 0',
        minWidth: 140,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: item.color || '#1E293B',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
