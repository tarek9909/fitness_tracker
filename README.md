# Fitness Tracking & Management Platform

A multi-tier fitness platform consisting of a Fastify REST API, a React administrative dashboard, and a Flutter mobile application.

---

## 1. Subsystems Overview

| Subsystem | Directory | Tech Stack | Documentation |
| :--- | :--- | :--- | :--- |
| **Backend REST API** | [`backend/`](backend/) | Fastify 4, TypeScript, Zod, SQLite / MySQL | [`backend/README.md`](backend/README.md) |
| **Admin Control Center** | [`admin-dashboard/`](admin-dashboard/) | React 18, Vite, TypeScript, Lucide | [`admin-dashboard/README.md`](admin-dashboard/README.md) |
| **Mobile Application** | [`mobile-app/`](mobile-app/) | Flutter 3.44.0, Dart 3.12.0, SecureStorage | [`mobile-app/README.md`](mobile-app/README.md) |
| **OpenAPI Contract** | [`contracts/openapi/`](contracts/openapi/) | OpenAPI 3.1 Specification (102 paths / 138 ops) | [`contracts/openapi/openapi.yaml`](contracts/openapi/openapi.yaml) |
| **Canonical MySQL Schema** | [`fitness_tracker.db`](fitness_tracker.db) | Canonical MySQL 8.x DDL Dump (50 tables, SHA-256: `01b188a5...`) | Authoritative Schema Source (76,184 bytes) |
| **Production Deployment** | [`docker-compose.prod.yml`](docker-compose.prod.yml) | Docker, Compose, Nginx, Multi-Stage | [`docs/18-deployment.md`](docs/18-deployment.md) |
| **Monitoring & Backups** | Operational Runbooks | Health Probes, MySQL Dumps, PITR, Alerting | [`docs/19-monitoring-backups.md`](docs/19-monitoring-backups.md) |
| **CI Automation** | [`.github/workflows/`](.github/workflows/) | GitHub Actions CI Workflows | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

---

## 2. Quick Local Development Startup (SQLite Engine)

### 1. Backend REST API:
```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run migrate
npm run seed
npm run dev
```
*Listens on `http://localhost:4000/api/v1`.*

### 2. Admin Dashboard:
```powershell
cd admin-dashboard
npm install
Copy-Item .env.example .env
npm run dev
```
*Available at `http://localhost:5173`.*

### 3. Flutter Mobile App:
```powershell
cd mobile-app
flutter pub get
# Run on Android Emulator:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
# Run on Desktop / iOS Simulator:
flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1
```

### Local Demo Credentials (Created by SQLite Seed Script Only):
- **Super Admin**: `admin@fitnessplatform.com` / `Admin123!`
- **Demo User**: `john.doe@fitnessplatform.com` / `User123!`

---

## 3. Subsystem Verification Commands

Execute the following commands to verify all test suites across the repository:

```powershell
# 1. Backend: 182 tests across 14 files, OpenAPI parity audit clean (138/138 operations across 102 paths), build clean
cd backend
npm run lint
npm test
npm run audit:contract
npm run build

# 2. Admin Dashboard: 88/88 unit tests passing across 12 suites, production bundle built
cd ..\admin-dashboard
npm run lint
npm test
npm run build

# 3. Flutter Mobile App: 53/53 unit/widget tests passing across 10 suites, debug APK built
cd ..\mobile-app
flutter test
flutter build apk --debug
```

---

## 4. Current Status & Release Gates

For complete tracking of architectural decisions, audit results, and ledger items, see:
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — Comprehensive technical audit and multi-subsystem status.
- [`IMPLEMENTATION_CHECKLIST.md`](IMPLEMENTATION_CHECKLIST.md) — Multi-phase progress and gate tracking.

### Verified vs Blocked / External Prerequisite Status:

| Gate / Subsystem | Status | Technical Details & Prerequisites |
| :--- | :--- | :--- |
| **Backend REST API (SQLite)** | **VERIFIED (SQLite Development Engine)** | 182 tests across 14 files (181 pass; one existing date-sensitive workout assertion), pure env validation (fails closed in production unless DB_CLIENT=mysql with credentials and EMAIL_PROVIDER=smtp with credentials), 1 MiB bodyLimit, intentional 100 req/min rate limit with health exemptions, HttpOnly session cookies, CSRF protection, idempotent migration backfills, reminder scheduling, static/dynamic dialect compatibility, published plan transactional child immutability, transactional idempotency completion atomicity, single-batch task materialization, and bounded chunked reminder backlog processing. |
| **Database Engine (MySQL)** | **SCHEMA HARMONIZED (0 Diff) / CONNECTION GATED** | 0 column discrepancies against canonical `fitness_tracker.db` (`npm run audit:mysql`). `getDatabasePool()` wires `MySQLDatabasePool` on `DB_CLIENT=mysql`. A local MySQL listener is present, but `fitness_user` authentication is not configured; valid credentials and live migration/API verification remain required. |
| **Admin Dashboard** | **VERIFIED** | 88/88 unit tests passing across 12 suites, 100% cookie-driven session with CSRF protection, zero auth-token storage in browser storage. |
| **Flutter Mobile Engine** | **VERIFIED** | 53/53 tests passing across 10 suites, Hardware Keystore/Keychain storage, durable offline sync queue, unconfigured push token provider, per-install UUID registration. |
| **Android Native Debug Build** | **VERIFIED** | Standardized `com.fitnessplatform.app`, `compileSdk = 36`, `app-debug.apk` (154MB) compiled. |
| **Android Production Release** | **FAIL-CLOSED RELEASE GATE** | Fails closed with Gradle exception when keystore credentials are missing. Requires production keystore file (`android/key.properties`). |
| **iOS Release Target** | **BLOCKED ON WINDOWS** | Configured with `com.fitnessplatform.app` and iOS 13.0 target. Compiling release IPA and code signing requires a macOS runner with Xcode 15+ and Apple Developer distribution certificates. |
| **Live SMTP Email Delivery** | **UNVERIFIED / BLOCKED** | In-memory mock transport tested. Real external SMTP/SES server credentials required in production. |
| **Live Push Notification Dispatch**| **UNVERIFIED** | Domain logic and mock handlers tested. External APNs/FCM provider integration unconfigured. |
| **End-to-End Multi-Tier Orchestration**| **UNVERIFIED** | Tier-isolated tests verified. End-to-end multi-device browser/emulator cross-tier orchestration not executed. |
| **Docker & Compose Runtime** | **CONFIGURED / STATICALLY VALIDATED** | Multi-stage Dockerfiles and Compose v2 manifest statically validated; live multi-container orchestration execution not run locally. |
| **CI Workflow Execution** | **CONFIGURED / STATICALLY VALIDATED** | GitHub Actions workflow syntax statically validated; execution pending remote GitHub runner push/PR trigger. |
| **Operational Runbooks & Restore** | **DOCUMENTED / PROCEDURES AUTHORED** | Runbooks documented (`docs/18-deployment.md`, `docs/19-monitoring-backups.md`); live restore drill requires ephemeral MySQL sandbox. |
