import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Forecast from './pages/Forecast';
import Alerts from './pages/Alerts';
import PurchaseOrders from './pages/PurchaseOrders';

function App() {
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem('userInfo');
      }
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('userInfo');
  };

  const isLoginPage = location.pathname === '/login';
  const roleHomeRoute = user ? (user.role === 'STAFF' ? '/sales' : '/dashboard') : '/login';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {!isLoginPage && user && <Navbar user={user} onLogout={handleLogout} />}

      <div className="flex flex-1">
        {!isLoginPage && user && <Sidebar userRole={user.role} />}

        <main className={`flex-1 ${!isLoginPage && user ? 'p-4 sm:p-6 lg:p-8' : ''}`}>
          <Routes>
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to={roleHomeRoute} replace />
                ) : (
                  <Login onLoginSuccess={(u) => setUser(u)} />
                )
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER']}>
                  <Dashboard userRole={user?.role} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/products"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                  <Products userRole={user?.role} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                  <Sales userRole={user?.role} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/forecast"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER']}>
                  <Forecast />
                </ProtectedRoute>
              }
            />

            <Route
              path="/alerts"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER']}>
                  <Alerts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute user={user} allowedRoles={['ADMIN', 'MANAGER']}>
                  <PurchaseOrders userRole={user?.role} currentUser={user} />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={<Navigate to={roleHomeRoute} replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
