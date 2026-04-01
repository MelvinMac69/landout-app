// Geospatial utility helpers

/**
 * Calculate distance between two points in miles using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Convert [lng, lat] to [lat, lng] for MapLibre popup
 */
export function formatCoordinates(lng: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lonDir}`;
}

/**
 * Calculate total route distance from array of [lng, lat] points
 */
export function calculateRouteDistance(
  points: [number, number][]
): { totalMiles: number; segmentDistances: number[] } {
  if (points.length < 2) {
    return { totalMiles: 0, segmentDistances: [] };
  }

  const segmentDistances: number[] = [];
  let totalMiles = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const [lon1, lat1] = points[i];
    const [lon2, lat2] = points[i + 1];
    const distance = haversineDistance(lat1, lon1, lat2, lon2);
    segmentDistances.push(distance);
    totalMiles += distance;
  }

  return { totalMiles, segmentDistances };
}
