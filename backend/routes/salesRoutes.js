const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  getSalesByProduct,
} = require('../controllers/salesController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(getSales)
  .post(protect, createSale);

router.get('/product/:productId', getSalesByProduct);

module.exports = router;
