# Production Deployment Runbook

**System:** Astralis Heat-Treatment Enterprise Resource Planning (ERP)  
**Target Environment:** Mission-Critical Aerospace & Industrial Heat-Treatment Factory Operations  
**Compliance Standards:** AMS 2750G (Pyrometry), CQI-9 4th Edition, ISO 9001:2015, IATF 16949  

---

## 1. Pre-Deployment Readiness Checklist

Before initiating deployment to staging or production:

1. **Configuration & Secrets Verification:**
   - [ ] All production environment secrets (JWT_SECRET, JWT_REFRESH_SECRET, MONGODB_URI) are sourced securely from Vault/AWS Secrets Manager/Kubernetes Secrets.
   - [ ] Default credentials or placeholder secrets are rejected at bootstrap.
   - [ ] `ENABLE_MULTI_TENANT_ISOLATION=true` is strictly enabled.
   - [ ] CORS origins explicitly match internal factory hostnames (`https://erp.astralis.internal`).
2. **Database Cluster Verification:**
   - [ ] MongoDB replica set (Primary + Secondary + Arbiter/Secondary) is healthy and synced.
   - [ ] Connection pool sizes (`DB_MAX_POOL_SIZE=100`, `DB_MIN_POOL_SIZE=10`) configured.
   - [ ] Read preference set to `primaryPreferred` for analytics and `primary` for transactional mutations.
3. **Backup & State Snapshot:**
   - [ ] Execute an automated pre-deployment backup via `BackupRestoreService`.
   - [ ] Verify SHA-256 integrity checksums on generated backup manifest.
4. **Code Quality & Boundary Assurance:**
   - [ ] AST architecture enforcement passes: `npm run check:arch` (5/5 checks).
   - [ ] Complete automated test suite passes: `npm test` (100% passing).
   - [ ] TypeScript compilation clean with 0 warnings: `npm run build`.

---

## 2. Zero-Downtime Rolling Deployment Procedure

```
Kubernetes / Docker Swarm Deployment Flow:
[Traffic Router / Reverse Proxy (NGINX/Traefik)]
       │ (Active HTTP Traffic)
       ├── Pod v1.0.0 (Old Replica) ───► SIGTERM ──► In-flight Drain ──► Terminate
       └── Pod v1.1.0 (New Replica) ───► Liveness / Readiness Probes Pass (200 OK) ──► Receive Traffic
```

### Step 1: Deploy New Application Pods
Deploy new container images with liveness and readiness probe gates:
```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/liveness
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/v1/health/readiness
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Step 2: Graceful Termination of Legacy Pods
When `SIGTERM` is issued:
1. HTTP server stops accepting new incoming connections.
2. In-flight requests are allowed up to 10 seconds to complete cleanly.
3. Active database operations finish and MongoDB connection closes gracefully (`disconnectDatabase()`).
4. Process exits with code 0.

### Step 3: Post-Deployment Smoke Verification
1. Probe `/api/v1/health` and verify `status: "healthy"` and database ping latency $< 50\text{ms}$.
2. Verify Command Center Dashboard loads live furnace telemetry.
3. Verify global search (`Ctrl+K`) returns indexed records.

---

## 3. High-Availability Health & Telemetry Probes

| Endpoint | HTTP Method | Probe Target | Expected Success | Failure Action |
|---|---|---|---|---|
| `/api/v1/health` | GET | Comprehensive System Telemetry | 200 OK | Alert On-Call SRE |
| `/api/v1/health/liveness` | GET | Process Uptime & Event Loop | 200 OK | Restart Container |
| `/api/v1/health/readiness` | GET | Deep Database Connection Ping | 200 OK | Remove from Load Balancer |
