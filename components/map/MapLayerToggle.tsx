'use client';

import { useState } from 'react';
import { Layers, X } from 'lucide-react';
import { Button } from '@/components/ui';

interface Layer {
  id: string;
  label: string;
  color: string;
  description: string;
  visible: boolean;
}

interface MapLayerToggleProps {
  layers: Layer[];
  onToggle: (layerId: string) => void;
}

export function MapLayerToggle({ layers, onToggle }: MapLayerToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const visibleCount = layers.filter((l) => l.visible).length;

  return (
    <div className="absolute top-4 right-4 z-10">
      {isOpen ? (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Map Layers
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="space-y-2">
            {layers.map((layer) => (
              <label
                key={layer.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => onToggle(layer.id)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="font-medium text-slate-700 text-sm">
                      {layer.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {layer.description}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Overlay data from BLM, USFS, and USGS. Verify accuracy before use.
            </p>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 shadow-md"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Layers</span>
          {visibleCount > 0 && (
            <span className="bg-slate-900 text-white text-xs px-1.5 py-0.5 rounded-full">
              {visibleCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
