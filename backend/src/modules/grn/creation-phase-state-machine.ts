import { BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import {
  MaterialReceiptStatus,
  GRNStatus,
  GRNUnitStatus
} from './grn.types.js';
import { PurchaseOrderStatus } from '../purchase-order/purchase-order.types.js';

/**
 * Authoritative Creation Phase States
 * Lifecycle: PO_CREATED -> MATERIAL_RECEIVED -> MATERIAL_STORED -> GRN_CREATED -> CREATION_COMPLETE -> AVAILABLE_FOR_PLANNING
 */
export enum CreationPhaseStage {
  PO_CREATED = 'PO_CREATED',
  MATERIAL_RECEIVED = 'MATERIAL_RECEIVED',
  MATERIAL_STORED = 'MATERIAL_STORED',
  GRN_CREATED = 'GRN_CREATED',
  CREATION_COMPLETE = 'CREATION_COMPLETE',
  AVAILABLE_FOR_PLANNING = 'AVAILABLE_FOR_PLANNING',
  ALLOCATED_TO_PLAN = 'ALLOCATED_TO_PLAN'
}

/**
 * Valid Entity State Transitions in the Creation Phase
 */
export const CREATION_PHASE_TRANSITIONS = {
  // 1. Purchase Order Transitions
  PURCHASE_ORDER: {
    DRAFT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'],
    RECEIVED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: []
  },

  // 2. Material Receipt Transitions
  MATERIAL_RECEIPT: {
    RECEIVED: ['PARTIALLY_STORED', 'STORED'],
    PARTIALLY_STORED: ['PARTIALLY_STORED', 'STORED'],
    STORED: ['GRN_CREATED'],
    GRN_CREATED: []
  },

  // 3. Goods Receipt Note (GRN) Transitions
  GRN: {
    ISSUED: ['PRINTED', 'AVAILABLE_FOR_PLANNING'],
    PRINTED: ['AVAILABLE_FOR_PLANNING'],
    AVAILABLE_FOR_PLANNING: []
  },

  // 4. Material/Part Unit Transitions
  UNIT: {
    AVAILABLE_FOR_PLANNING: ['ALLOCATED_TO_PLAN'],
    ALLOCATED_TO_PLAN: ['IN_PRODUCTION'],
    IN_PRODUCTION: ['CONSUMED'],
    CONSUMED: []
  }
} as const;

/**
 * Creation Phase State Machine Engine
 * Enforces single authoritative linear lifecycle with zero state skipping.
 */
export class CreationPhaseStateMachine {
  /**
   * 1. Assert PO is eligible for Material Receipt
   * Stage: PO_CREATED -> MATERIAL_RECEIVED
   */
  public static assertPoEligibleForReceipt(po: {
    id?: string;
    _id?: any;
    poNumber: string;
    status: PurchaseOrderStatus | string;
    isDeleted?: boolean;
    items?: any[];
  }): void {
    if (!po) {
      throw new BadRequestError('A valid Purchase Order reference is required to receive material.');
    }
    if (po.isDeleted) {
      throw new BadRequestError(`Cannot receive material against deleted Purchase Order '${po.poNumber}'.`);
    }
    if (po.status === 'DRAFT') {
      throw new BadRequestError(
        `Cannot record material receipt against Purchase Order in 'DRAFT' status. PO must be issued first.`
      );
    }
    if (po.status === 'CLOSED' || po.status === 'CANCELLED') {
      throw new BadRequestError(
        `Cannot record material receipt against Purchase Order in '${po.status}' status`
      );
    }
    const eligibleStatuses = ['ISSUED', 'PARTIALLY_RECEIVED'];
    if (!eligibleStatuses.includes(po.status)) {
      throw new BadRequestError(
        `Purchase Order '${po.poNumber}' status '${po.status}' is not eligible for material receipt. Required: [${eligibleStatuses.join(', ')}].`
      );
    }
    if (!po.items || po.items.length === 0) {
      throw new BadRequestError(`Purchase Order '${po.poNumber}' has no line items.`);
    }
  }

  /**
   * 2. Assert Material Receipt is eligible for Warehouse Storage / Putaway
   * Stage: MATERIAL_RECEIVED -> MATERIAL_STORED
   */
  public static assertReceiptEligibleForStorage(
    receipt: {
      id?: string;
      _id?: any;
      receiptNumber: string;
      status: MaterialReceiptStatus | string;
      remainingQuantityToStore?: number;
      totalReceivedQuantity?: number;
    },
    putawayQuantity: number
  ): void {
    if (!receipt) {
      throw new BadRequestError(
        'Material Receipt does not exist. Material must be received at factory gate before warehouse storage.'
      );
    }

    if (receipt.status === 'STORED' || receipt.status === 'GRN_CREATED') {
      throw new BadRequestError(
        `Duplicate storage: Material receipt [${receipt.receiptNumber}] has already been fully stored into the warehouse.`
      );
    }

    const eligibleReceiptStatuses = ['RECEIVED', 'PARTIALLY_STORED'];
    if (!eligibleReceiptStatuses.includes(receipt.status)) {
      throw new BadRequestError(
        `Cannot store material receipt in '${receipt.status}' status. Only newly received or partially stored material can be stored.`
      );
    }

    if (putawayQuantity <= 0) {
      throw new BadRequestError('Storage quantity must be greater than zero');
    }

    const remaining = receipt.remainingQuantityToStore ?? receipt.totalReceivedQuantity ?? 0;
    if (putawayQuantity > remaining) {
      throw new BadRequestError(
        `Storage quantity [${putawayQuantity}] exceeds available received balance [${remaining}]`
      );
    }
  }

  /**
   * 3. Assert Material Receipt is eligible for GRN Creation
   * Stage: MATERIAL_STORED -> GRN_CREATED
   */
  public static assertReceiptEligibleForGRN(
    receipt: {
      id?: string;
      _id?: any;
      receiptNumber: string;
      status: MaterialReceiptStatus | string;
      warehouseId?: string;
      warehouseCode?: string;
      storageLocationCode?: string;
    },
    po?: { id?: string; _id?: any; poNumber: string; status: string }
  ): void {
    if (!receipt) {
      throw new BadRequestError(
        'A valid Material Receipt reference is required to create a Goods Receipt Note.'
      );
    }

    if (receipt.status === 'GRN_CREATED') {
      throw new ConflictError(
        `Duplicate GRN: Material receipt [${receipt.receiptNumber}] has already had a GRN created (status: GRN_CREATED). Duplicate GRN generation is rejected.`
      );
    }

    if (receipt.status !== 'STORED') {
      throw new BadRequestError(
        `Cannot create GRN for material receipt in '${receipt.status}' status. Material must be stored in the warehouse first.`
      );
    }

    if (!receipt.warehouseId || !receipt.warehouseCode || !receipt.storageLocationCode) {
      throw new BadRequestError(
        'Material receipt lacks verified warehouse storage allocation'
      );
    }

    if (po) {
      const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
      if (!eligiblePoStatuses.includes(po.status)) {
        throw new BadRequestError(
          `Purchase Order '${po.poNumber}' is in '${po.status}' status and is not eligible for GRN creation. Only ISSUED, PARTIALLY_RECEIVED, or RECEIVED purchase orders may generate goods receipt notes.`
        );
      }
    }
  }

  /**
   * 4. Assert Unit is eligible for Planning Phase
   * Stage: GRN_CREATED / AVAILABLE_FOR_PLANNING -> ALLOCATED_TO_PLAN
   */
  public static assertUnitEligibleForPlanning(unit: {
    unitIdentifier: string;
    status: GRNUnitStatus | string;
    allocatedPlanId?: string;
  }): void {
    if (!unit) {
      throw new BadRequestError('State Machine Violation: Unit does not exist.');
    }

    if (unit.status !== 'AVAILABLE_FOR_PLANNING') {
      throw new BadRequestError(
        `State Machine Violation [INVALID_STATE_TRANSITION]: Unit '${unit.unitIdentifier}' cannot be allocated to planning. Current status is '${unit.status}'. Only units in 'AVAILABLE_FOR_PLANNING' status may be allocated.`
      );
    }

    if (unit.allocatedPlanId) {
      throw new ConflictError(
        `State Machine Violation [DUPLICATE_TRANSITION]: Unit '${unit.unitIdentifier}' is already allocated to plan '${unit.allocatedPlanId}'.`
      );
    }
  }

  /**
   * 5. Assert Unit Immutability (Locked genealogy protection)
   * Prevents rewriting PO, GRN, Item, Recipe, or Heat Lot once allocated or in-production
   */
  public static assertUnitImmutability(unit: {
    unitIdentifier: string;
    status: GRNUnitStatus | string;
  }): void {
    if (unit.status !== 'AVAILABLE_FOR_PLANNING') {
      throw new BadRequestError(
        `State Machine Violation [LOCKED_RELATIONSHIP]: Unit '${unit.unitIdentifier}' has progressed into downstream lifecycle (status: '${unit.status}'). Its parent PO, GRN, Item, and Recipe genealogy is permanently locked and immutable.`
      );
    }
  }

  /**
   * 6. Get Complete State Machine Definition metadata for UI display
   */
  public static getLifecycleMetadata() {
    return {
      name: 'Authoritative Creation Phase State Machine',
      sequence: [
        CreationPhaseStage.PO_CREATED,
        CreationPhaseStage.MATERIAL_RECEIVED,
        CreationPhaseStage.MATERIAL_STORED,
        CreationPhaseStage.GRN_CREATED,
        CreationPhaseStage.CREATION_COMPLETE,
        CreationPhaseStage.AVAILABLE_FOR_PLANNING,
        CreationPhaseStage.ALLOCATED_TO_PLAN
      ],
      stages: [
        CreationPhaseStage.PO_CREATED,
        CreationPhaseStage.MATERIAL_RECEIVED,
        CreationPhaseStage.MATERIAL_STORED,
        CreationPhaseStage.GRN_CREATED,
        CreationPhaseStage.CREATION_COMPLETE,
        CreationPhaseStage.AVAILABLE_FOR_PLANNING
      ],
      transitions: {
        [CreationPhaseStage.PO_CREATED]: [CreationPhaseStage.MATERIAL_RECEIVED],
        [CreationPhaseStage.MATERIAL_RECEIVED]: [CreationPhaseStage.MATERIAL_STORED],
        [CreationPhaseStage.MATERIAL_STORED]: [CreationPhaseStage.GRN_CREATED],
        [CreationPhaseStage.GRN_CREATED]: [CreationPhaseStage.CREATION_COMPLETE],
        [CreationPhaseStage.CREATION_COMPLETE]: [CreationPhaseStage.AVAILABLE_FOR_PLANNING],
        [CreationPhaseStage.AVAILABLE_FOR_PLANNING]: ['ALLOCATED_TO_PLAN']
      },
      entityTransitions: CREATION_PHASE_TRANSITIONS,
      enforcement: 'SERVER_SIDE_STRICT',
      immutabilityGate: 'ALLOCATED_TO_PLAN',
      immutabilityRule: 'Locked and immutable once allocated to planning'
    };
  }
}
