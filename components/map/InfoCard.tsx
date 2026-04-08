'use client';

import { useEffect, useRef, useState } from 'react';
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
  /** Called when closing by clicking/tapping outside the card — suppresses next open */
  onCloseOutside?: () => void;
  onDirectTo: (lng: number, lat: number, name?: string) => void;
  onDropPin?: (lng: number, lat: number) => void;
}

function capitalize(str?: string): string {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypePill({ type }: { type?: string }) {
  const colors: Record<string, string> = {
    heliport: 'bg-purple-100 text-purple-700',
    seaplane_base: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-500',
    private: 'bg-amber-100 text-amber-700',
    public: 'bg-green-100 text-green-700',
  };
  const cls = colors[type ?? ''] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {type ?? 'unknown'}
    </span>
  );
}

function RestrictionBadge({ restriction }: { restriction: string }) {
  let emoji = '⚠️';
  let cls = 'bg-red-50 text-red-700 border border-red-200';
  let label = 'Restricted — verify before landing';
  if (restriction === 'no-landing') {
    emoji = '🚫';
    cls = 'bg-red-100 text-red-700 border border-red-200';
    label = 'No landing';
  } else if (restriction === 'multiple-use') {
    emoji = '✅';
    cls = 'bg-green-100 text-green-700 border border-green-200';
    label = 'Landing generally OK';
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${cls}`}>
      {emoji} {label}
    </span>
  );
}

export function InfoCard({ card, screenX, screenY, onClose, onCloseOutside, onDirectTo, onDropPin }: InfoCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [idCopied, setIdCopied] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);

  async function copyToClipboard(text: string, setFn: React.Dispatch<React.SetStateAction<boolean>>) {
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea');
      el.value = text; el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setFn(true);
    setTimeout(() => setFn(false), 1500);
  }

  // Desktop: close on mousedown outside card — tells parent whether it was outside-click
  useEffect(() => {
    function handler(ev: MouseEvent) {
      if (!ref.current) return;
      // If clicking inside the card (including the X button), don't suppress next open
      if (ref.current.contains(ev.target as Node)) return;
      // Outside click — tell parent to suppress the next map-click from opening a card
      onCloseOutside?.();
    }
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [onCloseOutside]);

  // Airport card: position near click, respect screen edges
  const flipUp = screenY > window.innerHeight - 200;
  const flipLeft = screenX > window.innerWidth - 200;
  const airportStyle: React.CSSProperties = {
    position: 'fixed',
    top: flipUp ? screenY - 20 : screenY + 20,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 280,
    zIndex: 200,
    background: 'white',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  };

  // Land card: centered horizontally, slightly below screen center
  const landCardStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, calc(-50% + 80px))',
    width: 240,
    zIndex: 200,
    background: 'white',
    borderRadius: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  };

  // ── Airport card ─────────────────────────────────────────────────────────
  if (card.type === 'airport') {
    const identifier = card.faa_ident || card.gps_code || card.iata || '—';
    return (
      <div ref={ref} style={airportStyle}>
        <div style={{ background: '#D4621A', padding: '12px 14px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{card.name || 'Unknown Airport'}</span>
              <TypePill type={card.airportType} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{identifier}{card.iata ? ` / ${card.iata}` : ''} · {capitalize(card.airportType)}</span>
              <button
                onClick={() => copyToClipboard(identifier, setIdCopied)}
                title="Copy identifier"
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  background: idCopied ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 4,
                  color: idCopied ? 'white' : 'rgba(255,255,255,0.9)',
                  cursor: 'pointer',
                  minWidth: 40,
                  textAlign: 'center',
                }}
              >
                {idCopied ? '✓ Copied!' : '📋'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          {/* Coordinates + copy */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordinates</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
                {card.lat.toFixed(4)}, {card.lng.toFixed(4)}
              </span>
              <button
                onClick={() => copyToClipboard(`${card.lat.toFixed(6)}, ${card.lng.toFixed(6)}`, setCoordsCopied)}
                title="Copy coordinates"
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  background: coordsCopied ? '#dcfce7' : '#f1f5f9',
                  border: `1px solid ${coordsCopied ? '#86efac' : '#cbd5e1'}`,
                  borderRadius: 4,
                  color: coordsCopied ? '#16a34a' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {coordsCopied ? '✓' : '📋'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '8px 14px 14px', display: 'flex', gap: 8 }}>
          <Button variant="aviation" size="sm" onClick={() => onDirectTo(card.lng, card.lat, card.name)} className="flex-1">
            ✈ Direct To
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  // ── Land info card — compact, centered, agency/label + restriction ────────

  // Determine stripe color from restriction
  const stripeColor = card.restriction === 'no-landing'
    ? '#991B1B'
    : card.restriction === 'restricted'
      ? '#92400E'
      : '#166534';

  // Build header label — prefer label (Wilderness, WSA, Wildlife Refuge, etc.), fallback to agency
  const headerLabel = card.label || card.agency;

  return (
    <div ref={ref} style={landCardStyle}>
      {/* Header — colored stripe with agency/label */}
      <div style={{
        background: stripeColor,
        padding: '10px 12px 9px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
          {headerLabel}
        </div>
        {card.label && card.agency && card.label !== card.agency && (
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
            {card.agency}
          </div>
        )}
      </div>

      {/* Body — land name + restriction badge + coordinates */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {card.name && (
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, fontWeight: 500 }}>
            {card.name}
          </div>
        )}
        <RestrictionBadge restriction={card.restriction} />
        {/* Coordinates + copy */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordinates</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
              {card.lat.toFixed(4)}, {card.lng.toFixed(4)}
            </span>
            <button
              onClick={() => copyToClipboard(`${card.lat.toFixed(6)}, ${card.lng.toFixed(6)}`, setCoordsCopied)}
              title="Copy coordinates"
              style={{
                fontSize: 10,
                padding: '1px 5px',
                background: coordsCopied ? '#dcfce7' : '#f1f5f9',
                border: `1px solid ${coordsCopied ? '#86efac' : '#cbd5e1'}`,
                borderRadius: 4,
                color: coordsCopied ? '#16a34a' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {coordsCopied ? '✓' : '📋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
