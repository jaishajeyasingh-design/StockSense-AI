import React from 'react';

const StockAlert = ({ status, customLabel }) => {
  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = customLabel || status;

  switch (status) {
    case 'HEALTHY':
      badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      label = label || 'Healthy';
      break;
    case 'STOCKOUT_RISK':
      badgeStyles = 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
      label = label || 'Stockout Risk';
      break;
    case 'OVERSTOCK':
      badgeStyles = 'bg-sky-50 text-sky-700 border-sky-200';
      label = label || 'Overstock';
      break;
    case 'LOW_STOCK':
      badgeStyles = 'bg-amber-50 text-amber-700 border-amber-200';
      label = label || 'Low Stock';
      break;
    default:
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyles}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'HEALTHY'
            ? 'bg-emerald-500'
            : status === 'STOCKOUT_RISK'
            ? 'bg-rose-500'
            : status === 'OVERSTOCK'
            ? 'bg-sky-500'
            : 'bg-amber-500'
        }`}
      ></span>
      {label}
    </span>
  );
};

export default StockAlert;
