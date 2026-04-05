'use client';

import { useEffect, useState } from 'react';

interface BuildBannerProps {
  sha?: string;
  branch?: string;
  changes?: string;
  buildTime?: string;
}

export function BuildBanner({ sha = '?', branch = '?', changes, buildTime }: BuildBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `build_shown_${sha}`;
    if (sessionStorage.getItem(key)) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem(key, '1');
    setVisible(true);
  }, [sha]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        background: 'rgba(26,32,44,0.97)',
        borderBottom: '1.5px solid rgba(0,200,255,0.5)',
        padding: '7px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: 'monospace', fontSize: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ color: '#00C8FF', fontWeight: 700, fontSize: 11 }}>
        BUILD {sha}
      </span>
      <span style={{ color: '#4A5568' }}>·</span>
      <span style={{ color: '#718096', fontSize: 11 }}>{branch}</span>
      {buildTime && (
        <>
          <span style={{ color: '#4A5568' }}>·</span>
          <span style={{ color: '#4A5568', fontSize: 11 }}>{new Date(buildTime).toLocaleTimeString()}</span>
        </>
      )}
      {changes && (
        <>
          <span style={{ color: '#4A5568' }}>·</span>
          <span style={{ color: '#A0AEC0', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{changes}</span>
        </>
      )}
      <button
        onClick={() => setVisible(false)}
        style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          color: '#4A5568', cursor: 'pointer', fontSize: 16, lineHeight: 1,
          padding: '0 2px',
        }}
        aria-label="Dismiss build banner"
      >
        ×
      </button>
    </div>
  );
}
