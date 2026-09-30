import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Forecast from './pages/Forecast';
import Alerts from './pages/Alerts';

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {!isLoginPage && user && <Navbar user={user} onLogout={handleLogout} />}

      <div className="flex flex-1">
        {!isLoginPage && user && <Sidebar />}

        <main className={`flex-1 ${!isLoginPage && user ? 'p-4 sm:p-6 lg:p-8' : ''}`}>
          <Routes>
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Login onLoginSuccess={(u) => setUser(u)} />
                )
              }
            />

            <Route
              path="/dashboard"
              element={user ? <Dashboard /> : <Navigate to="/login" replace />}
            />

            <Route
              path="/products"
              element={
                user ? (
                  <Products userRole={user.role} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route
              path="/sales"
              element={user ? <Sales /> : <Navigate to="/login" replace />}
            />

            <Route
              path="/forecast"
              element={user ? <Forecast /> : <Navigate to="/login" replace />}
            />

            <Route
              path="/alerts"
              element={user ? <Alerts /> : <Navigate to="/login" replace />}
            />

            <Route
              path="*"
              element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
