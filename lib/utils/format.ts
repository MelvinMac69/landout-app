/**
 * Format runway length for display
 */
export function formatRunwayLength(feet: number | null): string {
  if (!feet) return 'Unknown';
  if (feet >= 5280) {
    return `${(feet / 5280).toFixed(1)} mi`;
  }
  return `${feet.toLocaleString()} ft`;
}

/**
 * Format elevation for display
 */
export function formatElevation(feet: number | null): string {
  if (!feet) return 'Unknown';
  return `${feet.toLocaleString()} ft MSL`;
}

/**
 * Format surface type for display
 */
export function formatSurface(surface: string | null): string {
  if (!surface) return 'Unknown';
  const labels: Record<string, string> = {
    dirt: 'Dirt',
    gravel: 'Gravel',
    paved: 'Paved',
    grass: 'Grass',
    snow: 'Snow/Ice',
    unknown: 'Unknown',
  };
  return labels[surface] || surface;
}

/**
 * Format distance in miles/nm
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(miles)} mi`;
}

/**
 * Format time ago for timestamps
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}
