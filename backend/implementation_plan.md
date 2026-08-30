# Implementation Plan: Backend Production Readiness & MySQL Harmonization

This plan details the comprehensive engineering pass to bring the backend to true production readiness, reconcile all database queries with the canonical MySQL 8.x schema (`fitness_tracker.db`), add real SMTP transactional email delivery, establish a robust background reminder worker, and harden production security and observability.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Decisions & Changes**:
> 1. **Schema & Query Harmonization**: All repositories and the local development SQLite DDL will be aligned with the canonical table and column names in `fitness_tracker.db` (e.g. `workout_session_exercises`, `workout_set_logs`, `body_weight_logs`, `water_intake_logs`, `cardio_logs`, `user_workout_plan_assignments`, `user_diet_plan_assignments`).
> 2. **Dual-Engine Operation**: Removing the hard `DB_CLIENT=mysql` startup guard in `backend/src/database/pool.ts`. Both MySQL and SQLite will execute the same unified queries.
> 3. **Nodemailer Integration**: Adding `nodemailer` for real SMTP transactional email delivery when `EMAIL_PROVIDER=smtp`, with fail-closed configuration validation and in-memory mock store for automated testing.
> 4. **Dedicated Reminder Worker**: Adding `src/workers/reminder.worker.ts` with distributed locking, exponential retry handling, and Pino observability metrics.
> 5. **Fastify Cookie Authentication**: Adding `@fastify/cookie` to support `HttpOnly`, `Secure`, `SameSite=Lax/Strict` session cookies for the Admin Dashboard alongside standard Bearer tokens for mobile clients.

---

## Proposed Changes

### 1. Database Layer & Repository Query Harmonization (`fitness_tracker.db` Alignment)

#### [MODIFY] [`backend/src/database/pool.ts`](file:///C:/Projects/health%20track/backend/src/database/pool.ts)
- Remove the temporary `DB_CLIENT=mysql` startup guard.
- Ensure MySQL connection pool executes portable queries, handles transaction rollbacks/commits reliably, and reports health checks.

#### [MODIFY] [`backend/src/database/schema.ts`](file:///C:/Projects/health%20track/backend/src/database/schema.ts)
- Update SQLite table definitions and column names to match the canonical 50-table MySQL schema in `fitness_tracker.db`:
  - `user_workout_plan_assignments` & `user_diet_plan_assignments`
  - `body_weight_logs` (`log_date`, `weight_kg`)
  - `water_intake_logs` (`log_date`, `amount_ml`, `logged_at`)
  - `workout_sessions` (`workout_date`, `started_at`, `completed_at`)
  - `workout_session_exercises` & `workout_set_logs`
  - `meal_logs` (`log_date`, `logged_at`) & `meal_log_items`
  - `cardio_logs` (`log_date`, `duration_minutes`, `distance_km`)
  - `reminder_rules` & `notification_deliveries`

#### [MODIFY] [`backend/src/database/migrate.ts`](file:///C:/Projects/health%20track/backend/src/database/migrate.ts)
- Update migration definitions and deduplication cleanup to use the canonical schema names.
- Ensure `001-initial-schema` and `002-workout-sessions-unique-user-date` run idempotently on both SQLite and MySQL.

#### [NEW] [`backend/src/scripts/verify-mysql-connection.ts`](file:///C:/Projects/health%20track/backend/src/scripts/verify-mysql-connection.ts)
- Script to test live MySQL connection, table schemas, migration status, and basic CRUD when MySQL credentials are provided.

