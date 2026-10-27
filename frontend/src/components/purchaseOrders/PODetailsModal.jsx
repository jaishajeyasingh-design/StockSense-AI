import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Truck,
  CheckCheck,
  Ban,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import { fetchPurchaseOrderByIdApi } from '../../services/api';

const statusBadgeStyles = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ORDERED: 'bg-sky-50 text-sky-700 border-sky-200',
  PARTIALLY_RECEIVED: 'bg-purple-50 text-purple-700 border-purple-200',
  RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-300',
};

const priorityBadgeStyles = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
};

const PODetailsModal = ({ isOpen, onClose, poId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && poId) {
      setLoading(true);
      setError(null);
      fetchPurchaseOrderByIdApi(poId)
        .then((res) => {
          if (res.data?.success) {
            setOrder(res.data.data);
          }
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to load purchase order details');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, poId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg font-mono">
                  {order?.poNumber || 'Purchase Order'}
                </h3>
                {order && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      statusBadgeStyles[order.status] || 'bg-slate-100'
                    }`}
                  >
                    {order.status}
                  </span>
                )}
                {order && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                      priorityBadgeStyles[order.priority] || 'bg-slate-100'
                    }`}
                  >
                    {order.priority}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Created on {order?.createdAt ? new Date(order.createdAt).toLocaleString() : '...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading purchase order details...
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : order ? (
            <>
              {/* Product and Cost Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <Package className="w-4 h-4" /> Product Details
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{order.productId?.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">SKU: {order.productId?.sku}</p>
                    <p className="text-xs text-slate-500">
                      Category: {order.productId?.category || 'General'} | Current Stock: {order.productId?.stock ?? 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <Layers className="w-4 h-4" /> Quantities & Financials
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Requested:</span>
                      <strong className="text-slate-900">{order.requestedQuantity} units</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Approved:</span>
                      <strong className="text-emerald-700">{order.approvedQuantity ?? 'Pending'} units</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Received / Remaining:</span>
                      <strong className="text-purple-700">
                        {order.receivedQuantity} / {order.remainingQuantity}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Est. Total Cost:</span>
                      <strong className="text-slate-900">${order.estimatedCost}</strong> (${order.unitCost}/unit)
                    </div>
                  </div>
                </div>
              </div>

              {/* Justification / Notes */}
              <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100 text-xs space-y-1">
                <span className="font-bold text-blue-900 block">Requisition Justification:</span>
                <p className="text-slate-700">{order.requestReason || 'No justification recorded'}</p>
                <div className="text-[11px] text-slate-500 pt-1">
                  Requested by: <strong>{order.requestedBy?.name}</strong> ({order.requestedBy?.email})
                </div>
              </div>

              {/* Supplier Info (if ordered) */}
              {(order.supplierInfo?.supplierName || order.supplier?.supplierName) && (() => {
                const supplier = order.supplierInfo || order.supplier;
                return (
                  <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-sky-900">
                      <Truck className="w-4 h-4 text-sky-600" /> Supplier Information
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-500 block">Vendor:</span>
                        <strong className="text-slate-900">{supplier.supplierName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ref / Invoice:</span>
                        <strong className="text-slate-900">{supplier.referenceNumber || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Expected Delivery:</span>
                        <strong className="text-slate-900">
                          {supplier.expectedDeliveryDate
                            ? new Date(supplier.expectedDeliveryDate).toLocaleDateString()
                            : 'N/A'}
                        </strong>
                      </div>
                      {supplier.contactEmail && (
                        <div>
                          <span className="text-slate-500 block">Email:</span>
                          <span className="text-slate-700">{supplier.contactEmail}</span>
                        </div>
                      )}
                      {supplier.contactPhone && (
                        <div>
                          <span className="text-slate-500 block">Phone:</span>
                          <span className="text-slate-700">{supplier.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Rejection or Cancellation details */}
              {order.rejectionReason && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <strong className="block mb-1">Rejection Reason:</strong>
                  {order.rejectionReason}
                </div>
              )}
              {order.cancellationReason && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <strong className="block mb-1">Cancellation Reason:</strong>
                  {order.cancellationReason}
                </div>
              )}

              {/* Receiving Log (Physical Deliveries) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Physical Stock Receiving Log ({order.receivingLog?.length || 0})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Received: {order.receivedQuantity} | Remaining: {order.remainingQuantity}
                  </span>
                </div>

                {order.receivingLog?.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No physical delivery batches have been received for this order yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-3.5 py-2">Batch ID</th>
                          <th className="px-3.5 py-2">Quantity</th>
                          <th className="px-3.5 py-2">Lot / Slip</th>
                          <th className="px-3.5 py-2">Received By</th>
                          <th className="px-3.5 py-2">Timestamp</th>
                          <th className="px-3.5 py-2">Stock Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.receivingLog.map((log) => (
                          <tr key={log.batchId} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700">
                              {log.batchId}
                            </td>
                            <td className="px-3.5 py-2 font-bold text-purple-700">
                              +{log.quantityReceived} units
                            </td>
                            <td className="px-3.5 py-2 text-slate-600">{log.batchNumber || '—'}</td>
                            <td className="px-3.5 py-2 text-slate-700">
                              {log.receivedBy?.name || 'Admin'}
                            </td>
                            <td className="px-3.5 py-2 text-slate-500 text-[11px]">
                              {new Date(log.receivedAt).toLocaleString()}
                            </td>
                            <td className="px-3.5 py-2">
                              {log.stockApplied ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  <CheckCheck className="w-3 h-3" /> Applied
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                  <AlertCircle className="w-3 h-3" /> Pending Recovery
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Timeline Audit History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Audit Timeline ({order.timeline?.length || 0})
                </h4>

                <div className="space-y-3 pl-2 border-l-2 border-slate-200">
                  {order.timeline?.map((event, idx) => (
                    <div key={idx} className="relative pl-4 space-y-1 text-xs">
                      <span className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-2 ring-slate-100" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{event.action}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {event.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">{event.notes}</p>
                      <p className="text-[11px] text-slate-400">
                        Actor: {event.actor?.name || 'System'} ({event.actorRole})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PODetailsModal;
