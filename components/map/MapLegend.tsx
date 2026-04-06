'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(true);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderClick = () => {
    const win = window as typeof window & { landoutToggleDiagnostics?: () => void };

    if (win.landoutToggleDiagnostics) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current++;
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 1500);

      if (tapCount.current >= 5) {
        tapCount.current = 0;
        if (tapTimer.current) clearTimeout(tapTimer.current);
        win.landoutToggleDiagnostics();
        return;
      }
    }

    setCollapsed((c) => !c);
  };

  const items = [
    { color: '#C9B99A', label: 'BLM Land', agency: 'Bureau of Land Management' },
    { color: '#2D3748', label: 'USFS Land', agency: 'Forest Service' },
    { color: '#DC2626', label: 'Wilderness', agency: 'Designated wilderness — avoid' },
    { color: '#D4621A', label: 'WSA', agency: 'Wilderness Study Area' },
    { color: '#1D4ED8', label: 'Airport / Strip', agency: 'Reference data — not legal authority' },
    { color: '#C9B99A', label: 'BLM Alaska', agency: 'BLM Alaska — federal land agencies' },
    { color: '#6B21A8', label: 'NPS Alaska Park', agency: 'National Park Service — no landing' },
    { color: '#0369A1', label: 'FWS Alaska Refuge', agency: 'Fish & Wildlife Service — restricted' },
    { color: '#DC2626', label: 'AK Wilderness/WSA', agency: 'Alaska designated wilderness / WSA' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,     // just above bottom area
        left: 8,
        zIndex: 30,
        background: 'var(--landout-charcoal-light)',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        border: '1px solid #4A5568',
        overflow: 'hidden',
        minWidth: 200,
      }}
    >
      {/* Header — tap 5× for diagnostics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--landout-charcoal)',
          borderBottom: collapsed ? 'none' : '1px solid #4A5568',
        }}
        onClick={handleHeaderClick}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--landout-aviation)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Land Status
        </span>
        {collapsed ? (
          <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        ) : (
          <ChevronUp style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        )}
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 16,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: item.color,
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.agency}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #4A5568' }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Sources: BLM SMA, BLM NLCS, USFS. Does not equal legal landing permission.
            </p>
            <p style={{ marginTop: 4, fontSize: 9, color: '#4A5568', fontStyle: 'italic' }}>
              Tap header 5× for diagnostics
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
