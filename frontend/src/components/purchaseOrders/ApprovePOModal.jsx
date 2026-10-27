import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { approvePurchaseOrderApi } from '../../services/api';

const ApprovePOModal = ({ isOpen, onClose, onSuccess, order }) => {
  const [approvedQuantity, setApprovedQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order && isOpen) {
      setError(null);
      setApprovedQuantity(order.requestedQuantity || 1);
      setNotes('');
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const qty = Number(approvedQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Approved quantity must be an integer of at least 1');
      return;
    }

    setSubmitting(true);
    try {
      const res = await approvePurchaseOrderApi(order._id, {
        approvedQuantity: qty,
        notes: notes ? notes.trim() : undefined,
      });

      if (res.data?.success) {
        onSuccess(res.data.data, `Purchase Order ${order.poNumber} approved successfully`);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Approve Purchase Order</h3>
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
          {error && (
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
              <span className="text-slate-500">Requested Quantity:</span>
              <span className="font-bold text-slate-900">{order.requestedQuantity} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unit Cost:</span>
              <span className="font-bold text-slate-900">${order.unitCost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Requested By:</span>
              <span className="font-medium text-slate-700">{order.requestedBy?.name || 'Staff/Manager'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Authorized Approved Quantity *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={approvedQuantity}
              onChange={(e) => setApprovedQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              You can adjust quantity upwards or downwards based on vendor minimum order requirements.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Approval Notes (Optional)
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved for bulk vendor order discount..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...
                </>
              ) : (
                'Confirm Approval'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApprovePOModal;
