# Implementation Checklist: Fitness Tracking Platform

## Phase 1: Database Architecture & MySQL 8.x Compatibility
- [x] **SQLite Runtime Schema & Test Isolation**: Active DDL in `backend/src/database/schema.ts` operates in SQLite dialect for local development and isolated automated tests (181/181 tests passing across 14 files)
- [x] **Runtime Schema Divergence Audit (`npm run audit:mysql`)**: Accurately parses canonical `fitness_tracker.db` dump vs active `schema.ts`, reporting **0 shared-table column discrepancies** across all 50 canonical tables and `isHarmonized = true`
- [x] **MySQL Compatibility & Schema Parity**: All 50 canonical domain tables, active repository queries, migrations, and seed fixtures are fully reconciled with canonical column structures and backwards-compatible runtime aliases
- [x] **Fail-Closed MySQL Integration Test Runner (`npm run test:mysql`)**: Executes Schema Harmonization Gate (Step 1) successfully with 0 discrepancies and halts at Step 2 (Connection Gate) reporting live server requirements
- [x] **Local Development Reset (`npm run reset:dev`)**: Guarded development reset recreating local SQLite database and seeding super admin (`Admin123!`) and demo user (`User123!`)
- [x] **OpenAPI 3.1 Contract**: 100% reconciled against all **101 unique runtime paths and 137 operations** via `npm run audit:contract`

## Phase 2: Backend Core Infrastructure & Security
- [x] Fastify server builder with structured Pino logging, correlation IDs, rate limiting, and CORS
- [x] Registered `@fastify/cookie` and configured HttpOnly SameSite session cookies for web clients
- [x] Exclude/suppress raw token strings in JSON response when `clientType === 'web'` to enforce browser security
- [x] Implemented Double Submit CSRF protection middleware (`backend/src/middleware/csrf.ts`) and global `preHandler` hook
- [x] Added sensitive field log redaction in Pino logger (`password`, `token`, `refreshToken`, `cookie`, `set-cookie`, `authorization`, `secret`)
- [x] JWT token issuance, verification, and atomic conditional rotation (`withTransaction`)
- [x] Concurrency-safe refresh token rotation (verified: parallel refresh attempts permit exactly one rotation)
- [x] Active account status re-check on every authenticated request in `authenticate.ts` (immediate rejection of disabled accounts)
- [x] Dual authentication credentials extraction (supports both Bearer token header and `access_token` HttpOnly cookie)
- [x] Role-Based Access Control (`src/middleware/authorize.ts`)
- [x] Universal idempotency engine in `src/shared/utils/request-utils.ts` supporting standard `Idempotency-Key` headers
- [x] Fail-closed production configuration in `src/config/env.ts` with strict MySQL credentials, SMTP validation, configurable password reset URL, and hardened production validation for `COOKIE_SECRET` and `ADMIN_ALLOWED_ORIGINS`
- [x] Dedicated liveness (`GET /health/live`) and readiness (`GET /health/ready`) probes returning 503 on database disconnection
- [x] Startup guard in `src/app/server.ts` preventing `seedDatabase()` from executing in production
- [x] Integrated `nodemailer` email delivery service (`src/shared/services/email.service.ts`) with fail-closed SMTP validation, in-memory mock store for testing, and rollback on delivery failure
- [x] **Kickoff Section 91 Focused Security Audit**:
  - **Passwords & Crypto**: `bcrypt.hash` (12 rounds), CSPRNG reset tokens (`crypto.randomBytes(32)`), SHA-256 token hashing, 1-hour expiry, atomic revocation, enumeration-resistant responses — **VERIFIED**
  - **JWT & Token Lifecycle**: Strict HMAC signing with secret validation, atomic conditional token rotation in `withTransaction`, user active status re-check on refresh — **VERIFIED**
  - **SQL Injection & XSS**: 100% parameterized SQL query execution across all repositories, zero string concatenation into SQL clauses, strict Zod body/query validation — **VERIFIED**
  - **Authorization & IDOR Protection**: Universal RBAC (`authenticate`, `authorize`), `/me/*` user ID scoping, object-level ownership checks on workouts, sets, meals, cardio, and goals — **VERIFIED**
  - **CORS, Rate Limiting & DoS Protection**: `@fastify/rate-limit` (100 req/min intentional default, configurable via `RATE_LIMIT_MAX`; health probes `/api/v1/health/*` exempt), CORS restricted to validated origins (HTTPS required in production), bounded 1 MiB body size limits (`bodyLimit: 1048576`) — **VERIFIED**
  - **Log Redaction & Zero Token Persistence**: Pino redaction on all sensitive keys (`password`, `token`, `refreshToken`, `cookie`, `set-cookie`, `authorization`, `secret`), zero token persistence in browser `localStorage`/`sessionStorage` — **VERIFIED**

