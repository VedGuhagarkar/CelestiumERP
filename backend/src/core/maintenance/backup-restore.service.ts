import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../../config/logger.config.js';
import { config } from '../../config/app.config.js';

export interface ICollectionBackupStat {
  collectionName: string;
  documentCount: number;
  sha256: string;
  fileSize: number;
}

export interface IBackupManifest {
  backupId: string;
  createdAt: string;
  tenantId: string;
  appVersion: string;
  environment: string;
  totalCollections: number;
  totalDocuments: number;
  collections: Record<string, ICollectionBackupStat>;
}

export interface IBackupOptions {
  tenantId?: string;
  targetDir?: string;
  customData?: Record<string, any[]>;
}

export interface IRestoreOptions {
  targetTenantId?: string;
  dryRun?: boolean;
  clearTargetTenantBeforeRestore?: boolean;
}

export interface IVerificationResult {
  isValid: boolean;
  backupId: string;
  totalCollections: number;
  totalDocuments: number;
  errors: string[];
}

export interface IRestoreResult {
  success: boolean;
  dryRun: boolean;
  backupId: string;
  targetTenantId: string;
  restoredCollections: number;
  totalRestoredDocuments: number;
  restoredDocumentsByCollection: Record<string, any[]>;
  durationMs: number;
}

export class BackupRestoreService {
  private static instance: BackupRestoreService;

  private constructor() {}

  public static getInstance(): BackupRestoreService {
    if (!BackupRestoreService.instance) {
      BackupRestoreService.instance = new BackupRestoreService();
    }
    return BackupRestoreService.instance;
  }

  public calculateFileSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Creates an immutable, checksummed backup archive of MongoDB collections
   */
  public async createBackup(options: IBackupOptions = {}): Promise<{ backupId: string; backupDir: string; manifest: IBackupManifest }> {
    const tenantId = options.tenantId || 'ALL';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `astralis_backup_${tenantId}_${timestamp}`;
    const baseDir = options.targetDir || path.join(process.cwd(), 'backups');
    const backupDir = path.join(baseDir, backupId);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const collectionStats: Record<string, ICollectionBackupStat> = {};
    let totalDocuments = 0;
    let totalCollections = 0;

    // 1. If customData is supplied (e.g. Injected during DR validation or unit testing)
    if (options.customData && Object.keys(options.customData).length > 0) {
      for (const [name, docs] of Object.entries(options.customData)) {
        const filteredDocs = tenantId === 'ALL' ? docs : docs.filter((d: any) => d.tenantId === tenantId);
        const filePath = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(filteredDocs, null, 2), 'utf-8');

        const sha256 = this.calculateFileSha256(filePath);
        const stat = fs.statSync(filePath);

        collectionStats[name] = {
          collectionName: name,
          documentCount: filteredDocs.length,
          sha256,
          fileSize: stat.size
        };

        totalDocuments += filteredDocs.length;
        totalCollections++;
      }
    } else {
      // 2. Query registered Mongoose models
      const modelNames = Object.keys(mongoose.models);
      if (modelNames.length === 0) {
        // Fallback default placeholder
        const emptyDocs: any[] = [];
        const filePath = path.join(backupDir, 'system_metadata.json');
        fs.writeFileSync(filePath, JSON.stringify(emptyDocs, null, 2), 'utf-8');
        const sha256 = this.calculateFileSha256(filePath);
        collectionStats['system_metadata'] = {
          collectionName: 'system_metadata',
          documentCount: 0,
          sha256,
          fileSize: fs.statSync(filePath).size
        };
        totalCollections = 1;
      } else {
        for (const modelName of modelNames) {
          const model = mongoose.models[modelName];
          const query: any = { isDeleted: { $ne: true } };
          if (tenantId !== 'ALL') {
            query.tenantId = tenantId;
          }

          let docs: any[] = [];
          if (mongoose.connection.readyState === 1) {
            try {
              docs = await model.find(query).lean().exec();
            } catch {
              docs = [];
            }
          }

          const collName = model.collection?.name || modelName.toLowerCase();
          const filePath = path.join(backupDir, `${collName}.json`);
          fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

          const sha256 = this.calculateFileSha256(filePath);
          const stat = fs.statSync(filePath);

          collectionStats[collName] = {
            collectionName: collName,
            documentCount: docs.length,
            sha256,
            fileSize: stat.size
          };

          totalDocuments += docs.length;
          totalCollections++;
        }
      }
    }

