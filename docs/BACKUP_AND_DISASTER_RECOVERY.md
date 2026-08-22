# Enterprise Backup and Disaster Recovery (DR) Plan

**System:** Astralis Heat-Treatment ERP  
**Recovery Time Objective (RTO):** $< 15\text{ minutes}$  
**Recovery Point Objective (RPO):** $< 5\text{ minutes}$  
**Integrity Guarantee:** SHA-256 Cryptographic Manifest Validation & Multi-Tenant Boundary Isolation  

---

## 1. Backup Strategy & Architecture

```
Authoritative MongoDB Collections (Jobs, Heat Lots, Pyrometry, NCRs, Invoices, Audit Logs)
                           │
                           ▼
Backup Engine (BackupRestoreService.createBackup)
   ├── 1. Tenant Filter or Full Database Extraction ({ isDeleted: { $ne: true } })
   ├── 2. Collection Serialization to JSON Formats
   ├── 3. SHA-256 Checksum Calculation per Collection
   ├── 4. Manifest Signing & Metadata Generation (manifest.json)
   └── 5. Encrypted Backup Directory Archive
                           │
                           ▼
Air-Gapped Immutable Storage / AWS S3 Glacier / Off-Site Encrypted Cold Vault
```

### Backup Frequency & Retention
- **Hourly Incremental Snapshots:** Retained for 7 days.
- **Daily Full Backups:** Retained for 90 days.
- **Monthly Regulatory Archive:** Retained for 10 years (CQI-9 / Aerospace AMS 2750G audit compliance).

---

## 2. Backup Execution & Validation Procedure

### Automated Backup Generation
```bash
# Execute tenant-scoped or full backup
npm run backup -- --tenant=tenant_primary_001 --output=/var/backups/astralis
```

### Cryptographic Manifest Structure (`manifest.json`)
```json
{
  "backupId": "astralis_backup_tenant_primary_001_2026-08-23T02-00-00",
  "createdAt": "2026-08-23T02:00:00.000Z",
  "tenantId": "tenant_primary_001",
  "appVersion": "1.0.0",
  "totalCollections": 18,
  "totalDocuments": 12450,
  "collections": {
    "productionjobs": {
      "collectionName": "productionjobs",
      "documentCount": 350,
      "sha256": "4a7d...39b1",
      "fileSize": 184500
    }
  }
}
```

---

## 3. Disaster Recovery & Demonstrated Restore Procedure

```
Corrupted / Restored Target Environment
                   ▲
                   │ (Dry-Run Integrity Validation -> Bulk Replace Insertion)
Restore Engine (BackupRestoreService.restoreBackup)
   ├── 1. Verify SHA-256 Checksums of All Collection JSON Files Against Manifest
   ├── 2. Abort Immediately if Checksums Mismatch or Files Are Tampered
   ├── 3. Clear Target Tenant Records (Ensuring Zero Cross-Tenant Leakage)
   ├── 4. Upsert Verified Records with Exact _id Preservation
   └── 5. Validate Final Restored Counts Match Original Manifest
```

### Restore Execution Steps
1. **Verify Backup Integrity:**
   ```typescript
   const verification = backupRestoreService.verifyBackupIntegrity(backupDirPath);
   if (!verification.isValid) throw new Error("Integrity check failed!");
   ```
2. **Execute Dry-Run Simulation:**
   ```typescript
   await backupRestoreService.restoreBackup(backupDirPath, { dryRun: true });
   ```
3. **Execute Authoritative Restore:**
   ```typescript
   await backupRestoreService.restoreBackup(backupDirPath, {
     targetTenantId: 'tenant_primary_001',
     clearTargetTenantBeforeRestore: true
   });
   ```
4. **Verify Application Readiness & Smoke Test:**
   - Execute `/api/v1/health` and verify all domain entity counts match pre-disaster state.
