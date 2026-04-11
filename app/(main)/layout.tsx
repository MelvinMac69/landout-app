'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { MapLegend, DataDashboard } from '@/components/map';
import { BackcountryMap } from '@/components/map/BackcountryMap';
import { MobileNav } from '@/components/layout/MobileNav';
import { Header, MobileHeader } from '@/components/layout/Header';
import { SiteInfoBox } from '@/components/map/SiteInfoBox';

// Persists across all (main) routes — the map stays alive while pages overlay on top
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapLoadFiredRef = useRef(false);
  const [activeSite, setActiveSite] = useState<{
    name: string;
    siteId: string;
    lat: number;
    lon: number;
    elev: string;
    runway: string;
    municipality: string;
    state: string;
    type: string;
  } | null>(null);

  // SiteInfoBox data passed from site detail page via URL params
  const [siteBoxData, setSiteBoxData] = useState<{
    name: string;
    siteId: string;
    lat: number;
    lon: number;
    elev: string;
    runway: string;
    municipality: string;
    state: string;
    type: string;
  } | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
        {/* ── Persistent full-screen map ─────────────────────────────────── */}
        {/* This stays mounted for the ENTIRE session — never unmounts */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <BackcountryMap
            onMapLoad={(map) => {
              if (mapLoadFiredRef.current) return;
              mapLoadFiredRef.current = true;
              setMapLoaded(true);
              // Expose map controls for child pages
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).landoutMapSetCenter = (lng: number, lat: number, zoom?: number) => {
                map.setCenter([lng, lat]);
                if (zoom !== undefined) map.setZoom(zoom);
              };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).landoutMapFlyTo = (lng: number, lat: number, zoom?: number) => {
                try {
                  map.flyTo({ center: [lng, lat], zoom: zoom ?? 13, duration: 800 });
                } catch {
                  map.setCenter([lng, lat]);
                  if (zoom !== undefined) map.setZoom(zoom);
                }
              };
            }}
          />
        </div>

        {/* ── SiteInfoBox overlay ───────────────────────────────────────── */}
        {/* Shown when site detail page calls landoutShowSiteBox */}
        {siteBoxData && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
              <SiteInfoBox
                site={siteBoxData}
                onClose={() => setSiteBoxData(null)}
              />
            </div>
          </div>
        )}

        {/* ── Page content overlay ──────────────────────────────────────── */}
        {/* Rendered ABOVE the map — pages can use transparent bg to show map */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>

        {/* ── Fixed UI ─────────────────────────────────────────────────── */}
        <DataDashboard />
        <MapLegend />
      </main>
      <MobileNav />
    </div>
  );
}
