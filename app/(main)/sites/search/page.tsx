'use client';

import { useState } from 'react';
import { Search, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card, Input } from '@/components/ui';

interface Site {
  id: string;
  name: string;
  icao_code: string | null;
  location: { lat: number; lng: number };
  runway_length_ft: number | null;
  runway_surface: string | null;
  elevation_ft: number | null;
  source: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // TODO: Wire to Supabase
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    // Placeholder - will query Supabase with PostGIS
    setTimeout(() => {
      setSites([
        {
          id: '1',
          name: 'Canyonlands Field',
          icao_code: 'CNY',
          location: { lat: 38.79, lng: -109.75 },
          runway_length_ft: 5200,
          runway_surface: 'paved',
          elevation_ft: 4555,
          source: 'faa',
        },
      ]);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Search Sites</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ICAO code, or location..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : sites.length > 0 ? (
        <div className="space-y-3">
          {sites.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`}>
              <Card className="hover:border-slate-300 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {site.name}
                        </h3>
                        {site.icao_code && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {site.icao_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {site.runway_length_ft?.toLocaleString()} ft ·{' '}
                        {site.runway_surface} · {site.elevation_ft?.toLocaleString()} ft
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            Search for airports, strips, or community sites
          </p>
        </div>
      )}
    </div>
  );
}
