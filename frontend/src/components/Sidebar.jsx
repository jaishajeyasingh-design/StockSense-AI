import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Sales Entry', path: '/sales', icon: ShoppingCart },
    { label: 'Demand Forecast', path: '/forecast', icon: TrendingUp },
    { label: 'Stock Alerts', path: '/alerts', icon: AlertTriangle },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 hidden md:block">
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-100 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <h4 className="text-xs font-semibold text-slate-700">Project Status</h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          MVP Engine Active. Statistical Moving Average forecasting active.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-[11px] font-medium text-emerald-700">System Ready</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
