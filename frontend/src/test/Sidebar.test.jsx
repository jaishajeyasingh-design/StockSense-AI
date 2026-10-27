import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

describe('Sidebar Component Role Filtering & Display', () => {
  it('renders only Products and Sales Entry links for STAFF role', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="STAFF" />
      </MemoryRouter>
    );

    // Permitted links
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Sales Entry')).toBeInTheDocument();

    // Forbidden management links
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Demand Forecast')).not.toBeInTheDocument();
    expect(screen.queryByText('Stock Alerts')).not.toBeInTheDocument();
    expect(screen.queryByText('Purchase Orders')).not.toBeInTheDocument();

    // Role badge
    expect(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('renders all 6 navigation links for MANAGER role', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="MANAGER" />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Sales Entry')).toBeInTheDocument();
    expect(screen.getByText('Demand Forecast')).toBeInTheDocument();
    expect(screen.getByText('Stock Alerts')).toBeInTheDocument();
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    expect(screen.getByText('MANAGER')).toBeInTheDocument();
  });

  it('renders all 6 navigation links for ADMIN role', () => {
    render(
      <MemoryRouter>
        <Sidebar userRole="ADMIN" />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Sales Entry')).toBeInTheDocument();
    expect(screen.getByText('Demand Forecast')).toBeInTheDocument();
    expect(screen.getByText('Stock Alerts')).toBeInTheDocument();
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });
});
