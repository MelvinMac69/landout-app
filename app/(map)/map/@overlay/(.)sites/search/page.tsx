'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, X } from 'lucide-react';
import { Card } from '@/components/ui';
import { useMapContext } from '../../../../MapContext';

// ── Types ───────────────────────────────────────────────────────────────────

interface AirportResult {
  type: 'airport';
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

interface PlaceResult {
  type: 'place';
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  category: string;
}

type Result = AirportResult | PlaceResult;

// ── Data loading (shared with full-page search) ────────────────────────────

let airportsCache: AirportResult[] | null = null;

async function loadAirports(): Promise<AirportResult[]> {
  if (airportsCache) return airportsCache;
  try {
    const res = await fetch('/data/airports-ourairports.geojson');
    const data = await res.json();
    airportsCache = data.features.map((f: any) => ({
      type: 'airport' as const,
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
    return airportsCache as AirportResult[];
  } catch {
    return [];
  }
}

function searchAirports(q: string, all: AirportResult[], limit = 10): AirportResult[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  return all
    .filter(a =>
      a.name.toLowerCase().includes(lower) ||
      (a.icao || '').toLowerCase().includes(lower) ||
      (a.faa_ident || '').toLowerCase().includes(lower) ||
      (a.municipality || '').toLowerCase().includes(lower)
    )
    .sort((a, b) => {
      const aExact = a.icao?.toLowerCase() === lower || a.faa_ident?.toLowerCase() === lower;
      const bExact = b.icao?.toLowerCase() === lower || b.faa_ident?.toLowerCase() === lower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      if (a.name.toLowerCase().startsWith(lower) && !b.name.toLowerCase().startsWith(lower)) return -1;
      if (b.name.toLowerCase().startsWith(lower) && !a.name.toLowerCase().startsWith(lower)) return 1;
      return 0;
    })
    .slice(0, limit);
}

async function searchPlaces(q: string, limit = 5): Promise<PlaceResult[]> {
  if (!q.trim() || q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LandOut-BackcountryMap/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((p: any) => p.lat && p.lon)
      .map((p: any) => ({
        type: 'place' as const,
        name: p.display_name.split(',')[0],
        display_name: p.display_name,
        lat: parseFloat(p.lat),
        lon: parseFloat(p.lon),
        category: p.category || p.type || 'place',
      }));
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

// ── Component ────────────────────────────────────────────────────────────────

export default function SearchOverlay() {
  const router = useRouter();
  const { flyToSite, startDirectTo, dropPin, setOverlayOpen } = useMapContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const allAirportsRef = useRef<AirportResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAirports().then(a => { allAirportsRef.current = a; });
    // Auto-focus search input when overlay opens
    setTimeout(() => inputRef.current?.focus(), 100);
    setOverlayOpen(true);
    return () => setOverlayOpen(false);
  }, [setOverlayOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const [airports, places] = await Promise.all([
      Promise.resolve(searchAirports(q, allAirportsRef.current, 10)),
      searchPlaces(q, 5),
    ]);
    setResults([...airports, ...places]);
    setLoading(false);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  function closeOverlay() {
    router.push('/map', { scroll: false });
  }

  function handleAirportClick(site: AirportResult) {
    // Fly to the airport on the map and open Site Info overlay
    flyToSite(site.lon, site.lat, 13);
    // Navigate to the site detail overlay
    const siteId = site.icao || site.faa_ident || site.id;
    router.push(`/map/sites/${encodeURIComponent(siteId)}`, { scroll: false });
  }

  function handlePlaceClick(place: PlaceResult) {
    // Drop a pin on the map and close the search overlay
    dropPin(place.lon, place.lat, place.name);
    flyToSite(place.lon, place.lat, 13);
    closeOverlay();
  }

  const airports = results.filter(r => r.type === 'airport') as AirportResult[];
  const places = results.filter(r => r.type === 'place') as PlaceResult[];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        overflow: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'auto',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          margin: '0 12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          background: 'white',
          borderRadius: '16px 16px 0 0',
          zIndex: 1,
        }}>
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search airports, towns, lakes..."
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: '#0F172A',
              background: 'transparent',
            }}
          />
          <button
            onClick={closeOverlay}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: 4,
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 12px 16px' }}>
          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{
                width: 28, height: 28,
                border: '2px solid #E2E8F0',
                borderTopColor: '#F97316',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            </div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p style={{ color: '#64748B', fontSize: 14 }}>No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {/* Airport results */}
          {!loading && airports.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 4px 6px' }}>
                Airports &amp; Strips
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {airports.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => handleAirportClick(site)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FDBA74'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    <div
                      style={{
                        width: 36, height: 36,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: `${typeColor(site.type_label)}20`,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: typeColor(site.type_label) }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{site.name}</span>
                        {(site.icao || site.faa_ident) && (
                          <span style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
                            {site.icao || site.faa_ident}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                        {[site.municipality, site.state].filter(Boolean).join(', ')}
                        {site.runway_length_ft && ` · ${site.runway_length_ft.toLocaleString()} ft`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Place results */}
          {!loading && places.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 4px 6px' }}>
                Places
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {places.map((place, i) => (
                  <button
                    key={`place-${i}`}
                    onClick={() => handlePlaceClick(place)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FDBA74'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, background: '#F1F5F9',
                    }}>
                      <MapPin className="w-4 h-4 text-slate-500" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {place.display_name.split(',').slice(1, 3).join(',').trim() || place.category}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p style={{ color: '#64748B', fontSize: 14 }}>Search airports, strips, towns, and landmarks</p>
            </div>
          )}
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}