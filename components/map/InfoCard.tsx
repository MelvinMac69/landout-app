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
  runway_length_ft?: number | null;
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
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    heliport:      { bg: 'rgba(168,85,247,0.15)', text: '#A855F7', border: 'rgba(168,85,247,0.3)' },
    seaplane_base: { bg: 'rgba(59,130,246,0.15)', text: '#58A6FF', border: 'rgba(59,130,246,0.3)' },
    closed:        { bg: 'var(--surface-overlay)', text: 'var(--text-muted)', border: 'var(--border-default)' },
    private:       { bg: 'rgba(198,117,42,0.15)', text: 'var(--accent-primary)', border: 'rgba(198,117,42,0.3)' },
    public:        { bg: 'rgba(34,197,94,0.15)', text: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  };
  const c = colors[type ?? ''] ?? { bg: 'var(--surface-overlay)', text: 'var(--text-secondary)', border: 'var(--border-default)' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {type ?? 'unknown'}
    </span>
  );
}

function RestrictionBadge({ restriction }: { restriction: string }) {
  let emoji = '⚠️';
  let bg = 'rgba(239,68,68,0.12)';
  let text = '#EF4444';
  let border = 'rgba(239,68,68,0.3)';
  let label = 'Restricted — verify before landing';
  if (restriction === 'no-landing') {
    emoji = '🚫';
    bg = 'rgba(239,68,68,0.18)';
    border = 'rgba(239,68,68,0.4)';
  } else if (restriction === 'multiple-use') {
    emoji = '✅';
    bg = 'rgba(34,197,94,0.12)';
    text = '#22C55E';
    border = 'rgba(34,197,94,0.3)';
    label = 'Landing generally OK';
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 12,
      fontWeight: 700,
      background: bg,
      color: text,
      border: `1px solid ${border}`,
    }}>
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

  // Shared card style — dark surface, design tokens
  const cardBase: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 200,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxHeight: 'calc(100vh - 40px)',
  };

  // Airport card: position near click, respect screen edges
  const flipUp = screenY > window.innerHeight - 200;
  const airportStyle: React.CSSProperties = {
    ...cardBase,
    top: flipUp ? screenY - 20 : screenY + 20,
    width: 280,
  };

  // Land card: centered horizontally, slightly below screen center
  const landCardStyle: React.CSSProperties = {
    ...cardBase,
    top: '50%',
    transform: 'translate(-50%, calc(-50% + 80px))',
    width: 240,
  };

  // ── Airport card ─────────────────────────────────────────────────────────
  if (card.type === 'airport') {
    const identifier = card.faa_ident || card.gps_code || card.iata || '—';
    return (
      <div ref={ref} style={airportStyle}>
        {/* Header — accent primary background */}
        <div style={{ background: 'var(--accent-primary)', padding: '12px 14px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-inverse)', fontWeight: 700, fontSize: 15 }}>{card.name || 'Unknown Airport'}</span>
              <TypePill type={card.airportType} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{identifier}{card.iata ? ` / ${card.iata}` : ''} · {capitalize(card.airportType)}</span>
              <button
                onClick={() => copyToClipboard(identifier, setIdCopied)}
                title="Copy identifier"
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  background: idCopied ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: idCopied ? 'white' : 'rgba(255,255,255,0.9)',
                  cursor: 'pointer',
                  minWidth: 40,
                  textAlign: 'center' as const,
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elevation</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{card.elevation_ft.toLocaleString()} ft</span>
            </div>
          )}
          {(card.municipality || card.state) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{[card.municipality, card.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {/* Runway length (or coordinates fallback) + copy */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {card.runway_length_ft ? 'Runway Length' : 'Coordinates'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {card.runway_length_ft ? (
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {card.runway_length_ft.toLocaleString()} ft
                </span>
              ) : (
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {card.lat.toFixed(4)}, {card.lng.toFixed(4)}
                </span>
              )}
              <button
                onClick={() => copyToClipboard(`${card.lat.toFixed(6)}, ${card.lng.toFixed(6)}`, setCoordsCopied)}
                title="Copy coordinates"
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  background: coordsCopied ? 'rgba(34,197,94,0.15)' : 'var(--surface-overlay)',
                  border: `1px solid ${coordsCopied ? '#22C55E' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: coordsCopied ? '#22C55E' : 'var(--text-secondary)',
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
          <Button variant="ghost-dark" size="sm" onClick={onClose}>Close</Button>
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
          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
            {card.name}
          </div>
        )}
        <RestrictionBadge restriction={card.restriction} />
        {/* Coordinates + copy */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordinates</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
              {card.lat.toFixed(4)}, {card.lng.toFixed(4)}
            </span>
            <button
              onClick={() => copyToClipboard(`${card.lat.toFixed(6)}, ${card.lng.toFixed(6)}`, setCoordsCopied)}
              title="Copy coordinates"
              style={{
                fontSize: 10,
                padding: '1px 5px',
                background: coordsCopied ? 'rgba(34,197,94,0.15)' : 'var(--surface-overlay)',
                border: `1px solid ${coordsCopied ? '#22C55E' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-sm)',
                color: coordsCopied ? '#22C55E' : 'var(--text-secondary)',
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