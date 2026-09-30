const express = require('express');
const router = express.Router();
const {
  getForecast,
  generateForecast,
  generateAllForecasts,
} = require('../controllers/forecastController');

router.get('/:productId', getForecast);
router.post('/:productId', generateForecast);
router.post('/generate-all', generateAllForecasts);

module.exports = router;
