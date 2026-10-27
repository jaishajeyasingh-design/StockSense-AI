import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import * as api from '../services/api';
import PurchaseOrders from '../pages/PurchaseOrders';
import ReceivePOModal from '../components/purchaseOrders/ReceivePOModal';
import CreatePOModal from '../components/purchaseOrders/CreatePOModal';
import ApprovePOModal from '../components/purchaseOrders/ApprovePOModal';
import RejectPOModal from '../components/purchaseOrders/RejectPOModal';
import CancelPOModal from '../components/purchaseOrders/CancelPOModal';

describe('Phase 3A.4: Purchase Orders Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // 1. API Client Method & Payload Verification
  // ==========================================================================
  describe('Purchase Order API Client Services', () => {
    it('calls fetchPurchaseOrdersApi with query parameters', async () => {
      const getSpy = vi.spyOn(api.default, 'get').mockResolvedValueOnce({ data: { success: true, data: [] } });
      await api.fetchPurchaseOrdersApi({ page: 2, status: 'PENDING' });
      expect(getSpy).toHaveBeenCalledWith('/purchase-orders', {
        params: { page: 2, status: 'PENDING' },
      });
    });

    it('calls fetchPurchaseOrderByIdApi with URL parameter', async () => {
      const getSpy = vi.spyOn(api.default, 'get').mockResolvedValueOnce({ data: { success: true, data: {} } });
      await api.fetchPurchaseOrderByIdApi('po_123');
      expect(getSpy).toHaveBeenCalledWith('/purchase-orders/po_123');
    });

    it('calls createPurchaseOrderApi with POST payload', async () => {
      const postSpy = vi.spyOn(api.default, 'post').mockResolvedValueOnce({ data: { success: true } });
      const payload = { productId: 'p1', requestedQuantity: 5, priority: 'HIGH', requestReason: 'Need stock' };
      await api.createPurchaseOrderApi(payload);
      expect(postSpy).toHaveBeenCalledWith('/purchase-orders', payload);
    });

    it('calls approvePurchaseOrderApi with PATCH payload', async () => {
      const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValueOnce({ data: { success: true } });
      await api.approvePurchaseOrderApi('po_123', { approvedQuantity: 10, notes: 'Approved' });
      expect(patchSpy).toHaveBeenCalledWith('/purchase-orders/po_123/approve', { approvedQuantity: 10, notes: 'Approved' });
    });

    it('calls rejectPurchaseOrderApi with mandatory rejectionReason', async () => {
      const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValueOnce({ data: { success: true } });
      await api.rejectPurchaseOrderApi('po_123', { rejectionReason: 'Budget exhausted' });
      expect(patchSpy).toHaveBeenCalledWith('/purchase-orders/po_123/reject', { rejectionReason: 'Budget exhausted' });
    });

    it('calls orderPurchaseOrderApi with supplier data', async () => {
      const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValueOnce({ data: { success: true } });
      const supplierData = { supplierName: 'Vendor Inc', referenceNumber: 'INV-1' };
      await api.orderPurchaseOrderApi('po_123', supplierData);
      expect(patchSpy).toHaveBeenCalledWith('/purchase-orders/po_123/order', supplierData);
    });

    it('calls receivePurchaseOrderStockApi with idempotent batchId', async () => {
      const postSpy = vi.spyOn(api.default, 'post').mockResolvedValueOnce({ data: { success: true } });
      const receiptData = { quantityReceived: 4, batchId: 'rcv_test_123' };
      await api.receivePurchaseOrderStockApi('po_123', receiptData);
      expect(postSpy).toHaveBeenCalledWith('/purchase-orders/po_123/receive', receiptData);
    });

    it('calls cancelPurchaseOrderApi with cancellationReason', async () => {
      const patchSpy = vi.spyOn(api.default, 'patch').mockResolvedValueOnce({ data: { success: true } });
      await api.cancelPurchaseOrderApi('po_123', { cancellationReason: 'No longer needed' });
      expect(patchSpy).toHaveBeenCalledWith('/purchase-orders/po_123/cancel', { cancellationReason: 'No longer needed' });
    });
  });

  // ==========================================================================
  // 2. Loading, Empty, Error and List Render States
  // ==========================================================================
  describe('PurchaseOrders Workspace Display States', () => {
    it('displays loading indicator initially', () => {
      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockReturnValue(new Promise(() => {}));
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      expect(screen.getByText(/loading purchase orders/i)).toBeInTheDocument();
    });

    it('displays empty state when no purchase orders exist', async () => {
      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValueOnce({
        data: { success: true, data: [], total: 0, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No purchase orders found')).toBeInTheDocument();
      });
    });

    it('displays error message and retry button when API fails', async () => {
      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockRejectedValueOnce({
        response: { data: { message: 'Database connection failed' } },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('renders populated list with real returned values', async () => {
      const mockPo = {
        _id: 'po_001',
        poNumber: 'PO-20261025-ABCD',
        productId: { name: 'Industrial Valve', sku: 'VALVE-99' },
        status: 'PENDING',
        priority: 'HIGH',
        requestedQuantity: 20,
        approvedQuantity: null,
        receivedQuantity: 0,
        remainingQuantity: 20,
        unitCost: 15.5,
        estimatedCost: 310,
        requestedBy: { name: 'John Manager' },
        createdAt: '2026-10-25T12:00:00Z',
      };

      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValueOnce({
        data: { success: true, data: [mockPo], total: 1, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('PO-20261025-ABCD')).toBeInTheDocument();
        expect(screen.getByText('Industrial Valve')).toBeInTheDocument();
        expect(screen.getAllByText('PENDING').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
        expect(screen.getByText('$310')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 3. Role & Status-Based Action Visibility
  // ==========================================================================
  describe('Role & Status Action Visibility Rules', () => {
    it('shows Approve, Reject and Cancel for ADMIN on PENDING orders', async () => {
      const mockPo = {
        _id: 'po_p1',
        poNumber: 'PO-PENDING-01',
        productId: { name: 'Test Product', sku: 'SKU-1' },
        status: 'PENDING',
        priority: 'MEDIUM',
        requestedQuantity: 10,
        remainingQuantity: 10,
        unitCost: 5,
        estimatedCost: 50,
        requestedBy: { _id: 'mgr_other', name: 'Other Manager' },
        createdAt: '2026-10-25T12:00:00Z',
      };

      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValueOnce({
        data: { success: true, data: [mockPo], total: 1, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ _id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it('hides Approve and Reject from MANAGER and allows Cancel only for own request', async () => {
      const mockOtherPo = {
        _id: 'po_p2',
        poNumber: 'PO-OTHER-MGR',
        productId: { name: 'Widget A', sku: 'SKU-A' },
        status: 'PENDING',
        priority: 'MEDIUM',
        requestedQuantity: 5,
        remainingQuantity: 5,
        unitCost: 10,
        estimatedCost: 50,
        requestedBy: { _id: 'mgr_other', name: 'Other Mgr' },
        createdAt: '2026-10-25T12:00:00Z',
      };

      const mockOwnPo = {
        _id: 'po_p3',
        poNumber: 'PO-OWN-MGR',
        productId: { name: 'Widget B', sku: 'SKU-B' },
        status: 'PENDING',
        priority: 'LOW',
        requestedQuantity: 8,
        remainingQuantity: 8,
        unitCost: 10,
        estimatedCost: 80,
        requestedBy: { _id: 'mgr_me', name: 'My User' },
        createdAt: '2026-10-25T12:00:00Z',
      };

      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValueOnce({
        data: { success: true, data: [mockOtherPo, mockOwnPo], total: 2, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="MANAGER" currentUser={{ _id: 'mgr_me', role: 'MANAGER' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Manager never sees Approve or Reject
        expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
        // Manager sees exactly one Cancel button (for own order only)
        const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
        expect(cancelButtons.length).toBe(1);
      });
    });

    it('shows Receive Stock for ADMIN on ORDERED or PARTIALLY_RECEIVED orders', async () => {
      const mockOrderedPo = {
        _id: 'po_ordered_1',
        poNumber: 'PO-ORDERED-01',
        productId: { name: 'Motor', sku: 'MTR-1' },
        status: 'ORDERED',
        priority: 'HIGH',
        requestedQuantity: 10,
        approvedQuantity: 10,
        receivedQuantity: 0,
        remainingQuantity: 10,
        unitCost: 25,
        estimatedCost: 250,
        createdAt: '2026-10-25T12:00:00Z',
      };

      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValueOnce({
        data: { success: true, data: [mockOrderedPo], total: 1, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ _id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /receive stock/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 4. Lifecycle Dialogs Validation & Interaction
  // ==========================================================================
  describe('Lifecycle Dialog Validation', () => {
    it('validates CreatePOModal input fields', async () => {
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValueOnce({
        data: { success: true, data: [{ _id: 'p1', name: 'Product 1', price: 10, stock: 5 }] },
      });

      render(
        <CreatePOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Product 1/i)).toBeInTheDocument();
      });

      // Submit with reason shorter than 3 characters
      const reasonInput = screen.getByPlaceholderText(/critically low/i);
      fireEvent.change(reasonInput, { target: { value: 'ab' } });

      const submitBtn = screen.getByRole('button', { name: /submit reorder request/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/at least 3 characters is required/i)).toBeInTheDocument();
    });

    it('validates RejectPOModal mandatory reason of at least 3 characters', async () => {
      render(
        <RejectPOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          order={{ _id: 'po_1', poNumber: 'PO-TEST-1', requestedQuantity: 5 }}
        />
      );

      // Input reason with only 2 characters
      const reasonInput = screen.getByPlaceholderText(/budget ceiling/i);
      fireEvent.change(reasonInput, { target: { value: 'no' } });

      const submitBtn = screen.getByRole('button', { name: /confirm rejection/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/rejection reason of at least 3 characters is mandatory/i)).toBeInTheDocument();
    });

    it('validates CancelPOModal mandatory cancellation reason', async () => {
      render(
        <CancelPOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          order={{ _id: 'po_1', poNumber: 'PO-TEST-1', requestedQuantity: 5 }}
        />
      );

      // Input reason with only 2 characters
      const reasonInput = screen.getByPlaceholderText(/no longer needed/i);
      fireEvent.change(reasonInput, { target: { value: 'no' } });

      const submitBtn = screen.getByRole('button', { name: /confirm cancellation/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/cancellation reason of at least 3 characters is mandatory/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 5. Receiving Safety: Stable Batch ID Reuse & Recovery Warnings
  // ==========================================================================
  describe('Receiving Safety & Idempotent Retry', () => {
    it('maintains the same batchId on retry after a failed receipt attempt', async () => {
      const mockOrder = {
        _id: 'po_rcv_1',
        poNumber: 'PO-RCV-TEST',
        productId: { name: 'Bearings' },
        approvedQuantity: 10,
        receivedQuantity: 0,
        remainingQuantity: 10,
      };

      const receiveSpy = vi.spyOn(api, 'receivePurchaseOrderStockApi').mockRejectedValueOnce({
        response: { data: { message: 'Network dropped during stock write' } },
      });

      render(
        <ReceivePOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          order={mockOrder}
        />
      );

      // Verify batchId is pre-populated with rcv_ prefix
      const batchInput = screen.getByDisplayValue(/^rcv_/);
      const initialBatchId = batchInput.value;
      expect(initialBatchId).toMatch(/^rcv_/);

      // Click receive
      const submitBtn = screen.getByRole('button', { name: /commit stock receipt/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Network dropped during stock write')).toBeInTheDocument();
      });

      // Verify the batchId in the input has NOT changed (stable retry ID!)
      expect(batchInput.value).toBe(initialBatchId);
      expect(receiveSpy).toHaveBeenCalledWith('po_rcv_1', expect.objectContaining({
        batchId: initialBatchId,
      }));
    });

    it('accurately displays CRITICAL RECOVERY REQUIRED banner if backend flags recoveryRequired', async () => {
      const mockOrder = {
        _id: 'po_rcv_crash',
        poNumber: 'PO-CRASH-TEST',
        productId: { name: 'Sensors' },
        approvedQuantity: 5,
        remainingQuantity: 5,
      };

      vi.spyOn(api, 'receivePurchaseOrderStockApi').mockRejectedValueOnce({
        response: {
          data: {
            recoveryRequired: true,
            batchId: 'rcv_crash_batch_009',
            message: 'CRITICAL INCONSISTENCY: Stock write failed and rollback failed.',
          },
        },
      });

      render(
        <ReceivePOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          order={mockOrder}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /commit stock receipt/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/CRITICAL RECOVERY REQUIRED/i)).toBeInTheDocument();
        expect(screen.getByText(/rcv_crash_batch_009/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry reconciliation/i })).toBeInTheDocument();
      });
    });

    it('handles reconciled response without local client inventory arithmetic', async () => {
      const mockOrder = {
        _id: 'po_rcv_reconciled',
        poNumber: 'PO-RECON-TEST',
        productId: { name: 'Gaskets' },
        approvedQuantity: 5,
        remainingQuantity: 5,
      };

      vi.spyOn(api, 'receivePurchaseOrderStockApi').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            reconciled: true,
            purchaseOrder: { ...mockOrder, remainingQuantity: 0, receivedQuantity: 5 },
          },
        },
      });

      const successSpy = vi.fn();

      render(
        <ReceivePOModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={successSpy}
          order={mockOrder}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /commit stock receipt/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(successSpy).toHaveBeenCalledWith(
          expect.objectContaining({ reconciled: true }),
          expect.stringMatching(/successfully reconciled/i)
        );
      });
    });

    it('renders feedback banner with dismiss button (X icon) and dismisses on click', async () => {
      const mockPo = {
        _id: 'po_fb_1',
        poNumber: 'PO-FB-01',
        productId: { name: 'Item FB', sku: 'FB-1' },
        status: 'PENDING',
        priority: 'MEDIUM',
        requestedQuantity: 5,
        remainingQuantity: 5,
        unitCost: 10,
        estimatedCost: 50,
        createdAt: '2026-10-25T12:00:00Z',
      };

      vi.spyOn(api, 'fetchPurchaseOrdersApi').mockResolvedValue({
        data: { success: true, data: [mockPo], total: 1, pages: 1 },
      });
      vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({ data: { success: true, data: [] } });
      vi.spyOn(api, 'approvePurchaseOrderApi').mockResolvedValueOnce({
        data: { success: true, data: { ...mockPo, status: 'APPROVED' } },
      });

      render(
        <MemoryRouter>
          <PurchaseOrders userRole="ADMIN" currentUser={{ _id: 'adm_1', role: 'ADMIN' }} />
        </MemoryRouter>
      );

      // Open Approve modal
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /approve/i }));

      // Confirm approval in modal
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /confirm approval/i }));

      // Feedback banner appears with message and dismiss button (X icon)
      await waitFor(() => {
        expect(screen.getByText(/approved successfully/i)).toBeInTheDocument();
      });

      // Find the dismiss button in the feedback banner and click it
      const dismissBtn = screen.getByText(/approved successfully/i).closest('div').parentElement.querySelector('button');
      expect(dismissBtn).toBeInTheDocument();
      fireEvent.click(dismissBtn);

      // Feedback banner should be dismissed
      await waitFor(() => {
        expect(screen.queryByText(/approved successfully/i)).not.toBeInTheDocument();
      });
    });
  });
});
