'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(true);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderClick = () => {
    const win = window as typeof window & { landoutToggleDiagnostics?: () => void };

    // Count tap toward diagnostics trigger
    if (win.landoutToggleDiagnostics) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current++;
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 1500); // 1.5s window for 5 taps

      if (tapCount.current >= 5) {
        tapCount.current = 0;
        if (tapTimer.current) clearTimeout(tapTimer.current);
        win.landoutToggleDiagnostics();
        return; // Don't toggle collapse on successful diagnostics trigger
      }
    }

    // Normal collapse toggle
    setCollapsed((c) => !c);
  };

  const items = [
    { color: '#8B6914', label: 'BLM Land', agency: 'Bureau of Land Management' },
    { color: '#2D5016', label: 'USFS Land', agency: 'Forest Service' },
    { color: '#DC2626', label: 'Wilderness', agency: 'Designated wilderness — avoid' },
    { color: '#DC2626', label: 'WSA', agency: 'Wilderness Study Area' },
    { color: '#1D4ED8', label: 'Airport / Strip', agency: 'Reference data — not legal authority' },
    { color: '#8B6914', label: 'BLM Alaska', agency: 'BLM Alaska — federal land agencies' },
    { color: '#6B21A8', label: 'NPS Alaska Park', agency: 'National Park Service — no landing' },
    { color: '#0369A1', label: 'FWS Alaska Refuge', agency: 'Fish & Wildlife Service — restricted' },
    { color: '#DC2626', label: 'AK Wilderness/WSA', agency: 'Alaska designated wilderness / WSA' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,   // below MapLayerToggle button (top-16 = 64px)
        right: 8,
        zIndex: 10,
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        minWidth: 200,
      }}
    >
      {/* Header — tap 5× to open diagnostics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={handleHeaderClick}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Land Status Key
        </span>
        {collapsed ? (
          <ChevronDown style={{ width: 14, height: 14, color: '#94A3B8' }} />
        ) : (
          <ChevronUp style={{ width: 14, height: 14, color: '#94A3B8' }} />
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
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.agency}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>
              Sources: BLM SMA, BLM NLCS, USFS. Does not equal legal landing permission.
            </p>
            <p style={{ marginTop: 4, fontSize: 9, color: '#CBD5E1', fontStyle: 'italic' }}>
              Tap header 5× for diagnostics
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