## Phase 3: Backend Domain Modules & REST API
- [x] **Auth**: Login, atomic single-flight refresh, logout, password reset flow with real email service, cookie setting/clearing, CSRF tokens, and token suppression in web flow
- [x] **Users**: Profile management, notification settings, admin user CRUD, immediate disable/enable status enforcement
- [x] **Exercises**: Library management, metadata listing, archive/restore endpoints
- [x] **Workout Plans & Immutability**: Plan CRUD, version cloning, day and exercise builder with strict Zod validation, `PLAN_VERSION_IMMUTABLE` enforcement
- [x] **Diet Plans & Option Groups**: Plan CRUD, version cloning, meals, option groups, food options with strict Zod validation, atomic draft reordering, `PLAN_VERSION_IMMUTABLE` enforcement
- [x] **Foods Library**: Food items listing and creation
- [x] **Assignments & Overlap Rules**: `PLAN_VERSION_NOT_PUBLISHED` check preventing draft plan assignments; `409 ASSIGNMENT_OVERLAP` check
- [x] **Goals & Targets**: Body weight goals, daily water targets, daily cardio targets
- [x] **Daily Plan Engine**: `GET /me/today` and `GET /me/days/:date` dynamic agenda generation
- [x] **Tracking & Logging**:
  - Weight tracking with 7-day rolling average and history
  - Water logging with idempotent deduplication and history
  - Meal logging with food option selections in atomic transactions
  - Race-safe workout session startup with validated set ranges and complete session ownership isolation
  - Cardio logging with dynamic date-based weekday resolution and history
- [x] **Progress & Analytics**: User progress metrics, admin KPIs overview, audit logs list
- [x] **Notifications & Reminder Workers**:
  - In-app notifications, device registration, on-demand HTTP trigger `POST /admin/reminders/process`
  - Dedicated background reminder worker daemon (`src/workers/reminder.worker.ts`) with distributed database locking (`worker_locks`) executable via `npm run worker:reminders`
- [x] **Automated Tests**: **181/181 tests passing** (`npm test` in `backend` across 14 files):
  - 61 API integration tests (`backend/tests/api.test.ts`)
  - 19 production environment validation tests (`backend/tests/env.test.ts`)
  - 4 schema parser & fail-closed runner tests (`backend/tests/schema-parser.test.ts`)
  - 4 schema parity tests (`backend/tests/schema-parity.test.ts`)
  - 1 migration backfill test (`backend/tests/migration.test.ts`)
  - 5 dialect compatibility tests (`backend/tests/dialect-compatibility.test.ts`)
  - 4 reminder scheduling tests (`backend/tests/reminder-engine.test.ts`)
  - 15 admin targets tests (`backend/tests/admin-targets.test.ts`)
  - 21 analytics & adherence tests (`backend/tests/analytics.test.ts`)
  - 10 architecture & security tests (`backend/tests/architecture-security-audit.test.ts`)
  - 10 push delivery, preferences, and in-app boundary tests (`backend/tests/push-provider.test.ts`)
  - 2 daily plan batch resolution tests (`backend/tests/daily-plan-batch.test.ts`)
  - 3 bounded reminder worker & chunking tests (`backend/tests/reminder-worker-bounded.test.ts`)
  - 22 production hardening tests (`backend/tests/production_hardening.test.ts`)

## Phase 4: Admin Control Dashboard
- [x] React 18, Vite, TypeScript, Vitest, Lucide, custom dark CSS design system
- [x] Complete removal of `localStorage` and `sessionStorage` token persistence; 100% cookie-driven in-memory session management
- [x] Storage cleanup strictly scoped to legacy app keys (`fitness_admin_token`, `fitness_admin_refresh`, `fitness_admin_user`) without clearing unrelated same-origin session state
- [x] Automated Double-Submit CSRF protection (`getCsrfTokenFromCookie()` automatically attaches `X-CSRF-Token` to `POST`/`PUT`/`PATCH`/`DELETE`)
- [x] Session initialization via cookie-authenticated `GET /me` with role authorization checks (`admin` / `super_admin`)
- [x] Single-flight cookie refresh mutex on 401 via `POST /auth/refresh` sending `{ clientType: 'web' }`
- [x] Production URL validation (requires HTTPS or same-origin `/api/v1`; disallows unencrypted localhost)
- [x] Dashboard Overview with live KPIs and activity feed
- [x] User Management directory
- [x] Workout & Diet Plan Builders with version cloning, full 7-day schedule, exercise reordering, inline editing, food alternatives, and weekly preview
- [x] Exercise Library & Food Database views with edit/archive/restore workflows
- [x] Plan Assignments view with published version resolution and status filtering
- [x] Audit Log Viewer & Comprehensive Analytics (Platform Overview, Athlete Deep-Dive, Audit Trail)
- [x] Automated test suite passing (`npm test` in `admin-dashboard` - 87/87 tests passed across 12 suites)
- [x] Production build and lint validation (`npm run lint && npm run build` passing in <1.1s)

