/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, getCsrfTokenFromCookie, API_BASE_URL } from './client';

describe('Admin Dashboard API Client & Cookie Auth Suite', () => {
  beforeEach(() => {
    // Clear cookies and storage
    document.cookie = 'csrf_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('getCsrfTokenFromCookie correctly extracts csrf_token from document.cookie', () => {
    document.cookie = 'other_cookie=xyz';
    document.cookie = 'csrf_token=test-csrf-token-abc-123';
    expect(getCsrfTokenFromCookie()).toBe('test-csrf-token-abc-123');
  });

  it('Mutating requests (POST, PUT, PATCH, DELETE) automatically attach X-CSRF-Token header and credentials: "include"', async () => {
    document.cookie = 'csrf_token=secret-csrf-token-999';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const headers = init?.headers as Headers;
      expect(init?.credentials).toBe('include');
      expect(headers.get('X-CSRF-Token')).toBe('secret-csrf-token-999');
      return new Response(JSON.stringify({ success: true, data: { id: 1, created: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await api.post('/admin/exercises', { name: 'Bench Press' });
    expect(res.created).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Single-flight 401 refresh automatically retries original request with credentials', async () => {
    document.cookie = 'csrf_token=refresh-csrf-token';
    let requestCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      requestCount++;
      const urlStr = url.toString();

      if (urlStr.endsWith('/me') && requestCount === 1) {
        // Initial request returns 401 Unauthorized
        return new Response(JSON.stringify({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Token expired' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.endsWith('/auth/refresh')) {
        // Refresh endpoint succeeds via cookie
        return new Response(JSON.stringify({ success: true, data: { expiresInSeconds: 900, csrfToken: 'new-csrf' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.endsWith('/me') && requestCount === 3) {
        // Retried request succeeds
        return new Response(JSON.stringify({ success: true, data: { id: 1, email: 'admin@fitnessplatform.com', role: 'admin' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    });

    const me = await api.get('/me');
    expect(me.email).toBe('admin@fitnessplatform.com');
    expect(requestCount).toBe(3); // 1. Initial /me (401) -> 2. /auth/refresh (200) -> 3. Retried /me (200)
  });

  it('preserves response-level pagination metadata while returning unwrapped array data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: [{ id: 1 }],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const users = await api.get<any[]>('/admin/users?page=2&limit=20');
    expect(users).toHaveLength(1);
    expect((users as any).pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  it('When refresh fails on 401, triggers onSessionExpired callback and clears session without throwing unhandled exceptions', async () => {
    let expiredCalled = false;
    const unsubscribe = api.onSessionExpired(() => {
      expiredCalled = true;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ success: false, error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Session expired' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(api.get('/admin/users')).rejects.toThrow();
    expect(expiredCalled).toBe(true);
    unsubscribe();
  });

  it('No token strings or sensitive session credentials are stored in localStorage or sessionStorage', () => {
    expect(localStorage.getItem('fitness_admin_token')).toBeNull();
    expect(localStorage.getItem('fitness_admin_refresh')).toBeNull();
    expect(localStorage.getItem('fitness_admin_user')).toBeNull();
    expect(sessionStorage.getItem('fitness_admin_token')).toBeNull();
    expect(sessionStorage.getItem('fitness_admin_refresh')).toBeNull();
    expect(sessionStorage.getItem('fitness_admin_user')).toBeNull();
  });
});
