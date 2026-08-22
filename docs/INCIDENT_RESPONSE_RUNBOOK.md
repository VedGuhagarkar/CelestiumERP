# SRE Incident Response Runbook

**System:** Astralis Heat-Treatment ERP  
**Scope:** P0/P1 Critical Production Incidents (Shop Floor Outages, Furnace Disconnects, DB Degradation)  

---

## 1. Severity Classification Matrix

| Severity | Definition | Target Response (MTTA) | Target Resolution (MTTR) |
|---|---|---|---|
| **P0 (Critical)** | Entire ERP down, active furnace telemetry halted, safety or pyrometry recording failure. | $< 5\text{ mins}$ | $< 30\text{ mins}$ |
| **P1 (High)** | Major operational subsystem unavailable (QC approvals blocked, dispatch gate passes failing). | $< 15\text{ mins}$ | $< 2\text{ hours}$ |
| **P2 (Medium)** | Non-blocking degradation (slow analytics reports, delayed email notifications). | $< 1\text{ hour}$ | $< 8\text{ hours}$ |
| **P3 (Low)** | Minor UI cosmetic defect or non-critical administrative bug. | $< 4\text{ hours}$ | Next Sprint |

---

## 2. P0 Incident Response Protocol

```
1. Detection & Triage (Alerting / Webhook / Health Probe 503)
       │
       ▼
2. Incident Commander (IC) Assigned
       │
       ├── Declare War Room / Bridge Channel
       ├── Assess Active Furnace Batches & Safety Telemetry
       │
       ▼
3. Containment & Mitigation
       ├── Option A: Failover to MongoDB Secondary Replica
       ├── Option B: Instant Container Rollback (kubectl rollout undo)
       └── Option C: Restore Last-Known-Good Backup Snapshot
       │
       ▼
4. Resolution & Root Cause Verification
       │
       ▼
5. Post-Mortem & Blameless RCA Documentation (Within 48h)
```

---

## 3. Specific Operational Failure Runbooks

### Scenario A: Database Connection Lost / Degraded Latency
1. Check `/api/v1/health` for connection state and `pingLatencyMs`.
2. Inspect MongoDB replica set status (`rs.status()`).
3. If primary is unresponsive, trigger automated failover (`rs.stepDown()`).
4. Reconnection manager in `DatabaseConnectionManager` will automatically reconnect with exponential backoff.

### Scenario B: Failed Background Event Handlers (Dead Letter Queue)
1. Inspect Dead Letter Queue via `DomainEventBus.getInstance().getDeadLetters()`.
2. Review failed event payload and error stack trace.
3. Once underlying service (e.g. email provider or third-party hook) is resolved, trigger `DomainEventBus.getInstance().retryDeadLetter(id)`.

### Scenario C: Duplicate Request Ingestion
1. Verify `Idempotency-Key` header is supplied by client.
2. `idempotencyMiddleware` automatically replays cached HTTP response with `_idempotencyReplay: true`, preventing double debit or duplicate work order creation.
