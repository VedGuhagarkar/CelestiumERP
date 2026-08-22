import { Document } from 'mongoose';
import { ProcessFamily, HardnessScale, RecipeStatus } from '../recipe/recipe.types.js';

export interface HardnessRequirement {
  min: number;
  max: number;
  scale: HardnessScale;
  testMethodReference?: string;
  testLocations?: string[];
}

export interface CaseDepthRequirement {
  effectiveCaseDepthMinMm?: number;
  effectiveCaseDepthMaxMm?: number;
  caseDepthCutoffHRC?: number;
  totalCaseDepthMinMm?: number;
  totalCaseDepthMaxMm?: number;
  testMethodReference?: string;
}

export interface MicrostructuralCriteria {
  matrixStructure: string;
  maxRetainedAustenitePercent?: number;
  maxCarbideNetworkRating?: string;
  decarburizationLimitMm?: number;
  intergranularOxidationLimitMm?: number;
}

export interface CustomerAcceptanceCriteria {
  samplingPlan: string;
  cocRequired: boolean;
  micrographRequired: boolean;
  destructiveCouponRequired: boolean;
  testStandardReferences: string[];
}

export interface ISpecification {
  tenantId: string;
  specCode: string;
  revision: number;
  title: string;
  description?: string;
  customerId?: string;
  customerCode?: string;
  applicableMaterialGrades: string[];
  processFamily: ProcessFamily;
  surfaceHardness: HardnessRequirement;
  coreHardness?: HardnessRequirement;
  caseDepth?: CaseDepthRequirement;
  microstructure?: MicrostructuralCriteria;
  customerAcceptance: CustomerAcceptanceCriteria;
  authorId: string;
  status: RecipeStatus;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
    comments?: string;
  };
  rejectionReason?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  referencedJobCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecificationDocument extends ISpecification, Document {}

export interface CreateSpecificationDto {
  specCode: string;
  title: string;
  description?: string;
  customerId?: string;
  customerCode?: string;
  applicableMaterialGrades: string[];
  processFamily: ProcessFamily;
  surfaceHardness: HardnessRequirement;
  coreHardness?: HardnessRequirement;
  caseDepth?: CaseDepthRequirement;
  microstructure?: MicrostructuralCriteria;
  customerAcceptance: CustomerAcceptanceCriteria;
}

export interface UpdateSpecificationDto {
  title?: string;
  description?: string;
  customerId?: string;
  customerCode?: string;
  applicableMaterialGrades?: string[];
  processFamily?: ProcessFamily;
  surfaceHardness?: HardnessRequirement;
  coreHardness?: HardnessRequirement;
  caseDepth?: CaseDepthRequirement;
  microstructure?: MicrostructuralCriteria;
  customerAcceptance?: CustomerAcceptanceCriteria;
}

export interface ApproveSpecificationDto {
  comments?: string;
}

export interface RejectSpecificationDto {
  rejectionReason: string;
}

export interface SpecificationFilterQuery {
  search?: string;
  customerId?: string;
  customerCode?: string;
  processFamily?: ProcessFamily;
  materialGrade?: string;
  status?: RecipeStatus;
}
