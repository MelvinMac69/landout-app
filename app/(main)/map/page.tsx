'use client';

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Handles "View on Map" URL params — dispatches landoutFlyToAirport to the
// persistent BackcountryMap living in the layout.
function MapUrlHandler() {
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
    }
  }, [searchParams]);

  return null;
}

// map/page.tsx — back to being a simple transparent container.
// All map state, controls, and URL param handling lives in the layout.
export default function MapPage() {
  return (
    <Suspense>
      <MapUrlHandler />
      <div
        className="h-[calc(100vh-3.5rem)] relative"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
    </Suspense>
  );
}
