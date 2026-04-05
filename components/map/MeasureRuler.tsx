'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

type Phase = 'off' | 'onePoint' | 'measuring';

interface Point { x: number; y: number; lng: number; lat: number }

function formatDist(nm: number): string {
  if (nm < 0.25) return `${Math.round(nm * 6076.12)} ft`;
  return `${nm.toFixed(2)} NM`;
}

export function MeasureRuler({ map }: { map: maplibregl.Map | null }) {
  const [phase, setPhase] = useState<Phase>('off');
  const [pA, setPA] = useState<Point | null>(null);
  const [pB, setPB] = useState<Point | null>(null);
  const [dragId, setDragId] = useState<'A' | 'B' | null>(null);
  const phaseRef = useRef<Phase>('off');
  const mapRef = useRef(map);
  mapRef.current = map;

  // Listen for landoutStartMeasureFrom from DirectToPanel
  useEffect(() => {
    function handler(e: Event) {
      const { lng, lat } = (e as CustomEvent<{ lng: number; lat: number }>).detail;
      if (!mapRef.current) return;
      const pt: Point = { x: 0, y: 0, lng, lat };
      phaseRef.current = 'onePoint';
      setPhase('onePoint');
      setPA(pt);
      setPB(null);
    }
    window.addEventListener('landoutStartMeasureFrom', handler);
    return () => window.removeEventListener('landoutStartMeasureFrom', handler);
  }, []);

  // Map click → place next point
  useEffect(() => {
    if (!map) return;

    function onClick(e: maplibregl.MapMouseEvent) {
      if (phaseRef.current === 'off') return;
      const { lng, lat } = e.lngLat;
      const pt: Point = { x: e.point.x, y: e.point.y, lng, lat };

      if (phaseRef.current === 'onePoint') {
        phaseRef.current = 'measuring';
        setPhase('measuring');
        setPA(pt);
        setPB(null);
      } else if (phaseRef.current === 'measuring') {
        setPB(pt);
      }
    }

    function onContextMenu(e: maplibregl.MapMouseEvent) {
      if (phaseRef.current === 'measuring') e.preventDefault();
    }

    map.on('click', onClick);
    map.on('contextmenu', onContextMenu);
    return () => {
      map.off('click', onClick);
      map.off('contextmenu', onContextMenu);
    };
  }, [map]);

  // Recalculate screen positions on map move
  const refreshScreens = useCallback(() => {
    if (!mapRef.current || !pA) return;
    const a = mapRef.current.project([pA.lng, pA.lat]);
    setPA(prev => prev ? { ...prev, x: a.x, y: a.y } : null);
    if (pB) {
      const b = mapRef.current.project([pB.lng, pB.lat]);
      setPB({ ...pB, x: b.x, y: b.y });
    }
  }, [pA, pB]);

  useEffect(() => {
    if (!map) return;
    map.on('move', refreshScreens);
    return () => { map.off('move', refreshScreens); };
  }, [map, refreshScreens]);

  // Drag endpoint circles
  const onCirclePointerDown = useCallback((id: 'A' | 'B', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onCirclePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragId || !mapRef.current) return;
    const canvas = mapRef.current.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lngLat = mapRef.current.unproject([x, y]);
    const pt: Point = { x, y, lng: lngLat.lng, lat: lngLat.lat };
    if (dragId === 'A') setPA(pt);
    else setPB(pt);
  }, [dragId]);

  const onCirclePointerUp = useCallback(() => { setDragId(null); }, []);

  const clear = useCallback(() => {
    phaseRef.current = 'off';
    setPhase('off');
    setPA(null);
    setPB(null);
  }, []);

  if (phase === 'off' || !map) return null;

  const distanceNm = pA && pB ? haversineNm(pA.lng, pA.lat, pB.lng, pB.lat) : 0;
  const W = map.getCanvas().width;
  const H = map.getCanvas().height;

  return (
    <>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, pointerEvents: 'none', zIndex: 40, overflow: 'visible' }}
        width={W} height={H}
      >
        {pA && pB && (
          <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y}
            stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={phase === 'onePoint' ? '6 4' : 'none'}
            opacity={phase === 'measuring' ? 1 : 0.6}
          />
        )}
        {pA && pB && phase === 'measuring' && (
          <text x={(pA.x + pB.x) / 2} y={(pA.y + pB.y) / 2 - 10}
            textAnchor="middle" fill="#FF6B00" fontSize={13} fontWeight={700}
            stroke="white" strokeWidth={3} paintOrder="stroke">
            {formatDist(distanceNm)}
          </text>
        )}
        {pA && (
          <circle cx={pA.x} cy={pA.y} r={7} fill="#FF6B00" stroke="white" strokeWidth={2}
            style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
            onPointerDown={e => onCirclePointerDown('A', e)}
            onPointerMove={onCirclePointerMove}
            onPointerUp={onCirclePointerUp}
          />
        )}
        {pB && (
          <circle cx={pB.x} cy={pB.y} r={7} fill="#FF6B00" stroke="white" strokeWidth={2}
            style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
            onPointerDown={e => onCirclePointerDown('B', e)}
            onPointerMove={onCirclePointerMove}
            onPointerUp={onCirclePointerUp}
          />
        )}
      </svg>

      {phase === 'measuring' && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'auto' }}>
          <div style={{ background: 'rgba(26,32,44,0.95)', border: '1.5px solid #FF6B00', borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 12, color: '#FF6B00', fontWeight: 700, whiteSpace: 'nowrap' }}>📏 {formatDist(distanceNm)}</div>
            <button onClick={clear} style={{ background: 'transparent', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 6, padding: '5px 14px', color: '#FF6B00', fontSize: 12, cursor: 'pointer' }}>
              Clear Measurement
            </button>
          </div>
        </div>
      )}

      {phase === 'onePoint' && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(26,32,44,0.9)', border: '1px solid #4A5568', borderRadius: 8, padding: '8px 16px', color: '#C9B99A', fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          Tap a second point on the map
        </div>
      )}
    </>
  );
}

function haversineNm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
