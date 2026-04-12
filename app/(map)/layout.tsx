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
 * - UI overlay layer sits above the map
 *   - The map PAGE sets pointer-events: none so touches pass through
 *     to the map (individual controls set pointer-events: auto)
 *   - Overlay pages (search, site-info) are fully interactive
 * - MobileNav is always visible at the bottom for navigation
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
      {/* UI overlay layer — sits above the map.
          - Map page sets pointer-events: none (controls opt in with auto)
          - Overlay pages (search, site-info) are fully interactive */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }}>
        {children}
      </div>
      {/* Bottom navigation — always visible on mobile */}
      <MobileNav />
    </MapProvider>
  );
}