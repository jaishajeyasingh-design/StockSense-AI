import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import * as api from '../services/api';

// Mock recharts ResponsiveContainer to render children reliably in JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('Dashboard Component - Role-Specific Experiences', () => {
  const mockDashboardData = {
    summary: {
      totalProducts: 12,
      totalInventory: 450,
      lowStockProducts: 3,
      stockoutRiskCount: 2,
      overstockCount: 1,
      healthyProducts: 9,
      totalSalesAmount: 18500,
    },
    salesTrend: [
      { date: '2026-10-20', totalSales: 2500, unitsSold: 10 },
      { date: '2026-10-21', totalSales: 3200, unitsSold: 14 },
    ],
    recentSales: [
      {
        _id: 'sale-1',
        productId: { name: 'Basmati Rice', category: 'Grocery', price: 120 },
        quantity: 2,
        totalAmount: 240,
        date: '2026-10-25T10:00:00.000Z',
      },
    ],
    forecastSummary: [
      {
        _id: 'fc-1',
        productId: { name: 'Basmati Rice' },
        currentStock: 15,
        forecastWeeklyDemand: 25,
        stockStatus: 'STOCKOUT_RISK',
      },
    ],
    alerts: [
      {
        productName: 'Basmati Rice',
        currentStock: 15,
        forecastWeeklyDemand: 25,
        stockStatus: 'STOCKOUT_RISK',
        severity: 'HIGH',
      },
    ],
    reorderRecommendations: [
      {
        productName: 'Basmati Rice',
        currentStock: 15,
        recommendedReorderQuantity: 35,
      },
    ],
  };

  const mockProducts = [
    { _id: 'p1', name: 'Basmati Rice', price: 120, stock: 15, reorderLevel: 20 },
    { _id: 'p2', name: 'Full Cream Milk', price: 35, stock: 50, reorderLevel: 15 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Executive Dashboard for ADMIN with financial valuation and User Management notice', async () => {
    vi.spyOn(api, 'fetchDashboardApi').mockResolvedValue({
      data: { success: true, data: mockDashboardData },
    });
    vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });

    render(
      <MemoryRouter>
        <Dashboard userRole="ADMIN" />
      </MemoryRouter>
    );

    // Verify Executive header and role badge
    expect(await screen.findByText('Executive Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Executive Suite')).toBeInTheDocument();

    // Verify Executive KPIs
    expect(screen.getByText('Total Inventory Valuation')).toBeInTheDocument();
    // Valuation: (120*15) + (35*50) = 1800 + 1750 = 3550
    expect(screen.getByText('₹3,550')).toBeInTheDocument();
    expect(screen.getByText('Sales Revenue')).toBeInTheDocument();
    expect(screen.getByText('₹18,500')).toBeInTheDocument();
    expect(screen.getByText('Active SKUs')).toBeInTheDocument();

    // Verify User Management section exists for ADMIN as future documented capability
    expect(screen.getByText('User & Role Administration')).toBeInTheDocument();
    expect(
      screen.getByText('Future Capability • Backend API Required')
    ).toBeInTheDocument();

    // Verify Manager-specific controls are NOT present
    expect(screen.queryByText('Run Forecast Engine')).not.toBeInTheDocument();
    expect(screen.queryByText('Stock Risk Alerts')).not.toBeInTheDocument();
  });

  it('renders Operations Dashboard for MANAGER with inventory health and shortcuts', async () => {
    vi.spyOn(api, 'fetchDashboardApi').mockResolvedValue({
      data: { success: true, data: mockDashboardData },
    });

    render(
      <MemoryRouter>
        <Dashboard userRole="MANAGER" />
      </MemoryRouter>
    );

    // Verify Operations header and badge
    expect(await screen.findByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Operations & Inventory')).toBeInTheDocument();

    // Verify Manager-specific inventory health KPIs
    expect(screen.getByText('Healthy Products')).toBeInTheDocument();
    expect(screen.getByText('Total Units in Stock')).toBeInTheDocument();
    expect(screen.getByText('Overstock')).toBeInTheDocument();

    // Verify Manager quick-action shortcuts
    expect(screen.getByText('Product Catalog')).toBeInTheDocument();
    expect(screen.getByText('Demand Forecast')).toBeInTheDocument();
    expect(screen.getByText('Stock Risk Alerts')).toBeInTheDocument();

    // Verify Manager forecast action button exists
    expect(screen.getByText('Run Forecast Engine')).toBeInTheDocument();

    // Verify User Management section is NOT shown for MANAGER
    expect(screen.queryByText('User & Role Administration')).not.toBeInTheDocument();
  });

  it('allows MANAGER to trigger demand forecast generation and displays feedback', async () => {
    vi.spyOn(api, 'fetchDashboardApi').mockResolvedValue({
      data: { success: true, data: mockDashboardData },
    });
    const generateSpy = vi.spyOn(api, 'generateAllForecastsApi').mockResolvedValue({
      data: { success: true, message: 'All forecasts generated' },
    });

    render(
      <MemoryRouter>
        <Dashboard userRole="MANAGER" />
      </MemoryRouter>
    );

    const runBtn = await screen.findByText('Run Forecast Engine');
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText(/Demand forecasts successfully generated & updated/i)
    ).toBeInTheDocument();
  });

  it('handles API errors gracefully and presents a retry option', async () => {
    vi.spyOn(api, 'fetchDashboardApi').mockRejectedValue({
      response: { data: { message: 'Database connection failed' } },
    });

    render(
      <MemoryRouter>
        <Dashboard userRole="ADMIN" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Error Loading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});
