import React from 'react';

const StatCard = ({ title, value, subtitle, icon: Icon, colorScheme = 'blue' }) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50/50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    emerald: {
      bg: 'bg-emerald-50/50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    amber: {
      bg: 'bg-amber-50/50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    rose: {
      bg: 'bg-rose-50/50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      iconBg: 'bg-rose-100 text-rose-600',
    },
    sky: {
      bg: 'bg-sky-50/50',
      text: 'text-sky-600',
      border: 'border-sky-100',
      iconBg: 'bg-sky-100 text-sky-600',
    },
  };

  const scheme = colorMap[colorScheme] || colorMap.blue;

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all ${scheme.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.iconBg}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
