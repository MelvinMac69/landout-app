'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Upload, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';

export default function NewSitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    icao_code: '',
    latitude: '',
    longitude: '',
    elevation_ft: '',
    runway_length_ft: '',
    runway_surface: 'unknown',
    description: '',
    restrictions: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // TODO: Wire to Supabase
    console.log('Submitting site:', formData);

    setTimeout(() => {
      setLoading(false);
      router.push('/map');
    }, 1000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Add Landing Site</h1>
      <p className="text-slate-500 mb-6">
        Submit a new strip or landing site for the community
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <h2 className="font-semibold text-slate-900 mb-4">Basic Info</h2>

          <div className="space-y-4">
            <Input
              label="Site Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Lone Peak Landing"
              required
            />

            <Input
              label="ICAO Code (if any)"
              name="icao_code"
              value={formData.icao_code}
              onChange={handleChange}
              placeholder="e.g., KPVU"
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-4">Location</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              name="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="38.9067"
              required
            />

            <Input
              label="Longitude"
              name="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="-109.8231"
              required
            />
          </div>

          <p className="text-xs text-slate-500 mt-2">
            <MapPin className="w-3 h-3 inline mr-1" />
            Or click on the map to set location
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-4">Runway Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Elevation (ft MSL)"
              name="elevation_ft"
              type="number"
              value={formData.elevation_ft}
              onChange={handleChange}
              placeholder="5500"
            />

            <Input
              label="Runway Length (ft)"
              name="runway_length_ft"
              type="number"
              value={formData.runway_length_ft}
              onChange={handleChange}
              placeholder="2500"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Surface Type
            </label>
            <select
              name="runway_surface"
              value={formData.runway_surface}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="unknown">Unknown</option>
              <option value="paved">Paved</option>
              <option value="dirt">Dirt</option>
              <option value="gravel">Gravel</option>
              <option value="grass">Grass</option>
              <option value="snow">Snow/Ice</option>
            </select>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-4">Additional Info</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Any notable features, approach considerations..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Restrictions / Access Notes
              </label>
              <textarea
                name="restrictions"
                value={formData.restrictions}
                onChange={handleChange}
                rows={2}
                placeholder="Permits required, seasonal closures, contact info..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 placeholder:text-slate-400"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Submitting...' : 'Submit Site'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          Submissions are reviewed before becoming public
        </p>
      </form>
    </div>
  );
}