#### [MODIFY] Backend Repositories & Modules
- Align all SQL queries across:
  - [`backend/src/modules/users/users.repository.ts`](file:///C:/Projects/health%20track/backend/src/modules/users/users.repository.ts)
  - [`backend/src/modules/weight/weight.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/weight/weight.routes.ts)
  - [`backend/src/modules/water/water.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/water/water.routes.ts)
  - [`backend/src/modules/meals/meals.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/meals/meals.routes.ts)
  - [`backend/src/modules/workout-sessions/workout-session.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/workout-sessions/workout-session.routes.ts)
  - [`backend/src/modules/cardio/cardio.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/cardio/cardio.routes.ts)
  - [`backend/src/modules/assignments/assignment.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/assignments/assignment.routes.ts)
  - [`backend/src/modules/daily-plan/daily-plan.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/daily-plan/daily-plan.routes.ts)
  - [`backend/src/modules/goals/goals.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/goals/goals.routes.ts)
  - [`backend/src/modules/progress/progress.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/progress/progress.routes.ts)
  - [`backend/src/modules/analytics/analytics.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/analytics/analytics.routes.ts)
  - [`backend/src/modules/notifications/notifications.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/notifications/notifications.routes.ts)

---

### 2. SMTP Transactional Email Delivery

#### [MODIFY] [`backend/package.json`](file:///C:/Projects/health%20track/backend/package.json)
- Add `nodemailer`, `@types/nodemailer`, `@fastify/cookie`.

#### [MODIFY] [`backend/src/config/env.ts`](file:///C:/Projects/health%20track/backend/src/config/env.ts)
- Add SMTP configuration options: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- When `EMAIL_PROVIDER=smtp`, strictly validate that `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` are set, or fail fast at startup.

#### [NEW] [`backend/src/shared/services/email.service.ts`](file:///C:/Projects/health%20track/backend/src/shared/services/email.service.ts)
- Real Nodemailer transport with connection pooling and delivery retry.
- In-memory mock store when `EMAIL_PROVIDER=mock` or during Vitest execution.
- Fail-closed error handling when `EMAIL_PROVIDER=none`.
- Sensitive token masking ensuring reset tokens are never written to log sinks.

#### [MODIFY] [`backend/src/modules/auth/auth.service.ts`](file:///C:/Projects/health%20track/backend/src/modules/auth/auth.service.ts)
- Wire `requestPasswordReset` to `EmailService.sendPasswordResetEmail(...)`.

---

### 3. Background Reminder Worker Daemon

#### [NEW] [`backend/src/workers/reminder.worker.ts`](file:///C:/Projects/health%20track/backend/src/workers/reminder.worker.ts)
- Standalone worker daemon for continuous reminder evaluation.
- Distributed advisory locking (or transactional lease record) preventing concurrent instances from dispatching duplicate reminders.
- Exponential backoff retry logic for failed push/in-app dispatches.
- Structured Pino logging with run duration, processed rules count, and delivery metrics.
- Clean shutdown on `SIGTERM` / `SIGINT`.

#### [MODIFY] [`backend/package.json`](file:///C:/Projects/health%20track/backend/package.json)
- Add `"worker:reminders": "tsx src/workers/reminder.worker.ts"`.

---

### 4. Production Hardening, Cookies & Observability

#### [MODIFY] [`backend/src/app/app.ts`](file:///C:/Projects/health%20track/backend/src/app/app.ts)
- Register `@fastify/cookie` plugin.
- Add sensitive field redaction in Pino onRequest/onResponse hooks (`password`, `token`, `refreshToken`, `authorization`, `cookie`, `set-cookie`).
- Add `/health/ready` probe verifying database pool connectivity.

#### [MODIFY] [`backend/src/modules/auth/auth.routes.ts`](file:///C:/Projects/health%20track/backend/src/modules/auth/auth.routes.ts) & [`backend/src/middleware/authenticate.ts`](file:///C:/Projects/health%20track/backend/src/middleware/authenticate.ts)
- Support reading access token from `access_token` HttpOnly cookie or `Authorization: Bearer <token>` header.
- On login/refresh, set `HttpOnly`, `Secure`, `SameSite=Lax` cookies in response when requested or in web flows.

---

## Verification Plan

### Automated Tests
1. **Contract Parity**: `npm run audit:contract` (Verify exact match with `contracts/openapi/openapi.yaml`).
2. **Database Migrations**: `npm run migrate`.
3. **SQLite Constraint & Deduplication Verifier**: `npx tsx src/scripts/verify-sqlite-constraint.ts`.
4. **Lint & TypeScript Compile**: `npm run lint && npm run build`.
5. **Backend Integration Suite**: `npm test` (all 34+ vitest tests passing).

### Manual Verification
1. Verify SMTP transport mock behavior in unit tests and fail-closed validation when misconfigured.
2. Verify reminder worker runs standalone and gracefully exits on interrupt signal.
3. Test cookie auth flow vs bearer auth flow in Fastify.
