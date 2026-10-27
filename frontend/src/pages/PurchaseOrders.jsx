import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchPurchaseOrdersApi,
  fetchProductsApi,
} from '../services/api';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  Ban,
  Eye,
  RotateCcw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Info,
  X,
} from 'lucide-react';

import CreatePOModal from '../components/purchaseOrders/CreatePOModal';
import ApprovePOModal from '../components/purchaseOrders/ApprovePOModal';
import RejectPOModal from '../components/purchaseOrders/RejectPOModal';
import OrderPOModal from '../components/purchaseOrders/OrderPOModal';
import ReceivePOModal from '../components/purchaseOrders/ReceivePOModal';
import CancelPOModal from '../components/purchaseOrders/CancelPOModal';
import PODetailsModal from '../components/purchaseOrders/PODetailsModal';

const statusBadgeStyles = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ORDERED: 'bg-sky-50 text-sky-700 border-sky-200',
  PARTIALLY_RECEIVED: 'bg-purple-50 text-purple-700 border-purple-200',
  RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-300',
};

const priorityBadgeStyles = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
};

const PurchaseOrders = ({ userRole, currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active state for orders
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Products lookup for filter
  const [productsList, setProductsList] = useState([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [preselectedProductId, setPreselectedProductId] = useState(null);
  const [preselectedQty, setPreselectedQty] = useState(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const [activeOrder, setActiveOrder] = useState(null);
  const [activeDetailsId, setActiveDetailsId] = useState(null);

  // Load products list for filters
  useEffect(() => {
    fetchProductsApi()
      .then((res) => {
        if (res.data?.success) {
          setProductsList(res.data.data || []);
        }
      })
      .catch((err) => console.error('Failed to load products list for filters:', err));
  }, []);

  // Handle URL search params (e.g. from Alerts reorder click)
  useEffect(() => {
    const reorderProd = searchParams.get('reorderProductId');
    const reorderQuantity = searchParams.get('reorderQty');
    if (reorderProd) {
      setPreselectedProductId(reorderProd);
      if (reorderQuantity) {
        setPreselectedQty(reorderQuantity);
      }
      setCreateModalOpen(true);
      // Clean up search params after opening
      searchParams.delete('reorderProductId');
      searchParams.delete('reorderQty');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch purchase orders with filters
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
      };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (productFilter) params.productId = productFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await fetchPurchaseOrdersApi(params);
      if (res.data?.success) {
        setOrders(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, priorityFilter, productFilter, startDate, endDate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleActionSuccess = (updatedData, message) => {
    setFeedback({ type: 'success', message });
    setTimeout(() => setFeedback(null), 6000);
    loadOrders();
  };

  // Determine user identity
  const currentUserId = currentUser?._id || currentUser?.id;
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';

  // Client search filtering
  const displayedOrders = orders.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const poNum = (o.poNumber || '').toLowerCase();
    const prodName = (o.productId?.name || '').toLowerCase();
    const sku = (o.productId?.sku || '').toLowerCase();
    const supplier = (o.supplierInfo?.supplierName || o.supplier?.supplierName || '').toLowerCase();
    return poNum.includes(term) || prodName.includes(term) || sku.includes(term) || supplier.includes(term);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Orders & Replenishment</h2>
              <p className="text-xs text-slate-500">
                End-to-end inventory requisition, multi-step approvals, vendor tracking, and verified stock receipts
              </p>
            </div>
          </div>
        </div>

        {(isAdmin || isManager) && (
          <button
            onClick={() => {
              setPreselectedProductId(null);
              setPreselectedQty(null);
              setCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Reorder Request</span>
          </button>
        )}
      </div>

      {/* Workflow Explanation Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/60 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-bold text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>7-Stage Zero-Trust Lifecycle Protocol</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 font-medium">
          <div className="p-2 rounded-xl bg-white/80 border border-amber-200 text-amber-800 text-center">
            <span className="font-bold block">1. PENDING</span>
            <span className="text-[10px] text-slate-500">Awaiting Admin Review</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-emerald-200 text-emerald-800 text-center">
            <span className="font-bold block">2. APPROVED</span>
            <span className="text-[10px] text-slate-500">Qty Authorized</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-sky-200 text-sky-800 text-center">
            <span className="font-bold block">3. ORDERED</span>
            <span className="text-[10px] text-slate-500">Placed with Vendor</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-purple-200 text-purple-800 text-center">
            <span className="font-bold block">4. PARTIAL</span>
            <span className="text-[10px] text-slate-500">Partial Delivery</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-emerald-300 text-emerald-900 text-center">
            <span className="font-bold block">5. RECEIVED</span>
            <span className="text-[10px] text-slate-500">Inventory Stock Added</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-rose-200 text-rose-800 text-center">
            <span className="font-bold block">REJECTED</span>
            <span className="text-[10px] text-slate-500">Declined by Admin</span>
          </div>
          <div className="p-2 rounded-xl bg-white/80 border border-slate-300 text-slate-700 text-center">
            <span className="font-bold block">CANCELLED</span>
            <span className="text-[10px] text-slate-500">Before Receiving</span>
          </div>
        </div>
      </div>

      {/* Toast / Banner Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Term */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO #, Product, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="ORDERED">ORDERED</option>
              <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Priority</option>
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Products</option>
              {productsList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh / Clear */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStatusFilter('');
                setPriorityFilter('');
                setProductFilter('');
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
                setPage(1);
              }}
              className="flex-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={loadOrders}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Refresh Orders"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 flex items-center gap-1 font-medium">
            <Calendar className="w-3.5 h-3.5" /> Date Range:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
          />
          <span className="ml-auto text-slate-400 text-[11px]">
            Showing {displayedOrders.length} of {total} orders (Page {page} of {pages})
          </span>
        </div>
      </div>

      {/* Orders List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading purchase orders from database...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600 text-xs space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={loadOrders}
              className="px-4 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 rounded-xl border border-rose-200 hover:bg-rose-100 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No purchase orders found</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              No orders match your filter criteria. Click "Create Reorder Request" to initiate a replenishment cycle.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Quantities (Req / Appr / Rem)</th>
                  <th className="px-4 py-3">Financials</th>
                  <th className="px-4 py-3">Requester / Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOrders.map((po) => {
                  const requesterId = po.requestedBy?._id || po.requestedBy;
                  const isRequester =
                    currentUserId && requesterId && currentUserId.toString() === requesterId.toString();

                  return (
                    <tr key={po._id} className="hover:bg-slate-50/60 transition-colors">
                      {/* PO Number */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {po.poNumber}
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{po.productId?.name || 'Product'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          SKU: {po.productId?.sku || 'N/A'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            statusBadgeStyles[po.status] || 'bg-slate-100'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                            priorityBadgeStyles[po.priority] || 'bg-slate-100'
                          }`}
                        >
                          {po.priority}
                        </span>
                      </td>

                      {/* Quantities */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="text-slate-600 block">
                            Req: <strong>{po.requestedQuantity}</strong> | Appr:{' '}
                            <strong className="text-emerald-700">{po.approvedQuantity ?? '—'}</strong>
                          </span>
                          <span className="text-purple-700 font-medium text-[11px] block">
                            Rec: {po.receivedQuantity || 0} / Rem: {po.remainingQuantity}
                          </span>
                        </div>
                      </td>

                      {/* Financials */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">${po.estimatedCost}</div>
                        <div className="text-[10px] text-slate-400">@ ${po.unitCost}/unit</div>
                      </td>

                      {/* Requester / Date */}
                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-medium">
                          {po.requestedBy?.name || 'Staff/Manager'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Contextual Actions strictly per role & status */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Details action (available to all) */}
                          <button
                            onClick={() => {
                              setActiveDetailsId(po._id);
                              setDetailsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View PO Details & Timeline"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* PENDING Status Actions */}
                          {po.status === 'PENDING' && (
                            <>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setApproveModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                  title="Approve Reorder Request"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setRejectModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  title="Reject Reorder Request"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              )}
                              {(isAdmin || (isManager && isRequester)) && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setCancelModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  title="Cancel Request"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                            </>
                          )}

                          {/* APPROVED Status Actions */}
                          {po.status === 'APPROVED' && (
                            <>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setOrderModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors cursor-pointer"
                                  title="Mark as Ordered with Supplier"
                                >
                                  <Truck className="w-3.5 h-3.5" /> Place Order
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setCancelModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  title="Cancel Order"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                            </>
                          )}

                          {/* ORDERED / PARTIALLY_RECEIVED Status Actions */}
                          {['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                            <>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setReceiveModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                  title="Receive Delivered Stock"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" /> Receive Stock
                                </button>
                              )}
                              {isAdmin && po.receivedQuantity === 0 && (
                                <button
                                  onClick={() => {
                                    setActiveOrder(po);
                                    setCancelModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  title="Cancel Unfulfilled Order"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
            <span className="text-slate-500">
              Page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total purchase orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lifecycle Dialog Modals */}
      <CreatePOModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleActionSuccess}
        preselectedProductId={preselectedProductId}
        preselectedQuantity={preselectedQty}
      />

      <ApprovePOModal
        isOpen={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setActiveOrder(null);
        }}
        onSuccess={handleActionSuccess}
        order={activeOrder}
      />

      <RejectPOModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setActiveOrder(null);
        }}
        onSuccess={handleActionSuccess}
        order={activeOrder}
      />

      <OrderPOModal
        isOpen={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setActiveOrder(null);
        }}
        onSuccess={handleActionSuccess}
        order={activeOrder}
      />

      <ReceivePOModal
        isOpen={receiveModalOpen}
        onClose={() => {
          setReceiveModalOpen(false);
          setActiveOrder(null);
        }}
        onSuccess={handleActionSuccess}
        order={activeOrder}
      />

      <CancelPOModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setActiveOrder(null);
        }}
        onSuccess={handleActionSuccess}
        order={activeOrder}
      />

      <PODetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setActiveDetailsId(null);
        }}
        poId={activeDetailsId}
      />
    </div>
  );
};

export default PurchaseOrders;
