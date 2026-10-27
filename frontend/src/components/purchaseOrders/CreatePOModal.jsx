import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { createPurchaseOrderApi, fetchProductsApi } from '../../services/api';

const CreatePOModal = ({ isOpen, onClose, onSuccess, preselectedProductId, preselectedQuantity }) => {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [priority, setPriority] = useState('MEDIUM');
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoadingProducts(true);
      fetchProductsApi()
        .then((res) => {
          if (res.data?.success) {
            setProducts(res.data.data || []);
            if (preselectedProductId) {
              setSelectedProductId(preselectedProductId);
            } else if (res.data.data?.length > 0) {
              setSelectedProductId(res.data.data[0]._id);
            }
          }
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to load products list');
        })
        .finally(() => {
          setLoadingProducts(false);
        });

      if (preselectedQuantity && Number(preselectedQuantity) > 0) {
        setRequestedQuantity(Number(preselectedQuantity));
      } else {
        setRequestedQuantity(1);
      }
      setPriority('MEDIUM');
      setRequestReason('');
    }
  }, [isOpen, preselectedProductId, preselectedQuantity]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p._id === selectedProductId);
  const estimatedTotalCost = selectedProduct
    ? (Number(requestedQuantity) * selectedProduct.price).toFixed(2)
    : '0.00';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }
    const qty = Number(requestedQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Requested quantity must be a whole number of at least 1');
      return;
    }
    if (!requestReason || requestReason.trim().length < 3) {
      setError('A business justification / request reason of at least 3 characters is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createPurchaseOrderApi({
        productId: selectedProductId,
        requestedQuantity: qty,
        priority,
        requestReason: requestReason.trim(),
      });

      if (res.data?.success) {
        onSuccess(res.data.data, 'Purchase order request created successfully with status PENDING');
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Create Reorder Request</h3>
            <p className="text-xs text-slate-500">Initiate a zero-trust replenishment purchase order</p>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product *
            </label>
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading inventory products...
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              >
                <option value="">-- Choose a Product --</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.sku}) — Current Stock: {p.stock} | Unit Cost: ${p.price}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Requested Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={requestedQuantity}
                onChange={(e) => setRequestedQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {selectedProduct && (
            <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Authoritative Unit Cost: <strong className="text-slate-900">${selectedProduct.price}</strong>
              </span>
              <span className="text-blue-700 font-bold">
                Est. Total: ${estimatedTotalCost}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reorder Reason / Business Justification *
            </label>
            <textarea
              rows="3"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="e.g. Stock critically low based on 7-day demand forecast..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              required
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
              disabled={submitting || loadingProducts}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                'Submit Reorder Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePOModal;
