import { Router } from 'express';
import { dispatchController } from './dispatch.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createDispatchSchema,
  createOutwardChallanSchema,
  verifyDispatchQualitySchema,
  scheduleDispatchSchema,
  approveDispatchSchema,
  authorizeDispatchSchema,
  departDispatchSchema,
  physicalDispatchSchema,
  deliverDispatchSchema,
  customerAcknowledgementSchema,
  cancelDispatchSchema,
  queryDispatchesSchema
} from './dispatch.validator.js';

export const dispatchRouter = Router();

dispatchRouter.use(authenticateJwt);

// Dedicated Dispatch Queue Route (Waiting for Dispatch)
dispatchRouter.get(
  '/queue',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.INVENTORY_WAREHOUSE_VIEW,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  dispatchController.getDispatchQueue
);

dispatchRouter.get(
  '/waiting-for-dispatch',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.INVENTORY_WAREHOUSE_VIEW,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  dispatchController.getDispatchQueue
);

// Dedicated Outward Challan (OC) Creation Route (PO -> GRN -> BO -> OC)
dispatchRouter.post(
  '/outward-challan',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_CREATE,
    PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE
  ),
  validateRequest({ body: createOutwardChallanSchema }),
  dispatchController.createOutwardChallan
);

// 1. Create Dispatch Consignment (DRAFT)
dispatchRouter.post(
  '/',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_CREATE,
    PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE
  ),
  validateRequest({ body: createDispatchSchema }),
  dispatchController.createDispatch
);

// 2. Query Dispatches
dispatchRouter.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.INVENTORY_WAREHOUSE_VIEW
  ),
  validateRequest({ query: queryDispatchesSchema }),
  dispatchController.queryDispatches
);

// 3. Get Dispatch by Number
dispatchRouter.get(
  '/number/:dispatchNumber',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.INVENTORY_WAREHOUSE_VIEW
  ),
  dispatchController.getDispatchByNumber
);

// 4. Get Dispatch by ID
dispatchRouter.get(
  '/:id',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.INVENTORY_WAREHOUSE_VIEW
  ),
  dispatchController.getDispatchById
);

// 5. Verify Quality & Document Compliance
dispatchRouter.post(
  '/:id/verify-quality',
  requireAnyPermission(
    PERMISSIONS.QUALITY_COC_APPROVE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  validateRequest({ body: verifyDispatchQualitySchema }),
  dispatchController.verifyQuality
);

// 6. Schedule Dispatch (Carrier, Vehicle, Driver, Departure Time)
dispatchRouter.post(
  '/:id/schedule',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_CREATE,
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH
  ),
  validateRequest({ body: scheduleDispatchSchema }),
  dispatchController.scheduleDispatch
);

// 7. Approve Dispatch & Issue Gate Pass
dispatchRouter.post(
  '/:id/approve',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: approveDispatchSchema }),
  dispatchController.approveDispatch
);

// 7b. Dedicated Outward Challan Authorization
dispatchRouter.post(
  '/:id/authorize',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: authorizeDispatchSchema }),
  dispatchController.authorizeOutwardChallan
);

dispatchRouter.post(
  '/outward-challan/:id/authorize',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: authorizeDispatchSchema }),
  dispatchController.authorizeOutwardChallan
);

// 8. Record Physical Departure (Gate Clearance & Stock Deduction)
dispatchRouter.post(
  '/:id/depart',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: departDispatchSchema }),
  dispatchController.recordDeparture
);

// 8b. Complete Physical Dispatch (Transport Validation, Storage Release & BO Dispatched Transition)
dispatchRouter.post(
  '/:id/dispatch',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: physicalDispatchSchema }),
  dispatchController.completePhysicalDispatch
);

dispatchRouter.post(
  '/outward-challan/:id/dispatch',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ),
  validateRequest({ body: physicalDispatchSchema }),
  dispatchController.completePhysicalDispatch
);

// 9. Confirm Customer Delivery & Log POD
dispatchRouter.post(
  '/:id/deliver',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  validateRequest({ body: deliverDispatchSchema }),
  dispatchController.confirmDelivery
);

// 9b. Dedicated Customer Acknowledgement
dispatchRouter.post(
  '/:id/acknowledge',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  validateRequest({ body: customerAcknowledgementSchema }),
  dispatchController.recordCustomerAcknowledgement
);

dispatchRouter.post(
  '/outward-challan/:id/acknowledge',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_DELIVERY_CREATE
  ),
  validateRequest({ body: customerAcknowledgementSchema }),
  dispatchController.recordCustomerAcknowledgement
);

// 10. Controlled Cancellation & Stock Release
dispatchRouter.post(
  '/:id/cancel',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_CREATE,
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH
  ),
  validateRequest({ body: cancelDispatchSchema }),
  dispatchController.cancelDispatch
);
