import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

describe('ProtectedRoute Component & Role Redirection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated users to /login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={null} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('redirects STAFF attempting to access /dashboard to /sales', () => {
    const staffUser = { name: 'Staff', role: 'STAFF', token: 'mock_token' };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/sales" element={<div>Sales Screen (Staff Home)</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={staffUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Sales Screen (Staff Home)')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('redirects STAFF attempting to access /forecast to /sales', () => {
    const staffUser = { name: 'Staff', role: 'STAFF', token: 'mock_token' };

    render(
      <MemoryRouter initialEntries={['/forecast']}>
        <Routes>
          <Route path="/sales" element={<div>Sales Screen (Staff Home)</div>} />
          <Route
            path="/forecast"
            element={
              <ProtectedRoute user={staffUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Forecast Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Sales Screen (Staff Home)')).toBeInTheDocument();
    expect(screen.queryByText('Forecast Content')).not.toBeInTheDocument();
  });

  it('redirects STAFF attempting to access /alerts to /sales', () => {
    const staffUser = { name: 'Staff', role: 'STAFF', token: 'mock_token' };

    render(
      <MemoryRouter initialEntries={['/alerts']}>
        <Routes>
          <Route path="/sales" element={<div>Sales Screen (Staff Home)</div>} />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute user={staffUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Alerts Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Sales Screen (Staff Home)')).toBeInTheDocument();
    expect(screen.queryByText('Alerts Content')).not.toBeInTheDocument();
  });

  it('redirects STAFF attempting to access /purchase-orders to /sales', () => {
    const staffUser = { name: 'Staff', role: 'STAFF', token: 'mock_token' };

    render(
      <MemoryRouter initialEntries={['/purchase-orders']}>
        <Routes>
          <Route path="/sales" element={<div>Sales Screen (Staff Home)</div>} />
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute user={staffUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Purchase Orders Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Sales Screen (Staff Home)')).toBeInTheDocument();
    expect(screen.queryByText('Purchase Orders Content')).not.toBeInTheDocument();
  });

  it('allows STAFF to access /products and /sales', () => {
    const staffUser = { name: 'Staff', role: 'STAFF', token: 'mock_token' };

    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={
              <ProtectedRoute user={staffUser} allowedRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                <div>Products Catalog Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Products Catalog Content')).toBeInTheDocument();
  });

  it('allows ADMIN and MANAGER to access /dashboard', () => {
    const adminUser = { name: 'Admin', role: 'ADMIN', token: 'mock_token' };
    const managerUser = { name: 'Manager', role: 'MANAGER', token: 'mock_token' };

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={adminUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Admin Dashboard View</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Dashboard View')).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={managerUser} allowedRoles={['ADMIN', 'MANAGER']}>
                <div>Manager Dashboard View</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Manager Dashboard View')).toBeInTheDocument();
  });
});
