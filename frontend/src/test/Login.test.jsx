import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import * as api from '../services/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component Role Navigation & Demo Logins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('populates fields when 1-Click Demo Review buttons are clicked', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const staffButton = screen.getByRole('button', { name: 'STAFF' });
    fireEvent.click(staffButton);

    const emailInput = screen.getByPlaceholderText('name@stocksense.ai');
    expect(emailInput.value).toBe('staff@stocksense.ai');

    const adminButton = screen.getByRole('button', { name: 'ADMIN' });
    fireEvent.click(adminButton);
    expect(emailInput.value).toBe('admin@stocksense.ai');
  });

  it('redirects to /sales when backend confirms authenticated role is STAFF', async () => {
    vi.spyOn(api, 'loginApi').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          _id: 'user_123',
          name: 'Staff Member',
          email: 'staff@stocksense.ai',
          role: 'STAFF',
          token: 'jwt_mock_staff',
        },
      },
    });

    const mockOnLoginSuccess = vi.fn();
    render(
      <MemoryRouter>
        <Login onLoginSuccess={mockOnLoginSuccess} />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/sales');
      expect(mockOnLoginSuccess).toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem('userInfo'));
      expect(stored.role).toBe('STAFF');
    });
  });

  it('redirects to /dashboard when backend confirms authenticated role is ADMIN', async () => {
    vi.spyOn(api, 'loginApi').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          _id: 'user_admin',
          name: 'Admin User',
          email: 'admin@stocksense.ai',
          role: 'ADMIN',
          token: 'jwt_mock_admin',
        },
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      const stored = JSON.parse(localStorage.getItem('userInfo'));
      expect(stored.role).toBe('ADMIN');
    });
  });

  it('displays error message and does not redirect when authentication fails', async () => {
    vi.spyOn(api, 'loginApi').mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: 'Invalid email or password',
        },
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
