const GEOLOCATION_OPTIONS = { timeout: 10000, maximumAge: 15 * 60 * 1000 }; // reuses a position up to 15 minutes old

// Resolves to the widget content HTML rendered by the server, or rejects if the weather is unavailable.
const fetchWidgetHtml = (url) => fetch(url).then((response) => (response.ok ? response.text() : Promise.reject()));

const replaceWidgetContent = (html) => {
  document.getElementById('weather-widget-content').outerHTML = html.trim();
};

document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('weather-widget-content');
  if (!content) return;

  let showsLocalWeather = false;

  // The default city failed to render on the server: try it again, unless the local weather has already replaced it.
  if (content.classList.contains('weather-widget__error')) {
    fetchWidgetHtml('/weather')
      .then((html) => {
        if (!showsLocalWeather) replaceWidgetContent(html);
      })
      .catch(() => {});
  }

  if (!navigator.geolocation) return;

  // If the visitor allows it, swap in the weather where they are. Otherwise the default city stays.
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const params = new URLSearchParams({ lat: coords.latitude, lon: coords.longitude });
      fetchWidgetHtml(`/weather?${params}`)
        .then((html) => {
          showsLocalWeather = true;
          replaceWidgetContent(html);
        })
        .catch(() => {});
    },
    () => {}, // denied, unavailable or timed out
    GEOLOCATION_OPTIONS
  );
});
