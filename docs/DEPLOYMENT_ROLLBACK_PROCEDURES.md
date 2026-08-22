# Production Deployment Rollback Procedures

**System:** Astralis Enterprise Resource Planning (ERP)  
**Objective:** Restore last-known-good operational state within $< 5\text{ minutes}$ in case of critical deployment regression.  

---

## 1. Rollback Decision Triggers

Initiate immediate deployment rollback if any of the following conditions occur post-deployment:
1. **Health Check Failure:** `/api/v1/health` returns status code 503 or error rate $> 1\%$ for 2 consecutive minutes.
2. **Pyrometry / Furnace Telemetry Drop:** PLC or simulated furnace socket connections disconnect or fail to ingest data.
3. **Database Migration / Schema Incompatibility:** Unhandled Mongoose validation or missing field errors occur during standard transactional flows (e.g. Job start, QC inspection, Dispatch).
4. **Data Corruption or Calculation Regressions:** Gross margin, FPY, or job cost variance calculations produce invalid results.

---

## 2. Immediate Rollback Execution Steps

```
[Incident Detected]
       │
       ▼
1. Traffic Redirection / Ingress Rollback
       │ (Point Ingress / Load Balancer Back to Previous Container Replica / Tag)
       ▼
2. Application Container Rollback
       │ (kubectl rollout undo deployment/astralis-backend)
       ▼
3. Database State Rollback (If Schema / Data Inconsistency Was Introduced)
       │ (Execute BackupRestoreService.restoreBackup from Pre-Deployment Snapshot)
       ▼
4. Clear Edge / Reverse Proxy Caches
       │ (Purge NGINX / Cloudflare CDN static assets)
       ▼
5. Post-Rollback Smoke Verification
       └── Validate Health, Command Center KPIs, and Active Batch Stages
```

### Command Reference
- **Kubernetes Container Rollback:**
  ```bash
  kubectl rollout undo deployment/astralis-backend-api -n astralis-prod
  kubectl rollout status deployment/astralis-backend-api -n astralis-prod
  ```
- **Docker Compose Rollback:**
  ```bash
  docker-compose -f docker-compose.prod.yml down
  docker-compose -f docker-compose.prod.yml up -d --build --scale backend=3
  ```
