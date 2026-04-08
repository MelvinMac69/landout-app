'use client';

import { useEffect, useRef, useState } from 'react';
import { haversineDistance } from '@/lib/utils/geo';

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function calcDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const miles = haversineDistance(lat1, lon1, lat2, lon2);
  return miles * 0.868976; // miles to NM
}

interface DirectToDest {
  lng: number;
  lat: number;
  name?: string;
  type: 'map' | 'airport' | 'pin';
}

interface DirectToPanelProps {
  dest: DirectToDest;
  currentPos: { lat: number; lon: number; heading?: number } | null;
  onClear: () => void;
  onRecenter?: () => void;
}

function formatETE(distanceNm: number, groundSpeedKts: number): string {
  if (!groundSpeedKts || groundSpeedKts <= 0) return '—';
  const hours = distanceNm / groundSpeedKts;
  if (hours < 0.1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDist(nm: number): string {
  if (nm < 0.1) return `${Math.round(nm * 5280)} ft`;
  if (nm < 10) return `${nm.toFixed(1)} NM`;
  return `${Math.round(nm)} NM`;
}

export function DirectToPanel({ dest, currentPos, onClear, onRecenter }: DirectToPanelProps) {
  const [visible, setVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);
  const prevDestRef = useRef<DirectToDest | null>(null);

  useEffect(() => {
    // Animate in
    const isNew = !prevDestRef.current;
    prevDestRef.current = dest;

    if (isNew) {
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        setVisible(true);
        setBottomVisible(true);
      });
    }
  }, [dest]);

  function handleClear() {
    setVisible(false);
    setBottomVisible(false);
    setTimeout(onClear, 300);
  }

  // Calculate values
  const destLabel = dest.name || formatCoord(dest.lat, dest.lng);
  const distanceNm = currentPos
    ? calcDistanceNm(currentPos.lat, currentPos.lon, dest.lat, dest.lng)
    : null;
  // Ground speed in knots from heading-bearing approximation using position deltas
  const gsKts = currentPos?.heading ?? null; // heading ≈ track when moving
  const ete = distanceNm != null && gsKts ? formatETE(distanceNm, gsKts) : '—';

  return (
    <>
      {/* ── Top data panel — slides down from top ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 70,
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          background: 'rgba(26,32,44,0.97)',
          borderBottom: '1.5px solid #D4621A',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          padding: 'calc(10px + env(safe-area-inset-top)) 14px 8px',
        }}
      >
        {/* Destination name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: '#D4621A' }}>✈</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'system-ui' }}>
              {destLabel}
            </span>
          </div>
          <button
            onClick={handleClear}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: '#94A3B8',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            END
          </button>
        </div>

        {/* Data row */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Distance */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Distance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
              {distanceNm != null ? formatDist(distanceNm) : '—'}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* ETE */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>ETE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
              {ete}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* Ground Speed */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>GS</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
              {gsKts != null ? `${Math.round(gsKts)} kts` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom cancel button — slides up from behind nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 67px)',
          right: 78,
          zIndex: 25,
          transform: bottomVisible ? 'translateY(0)' : 'translateY(80px)',
          opacity: bottomVisible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease',
        }}
      >
        <button
          onClick={handleClear}
          style={{
            padding: '8px 16px',
            background: 'rgba(26,32,44,0.95)',
            border: '1.5px solid #EF4444',
            borderRadius: 8,
            color: '#EF4444',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            letterSpacing: '0.05em',
          }}
        >
          ✕ Cancel Nav
        </button>
      </div>
    </>
  );
}
export function ActionMenu({
  x,
  y,
  lat,
  lng,
  items,
  onClose,
}: {
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  items: { label: string; icon: string; onClick: () => void; color?: string }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

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

  async function copyCoords() {
    const text = `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const totalRows = items.length + (lat != null ? 1 : 0);
  // Determine position: if y > 60% of screen height, flip menu up
  const isHigh = y > window.innerHeight * 0.6;
  // 36px per row for menu items + 32px for coords header
  const headerPx = lat != null ? 32 : 0;
  const rowPx = 36;
  const menuHeight = headerPx + rowPx * items.length;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: isHigh ? y - menuHeight - 8 : y + 8,
        left: Math.min(x, window.innerWidth - 160),
        zIndex: 200,
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        padding: '4px 0',
        minWidth: 140,
      }}
    >
      {/* Coordinates row at top */}
      {lat != null && lng != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 14px',
            borderBottom: items.length > 0 ? '1px solid #f1f5f9' : 'none',
            marginBottom: items.length > 0 ? 2 : 0,
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
          <button
            onClick={copyCoords}
            title="Copy coordinates"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: copied ? '#dcfce7' : '#f1f5f9',
              border: `1px solid ${copied ? '#86efac' : '#cbd5e1'}`,
              borderRadius: 4,
              color: copied ? '#16a34a' : '#64748b',
              cursor: 'pointer',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      )}
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
