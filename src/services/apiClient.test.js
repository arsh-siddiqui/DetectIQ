import { describe, it, expect } from 'vitest';
import apiClient, { isBackendUnreachable } from './apiClient.js';

describe('Frontend apiClient & Network Error Handler', () => {
  it('apiClient is configured with required defaults', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.timeout).toBe(8000);
  });

  it('isBackendUnreachable returns true when no response object exists', () => {
    // Network error, connection refused, DNS lookup failure, or timeout
    const networkError = new Error('Network Error');
    expect(isBackendUnreachable(networkError)).toBe(true);

    const corsError = { message: 'Network Error', response: undefined };
    expect(isBackendUnreachable(corsError)).toBe(true);

    expect(isBackendUnreachable(null)).toBe(true);
    expect(isBackendUnreachable(undefined)).toBe(true);
  });

  it('isBackendUnreachable returns false when server answered with an HTTP error response', () => {
    // 400 Validation Error
    const error400 = { response: { status: 400, data: { message: 'Invalid URL' } } };
    expect(isBackendUnreachable(error400)).toBe(false);

    // 401 Unauthorized
    const error401 = { response: { status: 401, data: { message: 'Token expired' } } };
    expect(isBackendUnreachable(error401)).toBe(false);

    // 429 Rate Limited
    const error429 = { response: { status: 429, data: { message: 'Too many requests' } } };
    expect(isBackendUnreachable(error429)).toBe(false);

    // 500 Internal Server Error
    const error500 = { response: { status: 500, data: { message: 'Internal error' } } };
    expect(isBackendUnreachable(error500)).toBe(false);
  });
});
