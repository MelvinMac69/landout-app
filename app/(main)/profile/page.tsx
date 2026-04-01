'use client';

import { useState } from 'react';
import { User, MapPin, Bookmark, Clock, Settings, LogOut } from 'lucide-react';
import { Button, Card } from '@/components/ui';

// TODO: Wire to Supabase auth
const mockUser = {
  email: 'trent@example.com',
  username: 'trentpalmer',
  membership_tier: 'free',
  created_at: '2024-01-15T00:00:00Z',
};

const mockSavedSites = [
  { id: '1', name: 'Lone Peak', icao: null, distance: '12 mi away' },
  { id: '2', name: 'Canyonlands Field', icao: 'CNY', distance: '45 mi away' },
];

const mockRoutes = [
  { id: '1', name: 'Moab to Escalante', distance: '78 mi', updated_at: '2 days ago' },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'saved' | 'routes'>('saved');

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <User className="w-8 h-8 text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {mockUser.username}
          </h1>
          <p className="text-sm text-slate-500">{mockUser.email}</p>
          <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
            {mockUser.membership_tier} Member
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-slate-900">{mockSavedSites.length}</p>
          <p className="text-xs text-slate-500">Saved Sites</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-slate-900">{mockRoutes.length}</p>
          <p className="text-xs text-slate-500">Routes</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-slate-900">0</p>
          <p className="text-xs text-slate-500">Sites Added</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'saved'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Saved
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'routes'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Routes
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'saved' ? (
        <div className="space-y-3">
          {mockSavedSites.map((site) => (
            <Card key={site.id} className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{site.name}</h3>
                    {site.icao && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {site.icao}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{site.distance}</p>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            </Card>
          ))}

          {mockSavedSites.length === 0 && (
            <div className="text-center py-8">
              <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No saved sites yet</p>
              <p className="text-sm text-slate-400">
                Tap the bookmark icon on any site to save it
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mockRoutes.map((route) => (
            <Card key={route.id} className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{route.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{route.distance}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {route.updated_at}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Open
                </Button>
              </div>
            </Card>
          ))}

          {mockRoutes.length === 0 && (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No routes yet</p>
              <p className="text-sm text-slate-400">
                Create a route from the map view
              </p>
            </div>
          )}
        </div>
      )}

      {/* Settings link */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <Button variant="outline" className="w-full gap-2 justify-start">
          <Settings className="w-4 h-4" />
          Account Settings
        </Button>
        <Button variant="ghost" className="w-full gap-2 justify-start text-red-600 mt-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
