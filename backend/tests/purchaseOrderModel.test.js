const { describe, it } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const PurchaseOrder = require('../models/PurchaseOrder');
const {
  formatPONumber,
  generateUniquePONumber,
  isValidPONumber,
} = require('../utils/poNumberGenerator');

describe('Phase 3A.1: PurchaseOrder Model & PO Number Generation Suite', () => {
  const dummyProductId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyAdminId = new mongoose.Types.ObjectId();

  describe('1. Purchase Order Number Generator Utility', () => {
    it('formats a valid PO number with date namespace and entropy', () => {
      const poNum = formatPONumber();
      assert.strictEqual(typeof poNum, 'string');
      assert.match(poNum, /^PO-\d{8}-[A-Z0-9]{6}$/);
      assert.strictEqual(isValidPONumber(poNum), true);
    });

    it('validates PO numbers strictly with isValidPONumber', () => {
      assert.strictEqual(isValidPONumber('PO-20261025-A1B2C3'), true);
      assert.strictEqual(isValidPONumber('PO-20261025-ABCD'), true);
      assert.strictEqual(isValidPONumber('PO-20261025-12345678'), true);
      assert.strictEqual(isValidPONumber('INVALID-1234'), false);
      assert.strictEqual(isValidPONumber('PO-2026-ABCD'), false); // Missing full YYYYMMDD
      assert.strictEqual(isValidPONumber('PO-20261025-'), false); // Missing entropy
      assert.strictEqual(isValidPONumber(''), false);
      assert.strictEqual(isValidPONumber(null), false);
    });

    it('generates unique PO numbers across consecutive invocations', async () => {
      const numbers = new Set();
      for (let i = 0; i < 50; i++) {
        const num = await generateUniquePONumber();
        assert.strictEqual(isValidPONumber(num), true);
        assert.strictEqual(numbers.has(num), false, `Collision detected on ${num}`);
        numbers.add(num);
      }
      assert.strictEqual(numbers.size, 50);
    });

    it('safely handles collision retry using a mock model', async () => {
      let callCount = 0;
      const mockModel = {
        findOne: () => ({
          select: () => ({
            lean: async () => {
              callCount++;
              // Simulate collision on first attempt, unique on second
              return callCount === 1 ? { _id: 'collision' } : null;
            },
          }),
        }),
      };

      const poNum = await generateUniquePONumber(mockModel);
      assert.strictEqual(isValidPONumber(poNum), true);
      assert.strictEqual(callCount >= 2, true);
    });
  });

  describe('2. PurchaseOrder Schema Constraints & Default Initialization', () => {
    it('validates a valid reorder request document successfully', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 25,
        unitCost: 60.5,
        requestReason: 'Stock level below reorder threshold based on forecast',
        requestedBy: dummyUserId,
      });

      await po.validate();

      // Check auto-initialized defaults
      assert.strictEqual(po.status, 'PENDING');
      assert.strictEqual(po.priority, 'MEDIUM');
      assert.strictEqual(po.receivedQuantity, 0);
      assert.strictEqual(po.remainingQuantity, 25);
      assert.strictEqual(po.totalEstimatedCost, 1512.5); // 25 * 60.5
      assert.strictEqual(po.approvedQuantity, null);
    });

    it('fails validation when required fields are missing', async () => {
      const po = new PurchaseOrder({});

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error, 'Expected validation error');
      assert.ok(error.errors.poNumber, 'Expected poNumber required error');
      assert.ok(error.errors.productId, 'Expected productId required error');
      assert.ok(error.errors.requestedQuantity, 'Expected requestedQuantity required error');
      assert.ok(error.errors.unitCost, 'Expected unitCost required error');
      assert.ok(error.errors.requestReason, 'Expected requestReason required error');
      assert.ok(error.errors.requestedBy, 'Expected requestedBy required error');
    });

    it('rejects invalid PO number formats in schema', async () => {
      const po = new PurchaseOrder({
        poNumber: 'BAD-FORMAT-PO',
        productId: dummyProductId,
        requestedQuantity: 10,
        unitCost: 100,
        requestReason: 'Valid reason',
        requestedBy: dummyUserId,
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.poNumber);
    });

    it('rejects non-positive and non-integer requested quantities', async () => {
      const invalidQuantities = [0, -5, 12.5];

      for (const qty of invalidQuantities) {
        const po = new PurchaseOrder({
          poNumber: 'PO-20261025-A1B2C3',
          productId: dummyProductId,
          requestedQuantity: qty,
          unitCost: 100,
          requestReason: 'Valid reason',
          requestedBy: dummyUserId,
        });

        let error;
        try {
          await po.validate();
        } catch (err) {
          error = err;
        }

        assert.ok(error, `Expected validation error for quantity: ${qty}`);
        assert.ok(error.errors.requestedQuantity);
      }
    });

    it('rejects unsupported status and priority enums', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 10,
        unitCost: 100,
        status: 'SHIPPED', // Not in enum
        priority: 'EXTREME', // Not in enum
        requestReason: 'Valid reason',
        requestedBy: dummyUserId,
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.status);
      assert.ok(error.errors.priority);
    });

    it('accepts all 7 valid lifecycle statuses', async () => {
      const validStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED',
        'ORDERED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CANCELLED',
      ];

      for (const status of validStatuses) {
        const poData = {
          poNumber: 'PO-20261025-A1B2C3',
          productId: dummyProductId,
          requestedQuantity: 10,
          unitCost: 100,
          status,
          requestReason: 'Stock replenishment request',
          requestedBy: dummyUserId,
        };

        if (status === 'REJECTED') {
          poData.rejectionReason = 'Exceeds departmental monthly budget';
        }
        if (status === 'CANCELLED') {
          poData.cancellationReason = 'Duplicate purchase order entry';
        }
        if (status === 'APPROVED' || status === 'ORDERED') {
          poData.approvedQuantity = 10;
        }
        if (status === 'RECEIVED') {
          poData.approvedQuantity = 10;
          poData.receivedQuantity = 10;
          poData.remainingQuantity = 0;
        }
        if (status === 'PARTIALLY_RECEIVED') {
          poData.approvedQuantity = 10;
          poData.receivedQuantity = 4;
          poData.remainingQuantity = 6;
        }

        const po = new PurchaseOrder(poData);
        await po.validate();
        assert.strictEqual(po.status, status);
      }
    });
  });

  describe('3. Lifecycle Business Rule Validations', () => {
    it('requires a rejectionReason of at least 3 chars when status is REJECTED', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 10,
        unitCost: 100,
        status: 'REJECTED',
        requestReason: 'Need more stock',
        requestedBy: dummyUserId,
        rejectionReason: '', // Missing
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.rejectionReason);
    });

    it('requires a cancellationReason of at least 3 chars when status is CANCELLED', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 10,
        unitCost: 100,
        status: 'CANCELLED',
        requestReason: 'Need more stock',
        requestedBy: dummyUserId,
        cancellationReason: 'No', // Too short
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.cancellationReason);
    });

    it('enforces approvedQuantity >= 1 when status is APPROVED or ORDERED', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 10,
        unitCost: 100,
        status: 'APPROVED',
        approvedQuantity: null, // Invalid for approved
        requestReason: 'Need stock',
        requestedBy: dummyUserId,
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.approvedQuantity);
    });

    it('validates remainingQuantity consistency on fully RECEIVED orders', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 10,
        approvedQuantity: 10,
        receivedQuantity: 10,
        remainingQuantity: 2, // Inconsistent with RECEIVED status (must be 0)
        unitCost: 100,
        status: 'RECEIVED',
        requestReason: 'Need stock',
        requestedBy: dummyUserId,
      });

      let error;
      try {
        await po.validate();
      } catch (err) {
        error = err;
      }

      assert.ok(error);
      assert.ok(error.errors.remainingQuantity);
    });
  });

  describe('4. Timeline Audit Subdocuments & Receiving Log', () => {
    it('validates timeline subdocuments with actors, actions and roles', async () => {
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 20,
        unitCost: 50,
        requestReason: 'Low stock safety reorder',
        requestedBy: dummyUserId,
        timeline: [
          {
            status: 'PENDING',
            action: 'REQUEST_SUBMITTED',
            actor: dummyUserId,
            actorRole: 'MANAGER',
            notes: 'Requested via inventory alert trigger',
          },
          {
            status: 'APPROVED',
            action: 'REQUEST_APPROVED',
            actor: dummyAdminId,
            actorRole: 'ADMIN',
            notes: 'Approved with full quantity',
          },
        ],
      });

      await po.validate();
      assert.strictEqual(po.timeline.length, 2);
      assert.strictEqual(po.timeline[0].actorRole, 'MANAGER');
      assert.strictEqual(po.timeline[1].actorRole, 'ADMIN');
    });

    it('validates receivingLog entries and hasReceivedBatch helper', async () => {
      const batchId = 'batch-20261025-001';
      const po = new PurchaseOrder({
        poNumber: 'PO-20261025-A1B2C3',
        productId: dummyProductId,
        requestedQuantity: 20,
        approvedQuantity: 20,
        receivedQuantity: 10,
        remainingQuantity: 10,
        unitCost: 50,
        status: 'PARTIALLY_RECEIVED',
        requestReason: 'Low stock safety reorder',
        requestedBy: dummyUserId,
        receivingLog: [
          {
            batchId,
            quantityReceived: 10,
            receivedBy: dummyAdminId,
            batchNumber: 'LOT-9921',
            notes: 'Partial shipment delivered by supplier courier',
          },
        ],
      });

      await po.validate();
      assert.strictEqual(po.hasReceivedBatch(batchId), true);
      assert.strictEqual(po.hasReceivedBatch('non-existent-batch'), false);
    });

    it('generates a PO number via static helper method', async () => {
      const generated = await PurchaseOrder.generatePONumber();
      assert.strictEqual(typeof generated, 'string');
      assert.strictEqual(isValidPONumber(generated), true);
    });
  });
});
