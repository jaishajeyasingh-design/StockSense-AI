import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../components/StatCard';

describe('StatCard Component', () => {
  it('renders title, value, and subtitle correctly', () => {
    render(
      <StatCard
        title="Total Inventory Value"
        value="$45,200"
        subtitle="12 SKUs active"
        colorScheme="emerald"
      />
    );

    expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
    expect(screen.getByText('$45,200')).toBeInTheDocument();
    expect(screen.getByText('12 SKUs active')).toBeInTheDocument();
  });

  it('renders without subtitle cleanly', () => {
    render(
      <StatCard
        title="Active Alerts"
        value="3"
        colorScheme="rose"
      />
    );

    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
