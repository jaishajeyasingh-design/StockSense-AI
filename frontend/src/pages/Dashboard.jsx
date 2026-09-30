import React, { useEffect, useState } from 'react';
import { fetchDashboardApi } from '../services/api';
import StatCard from '../components/StatCard';
import StockAlert from '../components/StockAlert';
import {
  Package,
  Boxes,
  AlertOctagon,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDashboardApi();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(
        err.response && err.response.data.message
          ? err.response.data.message
          : 'Failed to load dashboard data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading StockSense Analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 max-w-2xl mx-auto my-8">
        <h3 className="font-bold text-lg">Error Loading Dashboard</h3>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, salesTrend, recentSales, forecastSummary, alerts, reorderRecommendations } =
    data || {};

  // Forecast comparison chart data
  const forecastChartData = (forecastSummary || []).slice(0, 7).map((f) => ({
    name: f.productId ? f.productId.name : 'Product',
    CurrentStock: f.currentStock,
    PredictedWeeklyDemand: f.forecastWeeklyDemand,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-xs text-slate-500">Real-time inventory intelligence & demand forecast analytics</p>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Products"
          value={summary?.totalProducts || 0}
          subtitle="Active SKUs"
          icon={Package}
          colorScheme="blue"
        />
        <StatCard
          title="Total Inventory"
          value={summary?.totalInventory || 0}
          subtitle="Units in stock"
          icon={Boxes}
          colorScheme="emerald"
        />
        <StatCard
          title="Low Stock"
          value={summary?.lowStockProducts || 0}
          subtitle="At or below reorder level"
          icon={AlertOctagon}
          colorScheme="amber"
        />
        <StatCard
          title="Stockout Risk"
          value={summary?.stockoutRiskCount || 0}
          subtitle="High priority action"
          icon={TrendingDown}
          colorScheme="rose"
        />
        <StatCard
          title="Overstock"
          value={summary?.overstockCount || 0}
          subtitle="Excess capital tied"
          icon={TrendingUp}
          colorScheme="sky"
        />
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Revenue Trend Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sales & Revenue Trend</h3>
              <p className="text-xs text-slate-500">Daily sales performance history</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
              Total ₹{summary?.totalSalesAmount || 0}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalSales"
                  name="Revenue (₹)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demand Forecast vs Current Stock Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Demand Forecast vs Current Stock</h3>
              <p className="text-xs text-slate-500">Stock comparison per top product</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg">
              AI Forecast Engine
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="CurrentStock" name="Current Stock" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="PredictedWeeklyDemand" name="Weekly Demand" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Alerts Widget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Stock Alerts</h3>
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
              {alerts?.length || 0} Alerts
            </span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(!alerts || alerts.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active stock alerts.</p>
            ) : (
              alerts.map((a, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{a.productName}</p>
                    <p className="text-slate-500 mt-0.5">
                      Stock: {a.currentStock} | Demand: {a.forecastWeeklyDemand}/wk
                    </p>
                  </div>
                  <StockAlert status={a.stockStatus} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reorder Recommendations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Reorder Recommendations</h3>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {reorderRecommendations?.length || 0} Items
            </span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(!reorderRecommendations || reorderRecommendations.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">All inventory levels healthy.</p>
            ) : (
              reorderRecommendations.map((r, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{r.productName}</p>
                    <p className="text-slate-500 mt-0.5">Current Stock: {r.currentStock}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 block">
                      + {r.recommendedReorderQuantity} units
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales History */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Recent Sales</h3>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(!recentSales || recentSales.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">No sales recorded yet.</p>
            ) : (
              recentSales.map((s) => (
                <div
                  key={s._id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{s.productId ? s.productId.name : 'Product'}</p>
                    <p className="text-slate-500 mt-0.5">
                      {new Date(s.date).toLocaleDateString()} • Qty: {s.quantity}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    +₹{s.totalAmount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
