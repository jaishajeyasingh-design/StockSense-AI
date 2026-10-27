import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchDashboardApi,
  fetchProductsApi,
  generateAllForecastsApi,
} from '../services/api';
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
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ChevronRight,
  Info,
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

const Dashboard = ({ userRole }) => {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [inventoryValuation, setInventoryValuation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastNotice, setForecastNotice] = useState('');

  // Determine active role (prop -> localStorage -> default to ADMIN)
  const resolvedRole = (
    userRole ||
    (() => {
      try {
        return JSON.parse(localStorage.getItem('userInfo') || '{}').role;
      } catch (e) {
        return 'ADMIN';
      }
    })() ||
    'ADMIN'
  ).toUpperCase();

  const isAdmin = resolvedRole === 'ADMIN';
  const isManager = resolvedRole === 'MANAGER';

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [fetchDashboardApi()];
      // Admin executive view fetches products to calculate exact total inventory valuation
      if (isAdmin) {
        calls.push(fetchProductsApi());
      }
      const [dashRes, prodRes] = await Promise.all(calls);
      if (dashRes.data.success) {
        setData(dashRes.data.data);
      }
      if (prodRes && prodRes.data.success) {
        const prodList = prodRes.data.data || [];
        setProducts(prodList);
        const valuation = prodList.reduce(
          (sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0),
          0
        );
        setInventoryValuation(valuation);
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
  }, [resolvedRole]);

  // Manager action: Trigger AI forecast generation for all catalog items
  const handleRunForecast = async () => {
    setForecastLoading(true);
    setForecastNotice('');
    try {
      const res = await generateAllForecastsApi();
      if (res.data.success) {
        setForecastNotice('Demand forecasts successfully generated & updated across all SKUs.');
        await loadDashboard();
      }
    } catch (err) {
      setForecastNotice(
        err.response?.data?.message || 'Failed to generate demand forecasts.'
      );
    } finally {
      setForecastLoading(false);
    }
  };

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

  const {
    summary,
    salesTrend,
    recentSales,
    forecastSummary,
    alerts,
    reorderRecommendations,
  } = data || {};

  // Forecast comparison chart data
  const forecastChartData = (forecastSummary || []).slice(0, 7).map((f) => ({
    name: f.productId ? f.productId.name : 'Product',
    CurrentStock: f.currentStock,
    PredictedWeeklyDemand: f.forecastWeeklyDemand,
  }));

  return (
    <div className="space-y-6">
      {/* =========================================================================
          HEADER: Role-Aware Context
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isAdmin ? 'Executive Dashboard' : 'Operations Dashboard'}
            </h2>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                isAdmin
                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              {isAdmin ? 'Executive Suite' : 'Operations & Inventory'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'Real-time executive oversight, inventory valuation & demand intelligence'
              : 'Inventory health monitoring, stockout risk triage & demand forecasting'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          {/* Manager Action: Forecast Trigger */}
          {isManager && (
            <button
              onClick={handleRunForecast}
              disabled={forecastLoading}
              className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Generate fresh demand forecasts for all catalog items"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${forecastLoading ? 'animate-spin' : ''}`} />
              <span>{forecastLoading ? 'Updating Forecasts...' : 'Run Forecast Engine'}</span>
            </button>
          )}

          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Manager Forecast Feedback Banner */}
      {isManager && forecastNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{forecastNotice}</span>
          </div>
          <button
            onClick={() => setForecastNotice('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          MANAGER WORKSPACE: Quick Operational Shortcuts
          ========================================================================= */}
      {isManager && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/products"
            className="group p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Product Catalog</h4>
                <p className="text-xs text-slate-500">Inspect SKUs & safety thresholds</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </Link>

          <Link
            to="/forecast"
            className="group p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Demand Forecast</h4>
                <p className="text-xs text-slate-500">Inspect AI moving average predictions</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
          </Link>

          <Link
            to="/alerts"
            className="group p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-rose-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Stock Risk Alerts</h4>
                <p className="text-xs text-slate-500">Triage stockout & overstock warnings</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
          </Link>
        </div>
      )}

      {/* =========================================================================
          ROLE-SPECIFIC KPI STAT CARDS
          ========================================================================= */}
      {isAdmin ? (
        /* ADMIN EXECUTIVE KPIS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Inventory Valuation"
            value={`₹${inventoryValuation.toLocaleString()}`}
            subtitle="Catalog asset valuation"
            icon={Coins}
            colorScheme="emerald"
          />
          <StatCard
            title="Sales Revenue"
            value={`₹${(summary?.totalSalesAmount || 0).toLocaleString()}`}
            subtitle="Cumulative gross revenue"
            icon={ShoppingCart}
            colorScheme="blue"
          />
          <StatCard
            title="Total Products"
            value={summary?.totalProducts || 0}
            subtitle="Active SKUs"
            icon={Package}
            colorScheme="sky"
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
        </div>
      ) : (
        /* MANAGER OPERATIONS KPIS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Healthy Products"
            value={summary?.healthyProducts || 0}
            subtitle="Optimal stock level"
            icon={Package}
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
            subtitle="Immediate reorder needed"
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
          <StatCard
            title="Total Units in Stock"
            value={summary?.totalInventory || 0}
            subtitle="Total units across catalog"
            icon={Boxes}
            colorScheme="blue"
          />
        </div>
      )}

      {/* =========================================================================
          ANALYTICS CHARTS ROW
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Revenue Trend Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sales & Revenue Trend</h3>
              <p className="text-xs text-slate-500">Daily sales performance history</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
              Total ₹{(summary?.totalSalesAmount || 0).toLocaleString()}
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

      {/* =========================================================================
          OPERATIONAL & TRANSACTION WIDGETS
          ========================================================================= */}
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
            {!alerts || alerts.length === 0 ? (
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
            {!reorderRecommendations || reorderRecommendations.length === 0 ? (
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

        {/* Recent Sales History Feed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Recent Sales Activity</h3>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {!recentSales || recentSales.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No sales recorded yet.</p>
            ) : (
              recentSales.map((s) => (
                <div
                  key={s._id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">
                      {s.productId ? s.productId.name : 'Product'}
                    </p>
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

      {/* =========================================================================
          ADMIN ONLY: User & Role Administration Section
          (Requirement: Add only if backend API exists, else document as future feature)
          ========================================================================= */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  User & Role Administration
                </h3>
                <p className="text-xs text-slate-500">
                  Access control, user management, and authorization audit
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 self-start">
              Future Capability • Backend API Required
            </span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
              <p className="font-semibold text-slate-800">
                User Management Architecture Status:
              </p>
              <p>
                A secure server-side user provisioning and role administration API is planned for a subsequent release. In compliance with the security design, the frontend does not fabricate or mock user management capabilities.
              </p>
              <p>
                Currently, user registrations are strictly restricted to the <span className="font-bold text-slate-700">STAFF</span> role, while administrative credentials (<span className="font-bold text-slate-700">ADMIN</span>, <span className="font-bold text-slate-700">MANAGER</span>) are managed via secure database seeding and server-side RBAC middleware.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
