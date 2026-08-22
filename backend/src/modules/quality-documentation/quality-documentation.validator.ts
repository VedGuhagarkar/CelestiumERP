import { z } from 'zod';

export const ReportTypeEnum = z.enum([
  'TEST_REPORT',
  'CERTIFICATE_OF_CONFORMANCE',
  'COMBINED_METALLURGICAL_REPORT'
]);

export const DocumentStatusEnum = z.enum(['DRAFT', 'ISSUED', 'SUPERSEDED', 'REVOKED']);

export const generateQualityDocumentSchema = z.object({
  inspectionId: z.string().min(1, 'Inspection ID is required'),
  reportType: ReportTypeEnum,
  purchaseOrderNumber: z.string().max(100).optional(),
  partNumber: z.string().max(100).optional(),
  drawingNumber: z.string().max(100).optional(),
  drawingRevision: z.string().max(50).optional(),
  customRemarks: z.string().max(1000).optional(),
  additionalStandards: z.array(z.string().min(2)).optional()
});

export const revokeQualityDocumentSchema = z.object({
  reason: z.string().min(5, 'Mandatory revocation reason is required').max(1000)
});

export const reissueQualityDocumentSchema = z.object({
  changeDescription: z.string().min(5, 'Detailed description of changes required for document re-issuance').max(1000),
  purchaseOrderNumber: z.string().max(100).optional(),
  partNumber: z.string().max(100).optional(),
  drawingNumber: z.string().max(100).optional(),
  drawingRevision: z.string().max(50).optional(),
  customRemarks: z.string().max(1000).optional()
});

export const queryQualityDocumentsSchema = z.object({
  reportType: ReportTypeEnum.optional(),
  status: DocumentStatusEnum.optional(),
  jobId: z.string().optional(),
  inspectionId: z.string().optional(),
  customerCode: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
