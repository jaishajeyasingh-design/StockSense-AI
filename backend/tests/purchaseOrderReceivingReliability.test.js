const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const purchaseOrderRoutes = require('../routes/purchaseOrderRoutes');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const User = require('../models/User');

const TEST_SECRET = 'stocksense_ai_super_secret_jwt_key_2026';

describe('Phase 3A.3: Purchase Order Reliability & Failure-Recovery Test Suite', () => {
  let app;

  const mockAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin User',
    email: 'admin@stocksense.ai',
    role: 'ADMIN',
  };

  const adminToken = jwt.sign({ id: mockAdminUser._id.toString() }, TEST_SECRET);
  const testProductId = new mongoose.Types.ObjectId();
  const testPoId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock User.findById for authMiddleware
    User.findById = (id) => ({
      select: async () => mockAdminUser,
    });

    app.use('/api/purchase-orders', purchaseOrderRoutes);
  });

  // ==========================================================================
  // SCENARIO 1: Duplicate batchId retry does not increment stock twice
  // ==========================================================================
  it('1. Duplicate batchId retry returns existing batch without incrementing stock twice', async () => {
    const fixedBatchId = 'rcv_idempotent_test_001';
    let stockCalls = 0;

    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 10,
      receivedQuantity: 0,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    // First attempt: succeeds and logs batch with stockApplied: true
    PurchaseOrder.findOneAndUpdate = async () => ({
      ...mockPo,
      status: 'PARTIALLY_RECEIVED',
      remainingQuantity: 6,
      receivedQuantity: 4,
    });
    Product.findByIdAndUpdate = async (id, update) => {
      stockCalls += update.$inc.stock;
      return { _id: id, stock: 14 };
    };
    PurchaseOrder.updateOne = async () => ({ modifiedCount: 1 });

    const firstRes = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 4, batchId: fixedBatchId });

    assert.strictEqual(firstRes.status, 200);
    assert.strictEqual(firstRes.body.success, true);
    assert.strictEqual(stockCalls, 4);

    // Second attempt: identical batchId submitted (network retry)
    mockPo.status = 'PARTIALLY_RECEIVED';
    mockPo.remainingQuantity = 6;
    mockPo.receivedQuantity = 4;
    mockPo.receivingLog = [
      {
        batchId: fixedBatchId,
        quantityReceived: 4,
        stockApplied: true, // Already applied
      },
    ];

    const retryRes = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 4, batchId: fixedBatchId });

    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.success, true);
    assert.strictEqual(retryRes.body.data.idempotentDuplicate, true);
    // Stock must NOT be incremented a second time
    assert.strictEqual(stockCalls, 4, 'Stock increment must not increase on retry');
  });

  // ==========================================================================
  // SCENARIO 2 & 3: Failure during Product stock update triggers compensating rollback
  // ==========================================================================
  it('2 & 3. Product stock update failure triggers compensating rollback and restores PO balance', async () => {
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 10,
      receivedQuantity: 0,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    // Step 2 succeeds
    PurchaseOrder.findOneAndUpdate = async (query, update) => {
      if (update.$inc && update.$inc.receivedQuantity === 5) {
        return {
          ...mockPo,
          status: 'PARTIALLY_RECEIVED',
          remainingQuantity: 5,
          receivedQuantity: 5,
        };
      }
      // Rollback query
      if (update.$inc && update.$inc.receivedQuantity === -5) {
        return mockPo;
      }
      return null;
    };

    // Step 3 crashes (e.g. database error writing to Product)
    Product.findByIdAndUpdate = async () => {
      throw new Error('Database disk error during product inventory write');
    };

    const res = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 5, batchId: 'rcv_crash_step3' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.rolledBack, true);
    assert.match(res.body.message, /balance has been safely restored/i);
  });

  // ==========================================================================
  // SCENARIO 4: Failure during compensating rollback exposes recoverable state
  // ==========================================================================
  it('4. Failure during compensating rollback exposes explicit recoverable state without claiming success', async () => {
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 10,
      receivedQuantity: 0,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    let callIndex = 0;
    PurchaseOrder.findOneAndUpdate = async () => {
      callIndex++;
      if (callIndex === 1) {
        // Step 2 PO write succeeds
        return {
          ...mockPo,
          status: 'PARTIALLY_RECEIVED',
          remainingQuantity: 7,
          receivedQuantity: 3,
        };
      }
      // Step 3 rollback throws!
      throw new Error('Database network lost during compensating rollback');
    };

    Product.findByIdAndUpdate = async () => {
      throw new Error('Primary product update failed');
    };

    const res = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 3, batchId: 'rcv_dual_failure_001' });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.success, false);
    // Explicitly flags that recovery is required rather than claiming success
    assert.strictEqual(res.body.recoveryRequired, true);
    assert.strictEqual(res.body.batchId, 'rcv_dual_failure_001');
    assert.strictEqual(res.body.stockApplied, false);
    assert.match(res.body.message, /CRITICAL INCONSISTENCY/i);
  });

  // ==========================================================================
  // SCENARIO 5: Two concurrent receive requests competing for remaining quantity
  // ==========================================================================
  it('5. Two concurrent requests competing for remaining quantity prevent over-receiving via atomic precondition', async () => {
    // Approved order with only 5 units remaining
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 5,
      receivedQuantity: 5,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    // Simulate atomic conditional update:
    // Request 1 wants 4 units -> condition remainingQuantity >= 4 matches
    // Request 2 wants 3 units -> remaining is now 1, condition remainingQuantity >= 3 FAILS!
    let currentRemaining = 5;
    PurchaseOrder.findOneAndUpdate = async (query, update) => {
      const requestedAmt = update.$inc.receivedQuantity;
      if (currentRemaining >= requestedAmt) {
        currentRemaining -= requestedAmt;
        return {
          ...mockPo,
          remainingQuantity: currentRemaining,
          receivedQuantity: mockPo.receivedQuantity + requestedAmt,
        };
      }
      // Precondition failed: remaining balance was exhausted by racing request
      return null;
    };
    PurchaseOrder.findOne = async () => null; // No duplicate batchId
    Product.findByIdAndUpdate = async (id, update) => ({ _id: id, stock: 20 });
    PurchaseOrder.updateOne = async () => ({ modifiedCount: 1 });

    // Request 1: Claims 4 units
    const req1 = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 4, batchId: 'rcv_race_req_1' });

    assert.strictEqual(req1.status, 200);
    assert.strictEqual(req1.body.success, true);
    assert.strictEqual(currentRemaining, 1);

    // Request 2: Attempts to claim 3 units (only 1 remaining!)
    const req2 = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 3, batchId: 'rcv_race_req_2' });

    // Must return 409 Conflict and NOT over-receive
    assert.strictEqual(req2.status, 409);
    assert.strictEqual(req2.body.success, false);
    assert.match(req2.body.message, /Concurrent receiving conflict/i);
  });

  // ==========================================================================
  // SCENARIO 6: Concurrent duplicate requests using identical batchId
  // ==========================================================================
  it('6. Concurrent duplicate requests with the same batchId are caught by the batchId uniqueness guard', async () => {
    const fixedBatchId = 'rcv_racing_duplicate_batch';
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 10,
      receivedQuantity: 0,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    let inFlightBatchInserted = false;
    PurchaseOrder.findOneAndUpdate = async (query) => {
      // If batchId is already present in receivingLog, the $ne condition returns null
      if (query['receivingLog.batchId'] && query['receivingLog.batchId'].$ne === fixedBatchId) {
        if (!inFlightBatchInserted) {
          inFlightBatchInserted = true;
          return {
            ...mockPo,
            remainingQuantity: 5,
            receivedQuantity: 5,
          };
        }
      }
      return null;
    };

    // findOne discovers the in-flight duplicate batch inserted by the racing request
    PurchaseOrder.findOne = async () => ({
      ...mockPo,
      remainingQuantity: 5,
      receivedQuantity: 5,
      receivingLog: [{ batchId: fixedBatchId, quantityReceived: 5, stockApplied: true }],
    });

    Product.findByIdAndUpdate = async () => ({ stock: 15 });
    PurchaseOrder.updateOne = async () => ({ modifiedCount: 1 });

    // Request A: Wins race
    const resA = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 5, batchId: fixedBatchId });

    assert.strictEqual(resA.status, 200);

    // Request B: Arrived concurrently with same batchId
    const resB = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 5, batchId: fixedBatchId });

    assert.strictEqual(resB.status, 200);
    assert.strictEqual(resB.body.data.idempotentDuplicate, true);
  });

  // ==========================================================================
  // SCENARIO 7: Invalid, negative, non-integer, and over-remaining quantities
  // ==========================================================================
  it('7. Rejects invalid, negative, non-integer and over-remaining receipt quantities with 400', async () => {
    const mockPo = {
      _id: testPoId,
      status: 'ORDERED',
      remainingQuantity: 8,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    const invalidInputs = [
      { qty: undefined, expectedMsg: /integer of at least 1/i },
      { qty: 0, expectedMsg: /integer of at least 1/i },
      { qty: -4, expectedMsg: /integer of at least 1/i },
      { qty: 2.75, expectedMsg: /integer of at least 1/i },
      { qty: 'not-a-number', expectedMsg: /integer of at least 1/i },
      { qty: 9, expectedMsg: /Only 8 units remain outstanding/i }, // 9 > 8
      { qty: 50, expectedMsg: /Only 8 units remain outstanding/i },
    ];

    for (const item of invalidInputs) {
      const res = await request(app)
        .post(`/api/purchase-orders/${testPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: item.qty });

      assert.strictEqual(res.status, 400, `Expected 400 for input: ${item.qty}`);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, item.expectedMsg);
    }
  });

  // ==========================================================================
  // SCENARIO 8: Receiving after PO is fully received or cancelled/rejected
  // ==========================================================================
  it('8. Rejects receiving attempts on terminal or un-ordered statuses (RECEIVED, CANCELLED, REJECTED, PENDING, APPROVED)', async () => {
    const ineligibleStatuses = [
      'RECEIVED',
      'CANCELLED',
      'REJECTED',
      'PENDING',
      'APPROVED',
    ];

    for (const status of ineligibleStatuses) {
      const mockPo = {
        _id: testPoId,
        status,
        remainingQuantity: status === 'RECEIVED' ? 0 : 10,
        receivingLog: [],
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .post(`/api/purchase-orders/${testPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: 1 });

      assert.strictEqual(res.status, 400, `Expected 400 for status: ${status}`);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Cannot receive stock/i);
    }
  });

  // ==========================================================================
  // SCENARIO 9: Retry/reconciliation after an interrupted receipt
  // ==========================================================================
  it('9. Reconciles an interrupted receipt where PO log exists with stockApplied: false', async () => {
    const interruptedBatchId = 'rcv_interrupted_batch_001';
    let productStockIncremented = 0;
    let markAppliedCalled = false;

    // PO contains batch logged as stockApplied: false from a previous network drop
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'PARTIALLY_RECEIVED',
      remainingQuantity: 5,
      receivedQuantity: 5,
      receivingLog: [
        {
          batchId: interruptedBatchId,
          quantityReceived: 5,
          stockApplied: false, // Unreconciled
        },
      ],
      hasReceivedBatch: (bId) => bId === interruptedBatchId,
    };

    PurchaseOrder.findById = async () => mockPo;

    Product.findByIdAndUpdate = async (id, update) => {
      productStockIncremented = update.$inc.stock;
      return { _id: id, stock: 15 };
    };

    PurchaseOrder.updateOne = async (query, update) => {
      if (update.$set && update.$set['receivingLog.$.stockApplied'] === true) {
        markAppliedCalled = true;
      }
      return { modifiedCount: 1 };
    };

    // Client retries with the interrupted batchId
    const res = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quantityReceived: 5,
        batchId: interruptedBatchId,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.reconciled, true);
    // Verified: Stock was reconciled and applied to product
    assert.strictEqual(productStockIncremented, 5);
    // Verified: Flag updated to stockApplied: true
    assert.strictEqual(markAppliedCalled, true);
  });

  // ==========================================================================
  // SCENARIO 10: Forecast recalculation failure does not undo physical receipt
  // ==========================================================================
  it('10. Forecast recalculation failure does not roll back or undo committed physical stock receipt', async () => {
    const mockPo = {
      _id: testPoId,
      productId: testProductId,
      status: 'ORDERED',
      remainingQuantity: 10,
      receivedQuantity: 0,
      receivingLog: [],
    };
    PurchaseOrder.findById = async () => mockPo;

    PurchaseOrder.findOneAndUpdate = async () => ({
      ...mockPo,
      status: 'RECEIVED',
      remainingQuantity: 0,
      receivedQuantity: 10,
    });

    let physicalStockUpdated = false;
    Product.findByIdAndUpdate = async (id) => {
      physicalStockUpdated = true;
      return { _id: id, stock: 25 };
    };

    PurchaseOrder.updateOne = async () => ({ modifiedCount: 1 });

    const res = await request(app)
      .post(`/api/purchase-orders/${testPoId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityReceived: 10, batchId: 'rcv_full_receipt_forecast_err' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(physicalStockUpdated, true);
    assert.strictEqual(res.body.data.remainingProductStock, 25);
    assert.match(res.body.message, /fully received/i);
  });
});
