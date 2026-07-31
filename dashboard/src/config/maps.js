/** Same key as Android app — set in dashboard/.env (not committed) */
export const GOOGLE_MAPS_API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyBSAVqEE0dR5hKQGdZov33djH9DUNJKDtc';

export const DEFAULT_MAP_CENTER = { lat: 18.5204, lng: 73.8567 };

export function parseLocation(location) {
  if (!location || typeof location !== 'string') return { ...DEFAULT_MAP_CENTER };
  const parts = location.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return { ...DEFAULT_MAP_CENTER };
}

export function formatLocation(lat, lng) {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

export function getCameraNumber(cam) {
  if (cam?.camera_number != null) return Number(cam.camera_number);
  const m = String(cam?.id || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

/** google.maps.SymbolPath.CIRCLE — numeric constant, no API enum required */
const MARKER_CIRCLE_PATH = 0;

/** Google Maps marker options — numbered pin for city deployment */
export function numberedMarkerOptions(cam) {
  const num = getCameraNumber(cam);
  const label = num != null ? String(num) : '?';
  const isActive = cam?.status === 'active';
  const isPrimary = cam?.is_primary;

  let fillColor = '#64748b';
  if (isActive) fillColor = isPrimary ? '#fbbf24' : '#22c55e';
  else fillColor = '#475569';

  return {
    label: {
      text: label,
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: 'bold',
    },
    icon: {
      path: MARKER_CIRCLE_PATH,
      scale: isPrimary ? 16 : 14,
      fillColor,
      fillOpacity: isActive ? 1 : 0.55,
      strokeColor: isPrimary ? '#fef08a' : '#ffffff',
      strokeWeight: isPrimary ? 3 : 2,
    },
    title: num != null
      ? `#${num} ${cam.name || cam.id}${cam.city ? ` — ${cam.city}` : ''}`
      : (cam.name || cam.id),
    zIndex: isPrimary ? 1000 : (num != null ? 100 + num : 1),
  };
}
