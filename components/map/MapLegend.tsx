export function MapLegend() {
  const items = [
    { color: '#8B6914', label: 'BLM Land', agency: 'Bureau of Land Management' },
    { color: '#2D5016', label: 'USFS Land', agency: 'Forest Service' },
    { color: '#6B3FA0', label: 'NPS Land', agency: 'National Park Service' },
    { color: '#1E5A8A', label: 'FWS Land', agency: 'Fish & Wildlife Service' },
    { color: '#1D4D1D', label: 'Wilderness', agency: 'Designated wilderness area' },
    { color: '#7B3F00', label: 'WSA', agency: 'Wilderness Study Area' },
  ];

  return (
    <div className="absolute bottom-24 md:bottom-8 left-4 z-10 bg-white rounded-lg shadow-lg border border-slate-200 p-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Land Status (BLM SMA)
      </h4>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="w-4 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div>
              <span className="text-sm text-slate-700">{item.label}</span>
              <span className="text-xs text-slate-400 block">{item.agency}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Sources: BLM SMA, BLM NLCS, USGS. Does not equal legal landing permission.
        </p>
      </div>
    </div>
  );
}
