'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui';

/**
 * Full-page search fallback — used when navigating to /sites/search directly
 * (deep link, bookmark, etc.) instead of via intercepting route from /map.
 *
 * This is essentially the same search UI but as a standalone page with
 * standard page chrome (Header, MobileNav from the (map) layout).
 */

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
  } catch { return []; }
}

function searchAirports(q: string, all: AirportResult[], limit = 10): AirportResult[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  return all
    .filter(a => a.name.toLowerCase().includes(lower) || (a.icao || '').toLowerCase().includes(lower) || (a.faa_ident || '').toLowerCase().includes(lower) || (a.municipality || '').toLowerCase().includes(lower))
    .sort((a, b) => {
      const aExact = a.icao?.toLowerCase() === lower || a.faa_ident?.toLowerCase() === lower;
      const bExact = b.icao?.toLowerCase() === lower || b.faa_ident?.toLowerCase() === lower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
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
    return data.filter((p: any) => p.lat && p.lon).map((p: any) => ({
      type: 'place' as const, name: p.display_name.split(',')[0], display_name: p.display_name,
      lat: parseFloat(p.lat), lon: parseFloat(p.lon), category: p.category || p.type || 'place',
    }));
  } catch { return []; }
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

export default function SearchFallbackPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const allAirportsRef = useRef<AirportResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadAirports().then(a => { allAirportsRef.current = a; }); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); setSearched(false); return; }
    setLoading(true); setSearched(true);
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

  const airports = results.filter(r => r.type === 'airport') as AirportResult[];
  const places = results.filter(r => r.type === 'place') as PlaceResult[];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Search Sites</h1>
      <form onSubmit={e => e.preventDefault()} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text" value={query} onChange={e => handleChange(e.target.value)}
            placeholder="Search airports, towns, lakes, landmarks..." autoFocus
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {!loading && airports.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Airports &amp; Strips</h2>
          <div className="space-y-2">
            {airports.map((site) => (
              <Link key={site.id} href={`/sites/${encodeURIComponent(site.icao || site.faa_ident || site.id)}`}>
                <Card className="hover:border-orange-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${typeColor(site.type_label)}20` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: typeColor(site.type_label) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{site.name}</span>
                        {(site.icao || site.faa_ident) && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{site.icao || site.faa_ident}</span>
                        )}
                        <span className="text-xs text-slate-400 capitalize">{site.type_label}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {[site.municipality, site.state].filter(Boolean).join(', ')}
                        {site.runway_length_ft && ` · ${site.runway_length_ft.toLocaleString()} ft runway`}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && places.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Places</h2>
          <div className="space-y-2">
            {places.map((place, i) => (
              <Link key={`place-${i}`} href={`/map?lat=${place.lat}&lon=${place.lon}&name=${encodeURIComponent(place.name)}&type=place`}>
                <Card className="hover:border-orange-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{place.name}</div>
                      <div className="text-xs text-slate-500 truncate">{place.display_name.split(',').slice(1, 3).join(',').trim() || place.category}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && !searched && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Search for airports, strips, towns, lakes, and landmarks</p>
        </div>
      )}
    </div>
  );
}