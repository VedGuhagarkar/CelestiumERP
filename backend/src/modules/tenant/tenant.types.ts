import { Document } from 'mongoose';

export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'archived';

export type SubscriptionPlan = 'standard' | 'professional' | 'enterprise';

export interface PyrometryStandardsConfig {
  enableAms2750g: boolean;
  enableCqi9: boolean;
  defaultThermocoupleCalibrationDays: number;
  defaultSatIntervalDays: number;
  defaultTusIntervalDays: number;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  defaultTemperatureUnit: 'C' | 'F';
  defaultHardnessScale: 'HRC' | 'HB' | 'HV' | 'HRB';
  pyrometry: PyrometryStandardsConfig;
}

export interface ITenant {
  code: string;
  name: string;
  legalName?: string;
  taxId?: string;
  status: TenantStatus;
  subscriptionPlan: SubscriptionPlan;
  contactEmail: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  settings: TenantSettings;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantDocument extends ITenant, Document {}

export interface CreateTenantDto {
  code: string;
  name: string;
  legalName?: string;
  taxId?: string;
  subscriptionPlan?: SubscriptionPlan;
  contactEmail: string;
  contactPhone?: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantDto {
  name?: string;
  legalName?: string;
  taxId?: string;
  subscriptionPlan?: SubscriptionPlan;
  contactEmail?: string;
  contactPhone?: string;
  settings?: Partial<TenantSettings>;
}
