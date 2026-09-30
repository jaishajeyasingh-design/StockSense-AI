import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, LogOut, User } from 'lucide-react';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) onLogout();
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none tracking-tight flex items-center gap-2">
              StockSense <span className="text-blue-600 font-extrabold">AI</span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block mt-0.5">
              AI-Powered Demand Forecasting & Smart Inventory Optimization
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <User className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">{user.name}</span>
              <span
                className={`text-xs px-2 py-0.5 font-semibold rounded-md border ${getRoleBadge(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
