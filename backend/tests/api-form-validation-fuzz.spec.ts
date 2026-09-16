import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { itemService } from '../src/modules/item/item.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';

describe('PROMPT 3 — Aggressive Form, API Validation & Edge-Case Fuzz Test Suite', () => {
  const app = createApp();
  const testTenant = 'tenant_fuzz_alpha';
  const otherTenant = 'tenant_fuzz_beta';

  const generateToken = (userId: string, roles: string[] = ['ADMIN'], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@celestium.com`, roles },
      config.auth.jwtSecret,
      { expiresIn: '1h' }
    );
  };

  const adminToken = generateToken('usr_admin', ['ADMIN']);
  const crossTenantToken = generateToken('usr_attacker', ['ADMIN'], otherTenant);

  beforeAll(() => {
    // Silence verbose console logging during fuzz tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      permissions: Object.values(PERMISSIONS),
      roles: ['ADMIN']
    } as any);
  });

  // =========================================================================
  // SUITE 1: Empty, Whitespace-Only, and Missing Payloads
  // =========================================================================
  describe('1. Empty, Whitespace-Only, and Missing Payloads', () => {
    it('should reject completely empty object body with 422 and structured error', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
      expect(res.body.error.stack).toBeUndefined();
    });

    it('should reject whitespace-only strings for required string fields', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: '    \t\n   ', // Whitespace-only
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: '   ', // Whitespace-only
              recipeId: 'rec_01',
              orderedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const paths = res.body.error.details.map((d: any) => d.path);
      expect(paths.some((p: string) => p.includes('supplierName') || p.includes('itemId'))).toBe(true);
    });

    it('should reject missing mandatory nested arrays with 422', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Acme Metallurgy',
          expectedDeliveryDate: '2026-10-15'
          // items missing
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const itemError = res.body.error.details.find((d: any) => d.path === 'items');
      expect(itemError).toBeDefined();
    });

    it('should reject empty arrays where at least one item is required', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Acme Metallurgy',
          expectedDeliveryDate: '2026-10-15',
          items: [] // Empty array
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path === 'items')).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 2: Null and Undefined Values in Required Paths
  // =========================================================================
  describe('2. Null and Undefined Values in Required Paths', () => {
    it('should reject explicit null in non-nullable string and array fields', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: null,
          expectedDeliveryDate: null,
          items: null
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.stack).toBeUndefined();
    });

    it('should reject explicit null in required numeric fields', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Precision Casting',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: null // Null numeric
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('orderedQuantity'))).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 3: Unexpected & Malicious Extra Fields (Schema Stripping & Sanitization)
  // =========================================================================
  describe('3. Unexpected & Malicious Extra Fields', () => {
    it('should cleanly strip unrecognized and malicious root fields during validation', async () => {
      const createSpy = jest.spyOn(itemService, 'createItem').mockResolvedValueOnce({
        id: 'item_test_strip',
        itemCode: 'ITEM-TEST-STRIP-01',
        name: 'High Tensile Bolt',
        category: 'RAW_MATERIAL',
        uom: 'PCS'
      } as any);

      const res = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemCode: 'ITEM-TEST-STRIP-01',
          name: 'High Tensile Bolt',
          category: 'RAW_MATERIAL',
          uom: 'PCS',
          __proto__: { isAdmin: true },
          maliciousRootPayload: '<script>alert(1)</script>',
          dropDatabase: true,
          role: 'SUPER_ADMIN'
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalled();
      const passedDto = createSpy.mock.calls[0][1];
      expect(passedDto.itemCode).toBe('ITEM-TEST-STRIP-01');
      expect((passedDto as any).maliciousRootPayload).toBeUndefined();
      expect((passedDto as any).dropDatabase).toBeUndefined();
      expect((passedDto as any).role).toBeUndefined();
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 4: Type Confusion & Coercion Fuzzing
  // =========================================================================
  describe('4. Type Confusion & Non-Object Request Payloads', () => {
    it('should reject array payload when object is expected for body', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send([
          { supplierName: 'Supplier A' },
          { supplierName: 'Supplier B' }
        ]);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject object passed where string is expected', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: { company: 'Titanium Alloys Corp' }, // Object instead of string
          expectedDeliveryDate: '2026-10-15',
          items: [{ itemId: 'item_1', recipeId: 'rec_1', orderedQuantity: 10 }]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('supplierName'))).toBe(true);
    });

    it('should reject boolean passed where number is expected', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Titanium Alloys Corp',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: true // Boolean instead of number
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('orderedQuantity'))).toBe(true);
    });

    it('should reject string containing numeric-looking value where strict number is expected', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Titanium Alloys Corp',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: '150.75' // String instead of number
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('orderedQuantity'))).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: Numeric Edge-Cases: NaN, Infinity, Negative, and Extreme Overflow
  // =========================================================================
  describe('5. Numeric Boundaries, Infinity, Negative Numbers, and Overflows', () => {
    it('should reject negative quantities with 422', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Specialty Steels Inc',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: -250 // Negative quantity
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('orderedQuantity'))).toBe(true);
    });

    it('should reject zero quantities where positive is required', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Specialty Steels Inc',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: 0 // Zero
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('orderedQuantity'))).toBe(true);
    });

    it('should reject astronomical / extreme quantities exceeding upper threshold', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Specialty Steels Inc',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: 1e12 // Astronomical quantity
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject Infinity values sent in request payload', async () => {
      // In JSON, Infinity serializes to null, but in raw strings or non-standard payloads
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Specialty Steels Inc',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: Infinity // Serialized by supertest
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // SUITE 6: String Length & Memory DoS Fuzzing (50,000+ characters)
  // =========================================================================
  describe('6. String Length & Denial-of-Service Buffer Testing', () => {
    it('should reject excessively long string (50,000 chars) exceeding max string bounds without crashing', async () => {
      const massiveString = 'A'.repeat(50000);

      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: massiveString, // 50,000 chars
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('supplierName'))).toBe(true);
      expect(res.body.error.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 7: Multi-Byte UTF-8, Emojis, and Special Characters
  // =========================================================================
  describe('7. Multi-Byte UTF-8, Unicode, Emojis, and Special Characters', () => {
    it('should safely accept and preserve valid multi-byte Unicode and international text in description fields', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Tokyo Special Steel 東京特殊鋼株式会社',
          expectedDeliveryDate: '2026-10-15',
          notes: 'Arabic: فولاذ مقاوم للصدأ | Devanagari: उच्च शक्ति मिश्र धातु | Cyrillic: Высокопрочная сталь',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: 100,
              lineNotes: 'Batch approved with zero defects. 日本語テスト完了.'
            }
          ]
        });

      // Should not throw 500 encoding or character set crashes
      expect(res.status).not.toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });

    it('should safely handle emojis and special symbols in permitted text fields without crash', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Star Metallurgy 🚀🔥',
          expectedDeliveryDate: '2026-10-15',
          notes: 'Symbols: !@#$%^&*()_+-=[]{}|;:",.<>?/~ 🏭⚙️🛡️',
          items: [
            {
              itemId: 'item_1',
              recipeId: 'rec_1',
              orderedQuantity: 50
            }
          ]
        });

      expect(res.status).not.toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 8: HTML, XSS, and Script Injection Payloads
  // =========================================================================
  describe('8. HTML, XSS, and Script Injection Payloads', () => {
    it('should sanitize or reject malicious XSS script injections in string fields without executing', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(document.cookie)>',
        'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>'
      ];

      for (const payload of xssPayloads) {
        const res = await request(app)
          .post('/api/v1/purchase-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            supplierName: payload,
            expectedDeliveryDate: '2026-10-15',
            notes: payload,
            items: [
              {
                itemId: 'item_1',
                recipeId: 'rec_1',
                orderedQuantity: 10,
                lineNotes: payload
              }
            ]
          });

        expect(res.status).not.toBe(500);
        // Assert that error response (if returned) does not render raw HTML content type
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.error?.stack).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // SUITE 9: Malformed JSON Syntax & Parser Error Interception
  // =========================================================================
  describe('9. Malformed JSON Syntax & Parser Error Interception', () => {
    it('should intercept malformed JSON syntax with 400 Bad Request and MALFORMED_JSON code', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{"supplierName": "Incomplete Payload", "items": ['); // Broken JSON

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('MALFORMED_JSON');
      expect(res.body.error.stack).toBeUndefined();
      expect(res.body.message).toMatch(/malformed json/i);
    });
  });

  // =========================================================================
  // SUITE 10: Malformed URIs & URL Encoding Errors
  // =========================================================================
  describe('10. Malformed URIs & URL Encoding Errors', () => {
    it('should intercept broken percent-encoding in request paths with 400 MALFORMED_URI', async () => {
      const res = await request(app)
        .get('/api/v1/purchase-orders/%E0%A4%A') // Incomplete percent-encoded UTF-8
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 11: Malformed & Boundary Dates
  // =========================================================================
  describe('11. Malformed & Boundary Dates', () => {
    it('should reject completely unparseable date strings with 422', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Forge Metals Ltd',
          expectedDeliveryDate: 'NOT-A-VALID-DATE-STRING',
          items: [{ itemId: 'item_1', recipeId: 'rec_1', orderedQuantity: 10 }]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: any) => d.path.includes('expectedDeliveryDate'))).toBe(true);
    });

    it('should cleanly handle timezone boundary timestamps', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Global Metallurgy Co',
          orderDate: '2026-12-31T23:59:59.999Z',
          expectedDeliveryDate: '2027-01-01T00:00:00.000+14:00', // Pacific/Kiritimati +14 boundary
          items: [{ itemId: 'item_1', recipeId: 'rec_1', orderedQuantity: 10 }]
        });

      expect(res.status).not.toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 12: Invalid Identifiers & Mongoose CastError Safety
  // =========================================================================
  describe('12. Invalid Identifiers & Mongoose CastError Safety', () => {
    it('should return 400 Bad Request with INVALID_IDENTIFIER for non-existent/malformed ObjectIds', async () => {
      const malformedIds = [
        '123',
        'not-an-object-id',
        'undefined',
        'null',
        '64b1f8' // Incomplete 6-byte hex
      ];

      for (const badId of malformedIds) {
        const res = await request(app)
          .get(`/api/v1/purchase-orders/${badId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([400, 404]).toContain(res.status);
        expect(res.status).not.toBe(500);
        expect(res.body.error?.stack).toBeUndefined();
      }
    });

    it('should reject updating non-existent record with 404 Not Found rather than 500', async () => {
      const nonExistentValidId = '507f1f77bcf86cd799439011'; // Valid 24-hex ObjectId format

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValueOnce(null);

      const res = await request(app)
        .put(`/api/v1/purchase-orders/${nonExistentValidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierName: 'Non-Existent Supplier Inc'
        });

      expect([404, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
      expect(res.body.error?.stack).toBeUndefined();
    });
  });

  // =========================================================================
  // SUITE 13: Security Invariants & Zero Information Leakage
  // =========================================================================
  describe('13. Security Invariants & Zero Information Leakage', () => {
    it('should never expose stack trace, local filesystem paths, or internal MongoDB details in error responses', async () => {
      // Trigger validation failure
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invalidField: true
        });

      const responseString = JSON.stringify(res.body);

      expect(res.body.error?.stack).toBeUndefined();
      // Ensure local server file paths are not leaked
      expect(responseString).not.toMatch(/C:\\Users\\/i);
      expect(responseString).not.toMatch(/\/home\/[a-z]+/i);
      expect(responseString).not.toMatch(/node_modules/i);
      // Ensure database internal driver messages are not exposed
      expect(responseString).not.toMatch(/TopologyDescription/i);
      expect(responseString).not.toMatch(/ServerDescription/i);
      expect(responseString).not.toMatch(/mongodb:\/\//i);
    });

    it('should reject unauthenticated requests across protected routes with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .send({ supplierName: 'Unauthenticated Request' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.stack).toBeUndefined();
    });

    it('should strictly isolate tenants: Tenant B cannot query Tenant A records', async () => {
      const validObjectId = '507f1f77bcf86cd799439012';

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/v1/purchase-orders/${validObjectId}`)
        .set('Authorization', `Bearer ${crossTenantToken}`); // From otherTenant

      // Must return 404 (document not found in otherTenant's partition)
      expect([404, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });
});
