'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LayerDiagnostic {
  id: string;
  label: string;
  color: string;
  source: string;
  sourceClassification: 'authoritative public source - higher resolution' | 'official generalized - interim' | 'official generalized' | 'community/FAA-derived - development convenience';
  importDate: string;
  notes?: string;
  status: 'healthy' | 'warning' | 'degraded';
  statusReason?: string;
}

const LAYER_DIAGNOSTICS: LayerDiagnostic[] = [
  {
    id: 'sma-blm-fill',
    label: 'BLM Land',
    color: '#8B6914',
    source: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer/1',
    sourceClassification: 'official generalized - interim',
    importDate: '2026-04-03',
    notes: 'Limited-scale dataset. State aggregates only — no field-office breakdown available in this service.',
    status: 'warning',
    statusReason: 'Generalized dataset. Useful for planning but boundaries are simplified.',
  },
  {
    id: 'sma-usfs-fill',
    label: 'National Forest (USFS)',
    color: '#2D5016',
    source: 'https://services.arcgis.com/P3aJ3kRW5t0YLPqK/arcgis/rest/services/USA_National_Forests/FeatureServer/0',
    sourceClassification: 'authoritative public source - higher resolution',
    importDate: '2026-04-03',
    status: 'healthy',
  },
  {
    id: 'wilderness-fill',
    label: 'BLM Wilderness',
    color: '#DC2626',
    source: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/1',
    sourceClassification: 'authoritative public source - higher resolution',
    importDate: '2026-04-03',
    status: 'healthy',
  },
  {
    id: 'wsa-fill',
    label: 'Wilderness Study Area',
    color: '#DC2626',
    source: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_Generalized/FeatureServer/2',
    sourceClassification: 'authoritative public source - higher resolution',
    importDate: '2026-04-03',
    status: 'healthy',
  },
  {
    id: 'fs-wilderness-fill',
    label: 'USFS Wilderness',
    color: '#DC2626',
    source: 'wilderness.net / USFS TIGER',
    sourceClassification: 'authoritative public source - higher resolution',
    importDate: '2024-01-01',
    status: 'healthy',
  },
  {
    id: 'sma-nps-fill',
    label: 'National Parks (NPS)',
    color: '#DC2626',
    source: 'NPS Land Resources (Generalized)',
    sourceClassification: 'official generalized',
    importDate: '2024-01-01',
    notes: 'Generalized NPS land boundaries.',
    status: 'warning',
    statusReason: 'Generalized — may not reflect exact park boundaries.',
  },
  {
    id: 'sma-fws-fill',
    label: 'Wildlife Refuge (FWS)',
    color: '#DC2626',
    source: 'FWS National Wildlife Refuge System (Generalized)',
    sourceClassification: 'official generalized',
    importDate: '2024-01-01',
    notes: 'Generalized FWS land boundaries.',
    status: 'warning',
    statusReason: 'Generalized — verify with local FWS office before landing.',
  },
  {
    id: 'airport-fill',
    label: 'Airport / Strip Reference',
    color: '#1D4ED8',
    source: 'https://ourairports.com/data/airports.csv',
    sourceClassification: 'community/FAA-derived - development convenience',
    importDate: '2026-04-03',
    notes: 'Interim development data. Primary target: FAA 28-Day NASR Subscription. CC-BY license — attribution required.',
    status: 'warning',
    statusReason: 'Community data, not official FAA. Verify with current charts before flight.',
  },
];

interface DiagnosticsPanelProps {
  onClose: () => void;
}

interface LocInfo {
  state: string;
  followMode: boolean;
  position: { lat: number; lon: number; heading?: number } | null;
}

