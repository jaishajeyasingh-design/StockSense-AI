const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const Product = require('../models/Product');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/stocksense_test_po_lifecycle_isolated';
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'stocksense_ai_super_secret_jwt_key_2026';

describe('Phase 3A.5: Live MongoDB Purchase Order Lifecycle & Integrity Suite', () => {
  let adminUser, manager1User, manager2User, staffUser;
  let adminToken, manager1Token, manager2Token, staffToken;
  let testProduct;

  before(async () => {
    // Connect directly to the isolated test database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);

    // Clean test database before test suite
    await mongoose.connection.dropDatabase();

    // Create test accounts
    adminUser = await User.create({
      name: 'Audit Admin',
      email: 'audit_admin@stocksense.test',
      password: 'Password123!',
      role: 'ADMIN',
    });
    adminToken = jwt.sign({ id: adminUser._id.toString() }, TEST_JWT_SECRET);

    manager1User = await User.create({
      name: 'Audit Manager 1',
      email: 'audit_mgr1@stocksense.test',
      password: 'Password123!',
      role: 'MANAGER',
    });
    manager1Token = jwt.sign({ id: manager1User._id.toString() }, TEST_JWT_SECRET);

    manager2User = await User.create({
      name: 'Audit Manager 2',
      email: 'audit_mgr2@stocksense.test',
      password: 'Password123!',
      role: 'MANAGER',
    });
    manager2Token = jwt.sign({ id: manager2User._id.toString() }, TEST_JWT_SECRET);

    staffUser = await User.create({
      name: 'Audit Staff',
      email: 'audit_staff@stocksense.test',
      password: 'Password123!',
      role: 'STAFF',
    });
    staffToken = jwt.sign({ id: staffUser._id.toString() }, TEST_JWT_SECRET);

    // Create test product with baseline stock = 100
    testProduct = await Product.create({
      name: 'Precision Ball Bearings 608RS',
      sku: 'BEAR-608RS-TEST',
      category: 'Mechanical',
      price: 12.5,
      stock: 100,
      reorderLevel: 25,
    });
  });

  after(async () => {
    // Drop test database completely and disconnect
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==========================================================================
  // 1. Complete End-to-End Happy Path Lifecycle
  // PENDING -> APPROVED -> ORDERED -> PARTIALLY_RECEIVED -> RECEIVED
  // ==========================================================================
  it('1. Complete Happy Path: PENDING -> APPROVED -> ORDERED -> PARTIAL -> RECEIVED with accurate stock changes', async () => {
    // ------------------------------------------------------------------------
    // Step A: Creation (Manager 1 requests 20 units)
    // ------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${manager1Token}`)
      .send({
        productId: testProduct._id.toString(),
        requestedQuantity: 20,
        priority: 'HIGH',
        requestReason: 'Production line inventory replenishment',
      });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    const poId = createRes.body.data._id;
    assert.strictEqual(createRes.body.data.status, 'PENDING');
    assert.strictEqual(createRes.body.data.requestedQuantity, 20);
    assert.strictEqual(createRes.body.data.remainingQuantity, 20);
    assert.strictEqual(createRes.body.data.receivedQuantity, 0);
    assert.strictEqual(createRes.body.data.unitCost, 12.5);
    assert.strictEqual(createRes.body.data.totalEstimatedCost, 250);

    // VERIFY INVENTORY INTEGRITY: Stock MUST NOT change on creation!
    let prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 100, 'Product stock must remain 100 on PO creation');

    // ------------------------------------------------------------------------
    // Step B: Approval (Admin authorizes adjusted quantity of 25 units)
    // ------------------------------------------------------------------------
    const approveRes = await request(app)
      .patch(`/api/purchase-orders/${poId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        approvedQuantity: 25,
        notes: 'Adjusted to 25 units to meet vendor box quantity minimums',
      });

    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.success, true);
    assert.strictEqual(approveRes.body.data.status, 'APPROVED');
    assert.strictEqual(approveRes.body.data.approvedQuantity, 25);
    assert.strictEqual(approveRes.body.data.remainingQuantity, 25);
    assert.strictEqual(approveRes.body.data.totalEstimatedCost, 312.5);

    // VERIFY INVENTORY INTEGRITY: Stock MUST NOT change on approval!
    prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 100, 'Product stock must remain 100 on PO approval');

    // ------------------------------------------------------------------------
    // Step C: Mark Ordered (Admin places order with vendor)
    // ------------------------------------------------------------------------
    const orderRes = await request(app)
      .patch(`/api/purchase-orders/${poId}/order`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierName: 'Global Bearing Dynamics Corp',
        contactEmail: 'orders@globalbearing.test',
        contactPhone: '+1-800-555-0144',
        referenceNumber: 'PO-GB-99214',
        expectedDeliveryDate: '2026-11-15T00:00:00.000Z',
        notes: 'Air freight express shipping',
      });

    assert.strictEqual(orderRes.status, 200);
    assert.strictEqual(orderRes.body.success, true);
    assert.strictEqual(orderRes.body.data.status, 'ORDERED');
    assert.strictEqual(orderRes.body.data.supplierInfo.supplierName, 'Global Bearing Dynamics Corp');
    assert.strictEqual(orderRes.body.data.supplierInfo.referenceNumber, 'PO-GB-99214');

    // VERIFY INVENTORY INTEGRITY: Stock MUST NOT change on ordering!
    prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 100, 'Product stock must remain 100 on placing order');

    // ------------------------------------------------------------------------
    // Step D: Partial Receipt (Admin receives first batch of 10 units)
    // ------------------------------------------------------------------------
    const batch1Id = 'rcv_live_batch_001';
    const receive1Res = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quantityReceived: 10,
        batchNumber: 'LOT-9921-A',
        notes: 'Inspected 10 units undamaged',
        batchId: batch1Id,
      });

    assert.strictEqual(receive1Res.status, 200);
    assert.strictEqual(receive1Res.body.success, true);
    assert.strictEqual(receive1Res.body.data.purchaseOrder.status, 'PARTIALLY_RECEIVED');
    assert.strictEqual(receive1Res.body.data.purchaseOrder.receivedQuantity, 10);
    assert.strictEqual(receive1Res.body.data.purchaseOrder.remainingQuantity, 15);

    // VERIFY INVENTORY INTEGRITY: Stock increases by exactly 10 to 110!
    prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 110, 'Product stock must increment to 110 after receiving 10 units');

    // ------------------------------------------------------------------------
    // Step E: Duplicate BatchId Retry Guard (Network retry with same batchId)
    // ------------------------------------------------------------------------
    const duplicateRetryRes = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quantityReceived: 10,
        batchId: batch1Id,
      });

    assert.strictEqual(duplicateRetryRes.status, 200);
    assert.strictEqual(duplicateRetryRes.body.data.idempotentDuplicate, true);

    // VERIFY INVENTORY INTEGRITY: Stock MUST NOT increment twice!
    prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 110, 'Product stock must remain 110 on duplicate batch retry');

    // ------------------------------------------------------------------------
    // Step F: Final Receipt (Admin receives remaining 15 units)
    // ------------------------------------------------------------------------
    const batch2Id = 'rcv_live_batch_002';
    const receive2Res = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quantityReceived: 15,
        batchNumber: 'LOT-9921-B',
        notes: 'Remaining 15 units received, order fulfilled',
        batchId: batch2Id,
      });

    assert.strictEqual(receive2Res.status, 200);
    assert.strictEqual(receive2Res.body.success, true);
    assert.strictEqual(receive2Res.body.data.purchaseOrder.status, 'RECEIVED');
    assert.strictEqual(receive2Res.body.data.purchaseOrder.receivedQuantity, 25);
    assert.strictEqual(receive2Res.body.data.purchaseOrder.remainingQuantity, 0);

    // VERIFY INVENTORY INTEGRITY: Stock increases by 15 to 125!
    prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, 125, 'Product stock must increment to 125 after final receipt');

    // Final balance consistency assertion:
    const finalPo = await PurchaseOrder.findById(poId);
    assert.strictEqual(
      finalPo.receivedQuantity + finalPo.remainingQuantity,
      finalPo.approvedQuantity,
      'receivedQuantity + remainingQuantity must equal approvedQuantity'
    );
    assert.strictEqual(finalPo.receivingLog.length, 2);
    assert.strictEqual(finalPo.receivingLog[0].stockApplied, true);
    assert.strictEqual(finalPo.receivingLog[1].stockApplied, true);
  });

  // ==========================================================================
  // 2. Alternate Lifecycle: Rejection Flow
  // ==========================================================================
  it('2. Alternate Flow: PENDING -> REJECTED preserves product inventory stock', async () => {
    const baselineStock = (await Product.findById(testProduct._id)).stock;

    const createRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${manager2Token}`)
      .send({
        productId: testProduct._id.toString(),
        requestedQuantity: 50,
        requestReason: 'Surplus buffer request',
      });

    const poId = createRes.body.data._id;

    // Reject with reason
    const rejectRes = await request(app)
      .patch(`/api/purchase-orders/${poId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rejectionReason: 'Exceeds monthly department discretionary budget',
      });

    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.body.data.status, 'REJECTED');
    assert.strictEqual(
      rejectRes.body.data.rejectionReason,
      'Exceeds monthly department discretionary budget'
    );

    // Stock unchanged
    const prodCheck = await Product.findById(testProduct._id);
    assert.strictEqual(prodCheck.stock, baselineStock, 'Stock must not change on PO rejection');
  });

  // ==========================================================================
  // 3. Alternate Lifecycle: Cancellation & Role Permission Rules
  // ==========================================================================
  describe('Cancellation Rules & Role Authorization', () => {
    it('blocks MANAGER from cancelling another manager pending request', async () => {
      // Manager 1 creates a request
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 5,
          requestReason: 'Manager 1 personal request',
        });

      const poId = createRes.body.data._id;

      // Manager 2 tries to cancel Manager 1's request -> 403 Forbidden
      const cancelRes = await request(app)
        .patch(`/api/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${manager2Token}`)
        .send({
          cancellationReason: 'Manager 2 attempting cancellation',
        });

      assert.strictEqual(cancelRes.status, 403);
      assert.match(cancelRes.body.message, /cancel only their own/i);
    });

    it('allows MANAGER to cancel their own PENDING request', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 3,
          requestReason: 'Mistaken duplicate request',
        });

      const poId = createRes.body.data._id;

      const cancelRes = await request(app)
        .patch(`/api/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          cancellationReason: 'Created in error, cancelling immediately',
        });

      assert.strictEqual(cancelRes.status, 200);
      assert.strictEqual(cancelRes.body.data.status, 'CANCELLED');
    });

    it('blocks MANAGER from cancelling non-pending (e.g. APPROVED) orders', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 4,
          requestReason: 'Need approval',
        });

      const poId = createRes.body.data._id;

      // Admin approves it
      await request(app)
        .patch(`/api/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 4 });

      // Manager 1 tries to cancel an APPROVED order -> 403
      const cancelRes = await request(app)
        .patch(`/api/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          cancellationReason: 'Manager trying to cancel approved PO',
        });

      assert.strictEqual(cancelRes.status, 403);
      assert.match(cancelRes.body.message, /only PENDING/i);
    });

    it('allows ADMIN to cancel an unreceived APPROVED order', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 6,
          requestReason: 'Project requirement',
        });

      const poId = createRes.body.data._id;

      await request(app)
        .patch(`/api/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 6 });

      const adminCancelRes = await request(app)
        .patch(`/api/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cancellationReason: 'Project scope discontinued by executive team',
        });

      assert.strictEqual(adminCancelRes.status, 200);
      assert.strictEqual(adminCancelRes.body.data.status, 'CANCELLED');
    });

    it('blocks ADMIN from cancelling an order after partial stock is received', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 8,
          requestReason: 'Partial receive test',
        });

      const poId = createRes.body.data._id;

      await request(app)
        .patch(`/api/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 8 });

      await request(app)
        .patch(`/api/purchase-orders/${poId}/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierName: 'Speedy Supply' });

      // Partially receive 2 units
      await request(app)
        .post(`/api/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: 2, batchId: 'rcv_cannot_cancel_batch' });

      // Attempt cancellation
      const cancelRes = await request(app)
        .patch(`/api/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancellationReason: 'Trying to cancel partially received order' });

      assert.strictEqual(cancelRes.status, 400);
      assert.match(cancelRes.body.message, /already been partially received/i);
    });
  });

  // ==========================================================================
  // 4. Strict STAFF Role Protection
  // ==========================================================================
  describe('STAFF Role Isolation & Protection', () => {
    it('blocks STAFF from GET /api/purchase-orders with 403', async () => {
      const res = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('blocks STAFF from POST /api/purchase-orders with 403', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 5,
          requestReason: 'Staff reorder attempt',
        });
      assert.strictEqual(res.status, 403);
    });
  });

  // ==========================================================================
  // 5. Invalid State Transitions Rejection
  // ==========================================================================
  describe('Invalid State Transitions Rejection', () => {
    it('rejects receiving on PENDING purchase order', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 5,
          requestReason: 'Invalid transition probe',
        });

      const poId = createRes.body.data._id;

      const res = await request(app)
        .post(`/api/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: 1 });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /must be in ORDERED or PARTIALLY_RECEIVED/i);
    });

    it('rejects marking as ORDERED when PO is in PENDING status', async () => {
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 5,
          requestReason: 'Order transition probe',
        });

      const poId = createRes.body.data._id;

      const res = await request(app)
        .patch(`/api/purchase-orders/${poId}/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierName: 'Test Vendor' });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Only APPROVED purchase orders/i);
    });
  });

  // ==========================================================================
  // 6. Real Concurrent Receive Requests Against Live MongoDB
  // ==========================================================================
  describe('Live Database Concurrency Protection', () => {
    it('prevents over-receiving when two concurrent requests race for remaining balance', async () => {
      // Create and order an order with 10 units
      const createRes = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProduct._id.toString(),
          requestedQuantity: 10,
          requestReason: 'Concurrency testing order',
        });

      const poId = createRes.body.data._id;

      await request(app)
        .patch(`/api/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 10 });

      await request(app)
        .patch(`/api/purchase-orders/${poId}/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierName: 'Concurrent Vendor' });

      // Two simultaneous requests:
      // Request 1 wants 8 units (batch A)
      // Request 2 wants 6 units (batch B)
      // Total requested = 14 > 10! Exactly ONE must succeed and the other must be rejected with 409
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/purchase-orders/${poId}/receive`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ quantityReceived: 8, batchId: 'rcv_race_live_A' }),
        request(app)
          .post(`/api/purchase-orders/${poId}/receive`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ quantityReceived: 6, batchId: 'rcv_race_live_B' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert.deepStrictEqual(statuses, [200, 409], 'Exactly one request must succeed (200) and one must fail (409)');

      // Verify the PO document in MongoDB was not over-received
      const poAfter = await PurchaseOrder.findById(poId);
      assert.strictEqual(poAfter.receivedQuantity, 8);
      assert.strictEqual(poAfter.remainingQuantity, 2);
    });
  });
});
