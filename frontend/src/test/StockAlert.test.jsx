import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockAlert from '../components/StockAlert';

describe('StockAlert Component', () => {
  it('renders STOCKOUT_RISK status badge correctly', () => {
    const { container } = render(<StockAlert status="STOCKOUT_RISK" />);
    expect(screen.getByText('STOCKOUT_RISK')).toBeInTheDocument();
    expect(container.querySelector('.bg-rose-50')).toBeInTheDocument();
  });

  it('renders OVERSTOCK status badge correctly', () => {
    const { container } = render(<StockAlert status="OVERSTOCK" />);
    expect(screen.getByText('OVERSTOCK')).toBeInTheDocument();
    expect(container.querySelector('.bg-sky-50')).toBeInTheDocument();
  });

  it('renders HEALTHY status badge correctly', () => {
    const { container } = render(<StockAlert status="HEALTHY" />);
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(container.querySelector('.bg-emerald-50')).toBeInTheDocument();
  });

  it('supports customLabel override', () => {
    render(<StockAlert status="STOCKOUT_RISK" customLabel="Critical Depletion" />);
    expect(screen.getByText('Critical Depletion')).toBeInTheDocument();
  });
});
