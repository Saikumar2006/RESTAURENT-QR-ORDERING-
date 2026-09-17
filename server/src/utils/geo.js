const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two lat/lng points, in meters.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// True if (lat, lon) is within the restaurant's configured geofence.
// Callers should treat "restaurant has no lat/lng configured" as a config
// error, not silently let everyone through — see orderService.js.
function isWithinGeofence(restaurant, lat, lon) {
  if (restaurant.latitude == null || restaurant.longitude == null) return null; // not configured
  const d = distanceMeters(restaurant.latitude, restaurant.longitude, lat, lon);
  return d <= restaurant.geofenceRadiusMeters;
}

module.exports = { distanceMeters, isWithinGeofence };
