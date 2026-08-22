import { Router } from 'express';
import { ncrCapaController } from './ncr-capa.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createNcrSchema,
  recordNcrRootCauseSchema,
  recordNcrDispositionSchema,
  closeNcrSchema,
  createCapaSchema,
  updateCapaActionItemSchema,
  verifyCapaEffectivenessSchema,
  closeCapaSchema,
  queryNcrsSchema,
  queryCapasSchema
} from './ncr-capa.validator.js';

// ==========================================
// NCR Router: /api/v1/ncrs
// ==========================================
export const ncrRouter = Router();

ncrRouter.use(authenticateJwt);

// Create Non-Conformance Report
ncrRouter.post(
  '/',
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  validateRequest({ body: createNcrSchema }),
  ncrCapaController.createNcr
);

// Query Non-Conformance Reports
ncrRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  validateRequest({ query: queryNcrsSchema }),
  ncrCapaController.queryNcrs
);

// Get NCR Details by ID
ncrRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  ncrCapaController.getNcrById
);

// Record Root Cause Analysis
ncrRouter.put(
  '/:id/root-cause',
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  validateRequest({ body: recordNcrRootCauseSchema }),
  ncrCapaController.recordRootCause
);

// Record MRB Disposition
ncrRouter.post(
  '/:id/disposition',
  requirePermission(PERMISSIONS.QUALITY_DISPOSITION_MANAGE),
  validateRequest({ body: recordNcrDispositionSchema }),
  ncrCapaController.recordDisposition
);

// Close Non-Conformance Report
ncrRouter.post(
  '/:id/close',
  requireAnyPermission(
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_COC_APPROVE
  ),
  validateRequest({ body: closeNcrSchema }),
  ncrCapaController.closeNcr
);

// Initiate CAPA from NCR
ncrRouter.post(
  '/:ncrId/capas',
  requireAnyPermission(
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: createCapaSchema }),
  ncrCapaController.createCapa
);

// ==========================================
// CAPA Router: /api/v1/capas
// ==========================================
export const capaRouter = Router();

capaRouter.use(authenticateJwt);

// Query CAPAs
capaRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  validateRequest({ query: queryCapasSchema }),
  ncrCapaController.queryCapas
);

// Get CAPA Details by ID
capaRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  ncrCapaController.getCapaById
);

// Update CAPA Action Item
capaRouter.put(
  '/:id/action-items',
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  validateRequest({ body: updateCapaActionItemSchema }),
  ncrCapaController.updateActionItem
);

// Record Effectiveness Verification
capaRouter.post(
  '/:id/verify',
  requirePermission(PERMISSIONS.QUALITY_DISPOSITION_MANAGE),
  validateRequest({ body: verifyCapaEffectivenessSchema }),
  ncrCapaController.verifyEffectiveness
);

// Close CAPA
capaRouter.post(
  '/:id/close',
  requireAnyPermission(
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_COC_APPROVE
  ),
  validateRequest({ body: closeCapaSchema }),
  ncrCapaController.closeCapa
);
