import React, { useEffect, useState } from 'react';
import { fetchProductsApi, createSaleApi, fetchSalesApi } from '../services/api';
import { ShoppingBag, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedProduct = products.find((p) => p._id === selectedProductId);
  const totalAmount = selectedProduct ? selectedProduct.price * quantity : 0;

  const loadData = async () => {
    try {
      const [prodRes, salesRes] = await Promise.all([
        fetchProductsApi(),
        fetchSalesApi(),
      ]);
      if (prodRes.data.success) {
        setProducts(prodRes.data.data);
        if (prodRes.data.data.length > 0 && !selectedProductId) {
          setSelectedProductId(prodRes.data.data[0]._id);
        }
      }
      if (salesRes.data.success) {
        setSales(salesRes.data.data);
      }
    } catch (err) {
      console.error('Error loading sales page data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedProduct) {
      setErrorMsg('Please select a valid product.');
      return;
    }

    if (quantity > selectedProduct.stock) {
      setErrorMsg(
        `Cannot sell ${quantity} units. Only ${selectedProduct.stock} units available in current stock!`
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
        setSuccessMsg(
          `Sale recorded! Sold ${quantity} units of ${selectedProduct.name}. New Stock: ${res.data.data.remainingStock}`
        );
        setQuantity(1);
        loadData();
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Entry & Checkout</h2>
        <p className="text-xs text-slate-500">Record customer transactions and trigger real-time stock deduction</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Record New Sale</h3>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — ₹{p.price} (Stock: {p.stock})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Available Stock:</span>
                  <span
                    className={`font-bold ${
                      selectedProduct.stock <= selectedProduct.reorderLevel
                        ? 'text-rose-600'
                        : 'text-slate-800'
                    }`}
                  >
                    {selectedProduct.stock} units
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Unit Price:</span>
                  <span className="text-slate-800">₹{selectedProduct.price}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity to Sell</label>
              <input
                type="number"
                min="1"
                max={selectedProduct ? selectedProduct.stock : 999}
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Total Calculation Card */}
            <div className="p-4 bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                  Total Bill Amount
                </p>
                <h4 className="text-xl font-extrabold text-blue-900 mt-0.5">₹{totalAmount}</h4>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedProduct || selectedProduct.stock < 1}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing Transaction...' : 'Complete Sale & Update Stock'}
            </button>
          </form>
        </div>

        {/* Recent Sales History */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Sales Transactions History</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Qty Sold</th>
                  <th className="py-3 px-3">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">
                      No transactions recorded yet.
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
                      <td className="py-3 px-3 font-bold text-slate-900">{s.quantity}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600">₹{s.totalAmount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sales;
