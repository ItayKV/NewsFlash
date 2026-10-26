const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const CACHE_TTL_MS = 15 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
// The most visitor locations kept in the cache, so its memory can't grow without limit.
const MAX_CACHED_LOCATIONS = 500;

let cachedWeather = null;

// Weather by rounded visitor location: "lat,lon" -> { weather, fetchedAt }.
// A Map keeps insertion order, so its first key is the entry fetched longest ago.
const weatherByLocation = new Map();

/**
 * Requests the current weather from OpenWeatherMap for a location: { q: city } or { lat, lon }.
 * Returns { city, temperature, description, icon }, or null if the request failed.
 */
async function requestWeather(locationParams) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error('Missing OPENWEATHER_API_KEY environment variable');

    const params = new URLSearchParams({ ...locationParams, appid: apiKey, units: 'metric' });
    const response = await fetch(`${OPENWEATHER_URL}?${params}`);
    if (!response.ok) throw new Error(`OpenWeatherMap request failed with status ${response.status}`);

    const body = await response.json();
    return {
      city: body.name,
      temperature: Math.round(body.main.temp),
      description: body.weather[0].description,
      icon: body.weather[0].icon,
    };
  } catch (err) {
    console.error('Weather request failed:', err.message);
    return null;
  }
}

async function fetchAndCacheWeather() {
  const location = process.env.WEATHER_DEFAULT_LOCATION;
  if (!location) {
    console.error('Weather refresh failed: missing WEATHER_DEFAULT_LOCATION environment variable');
    return false;
  }

  const weather = await requestWeather({ q: location });
  if (!weather) return false;

  cachedWeather = weather;
  console.log(`[${new Date().toISOString()}] Weather cache refreshed:`, cachedWeather);
  return true;
}

async function refreshLoop() {
  const refreshSucceeded = await fetchAndCacheWeather();
  const delayMs = refreshSucceeded ? CACHE_TTL_MS : RETRY_AFTER_FAILURE_MS;
  // unref() so the pending timer never keeps the process alive on shutdown.
  setTimeout(refreshLoop, delayMs).unref();
}

/** Returns the cached weather snapshot, or null if none has been fetched successfully yet. */
function getCurrentWeather() {
  return cachedWeather;
}

/**
 * Returns the weather at a visitor's coordinates, or null if it could not be fetched.
 * Coordinates are rounded to 2 decimal places (about 1.1 km), so nearby visitors share one cache entry,
 * and an entry is reused for CACHE_TTL_MS before OpenWeatherMap is asked again.
 */
async function getWeatherByCoordinates(lat, lon) {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const cacheKey = `${roundedLat},${roundedLon}`;

  const cached = weatherByLocation.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.weather;

  const weather = await requestWeather({ lat: roundedLat, lon: roundedLon });
  if (!weather) return null;

  // Re-inserted at the end, so the first key stays the one fetched longest ago.
  weatherByLocation.delete(cacheKey);
  if (weatherByLocation.size >= MAX_CACHED_LOCATIONS) {
    weatherByLocation.delete(weatherByLocation.keys().next().value);
  }
  weatherByLocation.set(cacheKey, { weather, fetchedAt: Date.now() });
  console.log(`[${new Date().toISOString()}] Weather cached for location ${cacheKey}:`, weather);
  return weather;
}

refreshLoop();

module.exports = { getCurrentWeather, getWeatherByCoordinates };