## Phase 5: Flutter Mobile Application
- [x] Flutter 3.44.0 + Dart 3.12.0 with Material 3 Dark theme
- [x] Official Android and iOS platform harnesses generated and configured (`android/`, `ios/`) with `compileSdk = 36` and `com.fitnessplatform.app` namespace
- [x] Android `assembleDebug` successfully compiled to `app-debug.apk` (154MB) and release signing verified fail-closed
- [x] iOS release configuration statically verified in `Runner.xcodeproj/project.pbxproj` (bundle ID `com.fitnessplatform.app`, deployment target iOS 13.0, Security.framework Keychain integration); IPA release compilation and code signing cannot be executed on Windows and requires a macOS/Xcode CI runner plus Apple Developer credentials
- [x] Complete migration off `SharedPreferences` to `FlutterSecureStorage` (iOS Keychain / Android Keystore) with injectable `SecureStorageService` abstraction
- [x] Release-safe `ApiConfig` requiring `--dart-define=API_BASE_URL` with HTTPS in release mode
- [x] Durable `SyncCoordinator` with `connectivity_plus` network listener, bounded exponential backoff, single-flight 401 refresh, and non-destructive terminal 4xx/conflict preservation
- [x] User-visible Sync Status Banner & Modal Bottom Sheet with manual retry/discard controls
- [x] `ApiClient` integrated with secure session, operation IDs, and idempotency headers
- [x] Daily Agenda Command Center (`/me/today` adherence, workout card, meal cards, water tracker with quick adds, weight card, daily checklist)
- [x] Live Workout Tracker with neutral dynamic target inputs and interactive completion dialog
- [x] Meal Logger with food option group selectors
- [x] Body Weight Logger & Goal Progress tracker without synthetic fallback assumptions
- [x] Progress & Analytics view
- [x] Static analysis clean (`flutter analyze` - 0 issues found)
- [x] Unit, config, storage, offline sync, push registration, models & widget test suite passing (`flutter test` - 53/53 passed across 10 suites)

## Phase 6: Full-System Integration & End-to-End Workflows
- [x] **OpenAPI Contract & Route Parity**: Statically and dynamically audited (101 unique paths, 137 operations, 0 missing, 0 extra) via `npm run audit:contract` — **VERIFIED**
- [x] **Containerization & Operational Assets**: Configured and statically validated; multi-stage Dockerfiles (`backend/Dockerfile`, `admin-dashboard/Dockerfile`), Compose v2 manifest (`docker-compose.prod.yml`) with one-shot `migrate` gate and DB-aware `/health/ready` probe, and GitHub Actions CI (`.github/workflows/ci.yml`); live multi-container runtime execution and CI runner execution externally gated — **CONFIGURED / STATICALLY VALIDATED**
  - Multi-stage non-root backend Dockerfile (`backend/Dockerfile`) building TypeScript, running compiled server, and exposing liveness/readiness healthcheck
  - Multi-stage admin dashboard Dockerfile (`admin-dashboard/Dockerfile`) with Nginx SPA configuration (`admin-dashboard/nginx.conf`), security headers, cache policies, and `/health` probe
  - Production Compose manifest (`docker-compose.prod.yml`) and `.env.production.example` separating API and reminder worker daemon with healthcheck dependencies, one-shot migration gate, and secret injection
  - Continuous Integration workflow (`.github/workflows/ci.yml`) running backend, dashboard, and Flutter gates
  - Production deployment runbook (`docs/18-deployment.md`) covering architecture, migrations, zero-downtime rollout, rollback, SMTP/push, and mobile signing
  - Monitoring and backups runbook (`docs/19-monitoring-backups.md`) covering health probes, MySQL backup strategy, restore verification, alerting, and logging
