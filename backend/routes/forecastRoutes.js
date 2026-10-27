const express = require('express');
const router = express.Router();
const {
  getForecast,
  generateForecast,
  generateAllForecasts,
} = require('../controllers/forecastController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/generate-all', protect, authorize('ADMIN', 'MANAGER'), generateAllForecasts);
router.get('/:productId', protect, authorize('ADMIN', 'MANAGER'), getForecast);
router.post('/:productId', protect, authorize('ADMIN', 'MANAGER'), generateForecast);

module.exports = router;
