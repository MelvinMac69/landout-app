'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Navigation, MapPin } from 'lucide-react';
import { Button } from '@/components/ui';

interface AirportProps {
  name: string;
  faa_ident?: string;
  gps_code?: string;
  iata?: string;
  type?: string;
  elevation_ft?: number;
  municipality?: string;
  state?: string;
  lat?: number;
  lon?: number;
}

interface NearestAirport extends AirportProps {
  lat: number;
  lon: number;
  distanceNm: number;
  bearingDeg: number;
  bearingLabel: string;
}

interface NearestPanelProps {
  onDirectTo?: (lng: number, lat: number, name?: string) => void;
}

// Haversine distance in NM
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing from point 1 to point 2
function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (d: number) => (d * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1), lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

function bearingLabel(b: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return `${dirs[Math.round(b / 22.5) % 16]} ${Math.round(b).toString().padStart(3, '0')}°`;
}

const TYPE_COLORS: Record<string, string> = {
  large_airport: 'bg-landout-aviation text-white',
  medium_airport: 'bg-landout-forest text-white',
  small_airport: 'bg-landout-sand-dark text-landout-charcoal',
  seaplane_base: 'bg-landout-aviation-light text-white',
  heliport: 'bg-slate-400 text-white',
  closed: 'bg-slate-300 text-slate-600',
};

function TypeBadge({ type }: { type?: string }) {
  const label = type?.replace(/_/g, ' ') ?? 'unknown';
  const colorClass = TYPE_COLORS[type ?? ''] ?? 'bg-slate-300 text-slate-700';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${colorClass}`}>
      {label}
    </span>
  );
}

export function NearestPanel({ onDirectTo }: NearestPanelProps) {
  const doDirectTo = useCallback((lng: number, lat: number, name?: string) => {
    if (onDirectTo) {
      onDirectTo(lng, lat, name);
    } else {
      // Use window function — BackcountryMap sets this up
      (window as typeof window & { landoutSetDirectTo?: (dest: { lng: number; lat: number; name?: string; type: 'map' }) => void }).landoutSetDirectTo?.({
        lng, lat, name, type: 'map',
      });
    }
  }, [onDirectTo]);
  const [isOpen, setIsOpen] = useState(false);
  const [nearbyAirports, setNearbyAirports] = useState<NearestAirport[]>([]);
  const [loading, setLoading] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const [loadedData, setLoadedData] = useState<AirportProps[] | null>(null);

  // Load airport data once
  useEffect(() => {
    fetch('/data/airports-ourairports.geojson')
      .then((r) => r.json())
      .then((data: { features: { properties: AirportProps; geometry: { coordinates: [number, number] } }[] }) => {
        setLoadedData(data.features.map((f) => ({ ...f.properties, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] })));
      })
      .catch(() => setLoadedData([]));
  }, []);

  // Get current position
  const getCurrentPos = useCallback((): { lat: number; lon: number } | null => {
    try {
      const loc = (window as typeof window & { landoutLocationState?: { position?: { lat: number; lon: number }; state?: string } }).landoutLocationState;
      if (loc?.position && (loc.state === 'active' || loc.state === 'following')) {
        return { lat: loc.position.lat, lon: loc.position.lon };
      }
    } catch {}
    return null;
  }, []);

  const handleOpen = useCallback(() => {
    if (!loadedData) return;
    const pos = getCurrentPos();
    if (!pos) {
      setNoLocation(true);
      setIsOpen(true);
      return;
    }
    setNoLocation(false);
    setLoading(true);
    setIsOpen(true);

    // Compute nearest 10 within 100NM
    const { lat: curLat, lon: curLon } = pos;
    const withCoords = loadedData.filter((a): a is typeof a & { lat: number; lon: number } => a.lat != null && a.lon != null);
    const nearest: NearestAirport[] = withCoords
      .map((a) => {
        const dist = haversineNm(curLat, curLon, a.lat, a.lon);
        return { ...a, distanceNm: dist, bearingDeg: calcBearing(curLat, curLon, a.lat, a.lon), bearingLabel: '' };
      })
      .filter((a) => a.distanceNm <= 100)
      .sort((a, b) => a.distanceNm - b.distanceNm)
      .slice(0, 10)
      .map((a) => ({ ...a, bearingLabel: bearingLabel(a.bearingDeg) }));

    setNearbyAirports(nearest);
    setLoading(false);
  }, [loadedData, getCurrentPos]);

  const hasLocation = useMemo(() => {
    try {
      const loc = (window as typeof window & { landoutLocationState?: { state?: string } }).landoutLocationState;
      return loc?.state === 'active' || loc?.state === 'following';
    } catch { return false; }
  }, [isOpen]);

  const canOpen = hasLocation && loadedData != null;

  return (
    <>
      {/* Nearest button — bottom-left, above basemaps */}
      <div style={{ position: 'absolute', bottom: 60, left: 8, zIndex: 30 }}>
        <button
          onClick={handleOpen}
          disabled={!canOpen}
          title={canOpen ? 'Find nearest airports' : 'Nearest requires your location'}
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: canOpen ? 'white' : '#F1F5F9',
            border: `1.5px solid ${canOpen ? '#E2E8F0' : '#CBD5E1'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canOpen ? 'pointer' : 'not-allowed',
            color: canOpen ? '#1B3D2F' : '#94A3B8',
            transition: 'all 0.2s',
          }}
        >
          <Navigation className="w-5 h-5" style={{ transform: 'rotate(-45deg)' }} />
        </button>
      </div>

      {/* Bottom sheet */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: '50vh',
            background: 'white',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation className="w-4 h-4" style={{ color: '#1B3D2F', transform: 'rotate(-45deg)' }} />
              <span style={{ fontWeight: 600, color: '#1B3D2F', fontSize: 15 }}>Nearest Airports</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
            {noLocation ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 12 }}>
                <MapPin style={{ color: '#94A3B8', width: 32, height: 32 }} />
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                  Nearest requires your location.<br />Tap <strong>Locate Me</strong> first.
                </p>
              </div>
            ) : loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 10 }}>
                <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#1B3D2F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ color: '#64748B', fontSize: 14 }}>Finding nearest airports…</span>
              </div>
            ) : nearbyAirports.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                No airports within 100 NM.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nearbyAirports.map((apt, i) => {
                  const identifier = apt.faa_ident || apt.gps_code || apt.iata || '—';
                  return (
                    <div
                      key={i}
                      onClick={() => doDirectTo(apt.lon!, apt.lat!, apt.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 10px',
                        background: '#F8FAFC',
                        borderRadius: 10,
                        cursor: 'pointer',
                        border: '1px solid #F1F5F9',
                      }}
                    >
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {apt.name || 'Unknown'}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1B3D2F', fontSize: 12 }}>{identifier}</span>
                          {apt.type && <TypeBadge type={apt.type} />}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 11, color: '#64748B' }}>
                          <span>{apt.distanceNm.toFixed(1)} NM</span>
                          <span>{apt.bearingLabel}</span>
                          {apt.elevation_ft != null && (
                            <span>{apt.elevation_ft.toLocaleString()} ft</span>
                          )}
                        </div>
                        {apt.municipality && apt.state && (
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                            {apt.municipality}, {apt.state}
                          </div>
                        )}
                      </div>

                      {/* Direct To button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); doDirectTo(apt.lon!, apt.lat!, apt.name); }}
                        style={{
                          flexShrink: 0,
                          background: '#D4621A',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✈ Direct To
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
