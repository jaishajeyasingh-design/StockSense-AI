import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Sales from '../pages/Sales';
import * as api from '../services/api';

describe('Sales Component - Role-Specific Workspaces', () => {
  const mockProducts = [
    {
      _id: 'p1',
      name: 'Toor Dal 1kg',
      category: 'Grocery',
      price: 150,
      stock: 8,
      reorderLevel: 10,
    },
    {
      _id: 'p2',
      name: 'Butter 500g',
      category: 'Dairy',
      price: 250,
      stock: 30,
      reorderLevel: 5,
    },
    {
      _id: 'p3',
      name: 'Orange Juice 1L',
      category: 'Beverages',
      price: 90,
      stock: 0,
      reorderLevel: 5,
    },
  ];

  const mockSales = [
    {
      _id: 'sale-1',
      date: '2026-10-25T09:30:00.000Z',
      quantity: 2,
      totalAmount: 300,
      productId: { name: 'Toor Dal 1kg', category: 'Grocery' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders POS workspace for STAFF and DOES NOT call fetchSalesApi', async () => {
    const productsSpy = vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });
    const salesSpy = vi.spyOn(api, 'fetchSalesApi').mockResolvedValue({
      data: { success: true, data: mockSales },
    });

    render(<Sales userRole="STAFF" />);

    // Verify Staff header & badge
    expect(await screen.findByText('Point-of-Sale (POS) Terminal')).toBeInTheDocument();
    expect(screen.getByText('Staff Checkout Terminal')).toBeInTheDocument();

    // Verify products were loaded
    expect(productsSpy).toHaveBeenCalledTimes(1);

    // CRITICAL: fetchSalesApi must NOT be called for STAFF to prevent 403 Forbidden
    expect(salesSpy).not.toHaveBeenCalled();

    // Verify Staff sees Current Shift Transactions but NOT full system-wide history
    expect(screen.getByText('Current Shift Transactions')).toBeInTheDocument();
    expect(
      screen.queryByText('Sales Transactions History (All Records)')
    ).not.toBeInTheDocument();
  });

  it('displays low-stock warnings when selecting a product at or below reorder level', async () => {
    vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });

    render(<Sales userRole="STAFF" />);

    // Toor Dal has stock 8, reorderLevel 10 -> Low stock
    expect(await screen.findByText(/Low Stock Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Only 8 unit\(s\) remaining/i)).toBeInTheDocument();
  });

  it('calculates total amount dynamically and confirms checkout for STAFF', async () => {
    vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });
    const createSaleSpy = vi.spyOn(api, 'createSaleApi').mockResolvedValue({
      data: {
        success: true,
        data: {
          sale: { _id: 'new-sale-1' },
          remainingStock: 5,
        },
      },
    });

    render(<Sales userRole="STAFF" />);

    // Initial selected product is Toor Dal (price: 150, qty: 1 -> Total ₹150)
    expect(await screen.findByText('Total Bill Amount')).toBeInTheDocument();
    expect(screen.getAllByText('₹150').length).toBeGreaterThan(0);

    // Using numeric input change
    const qtyInput = screen.getByRole('spinbutton');
    fireEvent.change(qtyInput, { target: { value: '3' } });

    // New total bill should be 150 * 3 = 450
    expect(screen.getAllByText('₹450').length).toBeGreaterThan(0);

    // Submit sale
    const submitBtn = screen.getByRole('button', { name: /Complete Sale & Deduct Stock/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSaleSpy).toHaveBeenCalledWith({
        productId: 'p1',
        quantity: 3,
      });
    });

    // Check confirmation banner
    expect(await screen.findByText(/Sale recorded! Sold 3 unit\(s\) of "Toor Dal 1kg"/i)).toBeInTheDocument();

    // Verify it was appended to Current Shift Transactions table
    expect(screen.getByText('₹450')).toBeInTheDocument();
    expect(screen.getByText('5 units')).toBeInTheDocument();
  });

  it('prevents sale submission when requested quantity exceeds available stock', async () => {
    vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });

    render(<Sales userRole="STAFF" />);

    await screen.findByText('Point-of-Sale (POS) Terminal');

    // Attempt to enter quantity 20 when stock is 8
    const qtyInput = screen.getByRole('spinbutton');
    // Bounded to stock: 8
    fireEvent.change(qtyInput, { target: { value: '20' } });

    // The component auto-bounds to available stock (8)
    expect(qtyInput.value).toBe('8');
  });

  it('loads full system-wide transaction history for ADMIN / MANAGER', async () => {
    vi.spyOn(api, 'fetchProductsApi').mockResolvedValue({
      data: { success: true, data: mockProducts },
    });
    const salesSpy = vi.spyOn(api, 'fetchSalesApi').mockResolvedValue({
      data: { success: true, data: mockSales },
    });

    render(<Sales userRole="ADMIN" />);

    // Verify Management header
    expect(await screen.findByText('Sales Entry & Transactions')).toBeInTheDocument();
    expect(screen.getByText('Management Sales Hub')).toBeInTheDocument();

    // Both APIs should be called for ADMIN
    expect(salesSpy).toHaveBeenCalledTimes(1);

    // Full transaction audit log should be displayed
    expect(screen.getByText('Sales Transactions History (All Records)')).toBeInTheDocument();
    expect(screen.getByText('1 Total Records')).toBeInTheDocument();
  });
});
