'use client';

/**
 * (map) route group layout — wraps the map route group.
 *
 * This layout renders BackcountryMap ONCE and keeps it mounted across all
 * page transitions within the /map route group. This prevents the map from
 * remounting when navigating between map, search, and site-info pages.
 *
 * No Header — map is full-screen. MobileNav is rendered as an overlay
 * if needed (currently the map page has its own controls).
 */

import { MapProvider } from './MapContext';
import { BackcountryMap } from '@/components/map';
import { useMapContext } from './MapContext';

/** Inner component that registers the map with MapContext on load */
function MapSlot() {
  const { registerMapLoaded } = useMapContext();

  const handleMapLoad = (map: maplibregl.Map) => {
    // Register with MapContext so other components can use flyToSite, etc.
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
      <MapSlot />
      {children}
    </MapProvider>
  );
}