export function DiagnosticsPanel({ onClose }: DiagnosticsPanelProps) {
  const [locInfo, setLocInfo] = useState<LocInfo>({ state: 'idle', followMode: false, position: null });

  useEffect(() => {
    const update = () => {
      const win = window as typeof window & { landoutLocationState?: LocInfo };
      if (win.landoutLocationState) setLocInfo(win.landoutLocationState);
    };
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,
        right: 8,
        width: 340,
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid #E2E8F0',
        zIndex: 50,
        fontFamily: '-apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid #F1F5F9',
          position: 'sticky',
          top: 0,
          background: 'white',
          borderRadius: '12px 12px 0 0',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
          🛰 Landout Diagnostics
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94A3B8',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Test Region Banner */}
      <div
        style={{
          margin: '10px 12px',
          padding: '8px 10px',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          fontSize: 11,
          color: '#1E40AF',
        }}
      >
        <strong>Test Region:</strong> Idaho (ID) — has BLM land, USFS forest, designated wilderness, and many airports all in one state. Zoom to ~zoom 6-7 over ID to verify all layers render correctly. Check that airport circles appear in blue at various sizes.
      </div>

      {/* Location Status */}
      <div
        style={{
          margin: '10px 12px',
          padding: '8px 10px',
          background: '#F0F9FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          fontSize: 11,
          color: '#1E40AF',
        }}
      >
        <strong>📍 Location:</strong>{' '}
        {locInfo.state === 'idle'
          ? 'Not requested'
          : locInfo.state === 'acquiring'
          ? 'Acquiring GPS…'
          : locInfo.state === 'active'
          ? locInfo.position
            ? `Active — ${locInfo.position.lat.toFixed(4)}°, ${locInfo.position.lon.toFixed(4)}°`
            : 'Active'
          : locInfo.state === 'denied'
          ? 'Permission denied'
          : 'Unavailable'}
        {locInfo.followMode && (
          <span style={{ color: '#3B82F6', fontWeight: 600 }}> • Follow mode ON</span>
        )}
      </div>

      {/* Layer List */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Overlay Layers
        </div>

        {LAYER_DIAGNOSTICS.map((layer) => (
          <div
            key={layer.id}
            style={{
              marginBottom: 12,
              padding: 10,
              background: '#F8FAFC',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Layer header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: layer.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', flex: 1 }}>{layer.label}</span>
              <StatusBadge status={layer.status} />
            </div>

            {/* Classification badge */}
            <div style={{ marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background:
                    layer.sourceClassification === 'authoritative public source - higher resolution'
                      ? '#DCFCE7'
                      : layer.sourceClassification === 'official generalized - interim'
                      ? '#FEF3C7'
                      : layer.sourceClassification === 'community/FAA-derived - development convenience'
                      ? '#DBEAFE'
                      : '#F3F4F6',
                  color:
                    layer.sourceClassification === 'authoritative public source - higher resolution'
                      ? '#166534'
                      : layer.sourceClassification === 'official generalized - interim'
                      ? '#92400E'
                      : layer.sourceClassification === 'community/FAA-derived - development convenience'
                      ? '#1E40AF'
                      : '#374151',
                }}
              >
                {layer.sourceClassification}
              </span>
            </div>

            {/* Details */}
            <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: '#94A3B8' }}>Source: </span>
                <span style={{ fontFamily: 'monospace', fontSize: 9 }}>{layer.source.slice(0, 60)}...</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Imported: </span>
                <span>{layer.importDate}</span>
              </div>
              {layer.statusReason && (
                <div style={{ marginTop: 4, color: '#D97706', fontStyle: 'italic' }}>
                  ⚠ {layer.statusReason}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div style={{ marginTop: 16, fontSize: 10, color: '#94A3B8', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Status Legend</div>
          <div>🟢 <strong>Healthy</strong> — Good data quality, sufficient resolution for backcountry planning</div>
          <div>🟡 <strong>Warning</strong> — Generalized data or limited coverage — verify boundaries before landing</div>
          <div>🔴 <strong>Degraded</strong> — Data missing, poor quality, or unreliable</div>
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: '#CBD5E1', borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
          Tap header 5× to toggle diagnostics
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'healthy' | 'warning' | 'degraded' }) {
  if (status === 'healthy') {
    return <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 6px', borderRadius: 4 }}>HEALTHY</span>;
  }
  if (status === 'warning') {
    return <span style={{ fontSize: 9, fontWeight: 700, color: '#D97706', background: '#FEF3C7', padding: '2px 6px', borderRadius: 4 }}>WARNING</span>;
  }
  return <span style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>DEGRADED</span>;
}

export { LAYER_DIAGNOSTICS };
