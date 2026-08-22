import { Schema, IndexOptions } from 'mongoose';

/**
 * Standard Multi-Tenant Index Factory & Validator
 *
 * ARCHITECTURAL INDEXING CONVENTIONS FOR ASTRALIS ERP:
 * 1. Multi-Tenant Prefix: All business collection indexes MUST include { tenantId: 1 } as the first field.
 * 2. Soft-Delete Acceleration: Query-heavy collections MUST combine { tenantId: 1, isDeleted: 1, [field]: 1 }.
 * 3. Traceability Genealogy: Heat-treatment tracking indexes MUST link (tenantId + heatNumber + lotNumber + jobCardId).
 * 4. Unique Constraints: Unique business codes MUST be scoped by tenantId (e.g. { tenantId: 1, code: 1 }, { unique: true }).
 * 5. TTL Indexes: Ephemeral logs or idempotency keys must define { expireAfterSeconds: ... }.
 *
 * Reference: CelestiumERP.md Section 1.5, Section 1.9 & Section 6.2
 */

export interface TenantCompoundIndexDefinition {
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: IndexOptions;
}

export class IndexRegistry {
  /**
   * Helper to attach a tenant-scoped unique business code index to a Mongoose schema
   */
  public static addTenantUniqueIndex(
    schema: Schema,
    field: string,
    options: IndexOptions = {}
  ): void {
    schema.index(
      { tenantId: 1, [field]: 1 },
      { unique: true, sparse: false, ...options }
    );
  }

  /**
   * Helper to attach a tenant-scoped status & soft-delete compound index for high-velocity lookups
   */
  public static addStatusFilterIndex(
    schema: Schema,
    statusField = 'status',
    extraFields: Record<string, 1 | -1> = {}
  ): void {
    schema.index({
      tenantId: 1,
      isDeleted: 1,
      [statusField]: 1,
      ...extraFields
    });
  }

  /**
   * Helper to attach heat-lot metallurgical traceability compound indexes
   */
  public static addTraceabilityGenealogyIndex(
    schema: Schema,
    extraFields: Record<string, 1 | -1> = {}
  ): void {
    schema.index({
      tenantId: 1,
      heatNumber: 1,
      lotNumber: 1,
      jobCardNumber: 1,
      ...extraFields
    });
  }

  /**
   * Helper to attach furnace / equipment scheduling timeline indexes
   */
  public static addFurnaceScheduleIndex(
    schema: Schema,
    extraFields: Record<string, 1 | -1> = {}
  ): void {
    schema.index({
      tenantId: 1,
      furnaceId: 1,
      scheduledStartTime: 1,
      scheduledEndTime: 1,
      ...extraFields
    });
  }
}
