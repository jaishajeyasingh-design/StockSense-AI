const mongoose = require('mongoose');
const { generateUniquePONumber, isValidPONumber } = require('../utils/poNumberGenerator');

/**
 * ============================================================================
 * StockSense AI - PurchaseOrder Model
 * ============================================================================
 * 
 * ARCHITECTURAL SPECIFICATION & CONTROLLER RESPONSIBILITIES:
 * 
 * 1. ZERO-TRUST PRICING:
 *    Controllers must NEVER accept `unitCost` or `totalEstimatedCost` from client
 *    payloads. The controller must fetch `product.price` from the database and
 *    compute costs server-side before persisting or updating documents.
 * 
 * 2. ZERO-TRUST IDENTITY:
 *    Controllers must NEVER trust `requestedBy`, `approvedBy`, or timeline `actor`
 *    from request bodies. These fields MUST be derived strictly from `req.user._id`
 *    and verified JWT claims (`req.user.role`).
 * 
 * 3. STATE MACHINE INTEGRITY:
 *    Status transitions must NEVER be set directly via generic updates. Transitions
 *    must be performed exclusively through authorized controller action endpoints:
 *    - /api/purchase-orders (POST)          -> PENDING
 *    - /api/purchase-orders/:id/approve     -> APPROVED (ADMIN only)
 *    - /api/purchase-orders/:id/reject      -> REJECTED (ADMIN only)
 *    - /api/purchase-orders/:id/order       -> ORDERED (ADMIN only)
 *    - /api/purchase-orders/:id/receive     -> PARTIALLY_RECEIVED / RECEIVED (ADMIN only)
 *    - /api/purchase-orders/:id/cancel      -> CANCELLED (MANAGER own pending / ADMIN)
 * 
 * 4. STANDALONE MONGODB CONCURRENCY & IDEMPOTENT RECEIVING:
 *    Local standalone MongoDB instances do not support multi-document replica-set
 *    transactions. To prevent race conditions, duplicate receiving, and negative stock:
 *    a) Each receiving submission should provide or be assigned a unique `batchId`.
 *    b) Receiving operations must use atomic conditional queries with state preconditions:
 *       PurchaseOrder.findOneAndUpdate({
 *         _id: poId,
 *         status: { $in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
 *         remainingQuantity: { $gte: quantityReceived }
 *       }, {
 *         $inc: { receivedQuantity: quantityReceived, remainingQuantity: -quantityReceived },
 *         $set: { status: newRemaining === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
 *         $push: { receivingLog: { batchId, quantityReceived, ... }, timeline: { ... } }
 *       }, { new: true });
 *    c) Product stock is incremented only AFTER the conditional PO update succeeds:
 *       Product.findByIdAndUpdate(productId, { $inc: { stock: quantityReceived } });
 *    d) If a duplicate network request with an existing `batchId` arrives, the controller
 *       returns the existing record idempotently without incrementing stock a second time.
 * ============================================================================
 */

const timelineEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: [
        'PENDING',
        'APPROVED',
        'REJECTED',
        'ORDERED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CANCELLED',
      ],
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Timeline event actor is required'],
    },
    actorRole: {
      type: String,
      required: true,
      enum: ['ADMIN', 'MANAGER', 'STAFF'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const receivingBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Receiving batch identifier is required'],
      trim: true,
    },
    quantityReceived: {
      type: Number,
      required: [true, 'Quantity received is required'],
      min: [1, 'Quantity received must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity received must be an integer',
      },
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver reference is required'],
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    batchNumber: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    stockApplied: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: [true, 'PO Number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: isValidPONumber,
        message: (props) => `${props.value} is not a valid Purchase Order number format`,
      },
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    requestedQuantity: {
      type: Number,
      required: [true, 'Requested quantity is required'],
      min: [1, 'Requested quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Requested quantity must be an integer',
      },
    },
    approvedQuantity: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          if (val === null || val === undefined) return true;
          return Number.isInteger(val) && val >= 1;
        },
        message: 'Approved quantity must be an integer greater than or equal to 1',
      },
    },
    receivedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Received quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Received quantity must be an integer',
      },
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: [0, 'Remaining quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Remaining quantity must be an integer',
      },
    },
    unitCost: {
      type: Number,
      required: [true, 'Unit cost is required'],
      min: [0, 'Unit cost cannot be negative'],
    },
    totalEstimatedCost: {
      type: Number,
      required: [true, 'Total estimated cost is required'],
      min: [0, 'Total estimated cost cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: [
          'PENDING',
          'APPROVED',
          'REJECTED',
          'ORDERED',
          'PARTIALLY_RECEIVED',
          'RECEIVED',
          'CANCELLED',
        ],
        message: '{VALUE} is not a supported Purchase Order status',
      },
      default: 'PENDING',
      uppercase: true,
      trim: true,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'MEDIUM',
      uppercase: true,
      trim: true,
    },
    requestReason: {
      type: String,
      required: [true, 'Reorder request justification reason is required'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    supplierInfo: {
      supplierName: { type: String, trim: true, default: null },
      contactPerson: { type: String, trim: true, default: null },
      contactEmail: { type: String, trim: true, lowercase: true, default: null },
      contactPhone: { type: String, trim: true, default: null },
      referenceNumber: { type: String, trim: true, default: null },
      expectedDeliveryDate: { type: Date, default: null },
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester user reference is required'],
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timeline: {
      type: [timelineEventSchema],
      default: [],
    },
    receivingLog: {
      type: [receivingBatchSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Compound indexes for optimal operational querying & analytics
purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ productId: 1, status: 1 });
purchaseOrderSchema.index({ requestedBy: 1, createdAt: -1 });

/**
 * Pre-validation hook:
 * Ensures derived defaults (`remainingQuantity`, `totalEstimatedCost`) are correctly
 * set before schema validation runs.
 */
purchaseOrderSchema.pre('validate', function (next) {
  const effectiveTargetQuantity =
    this.approvedQuantity !== null && this.approvedQuantity !== undefined
      ? this.approvedQuantity
      : this.requestedQuantity;

  // Auto-initialize remainingQuantity on new documents
  if (this.remainingQuantity === undefined || this.remainingQuantity === null) {
    this.remainingQuantity = effectiveTargetQuantity - (this.receivedQuantity || 0);
  }

  // Auto-compute totalEstimatedCost if omitted but unitCost is provided
  if (
    (this.totalEstimatedCost === undefined || this.totalEstimatedCost === null) &&
    this.unitCost !== undefined &&
    this.unitCost !== null
  ) {
    this.totalEstimatedCost = Number((effectiveTargetQuantity * this.unitCost).toFixed(2));
  }

  next();
});

/**
 * Business Rule Schema Validations:
 */
purchaseOrderSchema.path('rejectionReason').validate(function (val) {
  if (this.status === 'REJECTED') {
    return typeof val === 'string' && val.trim().length >= 3;
  }
  return true;
}, 'A rejection reason of at least 3 characters is mandatory when rejecting a purchase order.');

purchaseOrderSchema.path('cancellationReason').validate(function (val) {
  if (this.status === 'CANCELLED') {
    return typeof val === 'string' && val.trim().length >= 3;
  }
  return true;
}, 'A cancellation reason of at least 3 characters is mandatory when cancelling a purchase order.');

purchaseOrderSchema.path('approvedQuantity').validate(function (val) {
  if (this.status === 'APPROVED' || this.status === 'ORDERED') {
    return val !== null && val !== undefined && val >= 1;
  }
  return true;
}, 'Approved orders must specify a valid approvedQuantity of at least 1.');

purchaseOrderSchema.path('remainingQuantity').validate(function (val) {
  const targetQty =
    this.approvedQuantity !== null && this.approvedQuantity !== undefined
      ? this.approvedQuantity
      : this.requestedQuantity;

  if (targetQty !== undefined && targetQty !== null) {
    if (this.status === 'RECEIVED') {
      return val === 0;
    }
    if (this.status === 'PARTIALLY_RECEIVED') {
      return val > 0 && val < targetQty;
    }
    return val <= targetQty;
  }
  return true;
}, 'Remaining quantity must accurately reflect outstanding units based on current order status.');

/**
 * Static Helper: Generates a unique PO number using the utility.
 */
purchaseOrderSchema.statics.generatePONumber = function (options) {
  return generateUniquePONumber(this, options);
};

/**
 * Instance Helper: Check if a specific receiving batch ID was already processed.
 */
purchaseOrderSchema.methods.hasReceivedBatch = function (batchId) {
  if (!batchId || !this.receivingLog) return false;
  return this.receivingLog.some((b) => b.batchId === batchId);
};

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
