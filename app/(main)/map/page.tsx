'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function MapPageInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const name = searchParams.get('name');
    const icao = searchParams.get('icao');
    const airportType = searchParams.get('airportType');
    const municipality = searchParams.get('municipality');
    const state = searchParams.get('state');
    const dropPin = searchParams.get('dropPin') === '1';

    if (lat && lon && name && dropPin) {
      let decodedName = name;
      let decodedIcao: string | undefined;
      let decodedAirportType: string | undefined;
      let decodedMunicipality: string | undefined;
      let decodedState: string | undefined;
      try {
        decodedName = decodeURIComponent(name);
        decodedIcao = icao ? decodeURIComponent(icao) : undefined;
        decodedAirportType = airportType ? decodeURIComponent(airportType) : undefined;
        decodedMunicipality = municipality ? decodeURIComponent(municipality) : undefined;
        decodedState = state ? decodeURIComponent(state) : undefined;
      } catch {
        // use raw values
      }

      const airportData = {
        lng: parseFloat(lon),
        lat: parseFloat(lat),
        name: decodedName,
        ts: Date.now(),
      };
      (window as any).__landoutPendingAirport = airportData;
      window.dispatchEvent(new CustomEvent('landoutFlyToAirport', { detail: airportData }));
      console.log('[MapPage] dropPin=1, dispatched landoutFlyToAirport');
    }
  }, [searchParams]);

  return (
    <div
      className="h-[calc(100vh-3.5rem)] relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    />
  );
}

function MapPageLoading() {
  return (
    <div
      className="h-[calc(100vh-3.5rem)] relative flex items-center justify-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<MapPageLoading />}>
      <MapPageInner />
    </Suspense>
  );
}
