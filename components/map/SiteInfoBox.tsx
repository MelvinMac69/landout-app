'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SiteInfoData {
  name: string;
  siteId: string;
  lat: number;
  lon: number;
  elev: string;
  runway: string;
  municipality: string;
  state: string;
  type: string;
}

interface Position {
  lat: number;
  lon: number;
}

function haversineNm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(nm: number): string {
  if (nm < 0.5) return `${(nm * 6076).toFixed(0)} ft`;
  if (nm < 10) return `${nm.toFixed(1)} nm`;
  return `${nm.toFixed(0)} nm`;
}

interface SiteInfoBoxProps {
  site: SiteInfoData;
  onClose: () => void;
}

export function SiteInfoBox({ site, onClose }: SiteInfoBoxProps) {
  const router = useRouter();
  const [pos, setPos] = useState<Position | null>(null);

  // Listen for position updates from LocateButton
  useEffect(() => {
    function onPosition(e: Event) {
      const detail = (e as CustomEvent<{ lat: number; lon: number }>).detail;
      if (detail?.lat && detail?.lon) {
        setPos({ lat: detail.lat, lon: detail.lon });
      }
    }
    window.addEventListener('landoutPositionUpdate', onPosition);
    return () => window.removeEventListener('landoutPositionUpdate', onPosition);
  }, []);

  const distance = pos
    ? haversineNm(site.lon, site.lat, pos.lon, pos.lat)
    : null;

  function handleDirectTo() {
    // Use landoutSetDirectTo directly — does NOT open the orange InfoCard,
    // only sets the DirectTo destination and starts GPS tracking.
    // If BackcountryMap hasn't set window.landoutSetDirectTo yet, use the pending
    // flag so it gets picked up when BackcountryMap registers.
    if ((window as any).landoutSetDirectTo) {
      (window as any).landoutSetDirectTo({
        lng: site.lon,
        lat: site.lat,
        name: site.name,
        type: 'map',
      });
    } else {
      // BackcountryMap not ready yet — store as pending
      (window as any).__landoutPendingSetDirectTo = {
        lng: site.lon,
        lat: site.lat,
        name: site.name,
      };
    }
    onClose();
  }

  function handleInfo() {
    router.push(`/sites/${encodeURIComponent(site.siteId)}`);
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 190px)',
        left: 8,
        zIndex: 50,
        width: 240,
        background: 'rgba(20, 20, 20, 0.95)',
        border: '1.5px solid #4A5568',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px 6px',
        borderBottom: '1px solid #4A5568',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#D4621A',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {site.type}
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#F7FAFC',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}>
            {site.name}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#718096',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: 6,
          }}
        >
          ✕
        </button>
      </div>

      {/* Info rows */}
      <div style={{ padding: '6px 10px 8px' }}>
        {/* Distance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#718096' }}>Distance</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F7FAFC' }}>
            {distance !== null ? formatDistance(distance) : '—'}
          </span>
        </div>

        {/* Field elevation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#718096' }}>Elevation</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F7FAFC' }}>
            {site.elev ? `${parseInt(site.elev).toLocaleString()} ft` : '—'}
          </span>
        </div>

        {/* Runway */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#718096' }}>Runway</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F7FAFC' }}>
            {site.runway ? `${parseInt(site.runway).toLocaleString()} ft` : '—'}
          </span>
        </div>

        {/* Identifier */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#718096' }}>Identifier</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F7FAFC', fontFamily: 'monospace' }}>
            {site.siteId || '—'}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleDirectTo}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: '#D4621A',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Direct To
          </button>
          <button
            onClick={handleInfo}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid #4A5568',
              borderRadius: 6,
              color: '#CBD5E1',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Info
          </button>
        </div>
      </div>
    </div>
  );
}
