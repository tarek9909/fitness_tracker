/**
 * Authoritative API Client for Fitness Platform Admin Dashboard
 * Uses HttpOnly Cookies for session management and Double-Submit CSRF tokens.
 * Zero token persistence in localStorage / sessionStorage / JS memory.
 */

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  if (import.meta.env.PROD) {
    if (envUrl) {
      if (envUrl.startsWith('http://localhost') || envUrl.startsWith('http://127.0.0.1')) {
        throw new Error('FATAL: VITE_API_BASE_URL cannot use unencrypted localhost in production.');
      }
      if (!envUrl.startsWith('https://') && !envUrl.startsWith('/')) {
        throw new Error('FATAL: VITE_API_BASE_URL must use HTTPS or a same-origin relative path in production.');
      }
      return envUrl;
    }
    // Default to same-origin reverse proxy path in production
    return '/api/v1';
  }

  // Development default
  return envUrl || 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

// This is only the non-authenticating CSRF value. Access and refresh tokens
// remain HttpOnly and are never exposed to JavaScript or browser storage.
let csrfTokenInMemory: string | null = null;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearCsrfToken(): void {
  csrfTokenInMemory = null;
}

function captureCsrfToken(data: unknown): void {
  if (!data || typeof data !== 'object' || !('csrfToken' in data)) return;
  const token = (data as { csrfToken?: unknown }).csrfToken;
  if (typeof token === 'string' && token.length > 0 && token.length <= 256) {
    csrfTokenInMemory = token;
  }
}

type SessionExpiredHandler = () => void;

class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;
  private csrfBootstrapPromise: Promise<string | null> | null = null;
  private sessionExpiredHandlers: SessionExpiredHandler[] = [];

  onSessionExpired(handler: SessionExpiredHandler): () => void {
    this.sessionExpiredHandlers.push(handler);
    return () => {
      this.sessionExpiredHandlers = this.sessionExpiredHandlers.filter(h => h !== handler);
    };
  }

  private triggerSessionExpired(): void {
    clearCsrfToken();
    this.sessionExpiredHandlers.forEach(handler => handler());
  }

  private async getCsrfTokenForRequest(): Promise<string | null> {
    // Prefer the cookie when it is readable so another tab's token rotation
    // is observed; use transient memory for cross-origin API deployments.
    const availableToken = getCsrfTokenFromCookie() || csrfTokenInMemory;
    if (availableToken) return availableToken;

    if (!this.csrfBootstrapPromise) {
      this.csrfBootstrapPromise = this.bootstrapCsrfToken().finally(() => {
        this.csrfBootstrapPromise = null;
      });
    }

    return this.csrfBootstrapPromise;
  }

  private async bootstrapCsrfToken(): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const json: ApiResponse<{ csrfToken?: string }> = await response.json().catch(() => ({ success: false }));
      if (!response.ok || !json.success) return null;
      captureCsrfToken(json.data);
      return getCsrfTokenFromCookie() || csrfTokenInMemory;
    } catch {
      return null;
    }
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.requestWithRetry<T>(endpoint, options, true);
  }

  private async requestWithRetry<T = any>(endpoint: string, options: RequestInit, canRefresh: boolean): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!headers.has('X-CSRF-Token')) {
        const csrfToken = await this.getCsrfTokenForRequest();
        if (csrfToken) {
          headers.set('X-CSRF-Token', csrfToken);
        }
      }
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always send and receive HttpOnly session cookies
      headers,
    });

    if (response.status === 401 && canRefresh && !endpoint.endsWith('/auth/refresh') && !endpoint.endsWith('/auth/login')) {
      const refreshed = await this.refreshAccessTokenSingleFlight();
      if (refreshed) {
        return this.requestWithRetry<T>(endpoint, options, false);
      } else {
        this.triggerSessionExpired();
      }
    }

    const json: ApiResponse<T> = await response.json().catch(() => ({ success: false }));
    captureCsrfToken(json.data);

    if (!response.ok || !json.success) {
      const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg) as any;
      error.code = json.error?.code || 'UNKNOWN_ERROR';
      error.status = response.status;
      error.details = json.error?.details;
      throw error;
    }

    if (endpoint.endsWith('/auth/logout')) {
      clearCsrfToken();
    }

    // Keep the historical convenience of returning `data` directly while
    // preserving response-level pagination metadata for list pages. Arrays
    // are objects too, so this works for both array and object payloads
    // without changing existing consumers' response shapes.
    const result: any = json.data;
    if (json.pagination && result && typeof result === 'object') {
      Object.defineProperty(result, 'pagination', {
        value: json.pagination,
        enumerable: false,
        configurable: true,
      });
    }
    return result as T;
  }

  private async refreshAccessTokenSingleFlight(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefreshToken().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
      });
      const csrfToken = await this.getCsrfTokenForRequest();
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ clientType: 'web' }),
      });

      const json: ApiResponse = await response.json().catch(() => ({ success: false }));
      captureCsrfToken(json.data);
      return response.ok && json.success === true;
    } catch {
      return false;
    }
  }

  get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
