const CACHE_TTL_MS = 15 * 60 * 1000;

let cachedWeather = null;
let refreshTimeoutId = null;

async function fetchAndCacheWeather() {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const location = process.env.WEATHER_DEFAULT_LOCATION;
    if (!apiKey || !location) {
      throw new Error('Missing OPENWEATHER_API_KEY or WEATHER_DEFAULT_LOCATION environment variable');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenWeatherMap request failed with status ${response.status}`);

    const body = await response.json();
    cachedWeather = {
      city: body.name,
      temperature: Math.round(body.main.temp),
      description: body.weather[0].description,
      icon: body.weather[0].icon,
    };
    console.log(`[${new Date().toISOString()}] Weather cache refreshed:`, cachedWeather);
  } catch (err) {
    console.error('Weather refresh failed:', err.message);
  }
}

async function refreshLoop() {
  await fetchAndCacheWeather();
  refreshTimeoutId = setTimeout(refreshLoop, CACHE_TTL_MS).unref();
}

/** Returns the cached weather snapshot, or null if none has been fetched successfully yet. */
function getCurrentWeather() {
  return cachedWeather;
}

/** Stops the background refresh loop; call on server shutdown to let the process exit cleanly. */
function stopRefreshLoop() {
  clearTimeout(refreshTimeoutId);
  refreshTimeoutId = null;
}

refreshLoop();

module.exports = { getCurrentWeather, stopRefreshLoop };
