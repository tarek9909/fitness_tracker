# 18. Production Deployment Runbook

## 1. Overview & Architecture Topology

The production architecture separates public-facing static delivery, authenticated API routing, isolated background processing, and authoritative relational storage into decoupled tiers:

```text
                                  Internet
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │      Edge / Ingress Proxy       │
                    │   (Cloudflare / Nginx / ALB)    │
                    │       TLS Termination (443)     │
                    └────────────────┬────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌──────────────────┐                                   ┌──────────────────┐
│ admin.domain.com │                                   │  api.domain.com  │
│  React Dashboard │                                   │  Node.js Fastify │
│  (Nginx SPA Pod) │                                   │   (API Server)   │
└──────────────────┘                                   └─────────┬────────┘
                                                                 │
                                     ┌───────────────────────────┴───────────────────────────┐
                                     │                                                       │
                                     ▼                                                       ▼
                          ┌─────────────────────┐                                 ┌─────────────────────┐
                          │   Reminder Worker   │                                 │      MySQL 8.x      │
                          │ (Background Daemon) │────────────────────────────────►│ (Master Database)   │
                          │   Isolated Process  │                                 │ Persistent Volume   │
                          └─────────────────────┘                                 └─────────────────────┘
```

### Core Architecture Components
1. **Edge Reverse Proxy**: TLS termination, DDoS mitigation, HTTP/2 or HTTP/3 termination, SSL certificate management (Let's Encrypt / Cloudflare).
2. **Admin Dashboard (Nginx)**: Serves static Vite React SPA bundles with aggressive caching for hashed assets (`Cache-Control: public, immutable`) and `no-cache` for `index.html` to guarantee instant deployment reflection.
3. **API Server (Fastify)**: Stateless Node.js container executing compiled TypeScript (`dist/app/server.js`), running as unprivileged user `node`. The container healthcheck probes `GET /api/v1/health/ready` (DB-aware readiness) so that a degraded database connection removes API ingress traffic, while `/api/v1/health/live` remains available for orchestrator liveness checks.
4. **Reminder Daemon Worker**: Independent container executing `node dist/workers/reminder.worker.js`. The inherited Dockerfile HTTP healthcheck is disabled (`healthcheck: disable: true`) because the daemon does not listen on an HTTP port; process health is managed via container restart policies and distributed row-level lease locks in `worker_locks`.
5. **Database (MySQL 8.x)**: Authoritative relational database with InnoDB engine, utf8mb4 collation, persistent NVMe/SSD storage, and automated Point-In-Time-Recovery (PITR).
6. **One-Shot Migration Runner**: Ephemeral container executing `node dist/database/migrate.js` with HTTP healthcheck disabled (`healthcheck: disable: true`), completing before API and worker services accept traffic.

---

## 2. Secrets Management & Fail-Closed Environment Policy

### Principles
- **Zero Committed Secrets**: No passwords, API keys, or JWT secrets are stored in Git.
- **Fail-Closed Validation**: The backend environment loader (`validateAndLoadEnv`) strictly aborts initialization if `NODE_ENV=production` is detected without:
  - `DB_CLIENT=mysql`
  - Fully populated `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME`
  - `EMAIL_PROVIDER=smtp`
  - Fully populated `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
  - Minimum 32-character non-default keys for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `COOKIE_SECRET`
  - Valid `https://` URL for `PASSWORD_RESET_BASE_URL`
  - Valid `https://` origin list for `ADMIN_ALLOWED_ORIGINS`
  - `APP_HOST` (defaults to `0.0.0.0`) and `APP_PORT` (defaults to `4000`)

### Secret Provisioning Workflow
1. Store production secrets in a secure vault (AWS Secrets Manager, HashiCorp Vault, Doppler, or GitHub Actions Encrypted Secrets).
2. Inject secrets into runtime containers as environment variables at orchestration launch time or via Docker secrets.
3. Reference the template in `.env.production.example` for all required variables.

---

## 3. Database Migration Process

### Pre-Deployment Migration Gate
Database schema updates must be executed and verified **before** newly compiled container images receive live traffic. Because the production runtime container prunes development tools (`tsx`), migrations in production execute via the compiled runner:

```bash
# Execute idempotent schema migrations against production MySQL using compiled bundle:
npm run migrate:prod

# Alternatively, invoke the compiled entrypoint directly:
node dist/database/migrate.js

# Or execute via the dedicated one-shot container in production Compose:
docker compose -f docker-compose.prod.yml run --rm migrate
```

In `docker-compose.prod.yml`, this is automatically enforced by the one-shot `migrate` service:
- `migrate` runs `node dist/database/migrate.js` with `restart: "no"`.
- Both `api` and `worker` declare `depends_on: { migrate: { condition: service_completed_successfully } }`.
- Application and reminder traffic is blocked until migrations exit with status code 0.

### The Expand-and-Contract (Blue-Green Schema) Rule
To achieve zero-downtime, schema changes must never break currently running versions of the application:

1. **Step 1 (Expand)**:
   - Add new tables or add new columns with `NULL` or a safe `DEFAULT` value.
   - Create indices concurrently where supported.
   - Do NOT drop old columns, rename columns, or add non-nullable columns without defaults.
2. **Step 2 (Deploy Code)**:
   - Deploy new container version that writes to new columns while gracefully reading from either old or new columns.
3. **Step 3 (Contract - Follow-up Release)**:
   - Once all traffic is routed to the new code and old container instances are terminated, run a cleanup migration to drop deprecated columns or tables.

---

## 4. Zero-Downtime Rollout Runbook

### Prerequisites
- CI pipeline passed all quality, contract, and schema parity gates.
- New Docker images tagged with Git commit SHA and pushed to registry.
- Target database backup confirmed within the last 24 hours.

### Rolling Update Procedure

```text
[Current State: v1 (Active) 100%]
   │
   ├─► 1. Run database migration (Expand phase)
   │
   ├─► 2. Launch new container v2 alongside v1
   │
   ├─► 3. Orchestrator polls v2 GET /api/v1/health/ready
   │      - Database ping verified
   │      - Status 200 OK received
   │
   ├─► 4. Traffic router shifts traffic: 90/10 -> 50/50 -> 0/100
   │
   ├─► 5. Orchestrator sends SIGTERM to v1 container
   │      - Fastify stops accepting new connections
   │      - Active requests complete within 15s grace period
   │      - v1 container exits cleanly
   │
[Final State: v2 (Active) 100%]
```

### Worker Process Deployment
1. When the reminder daemon receives `SIGTERM`, it sets its internal `running = false` flag, completes any active rule evaluation cycle, releases its lock in `worker_locks`, and closes database connections.
2. The orchestrator starts the replacement worker container, which immediately registers a new lease in `worker_locks` with its unique instance ID.

---

## 5. Rollback Procedures

If an unrecoverable defect, latency spike (> 1000ms P95), or elevated 5xx error rate (> 1%) is detected post-deployment:

### Immediate Application Rollback
```bash
# 1. Roll back API and Worker to the previous stable image tag
docker compose -f docker-compose.prod.yml up -d --no-deps --build api worker

# 2. In Kubernetes / ECS:
kubectl rollout undo deployment/fitness-api
kubectl rollout undo deployment/fitness-worker
```

### Database Rollback Strategy
- Because migrations follow the Expand-and-Contract rule, the previous stable binary will continue functioning with the expanded schema.
- Do NOT perform destructive table drops during an emergency rollback.
- Investigate and deploy a forward-fix migration during the next maintenance window.

---

## 6. SMTP & Push Notification Prerequisites

### SMTP Live Email Verification
1. Configure credentials from an authorized email relay (SendGrid, Postmark, AWS SES, or custom corporate SMTP).
2. Ensure DNS records (`SPF`, `DKIM`, `DMARC`) are published and validated for the sending domain.
3. Validate credentials before starting production traffic:
   ```bash
   # Test SMTP configuration against provider
   node -e "
     const nodemailer = require('nodemailer');
     const transporter = nodemailer.createTransport({
       host: process.env.SMTP_HOST,
       port: Number(process.env.SMTP_PORT),
       secure: process.env.SMTP_SECURE === 'true',
       auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
     });
     transporter.verify().then(() => console.log('SMTP connection verified successfully.')).catch(console.error);
   "
   ```

### Push Notification Credentials
1. **Firebase Cloud Messaging (FCM)** for Android / iOS:
   - Provision a Firebase project and download the service account private key JSON (`firebase-service-account.json`).
   - Store private key in vault; inject as base64-encoded secret into the backend worker environment.
2. **Apple Push Notification service (APNs)** for iOS:
   - Generate an APNs Auth Key (`.p8`) in the Apple Developer Console.
   - Record Key ID, Team ID, and Bundle ID (`com.fitnessplatform.app`).

---

## 7. Mobile App Release Signing Runbook

### Android Release (Google Play)

1. **Keystore Generation**:
   ```bash
   keytool -genkey -v -keystore upload-keystore.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias upload -storetype JKS
   ```
2. **Keystore Configuration (`mobile-app/android/key.properties`)**:
   ```properties
   storePassword=SECURE_STORE_PASSWORD
   keyPassword=SECURE_KEY_PASSWORD
   keyAlias=upload
   storeFile=/path/to/upload-keystore.jks
   ```
   *(Ensure `key.properties` and `*.jks` are in `.gitignore`)*.

3. **Production Bundle Build**:
   ```bash
   cd mobile-app
   flutter clean
   flutter pub get
   flutter build appbundle --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1
   ```
   Output: `build/app/outputs/bundle/release/app-release.aab`.

4. **Distribution**: Upload `.aab` to Google Play Console Internal Testing track. Verify signature hashes match Play App Signing certificate.

---

### iOS Release (Apple App Store)

1. **Prerequisites**:
   - Active Apple Developer Program enrollment.
   - App ID registered (`com.fitnessplatform.app`) with Associated Domains and Push Notifications capabilities enabled.
   - Distribution Certificate and App Store Provisioning Profile installed in local keychain.

2. **Production IPA Build**:
   ```bash
   cd mobile-app
   flutter clean
   flutter pub get
   flutter build ipa --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1
   ```
   Output: `build/ios/archive/Runner.xcarchive` and `build/ios/ipa/fitness_platform.ipa`.

3. **Distribution**:
   - Upload via Transporter or Xcode Organizer:
     ```bash
     xcrun altool --upload-app --type ios -f build/ios/ipa/fitness_platform.ipa \
       --apiKey YOUR_API_KEY --apiIssuer YOUR_ISSUER_ID
     ```
   - Distribute to TestFlight internal testers for end-to-end smoke testing against production backend.
