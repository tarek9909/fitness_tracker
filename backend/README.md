# Fitness Platform Backend REST API

Production-hardened REST API built with Fastify 4, TypeScript, Zod, and SQLite (with fail-closed MySQL 8.x compatibility architecture).

---

## 1. Prerequisites & Environment Configuration

- **Node.js**: LTS (v20.x or v22.x recommended)
- **npm**: v10.x+
- **Database (Development)**: SQLite (`./fitness_local.db`)
- **Database (Production/Target)**: MySQL 8.x (requires external instance and schema harmonization)

### Exact Environment Variables (`backend/.env`):

Create your local `.env` from `.env.example`:

```properties
# Node Environment ('development' | 'production' | 'test')
NODE_ENV=development

# Server Network Configuration
APP_HOST=0.0.0.0
APP_PORT=4000
TRUST_PROXY=false

# Database Engine Configuration
# Options: 'sqlite' (verified production-hardened) | 'mysql' (fail-closed / blocked)
DB_CLIENT=sqlite
SQLITE_DB_PATH=./fitness_local.db

# MySQL Engine Configuration (Required only when DB_CLIENT=mysql)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=fitness_platform
DATABASE_USER=fitness_user
DATABASE_PASSWORD=<STRONG_LOCAL_PASSWORD>
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Security & Cryptography (32+ character secrets required in production)
ACCESS_TOKEN_SECRET=<GENERATE_32_CHAR_SECRET>
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_SECRET=<GENERATE_32_CHAR_SECRET>
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECRET=<GENERATE_32_CHAR_SECRET>
COOKIE_SAME_SITE=lax

# Logging Level ('debug' | 'info' | 'warn' | 'error')
LOG_LEVEL=info

# CORS & Admin Allowed Origins (Comma-separated HTTPS origins in production)
ADMIN_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173

# Email Service
# In development/test: 'mock' (in-memory test store) | 'none' | 'smtp'
# In production: MUST be 'smtp' with complete SMTP settings (fails closed otherwise)
EMAIL_PROVIDER=mock
SMTP_HOST=smtp.mailprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<SMTP_USERNAME_PLACEHOLDER>
SMTP_PASSWORD=<SMTP_PASSWORD_PLACEHOLDER>
SMTP_FROM="Fitness Platform" <noreply@fitnessplatform.local>
PASSWORD_RESET_BASE_URL=http://localhost:5173/reset-password

# Background Reminder Worker Interval (seconds)
REMINDER_WORKER_INTERVAL_SECONDS=60

# Rate Limiting & DoS Protection (requests per minute per client IP; default: 100)
RATE_LIMIT_MAX=100
```

---

## 2. Local Development Startup (SQLite Engine)

The verified development and testing runtime operates on SQLite:

```powershell
# 1. Install dependencies
npm install

# 2. Run schema migrations (creates baseline tables + unique constraints + worker_locks)
npm run migrate

# 3. Seed demo data (admin, users, exercises, foods, plans)
npm run seed

# 4. Start local development server with auto-reload
npm run dev
```

The REST API will listen on `http://localhost:4000/api/v1`.

### Demo Seed Credentials (Development Only):
- **Super Admin**: `admin@fitnessplatform.com` / `Admin123!`
- **Demo User**: `john.doe@fitnessplatform.com` / `User123!`

---

## 3. Background Reminder Worker Daemon

The platform includes a distributed background worker for scheduled user workout and nutrition reminder evaluations:

```powershell
# Run the standalone reminder worker daemon
npm run worker:reminders
```

- **Distributed Lease Locking**: Uses the `worker_locks` table to ensure that only one worker instance processes reminders across horizontal replicas.
- **On-Demand Admin Trigger**: Admins can trigger an immediate reminder evaluation cycle via `POST /api/v1/admin/reminders/process`.

---

## 4. MySQL 8.x Engine Status & Promotion Gate

> [!NOTE]
> **MySQL Status**: **SCHEMA HARMONIZED (0 Diff) / CONNECTION GATED**.
> All 50 canonical domain tables in `src/database/schema.ts` have been harmonized with the root `fitness_tracker.db` MySQL dump (`npm run audit:mysql` reports 0 column discrepancies, `isHarmonized = true`).
> `getDatabasePool()` wires `MySQLDatabasePool` on `DB_CLIENT=mysql`. Running in live MySQL mode requires a running MySQL 8.x server provisioned on `localhost:3306` with valid credentials in `.env`.

