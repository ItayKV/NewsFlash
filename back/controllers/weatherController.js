const weatherService = require('../services/weatherService');
const { HTTP_STATUS } = require('../config/constants');

function getWeather(req, res) {
  const weather = weatherService.getCurrentWeather();
  const status = weather ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
  res.status(status).render('partials/weatherWidgetContent', { weather });
}

module.exports = { getWeather };
