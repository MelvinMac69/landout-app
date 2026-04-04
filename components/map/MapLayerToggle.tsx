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

const LAYER_COLOR_OVERRIDES: Partial<Record<string, string>> = {
  'wilderness-fill':    '#1A202C',
  'wsa-fill':          '#D4621A',
  'fs-wilderness-fill': '#1A202C',
  'sma-nps-fill':      '#1A202C',
  'sma-fws-fill':      '#D97706',
  'sma-blm-fill':      '#C9B99A',
  'sma-usfs-fill':     '#2D3748',
  'airport-fill':      '#1D4ED8',
  'sma-blm-ak-fill':  '#C9B99A',
  'ak-ond-fill':       '#1A202C',
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
        <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
      ) : (
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
      )}
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--landout-aviation)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
    </button>
  );
}

export function MapLayerToggle({ layers, onToggle }: MapLayerToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [basemapsOpen, setBasemapsOpen] = useState(true);
  const [overlaysOpen, setOverlaysOpen] = useState(true);

  const visibleCount = layers.filter((l) => l.visible).length;

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
    <div>
      {isOpen ? (
        /* Open panel — dark charcoal */
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            zIndex: 50,
            width: 260,
            background: 'var(--landout-charcoal-light)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid #4A5568',
            padding: 14,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers style={{ width: 16, height: 16, color: 'var(--landout-aviation)' }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Layers</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                color: 'var(--text-muted)',
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Basemaps section */}
          <div style={{ marginBottom: 10 }}>
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
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        background: isActive ? 'var(--landout-aviation)' : '#1A202C',
                        color: isActive ? 'white' : '#A0998F',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        boxShadow: isActive ? '0 2px 6px rgba(212,98,26,0.4)' : 'none',
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
          <div style={{ borderTop: '1px solid #4A5568', marginBottom: 10 }} />

          {/* Overlays section */}
          <div>
            <SectionHeader
              label="Overlays"
              isOpen={overlaysOpen}
              onToggle={() => setOverlaysOpen((v) => !v)}
            />
            {overlaysOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {layers.map((layer) => {
                  const badgeColor = LAYER_COLOR_OVERRIDES[layer.id] ?? layer.color;
                  return (
                    <label
                      key={layer.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 6px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#3D4A5C')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => onToggle(layer.id)}
                        style={{ width: 14, height: 14, accentColor: 'var(--landout-aviation)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: badgeColor,
                              flexShrink: 0,
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {layer.label}
                          </span>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          {layer.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #4A5568' }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Verify accuracy before use. Not for navigation.
            </p>
          </div>
        </div>
      ) : (
        /* Closed button — dark, floating top-right */
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid #4A5568',
            background: 'var(--landout-charcoal-light)',
            color: '#C9B99A',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'all 0.15s',
          }}
        >
          <Layers style={{ width: 15, height: 15, color: 'var(--landout-aviation)' }} />
          <span>Layers</span>
          {visibleCount > 0 && (
            <span
              style={{
                background: 'var(--landout-aviation)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 10,
              }}
            >
              {visibleCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
