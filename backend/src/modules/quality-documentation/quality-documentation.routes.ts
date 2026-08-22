import { Router } from 'express';
import { qualityDocumentationController } from './quality-documentation.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  generateQualityDocumentSchema,
  revokeQualityDocumentSchema,
  queryQualityDocumentsSchema
} from './quality-documentation.validator.js';

export const qualityDocumentationRouter = Router();

// Public or Authenticated Security Token Verification Route
qualityDocumentationRouter.get(
  '/verify/:code',
  qualityDocumentationController.verifyDocument
);

qualityDocumentationRouter.use(authenticateJwt);

// Generate Test Report / CoC
qualityDocumentationRouter.post(
  '/',
  requireAnyPermission(
    PERMISSIONS.QUALITY_COC_GENERATE,
    PERMISSIONS.QUALITY_COC_APPROVE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: generateQualityDocumentSchema }),
  qualityDocumentationController.generateDocument
);

// Query Quality Documents
qualityDocumentationRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  validateRequest({ query: queryQualityDocumentsSchema }),
  qualityDocumentationController.queryDocuments
);

// Get Quality Document by ID
qualityDocumentationRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  qualityDocumentationController.getDocumentById
);

// Get Quality Document by Number
qualityDocumentationRouter.get(
  '/number/:documentNumber',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  qualityDocumentationController.getDocumentByNumber
);

// Revoke Quality Document
qualityDocumentationRouter.post(
  '/:id/revoke',
  requireAnyPermission(
    PERMISSIONS.QUALITY_COC_REVOKE,
    PERMISSIONS.QUALITY_COC_APPROVE
  ),
  validateRequest({ body: revokeQualityDocumentSchema }),
  qualityDocumentationController.revokeDocument
);
