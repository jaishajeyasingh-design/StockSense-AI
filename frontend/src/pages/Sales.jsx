import React, { useEffect, useState } from 'react';
import {
  fetchProductsApi,
  createSaleApi,
  fetchSalesApi,
} from '../services/api';
import {
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Minus,
  AlertTriangle,
  Receipt,
  Layers,
  History,
  Clock,
  X,
} from 'lucide-react';

const Sales = ({ userRole }) => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [sessionSales, setSessionSales] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Determine active role (prop -> localStorage -> default to STAFF)
  const resolvedRole = (
    userRole ||
    (() => {
      try {
        return JSON.parse(localStorage.getItem('userInfo') || '{}').role;
      } catch (e) {
        return 'STAFF';
      }
    })() ||
    'STAFF'
  ).toUpperCase();

  const isStaff = resolvedRole === 'STAFF';
  const isManagement = resolvedRole === 'ADMIN' || resolvedRole === 'MANAGER';

  const categories = ['All', 'Grocery', 'Dairy', 'Snacks', 'Beverages', 'Personal Care'];

  const loadData = async () => {
    setPageLoading(true);
    try {
      // Products are accessible to all roles (ADMIN, MANAGER, STAFF)
      const prodRes = await fetchProductsApi();
      if (prodRes.data.success) {
        const prodList = prodRes.data.data || [];
        setProducts(prodList);
        if (prodList.length > 0 && !selectedProductId) {
          setSelectedProductId(prodList[0]._id);
        }
      }

      // ONLY fetch system-wide sales history if authorized (ADMIN or MANAGER)
      // STAFF is restricted by backend RBAC (HTTP 403) from accessing GET /api/sales
      if (isManagement) {
        const salesRes = await fetchSalesApi();
        if (salesRes.data.success) {
          setSales(salesRes.data.data || []);
        }
      }
    } catch (err) {
      console.error('Error loading sales data:', err);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [resolvedRole]);

  const selectedProduct = products.find((p) => p._id === selectedProductId);
  const totalAmount = selectedProduct ? selectedProduct.price * quantity : 0;

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectProduct = (product) => {
    setSelectedProductId(product._id);
    setQuantity(1);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleQuantityChange = (newQty) => {
    if (!selectedProduct) return;
    const bounded = Math.max(1, Math.min(newQty, selectedProduct.stock || 1));
    setQuantity(bounded);
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedProduct) {
      setErrorMsg('Please select a valid product.');
      return;
    }

    if (selectedProduct.stock < 1) {
      setErrorMsg(`"${selectedProduct.name}" is currently out of stock.`);
      return;
    }

    if (quantity > selectedProduct.stock) {
      setErrorMsg(
        `Cannot sell ${quantity} units. Only ${selectedProduct.stock} unit(s) available in current inventory!`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await createSaleApi({
        productId: selectedProductId,
        quantity: Number(quantity),
      });

      if (res.data.success) {
        const remainingStock =
          res.data.data?.remainingStock ?? selectedProduct.stock - quantity;

        // Log session transaction locally for active cashier / staff member
        const confirmedSale = {
          _id: res.data.data?.sale?._id || `session-${Date.now()}`,
          productName: selectedProduct.name,
          category: selectedProduct.category,
          quantity: Number(quantity),
          unitPrice: selectedProduct.price,
          totalAmount: Number(quantity) * selectedProduct.price,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          remainingStock,
        };

        setSessionSales((prev) => [confirmedSale, ...prev]);

        setSuccessMsg(
          `Sale recorded! Sold ${quantity} unit(s) of "${selectedProduct.name}". Remaining stock: ${remainingStock}.`
        );
        setQuantity(1);

        // Refresh product list to update stock in UI
        await loadData();
      }
    } catch (err) {
      setErrorMsg(
        err.response && err.response.data.message
          ? err.response.data.message
          : 'Failed to record sale'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* =========================================================================
          HEADER: Role-Aware Context
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isStaff ? 'Point-of-Sale (POS) Terminal' : 'Sales Entry & Transactions'}
            </h2>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                isStaff
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              {isStaff ? 'Staff Checkout Terminal' : 'Management Sales Hub'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isStaff
              ? 'Rapid product lookup, real-time stock verification & customer checkout'
              : 'Record customer sales transactions and audit complete store sales history'}
          </p>
        </div>
      </div>

      {/* =========================================================================
          MAIN POS INTERFACE: Product Catalog Picker & Checkout Form
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Search & Quick Picker (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Select Product</h3>
            </div>
            <span className="text-xs text-slate-400">
              {filteredProducts.length} items available
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search product by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-slate-400 text-xs">
                No matching products found. Try adjusting your search query.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedProductId === p._id;
                const isOutOfStock = p.stock === 0;
                const isLowStock = p.stock > 0 && p.stock <= p.reorderLevel;

                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{p.name}</h4>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.category}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-blue-600 mt-1">₹{p.price}</p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Stock:</span>
                      {isOutOfStock ? (
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          Sold Out
                        </span>
                      ) : isLowStock ? (
                        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Low: {p.stock} units
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          {p.stock} units
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Checkout & Bill Summary (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Checkout Cart</h3>
            </div>

            {/* Success & Error Banners */}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Selected Product Summary */}
            {selectedProduct ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Selected SKU
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{selectedProduct.name}</h4>
                    <span className="text-[11px] text-slate-500">{selectedProduct.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Unit Price
                    </span>
                    <p className="text-base font-black text-slate-900">₹{selectedProduct.price}</p>
                  </div>
                </div>

                {/* Real-Time Stock Status & Low Stock Warning */}
                {selectedProduct.stock === 0 ? (
                  <div className="p-2.5 bg-rose-100/70 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Out of Stock. Restock before processing sales.</span>
                  </div>
                ) : selectedProduct.stock <= selectedProduct.reorderLevel ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Low Stock Warning: Only {selectedProduct.stock} unit(s) remaining (threshold:{' '}
                      {selectedProduct.reorderLevel})
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inventory available: {selectedProduct.stock} units</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                Please select a product from the catalog on the left.
              </div>
            )}

            {/* Quantity Stepper & Input */}
            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sale Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={!selectedProduct || quantity <= 1 || selectedProduct.stock === 0}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={selectedProduct ? selectedProduct.stock : 999}
                    required
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    disabled={!selectedProduct || selectedProduct.stock === 0}
                    className="flex-1 text-center py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />

                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={
                      !selectedProduct ||
                      quantity >= selectedProduct.stock ||
                      selectedProduct.stock === 0
                    }
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {selectedProduct && selectedProduct.stock > 0 && (
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(selectedProduct.stock)}
                      className="px-2.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      title="Set to maximum available stock"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="p-4 bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                    Total Bill Amount
                  </p>
                  <h4 className="text-2xl font-black text-blue-900 mt-0.5">₹{totalAmount}</h4>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-600" />
              </div>

              {/* Checkout Submit Button */}
              <button
                type="submit"
                disabled={
                  loading ||
                  !selectedProduct ||
                  selectedProduct.stock < 1 ||
                  quantity > selectedProduct.stock
                }
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Processing Transaction...' : 'Complete Sale & Deduct Stock'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* =========================================================================
          AUDIT LOG: Current Session Transactions (STAFF) vs Full History (ADMIN / MANAGER)
          ========================================================================= */}
      {isStaff ? (
        /* STAFF VIEW: Recent Own Transactions from Active Shift (Without unrestricted GET /api/sales) */
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              <h3 className="text-base font-bold text-slate-900">
                Current Shift Transactions
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              {sessionSales.length} Completed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Qty Sold</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Remaining Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionSales.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No transactions recorded during this active shift yet.
                    </td>
                  </tr>
                ) : (
                  sessionSales.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-500 font-medium">{s.timestamp}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{s.productName}</td>
                      <td className="py-3 px-3 text-slate-500">{s.category}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.quantity}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600">₹{s.totalAmount}</td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {s.remainingStock} units
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MANAGEMENT VIEW: Complete Store Transaction History Audit Log */
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Sales Transactions History (All Records)
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
              {sales.length} Total Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Qty Sold</th>
                  <th className="py-3 px-3">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No transactions recorded yet in store database.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-500 font-medium">
                        {new Date(s.date).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {s.productId ? s.productId.name : 'Unknown Product'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {s.productId ? s.productId.category : '-'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.quantity}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600">₹{s.totalAmount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
