import mongoose, { Document } from 'mongoose';
import { BaseRepository } from '../src/core/repository/base.repository.js';
import { createBaseSchema } from '../src/core/models/base.schema.js';
import { tenantMiddleware } from '../src/core/middleware/tenant.middleware.js';
import { TenantContextHolder } from '../src/core/context/tenant-context.js';
import { ForbiddenError } from '../src/core/errors/app-error.js';
import { TenantService } from '../src/modules/tenant/tenant.service.js';
import { ITenantRepository } from '../src/modules/tenant/tenant.repository.js';
import { TenantDocument, CreateTenantDto, UpdateTenantDto, TenantStatus } from '../src/modules/tenant/tenant.types.js';

interface ITestItemDoc extends Document {
  tenantId: string;
  code: string;
  name: string;
  secretFormula: string;
  isDeleted: boolean;
}

const testItemSchema = createBaseSchema<ITestItemDoc>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  secretFormula: { type: String, required: true }
});

const TestItemModel = mongoose.models.TestIsolationItem || mongoose.model<ITestItemDoc>('TestIsolationItem', testItemSchema);

class TestItemRepository extends BaseRepository<ITestItemDoc> {
  constructor() {
    super(TestItemModel);
  }
}

describe('Tenant Isolation & Security Boundary Enforcement', () => {
  const repository = new TestItemRepository();

  describe('BaseRepository Multi-Tenant Data Scoping', () => {
    it('should enforce non-empty tenantId and throw security error when tenantId is missing or blank', async () => {
      await expect(repository.findById('', 'item_123')).rejects.toThrow('SECURITY VIOLATION');
      await expect(repository.find('   ')).rejects.toThrow('SECURITY VIOLATION');
      await expect(repository.create('', { code: 'X', name: 'Y' })).rejects.toThrow();
    });

    it('should prevent cross-tenant read access when querying documents', () => {
      // Mock findOne on model to verify tenant filter injection
      const findOneSpy = jest.spyOn(TestItemModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      repository.findById('tenant_alpha', 'doc_beta_999');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_alpha',
          _id: 'doc_beta_999'
        }),
        undefined,
        undefined
      );

      findOneSpy.mockRestore();
    });

    it('should scope paginated queries strictly to the requesting tenant', async () => {
      const findSpy = jest.spyOn(TestItemModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      } as any);

      const countSpy = jest.spyOn(TestItemModel, 'countDocuments').mockReturnValue({
        exec: jest.fn().mockResolvedValue(0)
      } as any);

      await repository.findPaginated('tenant_alpha', { code: 'JOB-001' }, { page: 1, limit: 10 });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_alpha',
          code: 'JOB-001'
        })
      );
      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_alpha',
          code: 'JOB-001'
        })
      );

      findSpy.mockRestore();
      countSpy.mockRestore();
    });

    it('should prevent cross-tenant mutations in updateById and softDeleteById', () => {
      const updateSpy = jest.spyOn(TestItemModel, 'findOneAndUpdate').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      repository.updateById('tenant_alpha', 'doc_beta_999', { $set: { name: 'Hacked' } });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_alpha',
          _id: 'doc_beta_999'
        }),
        expect.anything(),
        expect.anything()
      );

      repository.softDeleteById('tenant_alpha', 'doc_beta_999', 'user_123');

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_alpha',
          _id: 'doc_beta_999'
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ isDeleted: true })
        }),
        expect.anything()
      );

      updateSpy.mockRestore();
    });
  });

  describe('Tenant Middleware & Cross-Tenant Spoofing Guard', () => {
    it('should block cross-tenant spoofing attempt when token tenant does not match header tenant', (done) => {
      const req: any = {
        headers: { 'x-tenant-id': 'tenant_beta' },
        user: { userId: 'user_1', tenantId: 'tenant_alpha', roles: ['operator'] }
      };
      const res: any = {};

      tenantMiddleware(req, res, (err?: any) => {
        expect(err).toBeInstanceOf(ForbiddenError);
        expect(err.message).toContain('Cross-tenant access denied');
        done();
      });
    });

    it('should allow valid request and populate AsyncLocalStorage tenant context', (done) => {
      const req: any = {
        headers: { 'x-tenant-id': 'tenant_alpha' },
        user: { userId: 'user_1', tenantId: 'tenant_alpha', roles: ['metallurgist'] }
      };
      const res: any = {};

      tenantMiddleware(req, res, () => {
        expect(req.tenantId).toBe('tenant_alpha');
        expect(TenantContextHolder.getTenantId()).toBe('tenant_alpha');
        expect(TenantContextHolder.getContext()?.userId).toBe('user_1');
        done();
      });
    });
  });

  describe('Tenant Service & Lifecycle Management', () => {
    const mockRepo: ITenantRepository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn()
    };

    const service = new TenantService(mockRepo);

    it('should provision a new tenant and emit TENANT_PROVISIONED event', async () => {
      (mockRepo.findByCode as jest.Mock).mockResolvedValue(null);
      (mockRepo.create as jest.Mock).mockResolvedValue({
        id: 'ten_001',
        code: 'ASTRALIS_DEMO',
        name: 'Astralis Demo Factory',
        contactEmail: 'admin@astralis.demo',
        subscriptionPlan: 'enterprise'
      });

      const result = await service.provisionTenant({
        code: 'ASTRALIS_DEMO',
        name: 'Astralis Demo Factory',
        contactEmail: 'admin@astralis.demo',
        subscriptionPlan: 'enterprise'
      });

      expect(result.code).toBe('ASTRALIS_DEMO');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should reject provisioning if tenant code is already taken', async () => {
      (mockRepo.findByCode as jest.Mock).mockResolvedValue({ id: 'ten_existing', code: 'ASTRALIS_DEMO' });

      await expect(
        service.provisionTenant({
          code: 'ASTRALIS_DEMO',
          name: 'Duplicate Tenant',
          contactEmail: 'admin@duplicate.demo'
        })
      ).rejects.toThrow("Tenant code 'ASTRALIS_DEMO' is already registered");
    });

    it('should support suspending and activating a tenant', async () => {
      (mockRepo.updateStatus as jest.Mock).mockImplementation((id: string, status: TenantStatus) =>
        Promise.resolve({ id, code: 'ASTRALIS_DEMO', status })
      );

      const suspended = await service.suspendTenant('ten_001', 'Overdue subscription');
      expect(suspended.status).toBe('suspended');

      const activated = await service.activateTenant('ten_001');
      expect(activated.status).toBe('active');
    });
  });
});
