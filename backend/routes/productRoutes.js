const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/authMiddleware');

router
  .route('/')
  .get(protect, getProducts)
  .post(protect, authorize('ADMIN', 'MANAGER'), createProduct);

router
  .route('/:id')
  .get(protect, getProductById)
  .put(protect, authorize('ADMIN', 'MANAGER'), updateProduct)
  .delete(protect, authorize('ADMIN'), deleteProduct);

module.exports = router;
