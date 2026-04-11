'use client';

export const dynamic = 'force-dynamic';

// map/page.tsx handles URL params from "View on Map" navigation.
// The BackcountryMap is in the layout — this page just handles URL params
// and dispatches events to the already-mounted map.

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function MapPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const name = searchParams.get('name');
    const icao = searchParams.get('icao');
    const airportType = searchParams.get('airportType');
    const municipality = searchParams.get('municipality');
    const state = searchParams.get('state');
    const runway = searchParams.get('runway');
    const elev = searchParams.get('elev');
    const siteId = searchParams.get('siteId');
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
