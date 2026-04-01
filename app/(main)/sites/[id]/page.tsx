'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  ArrowLeft,
  Bookmark,
  Share2,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { formatRunwayLength, formatElevation, formatSurface, formatTimeAgo } from '@/lib/utils/format';
import { formatCoordinates } from '@/lib/utils/geo';

// Placeholder data - will come from Supabase
const placeholderSite = {
  id: '1',
  name: 'Canyonlands Field',
  icao_code: 'CNY',
  location: { lat: 38.79, lng: -109.75 },
  elevation_ft: 4555,
  runway_length_ft: 5200,
  runway_surface: 'paved',
  magnetic_declination: 11,
  description:
    'Good backcountry access with views of the La Sal mountains. Watch for wildlife on approach to RWY 19.',
  restrictions: 'No overnight parking in lot B. Tie-downs available.',
  source: 'faa' as const,
  last_reported_at: '2024-03-15T14:30:00Z',
  reports: [
    {
      id: '1',
      report_type: 'condition',
      body: 'Runway in great shape. Recent crack-fill work completed.',
      reported_by: 'backcountry_pilot_92',
      created_at: '2024-03-15T14:30:00Z',
    },
    {
      id: '2',
      report_type: 'hazard',
      body: 'Birds active near the threshold RWY 19 in the morning.',
      reported_by: 'utah_flyer',
      created_at: '2024-02-28T08:15:00Z',
    },
  ],
};

export default function SiteDetailPage() {
  const params = useParams();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'info'>('reports');

  const site = placeholderSite; // TODO: fetch from Supabase by params.id

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/map"
          className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{site.name}</h1>
            {site.icao_code && (
              <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {site.icao_code}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {formatCoordinates(site.location.lng, site.location.lat)}
          </p>
        </div>
        <button
          onClick={() => setSaved(!saved)}
          className={`p-2 rounded-lg transition-colors ${
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
            {formatRunwayLength(site.runway_length_ft)}
          </p>
          <p className="text-xs text-slate-500">{formatSurface(site.runway_surface)}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-slate-500">Elevation</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatElevation(site.elevation_ft)}
          </p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-slate-500">Declination</p>
          <p className="text-lg font-semibold text-slate-900">
            {site.magnetic_declination}°E
          </p>
        </Card>
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
          Conditions ({site.reports.length})
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
          <Link href={`/sites/${site.id}/report`}>
            <Button variant="outline" className="w-full gap-2">
              <Clock className="w-4 h-4" />
              Add Condition Report
            </Button>
          </Link>

          {site.reports.map((report) => (
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
                    {formatTimeAgo(report.created_at)}
                  </span>
                </div>
              </div>
              <p className="text-slate-700 text-sm">{report.body}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                <User className="w-3 h-3" />
                {report.reported_by}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="space-y-4">
            {site.description && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-1">Description</h3>
                <p className="text-sm text-slate-600">{site.description}</p>
              </div>
            )}

            {site.restrictions && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-1">
                  Restrictions / Access
                </h3>
                <p className="text-sm text-slate-600">{site.restrictions}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">Data Source</h3>
              <p className="text-sm text-slate-600 capitalize">{site.source}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
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
          <Link href={`/routes/new?site=${site.id}`} className="flex-1">
            <Button variant="primary" className="w-full gap-2">
              Route Here
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
