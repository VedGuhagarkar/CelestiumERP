import { Document } from 'mongoose';

export type CustomerQualityStatus = 'approved' | 'conditional' | 'suspended' | 'blacklisted' | 'inactive';

export type IndustrySegment =
  | 'Aerospace'
  | 'Automotive'
  | 'Heavy Engineering'
  | 'Tool & Die'
  | 'Oil & Gas'
  | 'Defense'
  | 'General'
  | 'Other';

export interface CustomerContact {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface CustomerAddress {
  plantName?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstNumber?: string;
}

export interface JobProcessingDefaults {
  defaultHardnessInspectionRequirement?: string;
  defaultMicrostructureRequired?: boolean;
  defaultCocRequired?: boolean;
  defaultPackagingInstructions?: string;
  defaultRustPreventiveRequired?: boolean;
}

export interface ICustomer {
  tenantId: string;
  customerCode: string;
  companyName: string;
  tradeName?: string;
  industrySegment: IndustrySegment;
  qualityApprovals: string[];
  qualityStatus: CustomerQualityStatus;
  contacts: CustomerContact[];
  billingAddress: CustomerAddress;
  shippingAddresses: CustomerAddress[];
  taxDetails: {
    gstin?: string;
    pan?: string;
    taxId?: string;
  };
  paymentTerms?: string;
  processingDefaults: JobProcessingDefaults;
  activeJobCount: number;
  totalJobCount: number;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerDocument extends ICustomer, Document {}

export interface CreateCustomerDto {
  customerCode: string;
  companyName: string;
  tradeName?: string;
  industrySegment: IndustrySegment;
  qualityApprovals?: string[];
  qualityStatus?: CustomerQualityStatus;
  contacts: CustomerContact[];
  billingAddress: CustomerAddress;
  shippingAddresses?: CustomerAddress[];
  taxDetails?: {
    gstin?: string;
    pan?: string;
    taxId?: string;
  };
  paymentTerms?: string;
  processingDefaults?: JobProcessingDefaults;
  notes?: string;
}

export interface UpdateCustomerDto {
  companyName?: string;
  tradeName?: string;
  industrySegment?: IndustrySegment;
  qualityApprovals?: string[];
  qualityStatus?: CustomerQualityStatus;
  contacts?: CustomerContact[];
  billingAddress?: CustomerAddress;
  shippingAddresses?: CustomerAddress[];
  taxDetails?: {
    gstin?: string;
    pan?: string;
    taxId?: string;
  };
  paymentTerms?: string;
  processingDefaults?: JobProcessingDefaults;
  notes?: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface CustomerFilterQuery {
  search?: string;
  industrySegment?: IndustrySegment;
  qualityStatus?: CustomerQualityStatus;
  status?: 'active' | 'inactive' | 'archived';
  hasActiveJobs?: boolean;
}