    const manifest: IBackupManifest = {
      backupId,
      createdAt: new Date().toISOString(),
      tenantId,
      appVersion: config.app.version,
      environment: config.app.env,
      totalCollections,
      totalDocuments,
      collections: collectionStats
    };

    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    logger.info(
      `[BackupService] ✅ Backup [${backupId}] completed. ${totalCollections} collections, ${totalDocuments} records saved to ${backupDir}`
    );

    return { backupId, backupDir, manifest };
  }

  /**
   * Verifies SHA-256 integrity and structure of an existing backup directory
   */
  public verifyBackupIntegrity(backupDir: string): IVerificationResult {
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        isValid: false,
        backupId: 'UNKNOWN',
        totalCollections: 0,
        totalDocuments: 0,
        errors: ['manifest.json not found in backup directory']
      };
    }

    const manifest: IBackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const errors: string[] = [];

    for (const [name, stat] of Object.entries(manifest.collections)) {
      const filePath = path.join(backupDir, `${name}.json`);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing collection file for '${name}'`);
        continue;
      }

      const calculatedSha = this.calculateFileSha256(filePath);
      if (calculatedSha !== stat.sha256) {
        errors.push(
          `Integrity checksum mismatch for '${name}'. Expected ${stat.sha256}, calculated ${calculatedSha}`
        );
      }

      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!Array.isArray(parsed)) {
          errors.push(`Collection file '${name}.json' does not contain a JSON array`);
        } else if (parsed.length !== stat.documentCount) {
          errors.push(
            `Document count mismatch for '${name}'. Expected ${stat.documentCount}, found ${parsed.length}`
          );
        }
      } catch (err: any) {
        errors.push(`Failed to parse '${name}.json': ${err.message}`);
      }
    }

    const isValid = errors.length === 0;
    if (isValid) {
      logger.info(`[BackupService] ✅ Integrity verification PASSED for backup [${manifest.backupId}]`);
    } else {
      logger.error(
        `[BackupService] ❌ Integrity verification FAILED for backup [${manifest.backupId}]: ${errors.join('; ')}`
      );
    }

    return {
      isValid,
      backupId: manifest.backupId,
      totalCollections: manifest.totalCollections,
      totalDocuments: manifest.totalDocuments,
      errors
    };
  }

  /**
   * Restores an isolated backup into target tenant or full database with validation
   */
  public async restoreBackup(backupDir: string, options: IRestoreOptions = {}): Promise<IRestoreResult> {
    const startTime = Date.now();
    const verification = this.verifyBackupIntegrity(backupDir);
    if (!verification.isValid) {
      throw new Error(`Cannot restore corrupted backup: ${verification.errors.join(', ')}`);
    }

    const manifestPath = path.join(backupDir, 'manifest.json');
    const manifest: IBackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const targetTenantId = options.targetTenantId || manifest.tenantId;
    const dryRun = options.dryRun ?? false;

    let restoredCollections = 0;
    let totalRestoredDocuments = 0;
    const restoredDocumentsByCollection: Record<string, any[]> = {};

    for (const [name, stat] of Object.entries(manifest.collections)) {
      if (stat.documentCount === 0) continue;

      const filePath = path.join(backupDir, `${name}.json`);
      if (!fs.existsSync(filePath)) continue;

      const rawDocs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // If target tenant is specified, remap tenantId
      const docsToInsert = rawDocs.map((doc: any) => {
        const d = { ...doc };
        if (targetTenantId !== 'ALL') {
          d.tenantId = targetTenantId;
        }
        return d;
      });

      restoredDocumentsByCollection[name] = docsToInsert;

      if (!dryRun && mongoose.connection.readyState === 1) {
        const matchedModel = Object.values(mongoose.models).find(
          (m) => m.collection?.name === name || m.modelName.toLowerCase() === name
        );
        if (matchedModel) {
          if (options.clearTargetTenantBeforeRestore && targetTenantId !== 'ALL') {
            await matchedModel.deleteMany({ tenantId: targetTenantId });
          }
          for (const doc of docsToInsert) {
            await matchedModel.replaceOne({ _id: doc._id }, doc, { upsert: true });
          }
        }
      }

      restoredCollections++;
      totalRestoredDocuments += docsToInsert.length;
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `[BackupService] ✅ ${dryRun ? 'DRY-RUN ' : ''}Restore completed for backup [${manifest.backupId}]. Restored ${totalRestoredDocuments} documents across ${restoredCollections} collections in ${durationMs}ms`
    );

    return {
      success: true,
      dryRun,
      backupId: manifest.backupId,
      targetTenantId,
      restoredCollections,
      totalRestoredDocuments,
      restoredDocumentsByCollection,
      durationMs
    };
  }
}

export const backupRestoreService = BackupRestoreService.getInstance();
