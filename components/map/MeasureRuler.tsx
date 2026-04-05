'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

type Phase = 'off' | 'placingB' | 'placed';

interface GeoPoint { lng: number; lat: number }
interface ScreenPoint { x: number; y: number }

function haversineNm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(nm: number): string {
  if (nm < 0.25) return `${Math.round(nm * 6076.12)} ft`;
  if (nm < 10) return `${nm.toFixed(1)} NM`;
  return `${Math.round(nm)} NM`;
}

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

interface MeasureRulerProps {
  map: maplibregl.Map | null;
  /** Called whenever measure phase changes — lets BackcountryMap sync its click-guard ref */
  onMeasurePhaseChange: (phase: 'off' | 'placingB' | 'placed') => void;
}

export function MeasureRuler({ map, onMeasurePhaseChange }: MeasureRulerProps) {
  const [phase, setPhase] = useState<Phase>('off');
  const [pointA, setPointA] = useState<ScreenPoint & GeoPoint | null>(null);
  const [pointB, setPointB] = useState<ScreenPoint & GeoPoint | null>(null);
  const [dragging, setDragging] = useState<'A' | 'B' | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);

  const phaseRef = useRef<Phase>('off');
  const mapRef = useRef(map);
  mapRef.current = map;

  // Keep phaseRef in sync for use in event callbacks
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Expose window.landoutMeasureClear for external callers (e.g. page.tsx)
  useEffect(() => {
    (window as any).landoutMeasureClear = () => {
      phaseRef.current = 'off';
      setPhase('off');
      setPointA(null);
      setPointB(null);
      setCtxMenu(null);
      onMeasurePhaseChange('off');
    };
    return () => { delete (window as any).landoutMeasureClear; };
  }, [onMeasurePhaseChange]);

  // ── Right-click → context menu (desktop only) ─────────────────────────────────
  useEffect(() => {
    if (!map) return;
    // Only listen for contextmenu on non-touch devices to avoid iOS Safari conflicts
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    function onCtxMenu(e: maplibregl.MapMouseEvent) {
      try { e.preventDefault(); } catch {}
      setCtxMenu({ x: e.point.x, y: e.point.y, lng: e.lngLat.lng, lat: e.lngLat.lat });
    }
    map.on('contextmenu', onCtxMenu);
    return () => { map.off('contextmenu', onCtxMenu); };
  }, [map]);

  // ── Map click → place point B when in placingB phase ──────────────────────
  useEffect(() => {
    if (!map) return;
    function onClick(e: maplibregl.MapMouseEvent) {
      if (phaseRef.current !== 'placingB') return;
      const p = mapRef.current!.project([e.lngLat.lng, e.lngLat.lat]);
      phaseRef.current = 'placed';
      setPhase('placed');
      setPointB({ x: p.x, y: p.y, lng: e.lngLat.lng, lat: e.lngLat.lat });
      onMeasurePhaseChange('placed');
    }
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, onMeasurePhaseChange]);

  // Two-finger touch removed — mobile users use right-click context menu (desktop)
  // or the existing ActionMenu long-press for Direct To / Save Pin

  // ── Drag endpoints ───────────────────────────────────────────────────────
  const onEndpointPointerDown = useCallback((id: 'A' | 'B', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id);
  }, []);

  const onEndpointPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !mapRef.current) return;
    const rect = mapRef.current.getCanvas().getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ll = mapRef.current.unproject([x, y]);
    if (dragging === 'A') setPointA(prev => prev ? { ...prev, x, y, lng: ll.lng, lat: ll.lat } : null);
    else setPointB(prev => prev ? { ...prev, x, y, lng: ll.lng, lat: ll.lat } : null);
  }, [dragging]);

  const onEndpointPointerUp = useCallback(() => { setDragging(null); }, []);

  // ── Recalculate screen positions when map moves ──────────────────────────
  const refreshScreens = useCallback(() => {
    if (!mapRef.current) return;
    if (pointA) {
      const p = mapRef.current.project([pointA.lng, pointA.lat]);
      setPointA(prev => prev ? { ...prev, x: p.x, y: p.y } : null);
    }
    if (pointB) {
      const p = mapRef.current.project([pointB.lng, pointB.lat]);
      setPointB(prev => prev ? { ...prev, x: p.x, y: p.y } : null);
    }
  }, [pointA, pointB]);

  useEffect(() => {
    if (!map) return;
    map.on('move', refreshScreens);
    map.on('zoom', refreshScreens);
    return () => {
      map.off('move', refreshScreens);
      map.off('zoom', refreshScreens);
    };
  }, [map, refreshScreens]);

  function clear() {
    phaseRef.current = 'off';
    setPhase('off');
    setPointA(null);
    setPointB(null);
    setCtxMenu(null);
    onMeasurePhaseChange('off');
  }

  function startMeasureFromPoint(lng: number, lat: number) {
    if (!mapRef.current) return;
    const p = mapRef.current!.project([lng, lat]);
    phaseRef.current = 'placingB';
    setPhase('placingB');
    setPointA({ x: p.x, y: p.y, lng, lat });
    setPointB(null);
    setCtxMenu(null);
    onMeasurePhaseChange('placingB');
  }

  const distanceNm = pointA && pointB ? haversineNm(pointA.lng, pointA.lat, pointB.lng, pointB.lat) : 0;
  const W = map ? map.getCanvas().width : 0;
  const H = map ? map.getCanvas().height : 0;

  return (
    <>
      {/* SVG overlay — absolutely positioned over the map canvas */}
      {phase !== 'off' && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 45,
            overflow: 'visible',
          }}
          width={W} height={H}
        >
          {/* Measure line */}
          {pointA && pointB && (
            <>
              <line x1={pointA.x} y1={pointA.y} x2={pointB.x} y2={pointB.y}
                stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round" />
              <text
                x={(pointA.x + pointB.x) / 2} y={(pointA.y + pointB.y) / 2 - 10}
                textAnchor="middle" fill="#FF6B00" fontSize={14} fontWeight={700}
                stroke="white" strokeWidth={3} paintOrder="stroke"
              >
                {formatDist(distanceNm)}
              </text>
            </>
          )}
          {/* Pending point A marker (dashed circle while waiting for B) */}
          {pointA && !pointB && (
            <circle cx={pointA.x} cy={pointA.y} r={8}
              fill="rgba(255,107,0,0.2)" stroke="#FF6B00" strokeWidth={2} strokeDasharray="5 3" />
          )}
          {/* Endpoint A */}
          {pointA && (
            <circle cx={pointA.x} cy={pointA.y} r={8}
              fill="#FF6B00" stroke="white" strokeWidth={2.5}
              style={{ pointerEvents: 'all', cursor: dragging === 'A' ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={e => onEndpointPointerDown('A', e)}
              onPointerMove={onEndpointPointerMove}
              onPointerUp={onEndpointPointerUp}
            />
          )}
          {/* Endpoint B */}
          {pointB && (
            <circle cx={pointB.x} cy={pointB.y} r={8}
              fill="#FF6B00" stroke="white" strokeWidth={2.5}
              style={{ pointerEvents: 'all', cursor: dragging === 'B' ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={e => onEndpointPointerDown('B', e)}
              onPointerMove={onEndpointPointerMove}
              onPointerUp={onEndpointPointerUp}
            />
          )}
        </svg>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          style={{
            position: 'absolute', top: ctxMenu.y, left: ctxMenu.x,
            zIndex: 300, background: 'rgba(26,32,44,0.97)',
            border: '1.5px solid #D4621A', borderRadius: 12,
            padding: '10px 14px', minWidth: 210,
            boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            pointerEvents: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Coordinates
          </div>
          <div style={{ fontSize: 12, color: '#C9B99A', fontFamily: 'monospace', marginBottom: 10 }}>
            {formatCoord(ctxMenu.lat, ctxMenu.lng)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => {
                const fn = (window as any).landoutSetDirectTo;
                if (fn) fn({ lng: ctxMenu.lng, lat: ctxMenu.lat, name: formatCoord(ctxMenu.lat, ctxMenu.lng), type: 'map' });
                setCtxMenu(null);
              }}
              style={{ background: '#BE185D', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
            >
              ✈ Direct To
            </button>
            <button
              onClick={() => {
                const fn = (window as any).landoutDropPin;
                if (fn) fn(ctxMenu.lng, ctxMenu.lat, formatCoord(ctxMenu.lat, ctxMenu.lng));
                setCtxMenu(null);
              }}
              style={{ background: 'transparent', color: '#C9B99A', border: '1px solid #4A5568', borderRadius: 8, padding: '8px 12px', fontWeight: 500, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
            >
              📍 Save Pin
            </button>
            <button
              onClick={() => startMeasureFromPoint(ctxMenu.lng, ctxMenu.lat)}
              style={{ background: 'transparent', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.4)', borderRadius: 8, padding: '8px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
            >
              📏 Measure Distance
            </button>
            <button
              onClick={() => setCtxMenu(null)}
              style={{ background: 'transparent', color: '#718096', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', textAlign: 'center' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tap-to-place second point instruction */}
      {phase === 'placingB' && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(26,32,44,0.92)', border: '1.5px solid #FF6B00', borderRadius: 10, padding: '8px 16px', color: '#FF6B00', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            📏 Tap second point to measure
          </div>
        </div>
      )}

      {/* Clear Measurement — always visible when line is placed */}
      {phase === 'placed' && (
        <div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'auto' }}>
          <div style={{ background: 'rgba(26,32,44,0.95)', border: '1.5px solid #FF6B00', borderRadius: 12, padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FF6B00' }}>
              📏 {formatDist(distanceNm)}
            </div>
            <button
              onClick={clear}
              style={{ background: 'transparent', border: '1px solid rgba(255,107,0,0.5)', borderRadius: 8, padding: '6px 16px', color: '#FF6B00', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Clear Measurement
            </button>
          </div>
        </div>
      )}


    </>
  );
}
