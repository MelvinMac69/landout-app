'use client';

import { useState } from 'react';
import { Layers, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { BASEMAP_STYLES, type BasemapId } from './BackcountryMap';

interface Layer {
  id: string;
  label: string;
  color: string;
  description: string;
  visible: boolean;
}

interface MapLayerToggleProps {
  layers: Layer[];
  onToggle: (layerId: string) => void;
}

// Landout brand colors for layer badges
const LAYER_COLOR_OVERRIDES: Partial<Record<string, string>> = {
  'wilderness-fill':     '#0F2520',
  'wsa-fill':           '#D4621A',
  'fs-wilderness-fill': '#0F2520',
  'sma-nps-fill':      '#0F2520',
  'sma-fws-fill':      '#D97706',
  'sma-blm-fill':      '#C9B99A',
  'sma-usfs-fill':     '#1B3D2F',
  'airport-fill':      '#1D4ED8',
  'sma-blm-ak-fill':  '#C9B99A',
  'ak-ond-fill':      '#0F2520',
};

function SectionHeader({
  label,
  isOpen,
  onToggle,
  icon,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 0',
        marginBottom: 4,
      }}
    >
      {isOpen ? (
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      )}
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </button>
  );
}

export function MapLayerToggle({ layers, onToggle }: MapLayerToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [basemapsOpen, setBasemapsOpen] = useState(true);
  const [overlaysOpen, setOverlaysOpen] = useState(true);

  const visibleCount = layers.filter((l) => l.visible).length;

  // Get current basemap from window
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>(() => {
    try { return (window as typeof window & { landoutGetBasemap?: () => BasemapId }).landoutGetBasemap?.() ?? 'osm'; }
    catch { return 'osm'; }
  });

  function handleBasemap(id: BasemapId) {
    setActiveBasemap(id);
    const fn = (window as typeof window & { landoutSwitchBasemap?: (b: BasemapId) => void }).landoutSwitchBasemap;
    if (fn) fn(id);
  }

  return (
    <div className="absolute top-4 right-4 z-10">
      {isOpen ? (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Layers
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Section 1 — Basemaps */}
          <div style={{ marginBottom: 12 }}>
            <SectionHeader
              label="Basemaps"
              isOpen={basemapsOpen}
              onToggle={() => setBasemapsOpen((v) => !v)}
              icon="🗺️"
            />
            {basemapsOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 4 }}>
                {(Object.entries(BASEMAP_STYLES) as [BasemapId, (typeof BASEMAP_STYLES)[BasemapId]][]).map(([id, { label, icon }]) => {
                  const isActive = id === activeBasemap;
                  return (
                    <button
                      key={id}
                      onClick={() => handleBasemap(id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        background: isActive ? '#1B3D2F' : '#F1F5F9',
                        color: isActive ? 'white' : '#475569',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title={label}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #F1F5F9', marginBottom: 10 }} />

          {/* Section 2 — Overlays */}
          <div>
            <SectionHeader
              label="Overlays"
              isOpen={overlaysOpen}
              onToggle={() => setOverlaysOpen((v) => !v)}
            />
            {overlaysOpen && (
              <div className="space-y-1">
                {layers.map((layer) => {
                  const badgeColor = LAYER_COLOR_OVERRIDES[layer.id] ?? layer.color;
                  return (
                    <label
                      key={layer.id}
                      className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => onToggle(layer.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: badgeColor }}
                          />
                          <span className="font-medium text-slate-700 text-xs leading-tight">
                            {layer.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          {layer.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Verify accuracy before use. Not for navigation.
            </p>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 shadow-md"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Layers</span>
          {visibleCount > 0 && (
            <span className="bg-landout-forest text-white text-xs px-1.5 py-0.5 rounded-full">
              {visibleCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
