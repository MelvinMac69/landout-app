'use client';

import { useState } from 'react';
import { Check, X, Eye, MapPin, User } from 'lucide-react';
import { Button, Card } from '@/components/ui';

// TODO: Wire to Supabase with admin permissions
interface PendingSite {
  id: string;
  name: string;
  submitted_by: string;
  submitted_at: string;
  location: { lat: number; lng: number };
  runway_length_ft: number | null;
  runway_surface: string | null;
}

const mockPending: PendingSite[] = [
  {
    id: '1',
    name: 'Lone Peak Strip',
    submitted_by: 'mountain_pilot',
    submitted_at: '2024-03-20T10:30:00Z',
    location: { lat: 40.5263, lng: -111.8234 },
    runway_length_ft: 1800,
    runway_surface: 'dirt',
  },
];

export default function ModerationPage() {
  const [pending, setPending] = useState<PendingSite[]>(mockPending);

  const approve = (id: string) => {
    // TODO: Update Supabase
    setPending((prev) => prev.filter((s) => s.id !== id));
  };

  const reject = (id: string) => {
    // TODO: Update Supabase
    setPending((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Moderation Queue</h1>

      {pending.length === 0 ? (
        <Card className="text-center py-12">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">All caught up!</h2>
          <p className="text-slate-500">No submissions pending review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((site) => (
            <Card key={site.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-lg">
                    {site.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {site.submitted_by}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {site.location.lat.toFixed(4)}, {site.location.lng.toFixed(4)}
                    </span>
                    {site.runway_length_ft && (
                      <span>{site.runway_length_ft.toLocaleString()} ft</span>
                    )}
                    {site.runway_surface && (
                      <span className="capitalize">{site.runway_surface}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => approve(site.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => reject(site.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
