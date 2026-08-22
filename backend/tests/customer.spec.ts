import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Customer & Factory Master Data Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockCustomerPayload = {
    customerCode: 'CUST-AERO-001',
    companyName: 'AeroTurbine Precision Components Ltd.',
    tradeName: 'AeroTurbine',
    industrySegment: 'Aerospace',
    qualityApprovals: ['AS9100', 'NADCAP', 'ISO9001'],
    qualityStatus: 'approved',
    contacts: [
      {
        name: 'David Vance',
        email: 'dvance@aeroturbine.com',
        phone: '+1-555-0192',
        designation: 'VP Quality & Metallurgy',
        isPrimary: true
      }
    ],
    billingAddress: {
      street: '100 Aerospace Blvd, Suite 400',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'USA',
      gstNumber: 'GST-US-WA-981'
    },
    shippingAddresses: [
      {
        plantName: 'Seattle Turbine Plant 1',
        street: '102 Industrial Way',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98108',
        country: 'USA'
      }
    ],
    taxDetails: {
      taxId: 'US-TAX-8849201'
    },
    paymentTerms: 'Net 45',
    processingDefaults: {
      defaultHardnessInspectionRequirement: '100% Core & Case Hardness Inspection',
      defaultMicrostructureRequired: true,
      defaultCocRequired: true,
      defaultPackagingInstructions: 'VCI paper wrapped and wooden crate packaging',
      defaultRustPreventiveRequired: true
    },
    notes: 'Primary aerospace customer for turbine blade heat-treatment'
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/customers (Registration)', () => {
    it('should successfully create a new customer and log an audit record', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(customerRepository, 'create').mockResolvedValue({
        ...mockCustomerPayload,
        id: 'cust_mock_001',
        tenantId: testTenant,
        activeJobCount: 0,
        totalJobCount: 0,
        status: 'active',
        toJSON: () => ({ ...mockCustomerPayload, id: 'cust_mock_001', tenantId: testTenant })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/customers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockCustomerPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerCode).toBe('CUST-AERO-001');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'CUSTOMER_CREATED',
          entityType: 'Customer'
        })
      );
    });

    it('should reject creation with duplicate customer code under the tenant', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue({
        id: 'cust_existing_001',
        customerCode: 'CUST-AERO-001'
      } as any);

      const res = await request(app)
        .post('/api/v1/customers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockCustomerPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject creation with missing required fields (e.g. no contacts)', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      const invalidPayload = { ...mockCustomerPayload, contacts: [] };

      const res = await request(app)
        .post('/api/v1/customers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Request validation failed');
    });
  });

  describe('GET /api/v1/customers (Search & Retrieval)', () => {
    it('should retrieve customer by ID', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue({
        id: 'cust_001',
        tenantId: testTenant,
        ...mockCustomerPayload
      } as any);

      const res = await request(app)
        .get('/api/v1/customers/cust_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerCode).toBe('CUST-AERO-001');
    });

    it('should retrieve customer by unique Customer Code', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue({
        id: 'cust_001',
        tenantId: testTenant,
        ...mockCustomerPayload
      } as any);

      const res = await request(app)
        .get('/api/v1/customers/code/CUST-AERO-001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companyName).toBe(mockCustomerPayload.companyName);
    });

    it('should perform paginated search with industry and status filters', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'searchCustomers').mockResolvedValue({
        items: [{ id: 'cust_001', tenantId: testTenant, ...mockCustomerPayload } as any],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/customers?industrySegment=Aerospace&search=Turbine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('PUT /api/v1/customers/:id (Updates & Traceability Guards)', () => {
    it('should update mutable customer fields and log audit diff', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      const mockExistingCustomer: any = {
        id: 'cust_001',
        tenantId: testTenant,
        customerCode: 'CUST-AERO-001',
        paymentTerms: 'Net 30',
        toJSON: () => ({ customerCode: 'CUST-AERO-001', paymentTerms: 'Net 30' })
      };

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockExistingCustomer);
      jest.spyOn(customerRepository, 'updateById').mockResolvedValue({
        ...mockExistingCustomer,
        paymentTerms: 'Net 60',
        toJSON: () => ({ customerCode: 'CUST-AERO-001', paymentTerms: 'Net 60' })
      });

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .put('/api/v1/customers/cust_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentTerms: 'Net 60' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'CUSTOMER_UPDATED'
        })
      );
    });

    it('should reject attempts to mutate customerCode after creation', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue({
        id: 'cust_001',
        tenantId: testTenant,
        customerCode: 'CUST-AERO-001',
        toJSON: () => ({ customerCode: 'CUST-AERO-001' })
      } as any);

      const res = await request(app)
        .put('/api/v1/customers/cust_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerCode: 'ALTERED-CODE-999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Customer Code is immutable');
    });
  });

  describe('Controlled Deactivation & Archiving', () => {
    it('should reject deactivation/archival if customer has active in-progress jobs', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue({
        id: 'cust_001',
        tenantId: testTenant,
        customerCode: 'CUST-AERO-001',
        activeJobCount: 3, // ACTIVE JOBS RUNNING!
        toJSON: () => ({ customerCode: 'CUST-AERO-001', activeJobCount: 3 })
      } as any);

      const res = await request(app)
        .patch('/api/v1/customers/cust_001/status')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('active jobs are currently in process');
    });

    it('should archive customer when no active jobs remain and preserve historical references', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue({
        id: 'cust_001',
        tenantId: testTenant,
        customerCode: 'CUST-AERO-001',
        activeJobCount: 0,
        status: 'active',
        toJSON: () => ({ customerCode: 'CUST-AERO-001', activeJobCount: 0, status: 'active' })
      } as any);

      const updateSpy = jest.spyOn(customerRepository, 'updateById').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .delete('/api/v1/customers/cust_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(testTenant, 'cust_001', {
        $set: { status: 'archived', isDeleted: true }
      });
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block user lacking CUSTOMER_VIEW permission from searching customers', async () => {
      const unauthorizedToken = generateToken('usr_unauth', ['FURNACE_OPERATOR']);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockResolvedValue([
        DEFAULT_FACTORY_ROLES.find((r) => r.code === 'FURNACE_OPERATOR') as any
      ]);

      const res = await request(app)
        .get('/api/v1/customers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
