const weatherService = require('../services/weatherService');
const weatherValidators = require('../validators/weatherValidators');
const { HTTP_STATUS } = require('../config/constants');

const renderWidgetContent = (res, status, weather) => res.status(status).render('partials/weatherWidgetContent', { weather });

/** Renders the weather widget content: at the visitor's location when `lat` and `lon` are given, otherwise the default city. */
async function getWeather(req, res, next) {
  try {
    const { coordinates, error } = weatherValidators.parseCoordinates(req.query);
    if (error) return renderWidgetContent(res, HTTP_STATUS.BAD_REQUEST, null);

    const weather = coordinates
      ? await weatherService.getWeatherByCoordinates(coordinates.lat, coordinates.lon)
      : weatherService.getCurrentWeather();
    const status = weather ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
    renderWidgetContent(res, status, weather);
  } catch (err) {
    next(err);
  }
}

module.exports = { getWeather };
