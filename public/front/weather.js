document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('weather-widget-content');
  if (!content || !content.classList.contains('weather-widget__error')) return;

  fetch('/api/weather')
    .then((response) => (response.ok ? response.text() : Promise.reject()))
    .then((html) => {
      document.getElementById('weather-widget-content').outerHTML = html.trim();
    })
    .catch(() => {});
});
