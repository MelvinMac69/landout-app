'use client';

import { useState } from 'react';
import { BASEMAP_STYLES, type BasemapId } from './BackcountryMap';

export function BasemapToggle() {
  const [active, setActive] = useState<BasemapId>('osm');

  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        background: 'white',
        borderRadius: 8,
        padding: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {(Object.entries(BASEMAP_STYLES) as [BasemapId, (typeof BASEMAP_STYLES)[BasemapId]][]).map(([id, { label, icon }]) => (
        <button
          key={id}
          onClick={() => {
            setActive(id);
            const fn = (window as typeof window & { landoutSwitchBasemap: (b: BasemapId) => void }).landoutSwitchBasemap;
            if (fn) fn(id);
          }}
          style={{
            padding: '4px 7px',
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            background: active === id ? '#1E293B' : 'transparent',
            color: active === id ? 'white' : '#475569',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
          title={label}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}