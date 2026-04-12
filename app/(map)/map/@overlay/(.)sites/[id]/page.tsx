'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  X,
  Bookmark,
  Share2,
  AlertTriangle,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { formatCoordinates } from '@/lib/utils/geo';
import { useMapContext } from '../../../../MapContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface SiteData {
  id: string;
  name: string;
  icao: string | null;
  faa_ident: string | null;
  municipality: string | null;
  state: string | null;
  type_label: string;
  lat: number;
  lon: number;
  runway_length_ft: number | null;
  elevation_ft: number | null;
}

// ── Data loading (shared cache) ─────────────────────────────────────────────

let airportsCache: SiteData[] | null = null;

async function loadAirports(): Promise<SiteData[]> {
  if (airportsCache) return airportsCache;
  try {
    const res = await fetch('/data/airports-ourairports.geojson');
    const data = await res.json();
    airportsCache = data.features.map((f: any) => ({
      id: f.properties.icao || f.properties.faa_ident || `unknown-${Math.random()}`,
      name: f.properties.name || f.properties.icao || f.properties.faa_ident || 'Unknown',
      icao: f.properties.icao || null,
      faa_ident: f.properties.faa_ident || null,
      municipality: f.properties.municipality || null,
      state: f.properties.state || null,
      type_label: f.properties.type?.replace(/_/g, ' ') || 'airport',
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      runway_length_ft: f.properties.runway_length_ft || null,
      elevation_ft: f.properties.elevation_ft || null,
    }));
    return airportsCache as SiteData[];
  } catch {
    return [];
  }
}

function typeColor(type_label: string): string {
  const t = type_label.toLowerCase();
  if (t.includes('seaplane')) return '#0EA5E9';
  if (t.includes('heliport')) return '#8B5CF6';
  if (t.includes('large')) return '#EF4444';
  if (t.includes('medium')) return '#F97316';
  if (t.includes('small')) return '#22C55E';
  return '#94A3B8';
}

// ── Mock reports ──────────────────────────────────────────────────────────────

