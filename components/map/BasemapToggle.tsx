'use client';

import { BASEMAP_STYLES, type BasemapId } from './BackcountryMap';

declare global {
  interface Window {
    landoutSwitchBasemap: (basemap: BasemapId) => void;
    landoutGetBasemap: () => BasemapId;
  }
}

export function BasemapToggle() {
  const current = typeof window !== 'undefined' ? window.landoutGetBasemap?.() ?? 'osm' : 'osm';

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'flex',
        gap: 4,
        background: 'white',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {(Object.entries(BASEMAP_STYLES) as [BasemapId, typeof BASEMAP_STYLES[BasemapId]][]).map(([id, { label, icon }]) => (
        <button
          key={id}
          onClick={() => window.landoutSwitchBasemap?.(id)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: current === id ? '#1E293B' : 'transparent',
            color: current === id ? 'white' : '#475569',
            transition: 'all 0.15s',
          }}
          title={label}
        >
          <span style={{ marginRight: 4 }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
