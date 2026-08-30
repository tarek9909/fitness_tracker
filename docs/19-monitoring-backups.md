# 19. Monitoring & Backups Runbook

## 1. Health Checks & Probe Contracts

The platform implements separated liveness and readiness probes following container orchestrator standards (Kubernetes / ECS / Docker Compose):

### Endpoint Contracts

| Route | Purpose | Success Condition | Response Code | Failure Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/health/live` | **Liveness Probe** | Node event loop responsive, process alive | `200 OK` | Container restart (SIGKILL after timeout) |
| `GET /api/v1/health/ready` | **Readiness Probe** | Active database pool connection verified (`SELECT 1`) | `200 OK` / `503 Service Unavailable` | Temporarily remove container from ingress load balancer |
| `GET /health` (Dashboard) | **SPA Web Server** | Nginx master and worker processes active | `200 OK` | Container restart |

### Example Probe Response (`GET /api/v1/health/ready`)
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "timestamp": "2026-08-30T15:30:00.000Z",
    "database": "connected"
  }
}
```

---

## 2. MySQL Backup Strategy

The platform utilizes a dual-tier backup strategy: **daily logical snapshots** combined with **continuous binary logging** to achieve an RPO (Recovery Point Objective) of < 5 minutes and an RTO (Recovery Time Objective) of < 30 minutes.

### A. Automated Daily Full Logical Dumps

Run daily at 02:00 UTC (lowest traffic window):

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="/var/backups/mysql"
BACKUP_FILE="${BACKUP_DIR}/fitness_platform_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Execute non-blocking snapshot using InnoDB single-transaction consistency
mysqldump \
  --host="${DATABASE_HOST}" \
  --port="${DATABASE_PORT:-3306}" \
  --user="${DATABASE_USER}" \
  --password="${DATABASE_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --hex-blob \
  --databases fitness_platform \
  | gzip -9 > "${BACKUP_FILE}"

# Encrypt and upload to offsite immutable cloud storage (AWS S3 Glacier / GCP Coldline)
aws s3 cp "${BACKUP_FILE}" "s3://fitness-platform-backups/daily/${BACKUP_FILE##*/}" \
  --sse aws:kms \
  --sse-kms-key-id "alias/fitness-backup-key"

# Retain local copies for 7 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete
```

### B. Continuous Binary Logging for Point-In-Time Recovery (PITR)
Ensure the following settings are active in `/etc/mysql/conf.d/pitr.cnf`:
```ini
[mysqld]
server-id = 1
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW
binlog_row_image = FULL
expire_logs_days = 14
max_binlog_size = 100M
```

---

## 3. Backup Restore Verification Runbook

Backups that have not been tested for restoration are invalid. A scheduled weekly automated job executes this restoration verification in an isolated temporary database instance.

### Step-by-Step Restoration Verification

1. **Provision Isolated Sandbox Database**:
   ```bash
   # Set ephemeral sandbox credentials in your session (never commit credentials)
   export RESTORE_SANDBOX_ROOT_PASSWORD="${RESTORE_SANDBOX_ROOT_PASSWORD:-<GENERATE_TEMPORARY_EPHEMERAL_ROOT_PW>}"

   # Launch isolated ephemeral MySQL container
   docker run --name mysql-restore-test \
     -e MYSQL_ROOT_PASSWORD="${RESTORE_SANDBOX_ROOT_PASSWORD}" \
     -d -p 3307:3306 mysql:8.0
   sleep 15
   ```

2. **Decompress and Ingest Backup**:
   ```bash
   # Stream backup into the verification instance using the ephemeral sandbox credentials
   gunzip < fitness_platform_YYYYMMDD.sql.gz | mysql -h 127.0.0.1 -P 3307 -u root -p"${RESTORE_SANDBOX_ROOT_PASSWORD}"
   ```

3. **Verify Table & Row Integrity**:
   ```sql
   -- Connect to verification instance
   USE fitness_platform;

   -- 1. Check all canonical tables exist (expected: 50 tables)
   SELECT COUNT(*) AS table_count FROM information_schema.tables 
   WHERE table_schema = 'fitness_platform';

   -- 2. Verify critical user and configuration records
   SELECT COUNT(*) AS user_count FROM users;
   SELECT COUNT(*) AS exercise_count FROM exercises;
   SELECT COUNT(*) AS food_count FROM foods;
   SELECT COUNT(*) AS audit_count FROM audit_logs;

   -- 3. Check table consistency with mysqlcheck
   -- Run from shell:
   -- mysqlcheck -h 127.0.0.1 -P 3307 -u root -p"${RESTORE_SANDBOX_ROOT_PASSWORD}" --check fitness_platform
   ```

4. **Verify Schema Parity against Active Repository**:
   ```bash
   # Point audit-mysql-schema script at the verification instance
   DATABASE_PORT=3307 DATABASE_PASSWORD="${RESTORE_SANDBOX_ROOT_PASSWORD}" npm run audit:mysql
   ```

5. **Teardown Sandbox**:
   ```bash
   docker stop mysql-restore-test && docker rm mysql-restore-test
   unset RESTORE_SANDBOX_ROOT_PASSWORD
   ```

---

## 4. Operational Alerting & Thresholds

Production monitoring (Prometheus + Grafana / Datadog / AWS CloudWatch) triggers alerts on the following thresholds:

| Alert Name | Severity | Condition | Evaluation Window | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **API High Latency (P95)** | Warning | API P95 latency > 500ms | 5 minutes | Inspect slow query log and active connections |
| **API Critical Latency (P99)**| Critical | API P99 latency > 2000ms | 3 minutes | Scale API replicas; check DB lock contention |
| **Elevated HTTP 5xx Rate** | Critical | 5xx errors > 1% of total requests | 3 minutes | Inspect Pino structured error logs for unhandled exceptions |
| **DB Connection Pool Saturation** | Warning | Active DB connections > 85% pool max | 2 minutes | Check for leaked connections or slow queries |
| **Host Disk Utilization** | Warning / Critical | Disk usage > 80% (Warn) / > 90% (Crit) | Immediate | Purge old local logs; expand volume |
| **Reminder Worker Stalled** | Critical | Worker lease not renewed for > 2 minutes | 2 minutes | Restart reminder worker container; inspect `worker_locks` |
| **Memory / OOM Risk** | Warning | Container RSS memory > 85% limit | 5 minutes | Capture heap snapshot; scale memory limit |

---

## 5. Structured Logging & Audit Trail Retention

### Structured Pino JSON Ingestion
All backend instances stream single-line JSON logs to standard output:
```json
{
  "level": 30,
  "time": 1788104458788,
  "pid": 1,
  "hostname": "fitness-api-6d9b4c-9xf2",
  "requestId": "req_3e4ebc15-40bd-49aa-8c90-5786bfe44dae",
  "method": "GET",
  "url": "/api/v1/admin/users/1",
  "statusCode": 200,
  "responseTime": 1.45,
  "msg": "Request completed"
}
```

### Log Aggregation Rules
- **PII Scrubbing**: Passwords, authorization headers, refresh tokens, and payment identifiers are automatically scrubbed from request logs.
- **Log Routing**: A log forwarder (FluentBit / Vector) aggregates standard output and ships to central log storage (Grafana Loki / Datadog / AWS CloudWatch).
- **Log Retention Policy**:
  - Application access logs: 30 days active search, 90 days cold storage.
  - System error logs: 90 days active search.
  - Relational `audit_logs` table: Immutable. Retention minimum 365 days. Never deleted or modified in application code.
