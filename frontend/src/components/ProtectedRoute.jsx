import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute
 * Guards routes based on authentication state and role authorization.
 *
 * - Unauthenticated users -> Redirects to /login
 * - Authenticated users with forbidden role -> Redirects to their role home page
 *   (STAFF -> /sales, ADMIN/MANAGER -> /dashboard)
 * - Authorized users -> Renders children
 */
const ProtectedRoute = ({ user, allowedRoles, children }) => {
  // If user state is not yet loaded in memory, try checking localStorage
  const currentUser = user || (() => {
    try {
      const stored = localStorage.getItem('userInfo');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  if (!currentUser || !currentUser.token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to the user's role-permitted home page to avoid redirect loops
    const homeRoute = currentUser.role === 'STAFF' ? '/sales' : '/dashboard';
    return <Navigate to={homeRoute} replace />;
  }

  return children;
};

export default ProtectedRoute;
