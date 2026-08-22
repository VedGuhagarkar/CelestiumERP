import mongoose, { Document } from 'mongoose';
import { dbConnection } from '../src/core/database/connection.js';
import { getDatabaseHealth } from '../src/core/database/health.js';
import { withTransaction, TransactionManager } from '../src/core/database/transaction.js';
import { createBaseSchema } from '../src/core/models/base.schema.js';
import { IndexRegistry } from '../src/core/database/index-registry.js';

interface ITestDoc extends Document {
  tenantId: string;
  code: string;
  name: string;
  status: string;
  isDeleted: boolean;
}

describe('MongoDB Database Infrastructure & Reusable Conventions', () => {
  it('should verify database connection state management and lifecycle methods', () => {
    expect(dbConnection).toBeDefined();
    const stateName = dbConnection.getConnectionStateName();
    expect(['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized']).toContain(stateName);
  });

  it('should perform deep database health check diagnostics', async () => {
    const health = await getDatabaseHealth();

    expect(health).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.connectionState).toBeDefined();
  });

  it('should correctly inject tenantId, soft-delete, and clean JSON transforms in createBaseSchema', () => {
    const testSchema = createBaseSchema<ITestDoc>({
      code: { type: String, required: true },
      name: { type: String, required: true },
      status: { type: String, default: 'active' }
    });

    // Verify tenantId path is defined and required
    const tenantPath = testSchema.path('tenantId');
    expect(tenantPath).toBeDefined();
    expect((tenantPath as any).isRequired).toBe(true);

    // Verify soft-delete plugin added isDeleted path
    const isDeletedPath = testSchema.path('isDeleted');
    expect(isDeletedPath).toBeDefined();

    // Verify JSON transform cleans _id and __v and adds id
    const TestModel = mongoose.models.TestSchemaDoc || mongoose.model<ITestDoc>('TestSchemaDoc', testSchema);
    const doc = new TestModel({
      tenantId: 'tenant_test_001',
      code: 'TEST-001',
      name: 'Sample Item'
    });

    const json = doc.toJSON();
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.tenantId).toBe('tenant_test_001');
    expect(json.code).toBe('TEST-001');
  });

  it('should apply standard multi-tenant compound indexes via IndexRegistry', () => {
    const schema = createBaseSchema<ITestDoc>({
      code: { type: String, required: true },
      name: { type: String, required: true }
    });

    IndexRegistry.addTenantUniqueIndex(schema, 'code');
    IndexRegistry.addStatusFilterIndex(schema, 'status');
    IndexRegistry.addTraceabilityGenealogyIndex(schema);
    IndexRegistry.addFurnaceScheduleIndex(schema);

    const indexes = schema.indexes();
    expect(indexes.length).toBeGreaterThanOrEqual(4);

    // Verify unique tenant code index
    const uniqueIndex = indexes.find(([fields]) => fields.tenantId === 1 && fields.code === 1);
    expect(uniqueIndex).toBeDefined();
    if (uniqueIndex) {
      expect(uniqueIndex[1]?.unique).toBe(true);
    }

    // Verify status filter index
    const statusIndex = indexes.find(([fields]) => fields.tenantId === 1 && fields.isDeleted === 1 && fields.status === 1);
    expect(statusIndex).toBeDefined();

    // Verify traceability genealogy index
    const genealogyIndex = indexes.find(([fields]) => fields.heatNumber === 1 && fields.jobCardNumber === 1);
    expect(genealogyIndex).toBeDefined();
  });

  it('should provide withTransaction and TransactionManager utility', () => {
    expect(typeof withTransaction).toBe('function');
    expect(typeof TransactionManager.execute).toBe('function');
  });
});
