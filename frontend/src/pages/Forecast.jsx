import React, { useEffect, useState } from 'react';
import { fetchProductsApi, fetchForecastApi, generateForecastApi } from '../services/api';
import StockAlert from '../components/StockAlert';
import { TrendingUp, RefreshCw, Calendar, PackageCheck, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const Forecast = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const loadProducts = async () => {
    try {
      const res = await fetchProductsApi();
      if (res.data.success) {
        setProducts(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedProductId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const loadForecast = async (productId) => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetchForecastApi(productId);
      if (res.data.success) {
        setForecastData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadForecast(selectedProductId);
    }
  }, [selectedProductId]);

  const handleGenerateForecast = async () => {
    if (!selectedProductId) return;
    setGenLoading(true);
    try {
      const res = await generateForecastApi(selectedProductId);
      if (res.data.success) {
        setForecastData(res.data.data);
      }
    } catch (err) {
      alert('Failed to generate forecast');
    } finally {
      setGenLoading(false);
    }
  };

  // Prepare chart data comparing sales history vs forecast
  const salesHistory = forecastData?.salesHistory || [];
  const chartData = salesHistory.map((s, i) => ({
    name: `Sale ${i + 1}`,
    Date: new Date(s.date).toLocaleDateString(),
    HistoricalQtySold: s.quantity,
    PredictedDailyDemand: forecastData?.forecastDailyDemand || 0,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">AI Demand Forecast</h2>
          <p className="text-xs text-slate-500">
            Explainable moving-average demand prediction & automatic stock risk evaluation
          </p>
        </div>

        {/* Product selector and Generate button */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                Product: {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerateForecast}
            disabled={genLoading || !selectedProductId}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${genLoading ? 'animate-spin' : ''}`} />
            <span>Generate Forecast</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-medium">Computing demand forecast...</div>
      ) : forecastData ? (
        <div className="space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Stock</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{forecastData.currentStock} units</h3>
              <p className="text-xs text-slate-400 mt-1">Available in warehouse</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Predicted Daily Demand</p>
              <h3 className="text-2xl font-bold text-purple-900 mt-1">{forecastData.forecastDailyDemand} units/day</h3>
              <p className="text-xs text-purple-500 mt-1">Calculated daily average</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Predicted Weekly Demand</p>
              <h3 className="text-2xl font-bold text-blue-900 mt-1">{forecastData.forecastWeeklyDemand} units/week</h3>
              <p className="text-xs text-blue-500 mt-1">7-day projected demand</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Evaluated Stock Status</p>
              <StockAlert status={forecastData.stockStatus} />
              <p className="text-xs text-slate-400 mt-2">
                Reorder Recommendation:{' '}
                <span className="font-bold text-slate-800">
                  {forecastData.recommendedReorderQuantity > 0
                    ? `+${forecastData.recommendedReorderQuantity} units`
                    : 'None (Stock Adequate)'}
                </span>
              </p>
            </div>
          </div>

          {/* Forecast Explanation Box */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-sm tracking-wide">Forecast Intelligence Explanation</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Based on historical sales logs ({forecastData.salesHistoryCount || salesHistory.length} records), the average daily consumption rate for{' '}
              <strong className="text-white">{forecastData.productId?.name || 'this product'}</strong> is{' '}
              <strong className="text-purple-300">{forecastData.forecastDailyDemand} units/day</strong>.
              Comparing 7-day projected demand ({forecastData.forecastWeeklyDemand} units) against warehouse stock ({forecastData.currentStock} units) evaluates status as{' '}
              <strong className="text-amber-300">{forecastData.stockStatus}</strong>.
            </p>
          </div>

          {/* Recharts Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Historical Demand vs Predicted Daily Baseline
              </h3>
              <span className="text-xs font-medium text-slate-400">
                Generated at: {new Date(forecastData.generatedAt).toLocaleString()}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="Date" tick={{ fontSize: 11, fill: '#64748b' }} />
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
                  <Legend />
                  <Bar dataKey="HistoricalQtySold" name="Historical Qty Sold" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="PredictedDailyDemand" name="Forecast Daily Demand" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 text-xs">
          Select a product to view its AI demand forecast.
        </div>
      )}
    </div>
  );
};

export default Forecast;