### MySQL Tooling, Migration & Setup:

```powershell
# 1. Initiate MySQL Database (Creates 'fitness_platform' DB and imports all 50 tables automatically)
npm run db

# 2. Run dynamic DDL schema divergence audit (confirms 0 discrepancies)
npm run audit:mysql

# 3. Run MySQL connection verification (checks host connectivity and credentials)
npm run verify:mysql

# 4. Run live MySQL integration test suite
npm run test:mysql
```

### Exact Prerequisites for Live MySQL Operations:
1. **Database Provisioning**: Provision a live MySQL 8.x instance and create user/database:
   ```sql
   -- Local development provisioning example (never commit production credentials):
   CREATE DATABASE IF NOT EXISTS fitness_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'fitness_user'@'localhost' IDENTIFIED BY '<STRONG_LOCAL_PASSWORD>';
   GRANT ALL PRIVILEGES ON fitness_platform.* TO 'fitness_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
2. **Configure `.env`**: Set `DB_CLIENT=mysql`, `DATABASE_HOST=localhost`, `DATABASE_PORT=3306`, `DATABASE_USER=fitness_user`, `DATABASE_PASSWORD=<STRONG_LOCAL_PASSWORD>`, `DATABASE_NAME=fitness_platform`.
3. **Run Migrations & Live Verification**: Apply migrations 001-004 and verify with `npm run test:mysql`.

---

## 5. Testing, Contract Auditing & Production Build

All npm scripts defined in `package.json`:

```powershell
# Run full automated test suite (182 tests across 14 files)
npm test

# Run Vitest in watch mode
npm run test:watch

# Run OpenAPI 3.1 contract parity audit (102 unique paths / 138 operations)
npm run audit:contract

# Typecheck without emitting code
npm run lint

# Compile TypeScript production bundle to dist/
npm run build

# Start production server from dist/ (requires build)
npm start
```

### Test Isolation & Local Development Database Reset:
- **Test Isolation**: The automated integration test suite (`tests/api.test.ts`) dynamically creates and executes against an isolated temporary SQLite database (`tests/.tmp/fitness_test_<pid>_<timestamp>.db`) with complete lifecycle teardown in `afterAll()`. Tests do not mutate the local developer database.
- **Guarded Local DB Reset (`npm run reset:dev`)**:
  If a previous test run altered local demo credentials (e.g. changing `john.doe@fitnessplatform.com` password to `NewUserPassword123!`), you can run the guarded reset tool:
  ```powershell
  # Resets local SQLite database and applies clean baseline seed:
  npm run reset:dev
  ```
  *(This script enforces `NODE_ENV !== 'production'` and refuses to run in production).*
- **Manual Backup-and-Recreate Procedure (Local Development Only)**:
  Alternatively, you may manually recreate the local development SQLite database:
  ```powershell
  # 1. (Optional) Back up existing development database:
  Copy-Item ./fitness_local.db ./fitness_local.db.bak

  # 2. Remove local SQLite database and WAL/SHM artifacts:
  Remove-Item ./fitness_local.db, ./fitness_local.db-wal, ./fitness_local.db-shm -ErrorAction SilentlyContinue

  # 3. Re-run migrations and fresh baseline seed:
  npm run migrate
  npm run seed
  ```
  > [!WARNING]
  > This procedure destroys existing local SQLite demo data and must **never** be run in production environments.

---

## 6. External Providers & Unverified Gates

- **Live SMTP Delivery**: `EMAIL_PROVIDER=smtp` requires valid external `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. In-memory mock delivery is verified for testing.
- **Push Notification Dispatch**: APNs (Apple Push Notification service) and FCM (Firebase Cloud Messaging) integrations require external provider credentials and live device registration.
- **Cross-Tier End-to-End Orchestration**: End-to-end orchestration across Admin Dashboard, Backend, and Mobile App has been verified in isolated tiers but not in a single multi-device live browser/emulator test.
