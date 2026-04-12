'use client';

/**
 * (map) route group layout — wraps the map route group.
 *
 * This layout renders BackcountryMap ONCE and keeps it mounted across all
 * page transitions within the /map route group. This prevents the map from
 * remounting when navigating between map, search, and site-info pages.
 *
 * Architecture:
 * - Map fills the entire viewport (position: fixed, inset: 0)
 * - UI controls render in a pointer-events: none overlay (so touches
 *   pass through to the map underneath). Individual controls set
 *   pointer-events: auto on themselves.
 * - MobileNav is always visible at the bottom for navigation.
 */

import { MapProvider } from './MapContext';
import { BackcountryMap } from '@/components/map';
import { useMapContext } from './MapContext';
import { MobileNav } from '@/components/layout/MobileNav';
import type maplibregl from 'maplibre-gl';

/** Inner component that registers the map with MapContext on load */
function MapSlot() {
  const { registerMapLoaded } = useMapContext();

  const handleMapLoad = (map: maplibregl.Map) => {
    registerMapLoaded(map);
  };

  return <BackcountryMap onMapLoad={handleMapLoad} />;
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MapProvider>
      {/* Full-screen map — fills viewport, behind everything */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MapSlot />
      </div>
      {/* UI overlay layer — transparent to touch events so map interactions work.
          Individual controls (buttons, panels) set pointer-events: auto on themselves. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        {children}
      </div>
      {/* Bottom navigation — always visible on mobile */}
      <MobileNav />
    </MapProvider>
  );
}