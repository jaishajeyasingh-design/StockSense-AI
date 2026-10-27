import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../services/api';
import { BrainCircuit, Lock, Mail, ShieldAlert, Sparkles } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@stocksense.ai');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await loginApi({ email, password });
      if (data.success) {
        localStorage.setItem('userInfo', JSON.stringify(data.data));
        if (onLoginSuccess) onLoginSuccess(data.data);
        const targetRoute = data.data.role === 'STAFF' ? '/sales' : '/dashboard';
        navigate(targetRoute);
      }
    } catch (err) {
      setError(
        err.response && err.response.data.message
          ? err.response.data.message
          : 'Failed to connect to backend server. Make sure server is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (role) => {
    if (role === 'ADMIN') {
      setEmail('admin@stocksense.ai');
      setPassword('admin123');
    } else if (role === 'MANAGER') {
      setEmail('manager@stocksense.ai');
      setPassword('manager123');
    } else if (role === 'STAFF') {
      setEmail('staff@stocksense.ai');
      setPassword('staff123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-4 tracking-tight">
            StockSense <span className="text-blue-600 font-extrabold">AI</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            AI-Powered Demand Forecasting & Smart Inventory Optimization
          </p>
        </div>

        {/* 1-Click Demo Logins */}
        <div className="mt-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>1-Click Demo Review Logins:</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDemoRole('ADMIN')}
              className="py-1.5 px-2 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold rounded-lg border border-purple-200 transition-colors cursor-pointer"
            >
              ADMIN
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('MANAGER')}
              className="py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer"
            >
              MANAGER
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('STAFF')}
              className="py-1.5 px-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              STAFF
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@stocksense.ai"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
