'use client';

import { useState } from 'react';
import { BASEMAP_STYLES, type BasemapId } from './BackcountryMap';

export function BasemapToggle() {
  // Track active state locally — stays in sync after user clicks
  const [active, setActive] = useState<BasemapId>('osm');

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        left: 8,
        zIndex: 5,
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
          onClick={() => {
            setActive(id);
            const fn = (window as typeof window & { landoutSwitchBasemap: (b: BasemapId) => void }).landoutSwitchBasemap;
            if (fn) fn(id);
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: active === id ? '#1E293B' : 'transparent',
            color: active === id ? 'white' : '#475569',
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
