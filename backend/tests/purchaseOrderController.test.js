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

describe('Phase 3A.2: Purchase Order Controller & REST API Security Suite', () => {
  let app;

  const mockAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin User',
    email: 'admin@stocksense.ai',
    role: 'ADMIN',
  };

  const mockManagerUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Manager User',
    email: 'manager@stocksense.ai',
    role: 'MANAGER',
  };

  const mockOtherManagerUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Other Manager',
    email: 'other_mgr@stocksense.ai',
    role: 'MANAGER',
  };

  const mockStaffUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Staff User',
    email: 'staff@stocksense.ai',
    role: 'STAFF',
  };

  const adminToken = jwt.sign({ id: mockAdminUser._id.toString() }, TEST_SECRET);
  const managerToken = jwt.sign({ id: mockManagerUser._id.toString() }, TEST_SECRET);
  const staffToken = jwt.sign({ id: mockStaffUser._id.toString() }, TEST_SECRET);

  beforeEach(() => {
    // Construct test Express application with mounted purchaseOrderRoutes
    app = express();
    app.use(express.json());

    // Mock User.findById for authMiddleware
    User.findById = (id) => ({
      select: async (fields) => {
        const idStr = id.toString();
        if (idStr === mockAdminUser._id.toString()) return mockAdminUser;
        if (idStr === mockManagerUser._id.toString()) return mockManagerUser;
        if (idStr === mockOtherManagerUser._id.toString()) return mockOtherManagerUser;
        if (idStr === mockStaffUser._id.toString()) return mockStaffUser;
        return null;
      },
    });

    app.use('/api/purchase-orders', purchaseOrderRoutes);
  });

  // ==========================================================================
  // 1. RBAC & ROUTE AUTHORIZATION ENFORCEMENT
  // ==========================================================================
  describe('1. Route Authorization & Role Enforcement', () => {
    const dummyId = new mongoose.Types.ObjectId();

    it('rejects requests with missing Authorization token with 401', async () => {
      const res = await request(app).get('/api/purchase-orders');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /no token provided/i);
    });

    it('rejects requests with invalid JWT token with 401', async () => {
      const res = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', 'Bearer invalid_tampered_token');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /token failed/i);
    });

    it('blocks STAFF with 403 on all purchase order routes', async () => {
      const endpoints = [
        { method: 'get', path: '/api/purchase-orders' },
        { method: 'post', path: '/api/purchase-orders', body: {} },
        { method: 'get', path: `/api/purchase-orders/${dummyId}` },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/approve`, body: {} },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/reject`, body: {} },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/order`, body: {} },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/cancel`, body: {} },
        { method: 'post', path: `/api/purchase-orders/${dummyId}/receive`, body: {} },
      ];

      for (const ep of endpoints) {
        let reqBuilder = request(app)[ep.method](ep.path)
          .set('Authorization', `Bearer ${staffToken}`);
        if (ep.body) reqBuilder = reqBuilder.send(ep.body);

        const res = await reqBuilder;
        assert.strictEqual(
          res.status,
          403,
          `Expected 403 for STAFF on ${ep.method.toUpperCase()} ${ep.path}, got ${res.status}`
        );
        assert.strictEqual(res.body.success, false);
      }
    });

    it('blocks MANAGER from Admin-only actions (approve, reject, order, receive) with 403', async () => {
      const adminOnlyEndpoints = [
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/approve` },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/reject` },
        { method: 'patch', path: `/api/purchase-orders/${dummyId}/order` },
        { method: 'post', path: `/api/purchase-orders/${dummyId}/receive` },
      ];

      for (const ep of adminOnlyEndpoints) {
        const res = await request(app)[ep.method](ep.path)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({});

        assert.strictEqual(
          res.status,
          403,
          `Expected 403 for MANAGER on ${ep.method.toUpperCase()} ${ep.path}, got ${res.status}`
        );
        assert.strictEqual(res.body.success, false);
      }
    });
  });

  // ==========================================================================
  // 2. CREATE PURCHASE ORDER (POST /api/purchase-orders)
  // ==========================================================================
  describe('2. POST /api/purchase-orders (Zero-trust creation)', () => {
    const validProductId = new mongoose.Types.ObjectId();

    it('rejects invalid or missing productId with 400', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: 'not-an-objectid',
          requestedQuantity: 10,
          requestReason: 'Valid reason here',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /valid product ID/i);
    });

    it('rejects invalid, negative or non-integer requestedQuantity with 400', async () => {
      const invalidQuantities = [0, -10, 5.5, 'abc'];

      for (const qty of invalidQuantities) {
        const res = await request(app)
          .post('/api/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            productId: validProductId.toString(),
            requestedQuantity: qty,
            requestReason: 'Valid reason here',
          });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.message, /integer of at least 1/i);
      }
    });

    it('rejects short or missing requestReason with 400', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: validProductId.toString(),
          requestedQuantity: 10,
          requestReason: 'No', // < 3 chars
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /at least 3 characters/i);
    });

    it('returns 404 when productId does not exist in database', async () => {
      Product.findById = async () => null;

      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: validProductId.toString(),
          requestedQuantity: 10,
          requestReason: 'Inventory low',
        });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Product not found/i);
    });

    it('creates PENDING PO deriving unitCost from product and requestedBy from JWT', async () => {
      const mockProduct = {
        _id: validProductId,
        name: 'Wheat Flour 5kg',
        price: 240, // Server-side price
        stock: 5,
      };
      Product.findById = async () => mockProduct;

      let createdDocData = null;
      PurchaseOrder.create = async (doc) => {
        createdDocData = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() };
      };

      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: validProductId.toString(),
          requestedQuantity: 15,
          requestReason: 'Low stock safety reorder',
          priority: 'HIGH',
          // Malicious client inputs that MUST be ignored:
          unitCost: 1.0,
          totalEstimatedCost: 15.0,
          status: 'APPROVED',
          requestedBy: new mongoose.Types.ObjectId(),
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);

      // Verify server derived values:
      assert.strictEqual(createdDocData.status, 'PENDING');
      assert.strictEqual(createdDocData.unitCost, 240); // Derived from product.price (not client 1.0)
      assert.strictEqual(createdDocData.totalEstimatedCost, 3600); // 15 * 240 (not client 15.0)
      assert.strictEqual(createdDocData.requestedBy.toString(), mockManagerUser._id.toString());
      assert.strictEqual(createdDocData.remainingQuantity, 15);
      assert.strictEqual(createdDocData.receivedQuantity, 0);
      assert.strictEqual(createdDocData.timeline.length, 1);
      assert.strictEqual(createdDocData.timeline[0].action, 'REORDER_REQUESTED');
    });
  });

  // ==========================================================================
  // 3. REVIEW & APPROVAL (PATCH /api/purchase-orders/:id/approve & reject)
  // ==========================================================================
  describe('3. Admin Approval & Rejection Flow', () => {
    const validPoId = new mongoose.Types.ObjectId();

    it('rejects approval if order is not in PENDING status', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'ORDERED', // Already past PENDING
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 10 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Only PENDING purchase orders can be approved/i);
    });

    it('successfully approves a PENDING order with adjusted quantity', async () => {
      let saved = false;
      const mockPo = {
        _id: validPoId,
        status: 'PENDING',
        requestedQuantity: 20,
        unitCost: 100,
        timeline: [],
        save: async function () {
          saved = true;
          return this;
        },
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvedQuantity: 12, notes: 'Approved for 12 units due to storage limits' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(mockPo.status, 'APPROVED');
      assert.strictEqual(mockPo.approvedQuantity, 12);
      assert.strictEqual(mockPo.remainingQuantity, 12);
      assert.strictEqual(mockPo.totalEstimatedCost, 1200); // 12 * 100
      assert.strictEqual(mockPo.approvedBy.toString(), mockAdminUser._id.toString());
      assert.strictEqual(saved, true);
    });

    it('rejects PENDING order requiring a valid rejectionReason', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'PENDING',
        timeline: [],
        save: async function () {
          return this;
        },
      };
      PurchaseOrder.findById = async () => mockPo;

      // Missing reason
      const failRes = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.strictEqual(failRes.status, 400);
      assert.match(failRes.body.message, /rejection reason/i);

      // Valid reason
      const okRes = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Item being phased out by management' });

      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(mockPo.status, 'REJECTED');
      assert.strictEqual(mockPo.rejectionReason, 'Item being phased out by management');
    });
  });

  // ==========================================================================
  // 4. MARK ORDERED WITH SUPPLIER (PATCH /api/purchase-orders/:id/order)
  // ==========================================================================
  describe('4. Mark Ordered with Supplier', () => {
    const validPoId = new mongoose.Types.ObjectId();

    it('rejects marking as ORDERED if status is not APPROVED', async () => {
      const mockPo = { _id: validPoId, status: 'PENDING' };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplierName: 'Acme Wholesalers' });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Only APPROVED purchase orders can be marked as ORDERED/i);
    });

    it('successfully transitions APPROVED PO to ORDERED with supplier information', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'APPROVED',
        timeline: [],
        save: async function () {
          return this;
        },
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/order`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Acme Wholesalers Ltd',
          referenceNumber: 'INV-2026-9921',
          expectedDeliveryDate: '2026-11-05',
          notes: 'Standard 7-day freight dispatch',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockPo.status, 'ORDERED');
      assert.strictEqual(mockPo.supplierInfo.supplierName, 'Acme Wholesalers Ltd');
      assert.strictEqual(mockPo.supplierInfo.referenceNumber, 'INV-2026-9921');
    });
  });

  // ==========================================================================
  // 5. CANCELLATION FLOW & TERMINAL RULES (PATCH /api/purchase-orders/:id/cancel)
  // ==========================================================================
  describe('5. Order Cancellation Rules', () => {
    const validPoId = new mongoose.Types.ObjectId();

    it('blocks Manager from cancelling an order they did not create', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'PENDING',
        requestedBy: mockOtherManagerUser._id, // Created by someone else
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ cancellationReason: 'No longer needed' });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /cancel only their own/i);
    });

    it('blocks Manager from cancelling non-pending (e.g. APPROVED) orders', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'APPROVED',
        requestedBy: mockManagerUser._id,
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ cancellationReason: 'No longer needed' });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /only PENDING/i);
    });

    it('blocks Admin from cancelling orders where stock was already received', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'PARTIALLY_RECEIVED',
        receivedQuantity: 5,
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancellationReason: 'Cancel rest of shipment' });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /stock has already been partially received/i);
    });

    it('allows Manager to cancel their own PENDING order with valid reason', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'PENDING',
        requestedBy: mockManagerUser._id,
        receivedQuantity: 0,
        timeline: [],
        save: async function () {
          return this;
        },
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .patch(`/api/purchase-orders/${validPoId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ cancellationReason: 'Found existing inventory in rear warehouse' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockPo.status, 'CANCELLED');
      assert.strictEqual(mockPo.cancellationReason, 'Found existing inventory in rear warehouse');
    });
  });

  // ==========================================================================
  // 6. DURABLE STANDALONE RECEIVING & IDEMPOTENCY (POST /api/purchase-orders/:id/receive)
  // ==========================================================================
  describe('6. Durable Receiving Protocol, Stock Updates & Idempotency', () => {
    const validPoId = new mongoose.Types.ObjectId();
    const validProductId = new mongoose.Types.ObjectId();

    it('rejects receiving stock if PO is in PENDING or APPROVED status', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'APPROVED', // Not yet placed with supplier
        remainingQuantity: 10,
        receivingLog: [],
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .post(`/api/purchase-orders/${validPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: 5 });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /must be in ORDERED or PARTIALLY_RECEIVED/i);
    });

    it('rejects receiving quantity that exceeds remainingQuantity', async () => {
      const mockPo = {
        _id: validPoId,
        status: 'ORDERED',
        remainingQuantity: 8,
        receivingLog: [],
      };
      PurchaseOrder.findById = async () => mockPo;

      const res = await request(app)
        .post(`/api/purchase-orders/${validPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReceived: 10 }); // 10 > 8

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Only 8 units remain outstanding/i);
    });

    it('successfully processes partial receipt and increments Product.stock', async () => {
      const mockPo = {
        _id: validPoId,
        productId: validProductId,
        status: 'ORDERED',
        remainingQuantity: 10,
        receivedQuantity: 0,
        receivingLog: [],
      };
      PurchaseOrder.findById = async () => mockPo;

      let poUpdated = false;
      PurchaseOrder.findOneAndUpdate = async () => {
        poUpdated = true;
        return {
          ...mockPo,
          status: 'PARTIALLY_RECEIVED',
          remainingQuantity: 6,
          receivedQuantity: 4,
        };
      };

      let stockIncremented = 0;
      Product.findByIdAndUpdate = async (pId, update) => {
        stockIncremented = update.$inc.stock;
        return { _id: pId, stock: 14 }; // stock went 10 -> 14
      };

      PurchaseOrder.updateOne = async () => ({ modifiedCount: 1 });

      const res = await request(app)
        .post(`/api/purchase-orders/${validPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantityReceived: 4,
          batchNumber: 'LOT-9871',
          notes: 'Box 1 of 2 delivered',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(poUpdated, true);
      assert.strictEqual(stockIncremented, 4); // Exact quantity received
      assert.strictEqual(res.body.data.remainingProductStock, 14);
    });

    it('handles duplicate receipt idempotent retry without incrementing stock twice', async () => {
      const existingBatchId = 'rcv_existing_batch_123';
      const mockPo = {
        _id: validPoId,
        productId: validProductId,
        status: 'PARTIALLY_RECEIVED',
        remainingQuantity: 6,
        receivedQuantity: 4,
        receivingLog: [
          {
            batchId: existingBatchId,
            quantityReceived: 4,
            stockApplied: true, // Already applied previously
          },
        ],
      };
      PurchaseOrder.findById = async () => mockPo;

      let productUpdateCalled = false;
      Product.findByIdAndUpdate = async () => {
        productUpdateCalled = true;
        return {};
      };

      const res = await request(app)
        .post(`/api/purchase-orders/${validPoId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          batchId: existingBatchId,
          quantityReceived: 4,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.idempotentDuplicate, true);
      // Critical safety invariant: Product.stock must NOT be incremented a second time!
      assert.strictEqual(productUpdateCalled, false);
    });
  });
});
