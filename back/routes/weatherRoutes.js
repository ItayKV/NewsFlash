const express = require('express');
const controller = require('../controllers/weatherController');

const router = express.Router();

router.get('/weather', controller.getWeather);

module.exports = router;
