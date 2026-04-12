'use client';

/**
 * (map) route group layout — wraps the map route group.
 *
 * This layout renders BackcountryMap ONCE and keeps it mounted across all
 * page transitions within the /map route group.
 *
 * Architecture:
 * - Map fills the entire viewport (position: fixed, inset: 0, z-index: 0)
 * - Children render WITHOUT any wrapper — they sit at normal stacking
 *   order on top of the map.
 * - The map page wrapper has pointer-events: none so map gestures work;
 *   individual controls opt in with pointer-events: auto.
 * - Overlay pages (search, site-info) have their own fixed containers
 *   with high z-index and are fully interactive.
 * - MobileNav is always visible at the bottom.
 *
 * Key: no wrapper div around {children} — each child page manages its
 * own pointer-events and stacking. This avoids a full-viewport overlay
 * container accidentally blocking map interaction.
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
  // Global error handlers — catch unhandled errors/rejections to prevent
  // iOS Safari from killing the page. Log instead of crash.
  if (typeof window !== 'undefined') {
    if (!(window as any).__landoutErrorHandlersInstalled) {
      (window as any).__landoutErrorHandlersInstalled = true;
      window.onerror = (msg, src, line, col, err) => {
        console.error('[Global] Unhandled error:', { msg, src, line, col, err });
        return true; // Prevent default browser error handling (page reload)
      };
      window.addEventListener('unhandledrejection', (e) => {
        console.error('[Global] Unhandled promise rejection:', e.reason);
        e.preventDefault(); // Prevent default (which would log to console AND potentially crash)
      });
    }
  }
  return (
    <MapProvider>
      {/* Full-screen map — fills viewport, z-index 0 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MapSlot />
      </div>
      {/* Children render directly — no wrapper.
          Each page manages its own pointer-events and z-index. */}
      {children}
      {/* Bottom navigation — always visible on mobile */}
      <MobileNav />
    </MapProvider>
  );
}