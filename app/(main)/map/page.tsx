'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapLayerToggle, MapLegend } from '@/components/map';
import { Search } from 'lucide-react';

// Dynamic import to avoid SSR issues with MapLibre
const BackcountryMap = dynamic(
  () => import('@/components/map/BackcountryMap').then((mod) => mod.BackcountryMap),
  { ssr: false, loading: () => <MapLoading /> }
);

function MapLoading() {
  return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500 flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  );
}

interface Layer {
  id: string;
  label: string;
  color: string;
  description: string;
  visible: boolean;
}

export default function MapPage() {
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: 'blm-fill',
      label: 'BLM Land',
      color: '#8B6914',
      description: 'Bureau of Land Management',
      visible: true,
    },
    {
      id: 'fs-fill',
      label: 'Forest Service',
      color: '#2D5016',
      description: 'US Forest Service Land',
      visible: true,
    },
    {
      id: 'wilderness-fill',
      label: 'Wilderness Areas',
      color: '#DC2626',
      description: 'Designated wilderness — avoid landing',
      visible: true,
    },
    {
      id: 'wsa-fill',
      label: 'Wilderness Study Areas',
      color: '#DC2626',
      description: 'WSA — not yet designated',
      visible: true,
    },
  ]);

  const handleToggle = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      )
    );
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] relative">
      <BackcountryMap />

      <MapLayerToggle layers={layers} onToggle={handleToggle} />
      <MapLegend />

      {/* Search bar overlay */}
      <div className="absolute top-4 left-4 right-4 md:left-auto md:right-auto md:w-80 md:left-4 z-10">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search airports, strips, sites..."
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div className="absolute bottom-24 md:bottom-8 right-4 z-10 max-w-xs">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
          <strong>⚠️ NOT FOR NAVIGATION</strong><br />
          This app shows land status context only. It does not authorize landings.
          Always verify permissions and conditions before landing.
        </div>
      </div>
    </div>
  );
}
