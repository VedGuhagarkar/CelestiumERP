import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const addressSchema = z.object({
  plantName: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1, 'Street is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().min(1, 'Country is required').max(100),
  gstNumber: z.string().trim().max(30).optional()
});

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(100).optional(),
  isPrimary: z.boolean().optional()
});

const processingDefaultsSchema = z.object({
  defaultHardnessInspectionRequirement: z.string().trim().max(200).optional(),
  defaultMicrostructureRequired: z.boolean().optional(),
  defaultCocRequired: z.boolean().optional(),
  defaultPackagingInstructions: z.string().trim().max(500).optional(),
  defaultRustPreventiveRequired: z.boolean().optional()
});

export const createCustomerSchema: ValidationSchema = {
  body: z.object({
    customerCode: z
      .string()
      .trim()
      .min(2, 'Customer code must be at least 2 characters')
      .max(20, 'Customer code must not exceed 20 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Customer code must contain only uppercase letters, numbers, hyphens, and underscores')
      .toUpperCase(),
    companyName: z.string().trim().min(2, 'Company name is required').max(150),
    tradeName: z.string().trim().max(150).optional(),
    industrySegment: z.enum([
      'Aerospace',
      'Automotive',
      'Heavy Engineering',
      'Tool & Die',
      'Oil & Gas',
      'Defense',
      'General',
      'Other'
    ]),
    qualityApprovals: z.array(z.string().trim()).optional(),
    qualityStatus: z.enum(['approved', 'conditional', 'suspended', 'blacklisted', 'inactive']).optional(),
    contacts: z.array(contactSchema).min(1, 'At least one contact is required'),
    billingAddress: addressSchema,
    shippingAddresses: z.array(addressSchema).optional(),
    taxDetails: z
      .object({
        gstin: z.string().trim().max(30).optional(),
        pan: z.string().trim().max(20).optional(),
        taxId: z.string().trim().max(50).optional()
      })
      .optional(),
    paymentTerms: z.string().trim().max(100).optional(),
    processingDefaults: processingDefaultsSchema.optional(),
    notes: z.string().trim().max(1000).optional()
  })
};

export const updateCustomerSchema: ValidationSchema = {
  body: z.object({
    customerCode: z.string().trim().optional(),
    companyName: z.string().trim().min(2).max(150).optional(),
    tradeName: z.string().trim().max(150).optional(),
    industrySegment: z
      .enum(['Aerospace', 'Automotive', 'Heavy Engineering', 'Tool & Die', 'Oil & Gas', 'Defense', 'General', 'Other'])
      .optional(),
    qualityApprovals: z.array(z.string().trim()).optional(),
    qualityStatus: z.enum(['approved', 'conditional', 'suspended', 'blacklisted', 'inactive']).optional(),
    contacts: z.array(contactSchema).min(1).optional(),
    billingAddress: addressSchema.optional(),
    shippingAddresses: z.array(addressSchema).optional(),
    taxDetails: z
      .object({
        gstin: z.string().trim().max(30).optional(),
        pan: z.string().trim().max(20).optional(),
        taxId: z.string().trim().max(50).optional()
      })
      .optional(),
    paymentTerms: z.string().trim().max(100).optional(),
    processingDefaults: processingDefaultsSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Customer ID is required')
  })
};

export const updateCustomerStatusSchema: ValidationSchema = {
  body: z.object({
    status: z.enum(['active', 'inactive', 'archived'])
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Customer ID is required')
  })
};

export const queryCustomerSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    industrySegment: z.string().trim().optional(),
    qualityStatus: z.string().trim().optional(),
    status: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
