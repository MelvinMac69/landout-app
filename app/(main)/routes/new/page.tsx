'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { calculateRouteDistance } from '@/lib/utils/geo';
import { formatDistance } from '@/lib/utils/format';

const BackcountryMap = dynamic(
  () => import('@/components/map/BackcountryMap').then((mod) => mod.BackcountryMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse" /> }
);

interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

function RouteBuilder() {
  const searchParams = useSearchParams();
  const initialSite = searchParams.get('site');

  const [waypoints, setWaypoints] = useState<Waypoint[]>(
    initialSite
      ? [{ id: '1', lng: -109.8231, lat: 38.9067, label: 'Start' }]
      : []
  );
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);

  const addWaypoint = useCallback(() => {
    const newId = Date.now().toString();
    setWaypoints((prev) => [
      ...prev,
      { id: newId, lng: -110 + Math.random() * 10, lat: 39 + Math.random() * 5, label: '' },
    ]);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((wp) => wp.id !== id));
  }, []);

  const updateWaypoint = useCallback(
    (id: string, field: 'label' | 'lng' | 'lat', value: string | number) => {
      setWaypoints((prev) =>
        prev.map((wp) => (wp.id === id ? { ...wp, [field]: value } : wp))
      );
    },
    []
  );

  const routeGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((wp) => [wp.lng, wp.lat]),
        },
        properties: {},
      },
      ...waypoints.map((wp) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [wp.lng, wp.lat],
        },
        properties: { id: wp.id, label: wp.label },
      })),
    ],
  };

  const { totalMiles, segmentDistances } = calculateRouteDistance(
    waypoints.map((wp) => [wp.lng, wp.lat])
  );

  const handleSave = async () => {
    if (!routeName.trim() || waypoints.length < 2) return;

    setSaving(true);
    console.log('Saving route:', { name: routeName, waypoints, totalMiles });
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row">
      {/* Map */}
      <div className="flex-1 relative">
        <BackcountryMap routesGeoJson={routeGeoJson} />
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200 overflow-y-auto">
        <div className="p-4">
          <h1 className="text-xl font-bold text-slate-900 mb-4">Plan Route</h1>

          <Input
            label="Route Name"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="e.g., Moab to Escalante"
            className="mb-4"
          />

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-700">
              Waypoints ({waypoints.length})
            </h2>
            <Button variant="outline" size="sm" onClick={addWaypoint} className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-3 mb-4">
            {waypoints.map((wp, index) => (
              <Card key={wp.id} padding="sm">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Label (optional)"
                      value={wp.label}
                      onChange={(e) => updateWaypoint(wp.id, 'label', e.target.value)}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Lat"
                        value={wp.lat}
                        onChange={(e) => updateWaypoint(wp.id, 'lat', parseFloat(e.target.value))}
                        className="text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Lng"
                        value={wp.lng}
                        onChange={(e) => updateWaypoint(wp.id, 'lng', parseFloat(e.target.value))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  {waypoints.length > 2 && (
                    <button
                      onClick={() => removeWaypoint(wp.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {waypoints.length >= 2 && (
            <Card className="bg-slate-50 mb-4">
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-1">Total Distance</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatDistance(totalMiles)}
                </p>
              </div>
              {segmentDistances.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">Segments</p>
                  <div className="flex flex-wrap gap-2">
                    {segmentDistances.map((dist, i) => (
                      <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-slate-200">
                        {i + 1}→{i + 2}: {formatDistance(dist)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Button
            onClick={handleSave}
            disabled={!routeName.trim() || waypoints.length < 2 || saving}
            className="w-full gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Route'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewRoutePage() {
  return (
    <Suspense fallback={<div className="w-full h-full bg-slate-100 animate-pulse" />}>
      <RouteBuilder />
    </Suspense>
  );
}
