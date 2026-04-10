'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  ArrowLeft,
  Bookmark,
  Share2,
  AlertTriangle,
  Clock,
  User,
  Navigation,
  ExternalLink,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { formatCoordinates } from '@/lib/utils/geo';

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

// ── Data loading ──────────────────────────────────────────────────────────────

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

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<SiteData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'info'>('reports');

  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!id) return;
    loadAirports().then(sites => {
      const found = sites.find(s => s.id.toLowerCase() === id.toLowerCase());
      if (found) {
        setSite(found);
      } else {
        setNotFound(true);
      }
    });
  }, [id]);

  function handleDirectTo() {
    if (!site) return;
    // Use dropPin=1 (same as "View on Map") — shows SiteInfoBox, GPS tracking,
    // and the "Direct To" button inside SiteInfoBox shows the line and fits bounds
    router.push(`/map?lat=${site.lat}&lon=${site.lon}&name=${encodeURIComponent(site.name)}&siteId=${encodeURIComponent(site.icao || site.faa_ident || '')}&elev=${site.elevation_ft || ''}&runway=${site.runway_length_ft || ''}&municipality=${encodeURIComponent(site.municipality || '')}&state=${encodeURIComponent(site.state || '')}&type=${encodeURIComponent(site.type_label || '')}&dropPin=1`);
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/sites/search" className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Site not found</h1>
        </div>
        <Card>
          <p className="text-slate-600">Could not find a site with ID &ldquo;{id}&rdquo;.</p>
          <Link href="/sites/search">
            <Button className="mt-4 w-full">Back to Search</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/sites/search" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="h-6 bg-slate-200 rounded w-1/2 animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-16 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const isLandingSite = site.type_label.toLowerCase().includes('airport') ||
                        site.type_label.toLowerCase().includes('airstrip') ||
                        site.type_label.toLowerCase().includes('seaplane');

  return (
    <div className="max-w-2xl mx-auto p-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/sites/search"
          className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 truncate">{site.name}</h1>
            {(site.icao || site.faa_ident) && (
              <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono flex-shrink-0">
                {site.icao || site.faa_ident}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {formatCoordinates(site.lon, site.lat)}
          </p>
        </div>
        <button
          onClick={() => setSaved(!saved)}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            saved ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400'
          }`}
        >
          <Bookmark className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card padding="sm" className="text-center">
          <p className="text-xs text-slate-500">Runway</p>
          <p className="text-lg font-semibold text-slate-900">
            {site.runway_length_ft ? `${site.runway_length_ft.toLocaleString()} ft` : '—'}
          </p>
          <p className="text-xs text-slate-500 capitalize">{site.type_label}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-slate-500">Elevation</p>
          <p className="text-lg font-semibold text-slate-900">
            {site.elevation_ft ? `${site.elevation_ft.toLocaleString()} ft` : '—'}
          </p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-slate-500">Type</p>
          <p className="text-sm font-semibold capitalize" style={{ color: typeColor(site.type_label) }}>
            {site.type_label}
          </p>
        </Card>
      </div>

      {/* Location + Direct To */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href={`/map?lat=${site.lat}&lon=${site.lon}&name=${encodeURIComponent(site.name)}&siteId=${encodeURIComponent(site.icao || site.faa_ident || '')}&elev=${site.elevation_ft || ''}&runway=${site.runway_length_ft || ''}&municipality=${encodeURIComponent(site.municipality || '')}&state=${encodeURIComponent(site.state || '')}&type=${encodeURIComponent(site.type_label)}&dropPin=1`}>
          <Card className="h-full hover:border-orange-300 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-slate-700">View on Map</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
            </div>
          </Card>
        </Link>

        {isLandingSite && (
          <button onClick={handleDirectTo} className="w-full">
            <Card className="h-full bg-orange-50 border-orange-200 hover:border-orange-400 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700">Direct To</span>
              </div>
            </Card>
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Land status shown on map. This does <strong>not</strong> authorize landing.
          Always verify access permissions before landing.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'reports'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Reports ({mockReports.length})
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'info'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Info
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'reports' ? (
        <div className="space-y-4">
          <button
            onClick={() => alert('Condition report form coming soon!')}
            className="w-full"
          >
            <Button variant="outline" className="w-full gap-2">
              <Clock className="w-4 h-4" />
              Add Condition Report
            </Button>
          </button>

          {mockReports.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500 text-center py-4">
                No reports yet. Be the first to share a condition update.
              </p>
            </Card>
          ) : (
            mockReports.map((report) => (
              <Card key={report.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        report.report_type === 'hazard'
                          ? 'bg-red-100 text-red-700'
                          : report.report_type === 'closure'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {report.report_type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="text-slate-700 text-sm">{report.body}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <User className="w-3 h-3" />
                  {report.reported_by}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <div className="space-y-4">
            {site.municipality && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-1">Location</h3>
                <p className="text-sm text-slate-600">{site.municipality}{site.state ? `, ${site.state}` : ''}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">Coordinates</h3>
              <p className="text-sm text-slate-600 font-mono">{formatCoordinates(site.lon, site.lat)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">Data Source</h3>
              <p className="text-sm text-slate-600">OurAirports (public AIP data)</p>
            </div>
          </div>
        </Card>
      )}

      {/* Fixed bottom actions */}
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 max-w-2xl mx-auto">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          {isLandingSite && (
            <Button
              variant="primary"
              className="flex-1 gap-2"
              style={{ background: '#D4621A' }}
              onClick={handleDirectTo}
            >
              <Navigation className="w-4 h-4" />
              Direct To
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
