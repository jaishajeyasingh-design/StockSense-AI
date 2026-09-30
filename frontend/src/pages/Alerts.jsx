import React, { useEffect, useState } from 'react';
import { fetchDashboardApi } from '../services/api';
import StockAlert from '../components/StockAlert';
import { AlertTriangle, CheckCircle, Package, ArrowUpRight } from 'lucide-react';

const Alerts = () => {
  const [forecasts, setForecasts] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetchDashboardApi();
      if (res.data.success) {
        setForecasts(res.data.data.forecastSummary || []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredForecasts = forecasts.filter((f) => {
    if (filter === 'STOCKOUT_RISK') return f.stockStatus === 'STOCKOUT_RISK';
    if (filter === 'OVERSTOCK') return f.stockStatus === 'OVERSTOCK';
    if (filter === 'HEALTHY') return f.stockStatus === 'HEALTHY';
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Risk & Health Alerts</h2>
        <p className="text-xs text-slate-500">Automated stockout risk, overstock detection, and smart reorder advice</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Items ({forecasts.length})
        </button>

        <button
          onClick={() => setFilter('STOCKOUT_RISK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'STOCKOUT_RISK'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-rose-600 hover:bg-rose-50'
          }`}
        >
          Stockout Risk ({forecasts.filter((f) => f.stockStatus === 'STOCKOUT_RISK').length})
        </button>

        <button
          onClick={() => setFilter('OVERSTOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'OVERSTOCK'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
              : 'text-sky-600 hover:bg-sky-50'
          }`}
        >
          Overstock ({forecasts.filter((f) => f.stockStatus === 'OVERSTOCK').length})
        </button>

        <button
          onClick={() => setFilter('HEALTHY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'HEALTHY'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'text-emerald-600 hover:bg-emerald-50'
          }`}
        >
          Healthy ({forecasts.filter((f) => f.stockStatus === 'HEALTHY').length})
        </button>
      </div>

      {/* Alerts Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-medium">Analyzing stock health risks...</div>
      ) : filteredForecasts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
          No inventory items match the selected status filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForecasts.map((item) => (
            <div
              key={item._id}
              className={`p-5 rounded-3xl bg-white border transition-all space-y-3 shadow-2xs hover:shadow-md ${
                item.stockStatus === 'STOCKOUT_RISK'
                  ? 'border-rose-200 bg-rose-50/20'
                  : item.stockStatus === 'OVERSTOCK'
                  ? 'border-sky-200 bg-sky-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {item.productId ? item.productId.name : 'Product'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category: {item.productId?.category || 'N/A'}
                  </p>
                </div>
                <StockAlert status={item.stockStatus} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                <div>
                  <span className="text-slate-500 block">Current Stock:</span>
                  <span className="font-bold text-slate-900 text-sm">{item.currentStock} units</span>
                </div>
                <div>
                  <span className="text-slate-500 block">7-Day Demand:</span>
                  <span className="font-bold text-purple-600 text-sm">
                    {item.forecastWeeklyDemand} units
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[11px] text-slate-500">Recommended Reorder:</span>
                  <span className="block font-bold text-blue-600 text-xs">
                    {item.recommendedReorderQuantity > 0
                      ? `+${item.recommendedReorderQuantity} units`
                      : 'None needed'}
                  </span>
                </div>

                {item.recommendedReorderQuantity > 0 && (
                  <button
                    onClick={() =>
                      alert(
                        `Simulated purchase order created for ${item.recommendedReorderQuantity} units of ${item.productId?.name}!`
                      )
                    }
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                  >
                    <span>Reorder</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