const mockReports = [
  {
    id: '1',
    report_type: 'condition',
    body: 'Runway recently graded. Surface in good shape for the season.',
    reported_by: 'backcountry_pilot_92',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SiteInfoOverlay() {
  const params = useParams();
  const router = useRouter();
  const { flyToSite, startDirectTo, showInfoCard, setOverlayOpen } = useMapContext();

  const [site, setSite] = useState<SiteData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'info'>('reports');

  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    setOverlayOpen(true);
    return () => setOverlayOpen(false);
  }, [setOverlayOpen]);

  useEffect(() => {
    if (!id) return;
    loadAirports().then(sites => {
      const found = sites.find(s => s.id.toLowerCase() === id.toLowerCase());
      if (found) {
        setSite(found);
        // Fly map to this site when overlay opens
        flyToSite(found.lon, found.lat, 13);
      } else {
        setNotFound(true);
      }
    });
  }, [id, flyToSite]);

  function closeOverlay() {
    router.push('/map', { scroll: false });
  }

  if (notFound) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 23, 42, 0.92)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
      >
        <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', textAlign: 'center' }}>
          <p style={{ color: '#64748B', marginBottom: 16 }}>Could not find site &ldquo;{id}&rdquo;</p>
          <button onClick={closeOverlay} style={{ padding: '8px 24px', background: '#1E293B', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 23, 42, 0.92)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
      >
        <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ height: 24, background: '#E2E8F0', borderRadius: 4, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 48, background: '#E2E8F0', borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15, 23, 42, 0.92)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        WebkitBackdropFilter: 'blur(8px)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '75vh',
          overflow: 'auto',
          background: 'white',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.3)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>{site.name}</span>
                {(site.icao || site.faa_ident) && (
                  <span style={{ fontSize: 12, background: '#F1F5F9', color: '#475569', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                    {site.icao || site.faa_ident}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin className="w-3 h-3" />
                {formatCoordinates(site.lon, site.lat)}
              </div>
            </div>
            <button
              onClick={() => setSaved(!saved)}
              style={{
                padding: 6, borderRadius: 8, border: 'none',
                background: saved ? '#DBEAFE' : 'transparent',
                color: saved ? '#2563EB' : '#94A3B8',
                cursor: 'pointer',
              }}
            >
              <Bookmark className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={closeOverlay}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px' }}>
          <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: 10, color: '#94A3B8' }}>Runway</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>
              {site.runway_length_ft ? `${site.runway_length_ft.toLocaleString()} ft` : '—'}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: 10, color: '#94A3B8' }}>Elevation</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>
              {site.elevation_ft ? `${site.elevation_ft.toLocaleString()} ft` : '—'}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: 10, color: '#94A3B8' }}>Type</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: typeColor(site.type_label), textTransform: 'capitalize' }}>
              {site.type_label}
            </p>
          </div>
        </div>

        {/* Action buttons — View on Map & Direct To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 12px' }}>
          <button
            onClick={() => {
              flyToSite(site.lon, site.lat, 14);
              showInfoCard({
                lng: site.lon,
                lat: site.lat,
                name: site.name,
                faa_ident: site.faa_ident ?? undefined,
                airportType: site.type_label,
                municipality: site.municipality ?? undefined,
                state: site.state ?? undefined,
                runway_length_ft: site.runway_length_ft,
                elevation_ft: site.elevation_ft,
              });
              closeOverlay();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid #E2E8F0', background: 'white',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <MapPin className="w-4 h-4" style={{ color: '#F97316' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>View on Map</span>
            <ExternalLink className="w-3 h-3" style={{ color: '#94A3B8', marginLeft: 'auto' }} />
          </button>
          <button
            onClick={() => {
              startDirectTo(site.lon, site.lat, site.name);
              closeOverlay();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid #FDE68A', background: '#FFFBEB',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16 }}>✈</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#92400E' }}>Direct To</span>
          </button>
        </div>

        {/* Disclaimer */}
        <div style={{ margin: '0 16px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertTriangle className="w-4 h-4" style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#92400E' }}>
            Land status shown on map. This does <strong>not</strong> authorize landing. Always verify access permissions.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px' }}>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              flex: 1, padding: '6px 0', fontSize: 13, fontWeight: 500,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: activeTab === 'reports' ? '#1E293B' : '#F1F5F9',
              color: activeTab === 'reports' ? 'white' : '#475569',
            }}
          >
            Reports ({mockReports.length})
          </button>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              flex: 1, padding: '6px 0', fontSize: 13, fontWeight: 500,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: activeTab === 'info' ? '#1E293B' : '#F1F5F9',
              color: activeTab === 'info' ? 'white' : '#475569',
            }}
          >
            Info
          </button>
        </div>

        {/* Tab content */}
        <div style={{ padding: '0 16px 16px' }}>
          {activeTab === 'reports' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => alert('Condition report form coming soon!')}
                style={{
                  width: '100%', padding: '8px 0', fontSize: 13,
                  borderRadius: 8, border: '1px solid #E2E8F0',
                  background: 'white', cursor: 'pointer', color: '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Clock className="w-4 h-4" />
                Add Condition Report
              </button>
              {mockReports.map((report) => (
                <div key={report.id} style={{ padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600, background: '#DCFCE7', color: '#166534' }}>
                      {report.report_type}
                    </span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#334155' }}>{report.body}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: '#94A3B8' }}>
                    <User className="w-3 h-3" />
                    {report.reported_by}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {site.municipality && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 2 }}>Location</div>
                    <div style={{ fontSize: 13, color: '#64748B' }}>{site.municipality}{site.state ? `, ${site.state}` : ''}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 2 }}>Coordinates</div>
                  <div style={{ fontSize: 13, color: '#64748B', fontFamily: 'monospace' }}>{formatCoordinates(site.lon, site.lat)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 2 }}>Data Source</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>OurAirports (public AIP data)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}