'use client';

import { useState } from 'react';
import { Header, MobileHeader } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import dynamic from 'next/dynamic';
import { MapLegend } from '@/components/map';

// Dynamically import BackcountryMap with ssr:false — MapLibre requires browser APIs.
const BackcountryMap = dynamic(
  () => import('@/components/map/BackcountryMap').then((m) => m.BackcountryMap),
  { ssr: false, loading: () => <div style={{ position: 'fixed', inset: 0, background: '#1a2030' }} /> }
);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
        {/* Persistent full-screen map */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <BackcountryMap />
        </div>

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
