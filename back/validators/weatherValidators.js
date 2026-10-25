const isMissing = (value) => value === undefined || value === '';

/** Parses a query value into a number in [min, max], or returns null if it is not one. */
function parseNumberInRange(value, min, max) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

/**
 * Parses the visitor's location from the `lat` and `lon` query parameters.
 * Both missing (or empty) means no location: { coordinates: null }, and the default city is used.
 * Otherwise both must be numbers, lat from -90 to 90 and lon from -180 to 180.
 * Returns { coordinates: { lat, lon } } or { error } with a message.
 */
function parseCoordinates(query) {
  const { lat, lon } = query || {};
  if (isMissing(lat) && isMissing(lon)) return { coordinates: null };

  const latitude = parseNumberInRange(lat, -90, 90);
  const longitude = parseNumberInRange(lon, -180, 180);
  if (latitude === null || longitude === null) {
    return { error: 'lat and lon must both be given, lat from -90 to 90 and lon from -180 to 180' };
  }
  return { coordinates: { lat: latitude, lon: longitude } };
}

module.exports = { parseCoordinates };