- [ ] **Live Docker/Compose Multi-Container Runtime Orchestration**: Running live multi-container stack via Docker engine — **UNVERIFIED / EXTERNALLY GATED** (Requires host/server Docker daemon)
- [ ] **Remote GitHub Actions CI Runner Execution**: Automated workflow execution on remote GitHub runners upon push/PR — **UNVERIFIED / EXTERNALLY GATED** (Requires push/PR trigger to GitHub repository)
- [ ] **Live MySQL 8.x Engine Runtime**: End-to-end migrations and API execution on live MySQL — **BLOCKED / GATED** (A local MySQL listener is present, but `fitness_user` authentication is not configured; schema and queries are 100% harmonized)
- [ ] **Admin-to-Flutter Live Workflow Orchestration**: Publishing workout/diet plans in Admin Dashboard, assigning to live client, fetching on Flutter `/me/today`, executing workout sets, and observing aggregate KPI updates in Admin — **UNVERIFIED** (Isolated component test suites passed; end-to-end cross-tier browser/emulator orchestration not executed)
- [ ] **Live Push Notification & Deep-Link Dispatch**: Live APNs/FCM external provider dispatch to production device tokens — **UNVERIFIED / EXTERNALLY GATED** (Local typed `PushProvider` abstraction, config-driven mock-safe provider, active device routing, `notification_deliveries` attempt/failure recording without false sent claims, and Flutter authoritative `/me/today` meal deep-link resolution verified with tests; live APNs/FCM external delivery unconfigured)
- [ ] **Live SMTP Email Delivery**: End-to-end password reset email dispatch via external SMTP/SES provider — **UNVERIFIED / BLOCKED** (In-memory mock verified in test suite; live external SMTP server credentials required)
- [ ] **Backup Restoration Drill Execution**: Live restore into ephemeral MySQL sandbox — **UNVERIFIED / EXTERNALLY GATED** (Procedure documented in `docs/19-monitoring-backups.md`; requires ephemeral sandbox MySQL container)

## Phase 7: Final Release Readiness & Acceptance Gates
- [x] **Backend SQLite Production Harness**: Pure environment validation, fail-closed production gates (DB_CLIENT=mysql, EMAIL_PROVIDER=smtp), HttpOnly session cookies, CSRF protection, rate limiting, liveness/readiness probes, and rule-aware reminder scheduling verified with 181/181 passing tests across 14 files — **LOCALLY VERIFIED**
- [x] **Backend MySQL 8.x Schema Harmonization**: 0 shared-table column discrepancies across all 50 canonical tables, verified by runtime DDL parser (`npm run audit:mysql`) against `fitness_tracker.db` (SHA-256: `01b188a516...`, 76,184 bytes) — **VERIFIED**
- [x] **Admin Dashboard Production Bundle**: 100% cookie/CSRF authentication, zero token persistence in `localStorage`/`sessionStorage`, and Vite bundle compilation verified (87/87 tests passing across 12 suites) — **VERIFIED**
- [x] **Flutter Mobile Storage & Offline Sync Engine**: Keychain/Keystore hardware storage, durable sync queue, single-flight refresh, unconfigured push token provider, per-install UUID registration, and release-safe API config verified with 53/53 passing tests across 10 suites — **LOCALLY VERIFIED**
- [x] **Android Native Debug Build**: Standardized package `com.fitnessplatform.app`, `compileSdk = 36`, and `app-debug.apk` (154MB) compiled — **VERIFIED**
- [x] **Operational & Deployment Runbooks**: `docs/18-deployment.md` and `docs/19-monitoring-backups.md` detailing zero-downtime migrations, rollback, backup verification, alerting, and mobile signing — **PROCEDURES AUTHORED / STATICALLY AUDITED**
- [ ] **Android Production Release Signing**: Fail-closed release signing configured in Gradle; requires production release keystore file and credentials — **BLOCKED / UNVERIFIED**
- [ ] **iOS IPA Release Packaging & Code Signing**: Requires macOS runner with Xcode 15+ and Apple Developer distribution certificates — **BLOCKED ON WINDOWS**
- [ ] **MySQL 8.x Live Database Provisioning**: Local listener detected on `localhost:3306`, but valid `fitness_user` credentials and live migration/API verification are still required — **BLOCKED / UNVERIFIED**
- [ ] **End-to-End Fresh Environment Acceptance & Live UX/Performance Review**: Cross-tier load test, UI performance profiling, and production deployment dry-run — **UNVERIFIED**
