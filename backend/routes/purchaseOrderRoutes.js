const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  receivePurchaseOrderStock,
} = require('../controllers/purchaseOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All purchase order endpoints require authenticated token
router.use(protect);

// 1. List purchase orders & Create new reorder request
router
  .route('/')
  .get(authorize('ADMIN', 'MANAGER'), getPurchaseOrders)
  .post(authorize('ADMIN', 'MANAGER'), createPurchaseOrder);

// 2. Retrieve purchase order by ID
router.route('/:id').get(authorize('ADMIN', 'MANAGER'), getPurchaseOrderById);

// 3. Review & Approval (ADMIN only)
router.patch('/:id/approve', authorize('ADMIN'), approvePurchaseOrder);
router.patch('/:id/reject', authorize('ADMIN'), rejectPurchaseOrder);

// 4. Mark Ordered with Supplier (ADMIN only)
router.patch('/:id/order', authorize('ADMIN'), markPurchaseOrderOrdered);

// 5. Cancel Purchase Order (ADMIN or MANAGER for own pending)
router.patch('/:id/cancel', authorize('ADMIN', 'MANAGER'), cancelPurchaseOrder);

// 6. Receive Physical Shipment (ADMIN only)
router.post('/:id/receive', authorize('ADMIN'), receivePurchaseOrderStock);

module.exports = router;
