import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import API from '../services/api';

describe('Frontend API Client & Interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('configures default base URL with /api path', () => {
    expect(API.defaults.baseURL).toMatch(/http:\/\/localhost:5000\/api/);
  });

  it('attaches Authorization Bearer token when user is logged in', async () => {
    const mockToken = 'mock_jwt_token_for_vitest';
    localStorage.setItem('userInfo', JSON.stringify({ name: 'Admin', token: mockToken }));

    // Execute the request interceptor directly
    const interceptor = API.interceptors.request.handlers[0];
    const initialConfig = { headers: {} };
    const modifiedConfig = await interceptor.fulfilled(initialConfig);

    expect(modifiedConfig.headers.Authorization).toBe(`Bearer ${mockToken}`);
  });

  it('does not attach Authorization header when user is unauthenticated', async () => {
    const interceptor = API.interceptors.request.handlers[0];
    const initialConfig = { headers: {} };
    const modifiedConfig = await interceptor.fulfilled(initialConfig);

    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
