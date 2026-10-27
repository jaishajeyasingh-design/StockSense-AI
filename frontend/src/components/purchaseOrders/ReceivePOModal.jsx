import React, { useState, useEffect } from 'react';
import { X, PackageCheck, AlertCircle, AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { receivePurchaseOrderStockApi } from '../../services/api';

const ReceivePOModal = ({ isOpen, onClose, onSuccess, order }) => {
  const [quantityReceived, setQuantityReceived] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [batchId, setBatchId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [recoveryState, setRecoveryState] = useState(null);

  // Initialize unique batch ID only when modal is initially opened for a new attempt
  useEffect(() => {
    if (order && isOpen) {
      setError(null);
      setRecoveryState(null);
      setQuantityReceived(order.remainingQuantity || 1);
      setBatchNumber('');
      setNotes('');
      // Generate unique idempotent batch ID for this new receipt attempt
      const newBatchId = `rcv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setBatchId(newBatchId);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setRecoveryState(null);

    const qty = Number(quantityReceived);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Quantity received must be an integer of at least 1');
      return;
    }
    if (qty > order.remainingQuantity) {
      setError(`Cannot receive ${qty} units. Only ${order.remainingQuantity} units remain outstanding.`);
      return;
    }
    if (!batchId) {
      setError('A unique batch tracking ID is required for idempotent receipt');
      return;
    }

    setSubmitting(true);
    try {
      // Send receipt with the stable batchId (which will be reused if this attempt fails and is retried)
      const res = await receivePurchaseOrderStockApi(order._id, {
        quantityReceived: qty,
        batchNumber: batchNumber ? batchNumber.trim() : undefined,
        notes: notes ? notes.trim() : undefined,
        batchId: batchId.trim(),
      });

      if (res.data?.success) {
        const isReconciled = res.data.data?.reconciled;
        const isDuplicate = res.data.data?.idempotentDuplicate;

        let successMsg = `Successfully received ${qty} units for PO ${order.poNumber}`;
        if (isReconciled) {
          successMsg = `Pending receipt batch ${batchId} was successfully reconciled and physical stock was updated`;
        } else if (isDuplicate) {
          successMsg = `Receipt batch ${batchId} was already processed idempotently`;
        }

        onSuccess(res.data.data, successMsg);
        onClose();
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.recoveryRequired) {
        // Critical dual-write failure: Expose explicit recovery state
        setRecoveryState({
          batchId: errorData.batchId || batchId,
          message: errorData.message || 'Critical inconsistency detected during stock receipt.',
        });
      } else {
        setError(errorData?.message || err.message || 'Failed to process stock receipt');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-purple-50/50">
          <div className="flex items-center gap-2 text-purple-900">
            <PackageCheck className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Receive Stock Delivery</h3>
              <p className="text-xs text-slate-500 font-mono">{order.poNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {recoveryState && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs space-y-2">
              <div className="flex items-start gap-2 font-bold text-rose-900">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>CRITICAL RECOVERY REQUIRED</span>
              </div>
              <p className="leading-relaxed">{recoveryState.message}</p>
              <div className="p-2.5 bg-white/70 rounded-xl font-mono text-[11px] text-rose-900 border border-rose-200">
                Batch ID: {recoveryState.batchId} (stockApplied: false)
              </div>
              <p className="text-[11px] text-rose-700">
                Do not discard this Batch ID. Retry this receipt attempt using this exact Batch ID to reconcile physical inventory.
              </p>
            </div>
          )}

          {error && !recoveryState && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Product:</span>
              <span className="font-bold text-slate-900">{order.productId?.name || 'Product'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Approved:</span>
              <span className="font-medium text-slate-700">{order.approvedQuantity} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Received:</span>
              <span className="font-bold text-emerald-600">{order.receivedQuantity || 0} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining Outstanding:</span>
              <span className="font-bold text-purple-700">{order.remainingQuantity} units</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantity Receiving *
              </label>
              <input
                type="number"
                min="1"
                max={order.remainingQuantity}
                step="1"
                value={quantityReceived}
                onChange={(e) => setQuantityReceived(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                required
              />
              <span className="text-[10px] text-slate-400">Max: {order.remainingQuantity} units</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vendor Lot / Slip #
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. LOT-2026-X8"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Idempotent Batch Tracking ID (Fixed for this receipt attempt)
            </label>
            <input
              type="text"
              value={batchId}
              readOnly
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-600 font-mono select-all cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Guarantees zero-double-increment protection. If a network drop occurs, retrying will reuse this exact ID.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Receiving Notes / Inspection Comments
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Packages inspected intact, stored in Bay 4..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-md shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Receiving Stock...
                </>
              ) : recoveryState ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Reconciliation
                </>
              ) : (
                'Commit Stock Receipt'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceivePOModal;
