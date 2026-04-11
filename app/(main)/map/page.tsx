'use client';

// This page now renders ABOVE the persistent map in the layout.
// The BackcountryMap is in the layout and never unmounts.
// This page only handles: DisclaimerOverlay, NearestPanel, and URL param handling.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Disclaimer overlay — only shown on first visit (session storage)
function DisclaimerOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '75%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 40,
        maxWidth: 280,
        cursor: 'pointer',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(26, 32, 44, 0.92)',
          border: '1px solid #D4621A',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
          color: '#C9B99A',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          textAlign: 'center',
        }}
      >
        <strong style={{ color: '#D4621A' }}>⚠️ NOT FOR NAVIGATION</strong>
        <br />
        Land status context only. Does not authorize landings.
      </div>
    </div>
  );
}

export default function MapPage() {
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('landout-disclaimer-dismissed');
    if (dismissed) setDisclaimerDismissed(true);
  }, []);

  function handleCloseDisclaimer() {
    sessionStorage.setItem('landout-disclaimer-dismissed', '1');
    setDisclaimerDismissed(true);
  }

  return (
    <div
      className="h-[calc(100vh-3.5rem)] relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {!disclaimerDismissed && <DisclaimerOverlay onClose={handleCloseDisclaimer} />}
    </div>
  );
}
