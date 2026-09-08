import { BaseService } from '../../core/services/base.service.js';
import { IPurchaseOrderRepository, purchaseOrderRepository } from './purchase-order.repository.js';
import { itemService, ItemService } from '../item/item.service.js';
import { recipeService, RecipeService } from '../recipe/recipe.service.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { rbacService, RbacService } from '../rbac/rbac.service.js';
import {
  PurchaseOrderDocument,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
  IPurchaseOrderItem,
  PurchaseOrderStatus
} from './purchase-order.types.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../core/errors/app-error.js';
import { DomainEvents } from '../../core/constants/events.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export interface ActorContext {
  userId: string;
  email?: string;
  roles?: string[];
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class PurchaseOrderService extends BaseService {
  constructor(
    private readonly repo: IPurchaseOrderRepository = purchaseOrderRepository,
    private readonly items: ItemService = itemService,
    private readonly recipes: RecipeService = recipeService,
    private readonly audit: AuditService = auditService,
    private readonly rbac: RbacService = rbacService
  ) {
    super('PurchaseOrderService');
  }

  /**
   * Creates an authoritative Purchase Order (PO) binding Item/Part to its required Recipe.
   * Enforces server-side permissions, idempotency, monotonic ID generation, and metallurgical grade compatibility.
   */
  public async createOrder(
    tenantId: string,
    dto: CreatePurchaseOrderDto,
    actor: ActorContext
  ): Promise<PurchaseOrderDocument> {
    // 0. Permission Enforcement (Dynamic RBAC Check - requires PURCHASE_ORDER_CREATE)
    const effectiveRoles = actor.roles && actor.roles.length > 0
      ? actor.roles
      : (actor.role ? [actor.role] : []);

    const isSuperAdmin = effectiveRoles.some((r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN');
    if (!isSuperAdmin) {
      if (effectiveRoles.length === 0) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.PURCHASE_ORDER_CREATE}' to create Purchase Orders`
        );
      }
      const userPerms = await this.rbac.getUserEffectivePermissions(tenantId, actor.userId, effectiveRoles);
      if (!userPerms.permissions.includes(PERMISSIONS.PURCHASE_ORDER_CREATE)) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.PURCHASE_ORDER_CREATE}' to create Purchase Orders`
        );
      }
    }

    // 1. Idempotency & Duplicate Submission Check
    if (dto.idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(tenantId, dto.idempotencyKey);
      if (existing) {
        this.logger.info(
          `♻️ Idempotency replay: Returning existing Purchase Order [${existing.poNumber}] for key '${dto.idempotencyKey}'`
        );
        return existing;
      }
    }

    const orderDate = dto.orderDate ? new Date(dto.orderDate) : new Date();
    const expectedDelivery = new Date(dto.expectedDeliveryDate);

    if (expectedDelivery < orderDate) {
      throw new BadRequestError('Expected delivery date cannot precede order date');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestError('At least one item must be included in the Purchase Order');
    }

    const processedItems: IPurchaseOrderItem[] = [];
    let totalOrdered = 0;
    let subtotalAmount = 0;

    for (let i = 0; i < dto.items.length; i++) {
      const itemDto = dto.items[i];

      if (!itemDto.orderedQuantity || itemDto.orderedQuantity <= 0) {
        throw new BadRequestError(`Ordered quantity for item index ${i} must be greater than zero`);
      }

      // 2. Authoritative Item Master Resolution
      const item = await this.items.getItemById(tenantId, itemDto.itemId);
      if (!item) {
        throw new NotFoundError(`Item with ID '${itemDto.itemId}' not found in Item Master`);
      }
      if (item.status !== 'active') {
        throw new BadRequestError(
          `Cannot create PO with item '${item.itemCode}' in '${item.status}' status. Only active items are permitted.`
        );
      }

      // 3. Authoritative Recipe Resolution
      const recipe = await this.recipes.getRecipeById(tenantId, itemDto.recipeId);
      if (!recipe) {
        throw new NotFoundError(`Recipe with ID '${itemDto.recipeId}' not found in Recipe Master`);
      }
      if (recipe.status !== 'APPROVED' && recipe.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Cannot create PO with recipe '${recipe.recipeCode}' in '${recipe.status}' status. Only APPROVED or ACTIVE recipes are permitted.`
        );
      }

      // 4. Metallurgical Grade Compatibility Cross-Check
      if (
        recipe.applicableMaterialGrades &&
        recipe.applicableMaterialGrades.length > 0 &&
        item.materialGrade &&
        !recipe.applicableMaterialGrades.includes(item.materialGrade)
      ) {
        throw new BadRequestError(
          `Material grade mismatch for item '${item.itemCode}': Item grade '${item.materialGrade}' is not compatible with Recipe '${recipe.recipeCode}' grades [${recipe.applicableMaterialGrades.join(', ')}]`
        );
      }

      if (itemDto.unitPrice !== undefined && itemDto.unitPrice < 0) {
        throw new BadRequestError(`Unit price for item index ${i} cannot be negative`);
      }
      const unitPrice = itemDto.unitPrice !== undefined ? itemDto.unitPrice : 0;
      const lineTotal = Number((itemDto.orderedQuantity * unitPrice).toFixed(2));
      const lineItemId = `line_${i + 1}_${Date.now()}`;
      totalOrdered += itemDto.orderedQuantity;
      subtotalAmount += lineTotal;

      processedItems.push({
        lineItemId,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        materialGrade: item.materialGrade || 'GENERIC',
        processFamily: recipe.processFamily,
        processingRequirement: itemDto.processingRequirement?.trim(),
        recipeId: recipe.id,
        recipeCode: recipe.recipeCode,
        recipeRevision: recipe.revision,
        orderedQuantity: itemDto.orderedQuantity,
        receivedQuantity: 0,
        uom: item.uom,
        unitPrice,
        lineTotal,
        lineNotes: itemDto.lineNotes?.trim()
      });
    }

    const taxAmount = dto.taxAmount !== undefined && dto.taxAmount >= 0 ? dto.taxAmount : 0;
    const totalAmount = Number((subtotalAmount + taxAmount).toFixed(2));

    // 5. Sequential Monotonic ID Generation (PO-YYYYMM-XXXX)
    const poNumber = await this.repo.generateNextPoNumber(tenantId);

    const po = await this.repo.create(tenantId, {
      poNumber,
      idempotencyKey: dto.idempotencyKey?.trim(),
      supplierName: dto.supplierName.trim(),
      supplierCode: dto.supplierCode ? dto.supplierCode.toUpperCase().trim() : undefined,
      vendorAddress: dto.vendorAddress?.trim(),
      contactEmail: dto.contactEmail?.trim(),
      contactPhone: dto.contactPhone?.trim(),
      orderDate,
      expectedDeliveryDate: expectedDelivery,
      status: 'ISSUED',
      items: processedItems,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: 0,
      currency: dto.currency ? dto.currency.toUpperCase().trim() : 'USD',
      paymentTerms: dto.paymentTerms?.trim(),
      deliveryTerms: dto.deliveryTerms?.trim(),
      subtotalAmount,
      taxAmount,
      totalAmount,
      notes: dto.notes?.trim(),
      createdById: actor.userId,
      createdByName: actor.email,
      isDeleted: false
    });

    this.logger.info(
      `📋 Purchase Order created: [${po.poNumber}] Supplier: "${po.supplierName}" (${po.items?.length || 0} items, Total: ${po.currency} ${po.totalAmount}) on tenant [${tenantId}]`
    );

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role || actor.roles?.[0],
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      afterState: typeof po.toJSON === 'function' ? po.toJSON() : po,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.PO_CREATED, tenantId, {
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      totalItems: po.items.length,
      totalOrderedQuantity: po.totalOrderedQuantity,
      totalAmount: po.totalAmount,
      currency: po.currency
    });

    return po;
  }

  /**
   * Retrieves a Purchase Order by ID
   */
  public async getOrderById(tenantId: string, id: string): Promise<PurchaseOrderDocument> {
    const po = await this.repo.findById(tenantId, id);
    if (!po) {
      throw new NotFoundError(`Purchase Order with ID '${id}' not found`);
    }
    return po;
  }

  /**
   * Retrieves a Purchase Order by PO Number (e.g. PO-202609-0001)
   */
  public async getOrderByPoNumber(tenantId: string, poNumber: string): Promise<PurchaseOrderDocument> {
    const po = await this.repo.findByPoNumber(tenantId, poNumber);
    if (!po) {
      throw new NotFoundError(`Purchase Order with number '${poNumber}' not found`);
    }
    return po;
  }

  /**
   * Queries Purchase Orders with multi-attribute filtering and pagination
   */
  public async queryOrders(
    tenantId: string,
    query: QueryPurchaseOrderDto
  ): Promise<{ orders: PurchaseOrderDocument[]; total: number }> {
    return this.repo.queryOrders(tenantId, query);
  }

  /**
   * Updates Purchase Order metadata. Immutability guarantee: poNumber can never be modified.
   */
  public async updateOrder(
    tenantId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
    actor: ActorContext
  ): Promise<PurchaseOrderDocument> {
    const po = await this.getOrderById(tenantId, id);

    if (po.status === 'CLOSED' || po.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot modify Purchase Order in '${po.status}' state`);
    }

    const beforeState = po.toJSON();
    const updateData: Partial<PurchaseOrderDocument> = {};

    if (dto.supplierName) updateData.supplierName = dto.supplierName.trim();
    if (dto.supplierCode) updateData.supplierCode = dto.supplierCode.toUpperCase().trim();
    if (dto.vendorAddress !== undefined) updateData.vendorAddress = dto.vendorAddress.trim();
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail.trim();
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone.trim();
    if (dto.currency) updateData.currency = dto.currency.toUpperCase().trim();
    if (dto.paymentTerms !== undefined) updateData.paymentTerms = dto.paymentTerms.trim();
    if (dto.deliveryTerms !== undefined) updateData.deliveryTerms = dto.deliveryTerms.trim();
    if (dto.taxAmount !== undefined) updateData.taxAmount = dto.taxAmount;
    if (dto.notes !== undefined) updateData.notes = dto.notes.trim();

    if (dto.expectedDeliveryDate) {
      const newExpected = new Date(dto.expectedDeliveryDate);
      if (newExpected < po.orderDate) {
        throw new BadRequestError('Expected delivery date cannot precede order date');
      }
      updateData.expectedDeliveryDate = newExpected;
    }

    if (dto.status) {
      updateData.status = dto.status;
    }

    const updated = await this.repo.update(tenantId, id, updateData);
    if (!updated) {
      throw new NotFoundError(`Purchase Order with ID '${id}' failed to update`);
    }

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role || actor.roles?.[0],
      action: 'PURCHASE_ORDER_UPDATED',
      entityType: 'PurchaseOrder',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    return updated;
  }

  /**
   * Cancels a Purchase Order. Prohibited if any materials have already been received.
   */
  public async cancelOrder(
    tenantId: string,
    id: string,
    actor: ActorContext,
    reason?: string
  ): Promise<PurchaseOrderDocument> {
    const po = await this.getOrderById(tenantId, id);

    if (po.totalReceivedQuantity > 0) {
      throw new BadRequestError(
        `Cannot cancel Purchase Order '${po.poNumber}': ${po.totalReceivedQuantity} items have already been received.`
      );
    }

    if (po.status === 'CANCELLED') {
      return po;
    }

    const beforeState = po.toJSON();
    const updated = await this.repo.update(tenantId, id, {
      status: 'CANCELLED',
      notes: reason ? `${po.notes ? po.notes + ' | ' : ''}Cancellation Reason: ${reason}` : po.notes
    });

    if (!updated) {
      throw new NotFoundError(`Purchase Order with ID '${id}' failed to cancel`);
    }

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role || actor.roles?.[0],
      action: 'PURCHASE_ORDER_CANCELLED',
      entityType: 'PurchaseOrder',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.PO_CANCELLED, tenantId, {
      poId: updated.id,
      poNumber: updated.poNumber,
      previousStatus: po.status,
      newStatus: 'CANCELLED',
      reason
    });

    return updated;
  }

  /**
   * Updates received progression quantities on PO line items upon material receipt / GRN.
   */
  public async recordReceiptProgression(
    tenantId: string,
    poId: string,
    receiptLineUpdates: Array<{ itemId: string; quantity: number }> | string,
    quantity?: number
  ): Promise<PurchaseOrderDocument> {
    const updates: Array<{ poItemId: string; receivedQuantity: number }> = [];
    if (typeof receiptLineUpdates === 'string' && typeof quantity === 'number') {
      updates.push({ poItemId: receiptLineUpdates, receivedQuantity: quantity });
    } else if (Array.isArray(receiptLineUpdates)) {
      for (const u of receiptLineUpdates) {
        updates.push({ poItemId: u.itemId, receivedQuantity: u.quantity });
      }
    }
    return this.recordReceivedMaterial(tenantId, poId, updates);
  }

  /**
   * Updates received quantities on PO line items upon material receipt.
   */
  public async recordReceivedMaterial(
    tenantId: string,
    poId: string,
    receiptLineUpdates: Array<{ poItemId: string; receivedQuantity: number }>
  ): Promise<PurchaseOrderDocument> {
    const po = await this.getOrderById(tenantId, poId);
    let totalReceived = 0;

    for (const item of po.items) {
      const update = receiptLineUpdates.find(
        (u) => u.poItemId === item.lineItemId || u.poItemId === item.itemId
      );
      if (update) {
        item.receivedQuantity = (item.receivedQuantity || 0) + update.receivedQuantity;
        item.balanceQuantity = Math.max(0, item.orderedQuantity - item.receivedQuantity);
      }
      totalReceived += item.receivedQuantity || 0;
    }

    let newStatus: PurchaseOrderStatus = po.status;
    if (totalReceived >= po.totalOrderedQuantity) {
      newStatus = 'RECEIVED';
    } else if (totalReceived > 0) {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    const updated = await this.repo.update(tenantId, poId, {
      items: po.items,
      totalReceivedQuantity: totalReceived,
      status: newStatus
    });

    if (!updated) {
      throw new NotFoundError(`Purchase Order with ID '${poId}' failed to update received quantities`);
    }

    return updated;
  }
}

export const purchaseOrderService = new PurchaseOrderService();
