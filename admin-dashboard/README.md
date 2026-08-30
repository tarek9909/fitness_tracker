# Fitness Platform Admin Control Center

Modern, high-performance administrative web application built with React 18, Vite, TypeScript, and Lucide Icons.

---

## 1. Architecture & Security Overview

- **100% In-Memory / Cookie-Driven Session State**:
  - Zero storage of access tokens, refresh tokens, or user profiles in `localStorage` or `sessionStorage`.
  - Authentication state is maintained via backend HttpOnly, SameSite session cookies (`access_token`, `refresh_token`).
- **Automated Double-Submit CSRF Protection**:
  - The API client (`src/api/client.ts`) extracts the `csrf_token` cookie and automatically attaches `X-CSRF-Token` headers to all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Single-Flight 401 Refresh Mutex**:
  - When an access token expires, a single refresh request (`POST /api/v1/auth/refresh`) is dispatched; concurrent API requests queue until the refresh resolves.
- **Strict Role Enforcement**:
  - Route guards verify `admin` or `super_admin` role assignment via `GET /api/v1/me` on startup.

---

## 2. Prerequisites & Environment Configuration

- **Node.js**: LTS (v20.x or v22.x)
- **npm**: v10.x+

### Environment Configuration (`admin-dashboard/.env`):

```properties
# Base URL for the Backend REST API
# Development:
VITE_API_BASE_URL=http://localhost:3000/api/v1

# Production (Requires HTTPS or same-origin /api/v1):
# VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
```

> [!IMPORTANT]
> Ensure that the URL configured for `VITE_API_BASE_URL` matches an origin registered in the backend's `ADMIN_ALLOWED_ORIGINS` environment variable.

---

## 3. Development Startup

```powershell
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

The admin dashboard will be available at `http://localhost:5173`.

### Demo Login:
- **Email**: `admin@fitnessplatform.com`
- **Password**: `Admin123!`

---

## 4. Testing, Linting & Production Build

```powershell
# Run Vitest automated unit test suite (87/87 tests passing across 12 suites)
npm test

# Typecheck and lint
npm run lint

# Build optimized production bundle to dist/
npm run build

# Preview production build locally on port 4173
npm run preview
```

---

## 5. Deployment & Production Gates

- **HTTPS Requirement**: Production deployments enforce HTTPS for both the dashboard origin and the backend API.
- **CORS Alignment**: The backend must include the dashboard production domain in `ADMIN_ALLOWED_ORIGINS` in `backend/.env`.
