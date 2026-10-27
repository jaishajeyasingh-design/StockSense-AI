const mongoose = require('mongoose');
const crypto = require('crypto');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Forecast = require('../models/Forecast');
const Sale = require('../models/Sale');
const { forecastDemand } = require('../services/forecastingService');

/**
 * Helper to validate MongoDB ObjectId string
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Helper: Recalculates demand forecast for a product after inventory stock changes.
 * Safely handles errors so physical stock receiving is not corrupted by analytics failures.
 */
const recalculateProductForecast = async (productId, currentStock) => {
  // If database connection is not currently established (e.g. offline unit testing), skip safely
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { success: true, offline: true };
  }

  try {
    const salesHistory = await Sale.find({ productId });
    const computed = forecastDemand(salesHistory, currentStock);

    await Forecast.findOneAndUpdate(
      { productId },
      {
        productId,
        forecastDailyDemand: computed.forecastDailyDemand,
        forecastWeeklyDemand: computed.forecastWeeklyDemand,
        currentStock: computed.currentStock,
        stockStatus: computed.stockStatus,
        recommendedReorderQuantity: computed.recommendedReorderQuantity,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return { success: true };
  } catch (err) {
    console.error(`Warning: Forecast recalculation failed for product ${productId}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ============================================================================
// 1. GET /api/purchase-orders
// Access: ADMIN, MANAGER
// ============================================================================
const getPurchaseOrders = async (req, res) => {
  try {
    const { status, productId, priority, startDate, endDate } = req.query;
    const filter = {};

    // Validate status filter
    if (status) {
      const allowedStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED',
        'ORDERED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CANCELLED',
      ];
      if (!allowedStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter. Allowed values: ${allowedStatuses.join(', ')}`,
        });
      }
      filter.status = status.toUpperCase();
    }

    // Validate productId filter
    if (productId) {
      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid productId filter format',
        });
      }
      filter.productId = productId;
    }

    // Validate priority filter
    if (priority) {
      const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!allowedPriorities.includes(priority.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority filter. Allowed values: ${allowedPriorities.join(', ')}`,
        });
      }
      filter.priority = priority.toUpperCase();
    }

    // Validate date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (isNaN(parsedStart.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid startDate format' });
        }
        filter.createdAt.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (isNaN(parsedEnd.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid endDate format' });
        }
        // Set end of the specified day
        parsedEnd.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = parsedEnd;
      }
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await PurchaseOrder.countDocuments(filter);
    const orders = await PurchaseOrder.find(filter)
      .populate('productId', 'name category price stock reorderLevel')
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: orders,
    });
  } catch (error) {
    console.error('getPurchaseOrders error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 2. GET /api/purchase-orders/:id
// Access: ADMIN, MANAGER
// ============================================================================
const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id)
      .populate('productId', 'name category price stock reorderLevel')
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('timeline.actor', 'name email role')
      .populate('receivingLog.receivedBy', 'name email role');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('getPurchaseOrderById error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 3. POST /api/purchase-orders
// Access: ADMIN, MANAGER
// Zero-trust: unitCost derived from Product.price; requestedBy derived from JWT
// ============================================================================
const createPurchaseOrder = async (req, res) => {
  try {
    const { productId, requestedQuantity, priority, requestReason } = req.body;

    // Validate productId
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid product ID',
      });
    }

    // Validate requestedQuantity
    const parsedQty = Number(requestedQuantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Requested quantity must be an integer of at least 1',
      });
    }

    // Validate requestReason
    if (!requestReason || typeof requestReason !== 'string' || requestReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A request justification reason of at least 3 characters is required',
      });
    }

    // Validate priority
    const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const chosenPriority = priority ? priority.toUpperCase() : 'MEDIUM';
    if (!allowedPriorities.includes(chosenPriority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed values: ${allowedPriorities.join(', ')}`,
      });
    }

    // Fetch product to derive unitCost securely from server-side price
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const unitCost = product.price;
    const totalEstimatedCost = Number((parsedQty * unitCost).toFixed(2));
    const poNumber = await PurchaseOrder.generatePONumber();

    const newOrder = await PurchaseOrder.create({
      poNumber,
      productId,
      requestedQuantity: parsedQty,
      approvedQuantity: null,
      receivedQuantity: 0,
      remainingQuantity: parsedQty,
      unitCost,
      totalEstimatedCost,
      status: 'PENDING',
      priority: chosenPriority,
      requestReason: requestReason.trim(),
      requestedBy: req.user._id,
      timeline: [
        {
          status: 'PENDING',
          action: 'REORDER_REQUESTED',
          actor: req.user._id,
          actorRole: req.user.role,
          notes: requestReason.trim(),
          timestamp: new Date(),
        },
      ],
    });

    // Product stock is explicitly NOT changed
    return res.status(201).json({
      success: true,
      message: 'Purchase order request created successfully',
      data: newOrder,
    });
  } catch (error) {
    console.error('createPurchaseOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 4. PATCH /api/purchase-orders/:id/approve
// Access: ADMIN only
// ============================================================================
const approvePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING purchase orders can be approved (current status: ${order.status})`,
      });
    }

    const { approvedQuantity, notes } = req.body;

    // Use provided approvedQuantity or default to original requestedQuantity
    let approvedQty = order.requestedQuantity;
    if (approvedQuantity !== undefined && approvedQuantity !== null) {
      const parsed = Number(approvedQuantity);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({
          success: false,
          message: 'Approved quantity must be an integer of at least 1',
        });
      }
      approvedQty = parsed;
    }

    order.status = 'APPROVED';
    order.approvedQuantity = approvedQty;
    order.remainingQuantity = approvedQty;
    order.totalEstimatedCost = Number((approvedQty * order.unitCost).toFixed(2));
    order.approvedBy = req.user._id;

    order.timeline.push({
      status: 'APPROVED',
      action: 'REQUEST_APPROVED',
      actor: req.user._id,
      actorRole: req.user.role,
      notes: notes ? String(notes).trim() : `Approved ${approvedQty} units.`,
      timestamp: new Date(),
    });

    await order.save();

    // Product stock is explicitly NOT changed
    return res.status(200).json({
      success: true,
      message: 'Purchase order approved successfully',
      data: order,
    });
  } catch (error) {
    console.error('approvePurchaseOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 5. PATCH /api/purchase-orders/:id/reject
// Access: ADMIN only
// ============================================================================
const rejectPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING purchase orders can be rejected (current status: ${order.status})`,
      });
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason of at least 3 characters is mandatory',
      });
    }

    order.status = 'REJECTED';
    order.rejectionReason = rejectionReason.trim();
    order.approvedBy = req.user._id;

    order.timeline.push({
      status: 'REJECTED',
      action: 'REQUEST_REJECTED',
      actor: req.user._id,
      actorRole: req.user.role,
      notes: rejectionReason.trim(),
      timestamp: new Date(),
    });

    await order.save();

    // Product stock is explicitly NOT changed
    return res.status(200).json({
      success: true,
      message: 'Purchase order rejected',
      data: order,
    });
  } catch (error) {
    console.error('rejectPurchaseOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 6. PATCH /api/purchase-orders/:id/order
// Access: ADMIN only
// ============================================================================
const markPurchaseOrderOrdered = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (order.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Only APPROVED purchase orders can be marked as ORDERED (current status: ${order.status})`,
      });
    }

    const {
      supplierName,
      contactPerson,
      contactEmail,
      contactPhone,
      referenceNumber,
      expectedDeliveryDate,
      notes,
    } = req.body;

    let parsedDeliveryDate = null;
    if (expectedDeliveryDate) {
      parsedDeliveryDate = new Date(expectedDeliveryDate);
      if (isNaN(parsedDeliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expectedDeliveryDate format',
        });
      }
    }

    order.status = 'ORDERED';
    order.supplierInfo = {
      supplierName: supplierName ? String(supplierName).trim() : null,
      contactPerson: contactPerson ? String(contactPerson).trim() : null,
      contactEmail: contactEmail ? String(contactEmail).trim().toLowerCase() : null,
      contactPhone: contactPhone ? String(contactPhone).trim() : null,
      referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
      expectedDeliveryDate: parsedDeliveryDate,
    };

    order.timeline.push({
      status: 'ORDERED',
      action: 'ORDER_PLACED',
      actor: req.user._id,
      actorRole: req.user.role,
      notes: notes
        ? String(notes).trim()
        : `Order placed with supplier ${supplierName || 'vendor'} (Ref: ${referenceNumber || 'N/A'})`,
      timestamp: new Date(),
    });

    await order.save();

    // Product stock is explicitly NOT changed
    return res.status(200).json({
      success: true,
      message: 'Purchase order marked as ordered with supplier',
      data: order,
    });
  } catch (error) {
    console.error('markPurchaseOrderOrdered error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 7. PATCH /api/purchase-orders/:id/cancel
// Access: ADMIN, MANAGER
// Managers: own PENDING requests only
// Admins: unreceived orders only
// ============================================================================
const cancelPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    // Terminal state protections
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Purchase order is already cancelled' });
    }
    if (order.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a rejected purchase order' });
    }
    if (order.status === 'RECEIVED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a fully received purchase order' });
    }
    if (order.receivedQuantity > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a purchase order where stock has already been partially received',
      });
    }

    // Role-specific permission enforcement
    if (req.user.role === 'MANAGER') {
      if (order.status !== 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Managers are authorized to cancel only PENDING reorder requests',
        });
      }
      if (order.requestedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Managers may cancel only their own pending reorder requests',
        });
      }
    }

    const { cancellationReason } = req.body;
    if (!cancellationReason || typeof cancellationReason !== 'string' || cancellationReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A cancellation reason of at least 3 characters is mandatory',
      });
    }

    order.status = 'CANCELLED';
    order.cancellationReason = cancellationReason.trim();

    order.timeline.push({
      status: 'CANCELLED',
      action: 'ORDER_CANCELLED',
      actor: req.user._id,
      actorRole: req.user.role,
      notes: cancellationReason.trim(),
      timestamp: new Date(),
    });

    await order.save();

    // Product stock is explicitly NOT changed
    return res.status(200).json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: order,
    });
  } catch (error) {
    console.error('cancelPurchaseOrder error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// ============================================================================
// 8. POST /api/purchase-orders/:id/receive
// Access: ADMIN only
// Durable Standalone Receiving Protocol with Idempotency & Reconciliation
// ============================================================================
const receivePurchaseOrderStock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID format' });
    }

    const order = await PurchaseOrder.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    // State validation
    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot receive stock. Purchase order must be in ORDERED or PARTIALLY_RECEIVED status (current status: ${order.status})`,
      });
    }

    const { quantityReceived, batchNumber, notes, batchId: clientBatchId } = req.body;

    const parsedQty = Number(quantityReceived);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity received must be an integer of at least 1',
      });
    }

    // Guard against over-receiving
    if (parsedQty > order.remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot receive ${parsedQty} units. Only ${order.remainingQuantity} units remain outstanding on this purchase order.`,
      });
    }

    // Assign or use idempotent batch identifier
    const effectiveBatchId =
      clientBatchId && typeof clientBatchId === 'string' && clientBatchId.trim().length > 0
        ? clientBatchId.trim()
        : `rcv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // ------------------------------------------------------------------------
    // Step 1: Idempotency Check & Reconciliation
    // ------------------------------------------------------------------------
    const existingBatch = order.receivingLog.find((b) => b.batchId === effectiveBatchId);
    if (existingBatch) {
      if (existingBatch.stockApplied === true) {
        // Already successfully processed: return existing PO without double-incrementing stock
        return res.status(200).json({
          success: true,
          message: 'Receipt batch was already processed idempotently',
          data: {
            purchaseOrder: order,
            idempotentDuplicate: true,
            batchId: effectiveBatchId,
          },
        });
      } else {
        // Recovery path: Batch was logged but stock update crashed previously
        const recoveredProduct = await Product.findByIdAndUpdate(
          order.productId,
          { $inc: { stock: existingBatch.quantityReceived } },
          { new: true }
        );

        await PurchaseOrder.updateOne(
          { _id: order._id, 'receivingLog.batchId': effectiveBatchId },
          { $set: { 'receivingLog.$.stockApplied': true } }
        );

        await recalculateProductForecast(order.productId, recoveredProduct.stock);

        return res.status(200).json({
          success: true,
          message: 'Pending receipt batch successfully reconciled and inventory stock updated',
          data: {
            purchaseOrder: await PurchaseOrder.findById(order._id),
            remainingProductStock: recoveredProduct.stock,
            reconciled: true,
            batchId: effectiveBatchId,
          },
        });
      }
    }

    // ------------------------------------------------------------------------
    // Step 2: Atomic Preconditioned PurchaseOrder Update
    // Ensures remainingQuantity >= parsedQty and status is valid at moment of write
    // ------------------------------------------------------------------------
    const newRemaining = order.remainingQuantity - parsedQty;
    const isFullyReceived = newRemaining === 0;
    const nextStatus = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const actionName = isFullyReceived ? 'SHIPMENT_FULLY_RECEIVED' : 'SHIPMENT_PARTIALLY_RECEIVED';

    const updatedPo = await PurchaseOrder.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
        remainingQuantity: { $gte: parsedQty },
        'receivingLog.batchId': { $ne: effectiveBatchId },
      },
      {
        $inc: {
          receivedQuantity: parsedQty,
          remainingQuantity: -parsedQty,
        },
        $set: {
          status: nextStatus,
        },
        $push: {
          receivingLog: {
            batchId: effectiveBatchId,
            quantityReceived: parsedQty,
            receivedBy: req.user._id,
            receivedAt: new Date(),
            batchNumber: batchNumber ? String(batchNumber).trim() : null,
            notes: notes ? String(notes).trim() : '',
            stockApplied: false,
          },
          timeline: {
            status: nextStatus,
            action: actionName,
            actor: req.user._id,
            actorRole: req.user.role,
            notes: notes
              ? String(notes).trim()
              : `Received ${parsedQty} units. Outstanding: ${newRemaining}`,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedPo) {
      // Check if the condition failed because the same batchId was inserted by an in-flight concurrent request
      const inFlightDuplicate = await PurchaseOrder.findOne({
        _id: order._id,
        'receivingLog.batchId': effectiveBatchId,
      });

      if (inFlightDuplicate) {
        return res.status(200).json({
          success: true,
          message: 'Receipt batch was already processed idempotently by a concurrent request',
          data: {
            purchaseOrder: inFlightDuplicate,
            idempotentDuplicate: true,
            batchId: effectiveBatchId,
          },
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Concurrent receiving conflict: order status changed or remaining quantity is no longer sufficient.',
      });
    }

    // ------------------------------------------------------------------------
    // Step 3: Increment Physical Product Inventory Stock
    // ------------------------------------------------------------------------
    let updatedProduct;
    try {
      updatedProduct = await Product.findByIdAndUpdate(
        order.productId,
        { $inc: { stock: parsedQty } },
        { new: true }
      );

      if (!updatedProduct) {
        throw new Error('Referenced product not found during inventory increment');
      }
    } catch (stockErr) {
      // Compensating recovery: Roll back the PO increment so data remains consistent
      console.error('CRITICAL: Stock update failed. Initiating PO rollback:', stockErr.message);
      try {
        const rolledBack = await PurchaseOrder.findOneAndUpdate(
          { _id: order._id },
          {
            $inc: {
              receivedQuantity: -parsedQty,
              remainingQuantity: parsedQty,
            },
            $set: { status: order.status },
            $pull: { receivingLog: { batchId: effectiveBatchId } },
          },
          { new: true }
        );

        if (!rolledBack) {
          throw new Error('Rollback target purchase order document could not be updated');
        }

        return res.status(500).json({
          success: false,
          message: `Inventory stock update failed: ${stockErr.message}. Purchase order balance has been safely restored.`,
          rolledBack: true,
        });
      } catch (rollbackErr) {
        console.error('CRITICAL INCONSISTENCY: Compensating rollback also failed:', rollbackErr.message);
        return res.status(500).json({
          success: false,
          message: `CRITICAL INCONSISTENCY: Product stock update failed (${stockErr.message}) and compensating rollback could not complete (${rollbackErr.message}). Operation recorded with batchId: ${effectiveBatchId}. Recovery action is required.`,
          recoveryRequired: true,
          batchId: effectiveBatchId,
          stockApplied: false,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Step 4: Mark Batch as Stock Applied
    // ------------------------------------------------------------------------
    await PurchaseOrder.updateOne(
      { _id: updatedPo._id, 'receivingLog.batchId': effectiveBatchId },
      { $set: { 'receivingLog.$.stockApplied': true } }
    );

    // ------------------------------------------------------------------------
    // Step 5: Recalculate Forecast (Recoverable non-blocking)
    // ------------------------------------------------------------------------
    await recalculateProductForecast(order.productId, updatedProduct.stock);

    return res.status(200).json({
      success: true,
      message: isFullyReceived
        ? 'Shipment fully received and physical inventory stock updated'
        : 'Shipment partially received and physical inventory stock updated',
      data: {
        purchaseOrder: updatedPo,
        remainingProductStock: updatedProduct.stock,
        batchId: effectiveBatchId,
      },
    });
  } catch (error) {
    console.error('receivePurchaseOrderStock error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  receivePurchaseOrderStock,
};
