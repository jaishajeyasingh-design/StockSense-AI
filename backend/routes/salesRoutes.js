const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  getSalesByProduct,
} = require('../controllers/salesController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('ADMIN', 'MANAGER'), getSales)
  .post(protect, createSale);

router.get('/product/:productId', protect, authorize('ADMIN', 'MANAGER'), getSalesByProduct);

module.exports = router;
