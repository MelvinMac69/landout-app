'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui';

export interface AirportInfo {
  type: 'airport';
  lng: number;
  lat: number;
  name: string;
  faa_ident?: string;
  gps_code?: string;
  iata?: string;
  airportType?: string;
  elevation_ft?: number;
  municipality?: string;
  state?: string;
}

export interface LandInfo {
  type: 'land';
  lng: number;
  lat: number;
  agency: string;
  label: string;
  name?: string;
  restriction: 'no-landing' | 'restricted' | 'multiple-use';
}

export type InfoCardData = AirportInfo | LandInfo;

interface InfoCardProps {
  card: InfoCardData;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onDirectTo: (lng: number, lat: number, name?: string) => void;
  onDropPin?: (lng: number, lat: number) => void;
}

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function capitalize(str?: string): string {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypePill({ type }: { type?: string }) {
  const t = type?.toLowerCase() ?? '';
  let cls = 'bg-slate-300 text-slate-700';
  if (t.includes('large')) cls = 'bg-landout-aviation text-white';
  else if (t.includes('medium')) cls = 'bg-landout-forest text-white';
  else if (t.includes('small')) cls = 'bg-landout-sand-dark text-landout-charcoal';
  else if (t.includes('seaplane')) cls = 'bg-landout-aviation-light text-white';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${cls}`}>
      {capitalize(type)}
    </span>
  );
}

function RestrictionBadge({ restriction }: { restriction: string }) {
  let emoji = '⚠️';
  let cls = 'bg-amber-100 text-amber-800';
  let label = 'Restricted — verify before landing';
  if (restriction === 'no-landing') { emoji = '🚫'; cls = 'bg-red-100 text-red-700'; label = 'No landing'; }
  else if (restriction === 'multiple-use') { emoji = '✅'; cls = 'bg-green-100 text-green-700'; label = 'Multiple use — landing generally OK'; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${cls}`}>
      {emoji} {label}
    </span>
  );
}

export function InfoCard({ card, screenX, screenY, onClose, onDirectTo, onDropPin }: InfoCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: MouseEvent | TouchEvent) => {
      if (ref.current && !(ref.current as HTMLElement).contains(ev.target as Node)) onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  // Determine flip — if within 200px of bottom, flip up
  const flipUp = screenY > window.innerHeight - 200;
  const flipLeft = screenX > window.innerWidth - 200;

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: flipUp ? screenY - 20 : screenY + 20,
    left: flipLeft ? screenX - 20 : Math.max(8, Math.min(screenX, window.innerWidth - 292)),
    width: 280,
    zIndex: 200,
    background: 'white',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  };

  if (card.type === 'airport') {
    const identifier = card.faa_ident || card.gps_code || card.iata || '—';
    return (
      <div ref={ref} style={cardStyle}>
        {/* Aviation stripe header */}
        <div style={{ background: '#D4621A', padding: '12px 14px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{card.name || 'Unknown Airport'}</span>
              <TypePill type={card.airportType} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 2, flexShrink: 0 }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identifier</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1B3D2F', fontSize: 14 }}>{identifier}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordinates</span>
            <span style={{ fontSize: 12, color: '#475569' }}>{formatCoord(card.lat, card.lng)}</span>
          </div>
          {card.airportType && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</span>
              <span style={{ fontSize: 12, color: '#475569' }}>{capitalize(card.airportType)}</span>
            </div>
          )}
          {card.elevation_ft != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elevation</span>
              <span style={{ fontSize: 12, color: '#475569' }}>{card.elevation_ft.toLocaleString()} ft</span>
            </div>
          )}
          {(card.municipality || card.state) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
              <span style={{ fontSize: 12, color: '#475569' }}>{[card.municipality, card.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 14px 14px', display: 'flex', gap: 8 }}>
          <Button
            variant="aviation"
            size="sm"
            onClick={() => onDirectTo(card.lng, card.lat, card.name)}
            className="flex-1"
          >
            ✈ Direct To
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Land info card
  return (
    <div ref={ref} style={cardStyle}>
      {/* Aviation stripe header */}
      <div style={{ background: '#1B3D2F', padding: '12px 14px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{card.agency}</div>
          {card.label && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{card.label}</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 2, flexShrink: 0 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {card.name && (
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Land Name</div>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{card.name}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Status</div>
          <RestrictionBadge restriction={card.restriction} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Coordinates</div>
          <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{formatCoord(card.lat, card.lng)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '8px 14px 14px', display: 'flex', gap: 8 }}>
        <Button
          variant="aviation"
          size="sm"
          onClick={() => onDirectTo(card.lng, card.lat, card.agency)}
          className="flex-1"
        >
          ✈ Direct To
        </Button>
        {onDropPin && (
          <Button
            variant="forest"
            size="sm"
            onClick={() => { onDropPin(card.lng, card.lat); onClose(); }}
          >
            📍 Pin
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
