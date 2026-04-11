'use client';

import { useState } from 'react';
import { Header, MobileHeader } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import dynamic from 'next/dynamic';
import { MapLegend, MapLayerToggle, DataDashboard, OVERLAY_LAYERS } from '@/components/map';
import { DirectToPanel } from '@/components/map/DirectTo';

// Dynamically import BackcountryMap with ssr:false — MapLibre requires browser APIs.
const BackcountryMap = dynamic(
  () => import('@/components/map/BackcountryMap').then((m) => m.BackcountryMap),
  { ssr: false, loading: () => <div style={{ position: 'fixed', inset: 0, background: '#1a2030' }} /> }
);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OVERLAY_LAYERS.map((l) => [l.id, true]))
  );

  const layers = OVERLAY_LAYERS.map((l) => ({ ...l, visible: activeLayers[l.id] ?? true }));

  const handleToggle = (layerId: string) => {
    const fn = (window as typeof window & { landoutSetOverlayVisibility: (id: string, v: boolean) => void }).landoutSetOverlayVisibility;
    if (fn) fn(layerId, !activeLayers[layerId]);
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
        {/* Persistent full-screen map */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <BackcountryMap />
        </div>

        {/* Map UI controls */}
        <DataDashboard />

        {/* Layers button */}
        <div
          className="absolute right-1 z-50"
          style={{ top: 'calc(var(--data-dashboard-offset, 0px) + 19px)', pointerEvents: 'auto' }}
        >
          <MapLayerToggle layers={layers} onToggle={handleToggle} />
        </div>

        {/* Site Info Box — rendered by map/page.tsx when viewing site detail */}
        <div id="site-info-box-container" />

        {/* Page content overlay */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>

        <MapLegend />
      </main>
      <MobileNav />
    </div>
  );
}
