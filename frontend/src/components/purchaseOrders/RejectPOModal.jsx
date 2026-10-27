import React, { useState, useEffect } from 'react';
import { X, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { rejectPurchaseOrderApi } from '../../services/api';

const RejectPOModal = ({ isOpen, onClose, onSuccess, order }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order && isOpen) {
      setError(null);
      setRejectionReason('');
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setError('A rejection reason of at least 3 characters is mandatory');
      return;
    }

    setSubmitting(true);
    try {
      const res = await rejectPurchaseOrderApi(order._id, {
        rejectionReason: rejectionReason.trim(),
      });

      if (res.data?.success) {
        onSuccess(res.data.data, `Purchase Order ${order.poNumber} was rejected`);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <div className="flex items-center gap-2 text-rose-800">
            <XCircle className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Reject Purchase Order</h3>
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
              <span className="text-slate-500">Requested By:</span>
              <span className="font-medium text-slate-700">{order.requestedBy?.name || 'Staff/Manager'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Rejection Reason *
            </label>
            <textarea
              rows="3"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Budget ceiling reached or duplicate reorder request submitted..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The requester will be able to review this reason in the order audit timeline.
            </p>
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-md shadow-rose-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectPOModal;
