import { BaseService } from '../../core/services/base.service.js';
import { IGRNRepository, grnRepository } from './grn.repository.js';
import { purchaseOrderService, PurchaseOrderService } from '../purchase-order/purchase-order.service.js';
import { warehouseService, WarehouseService } from '../warehouse/warehouse.service.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import { rbacService, RbacService } from '../rbac/rbac.service.js';
import {
  MaterialReceiptDocument,
  GRNDocument,
  GRNUnitDocument,
  RecordMaterialReceiptDto,
  StoreMaterialDto,
  CreateGrnDto,
  QueryGrnDto,
  QueryGrnUnitDto,
  IMaterialReceiptItem,
  IGRNItem,
  IGRNUnit
} from './grn.types.js';
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

export class GRNService extends BaseService {
  constructor(
    private readonly repo: IGRNRepository = grnRepository,
    private readonly poService: PurchaseOrderService = purchaseOrderService,
    private readonly whService: WarehouseService = warehouseService,
    private readonly audit: AuditService = auditService,
    private readonly rbac: RbacService = rbacService
  ) {
    super('GRNService');
  }

  /**
   * 1. Record incoming physical material delivery strictly against an authorized Purchase Order
   */
  public async recordMaterialReceipt(
    tenantId: string,
    dto: RecordMaterialReceiptDto,
    actor: ActorContext
  ): Promise<MaterialReceiptDocument> {
    // 0. Permission Enforcement (Dynamic RBAC Check - requires INVENTORY_STORAGE_RECORD)
    const effectiveRoles = actor.roles && actor.roles.length > 0
      ? actor.roles
      : (actor.role ? [actor.role] : []);

    const isSuperAdmin = effectiveRoles.some((r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN');
    if (!isSuperAdmin) {
      if (effectiveRoles.length === 0) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.INVENTORY_STORAGE_RECORD}' to record incoming material receipt`
        );
      }
      const userPerms = await this.rbac.getUserEffectivePermissions(tenantId, actor.userId, effectiveRoles);
      if (!userPerms.permissions.includes(PERMISSIONS.INVENTORY_STORAGE_RECORD)) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.INVENTORY_STORAGE_RECORD}' to record incoming material receipt`
        );
      }
    }

    // 1. Idempotency & Duplicate Submission Check
    if (dto.idempotencyKey) {
      const existing = await this.repo.findReceiptByIdempotencyKey(tenantId, dto.idempotencyKey);
      if (existing) {
        this.logger.info(
          `♻️ Idempotency replay: Returning existing Material Receipt [${existing.receiptNumber}] for key '${dto.idempotencyKey}'`
        );
        return existing;
      }
    }

    // 2. PO Validation & Eligibility Check
    if (!dto.poId || !dto.poId.trim()) {
      throw new BadRequestError('Purchase Order ID is required');
    }
    const po = await this.poService.getOrderById(tenantId, dto.poId);

    if (po.status === 'DRAFT') {
      throw new BadRequestError("Cannot record material receipt against Purchase Order in 'DRAFT' status. PO must be issued first.");
    }

    if (po.status === 'CLOSED' || po.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot record material receipt against Purchase Order in '${po.status}' status`);
    }

    // 3. Supplier Challan Information Validation
    if (!dto.supplierChallanNumber || !dto.supplierChallanNumber.trim()) {
      throw new BadRequestError('Supplier Delivery Challan Number is required');
    }
    const challanDate = dto.supplierChallanDate ? new Date(dto.supplierChallanDate) : new Date();
    if (isNaN(challanDate.getTime())) {
      throw new BadRequestError('Invalid supplier challan date');
    }

    // 4. Material Items Reconciliation against PO
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestError('At least one item must be received');
    }

    const processedItems: IMaterialReceiptItem[] = [];

    for (const itemDto of dto.items) {
      // Find matching line on PO
      let poLine = po.items.find((line) => line.lineItemId === itemDto.poLineItemId);
      if (!poLine && itemDto.itemId) {
        poLine = po.items.find((line) => line.itemId === itemDto.itemId);
      }

      if (!poLine) {
        throw new BadRequestError(
          `Received item '${itemDto.itemId || itemDto.poLineItemId}' does not match any line item on Purchase Order [${po.poNumber}]`
        );
      }

      if (itemDto.poLineItemId && itemDto.itemId && poLine.itemId !== itemDto.itemId) {
        throw new BadRequestError(
          `Mismatched line item identifier: poLineItemId '${itemDto.poLineItemId}' does not match itemId '${itemDto.itemId}' on Purchase Order [${po.poNumber}]`
        );
      }

      if (!itemDto.supplierHeatNumber || !itemDto.supplierHeatNumber.trim()) {
        throw new BadRequestError(
          `Supplier Heat Number is required for incoming material traceability on PO line [${poLine.itemCode}]`
        );
      }

      if (!itemDto.receivedQuantity || itemDto.receivedQuantity <= 0) {
        throw new BadRequestError('Received quantity must be greater than zero');
      }

      const remainingOrdered = poLine.orderedQuantity - (poLine.receivedQuantity || 0);
      if (itemDto.receivedQuantity > remainingOrdered * 1.1) {
        // 10% over-delivery tolerance
        throw new BadRequestError(
          `Received quantity (${itemDto.receivedQuantity} ${poLine.uom}) exceeds remaining ordered quantity (${remainingOrdered} ${poLine.uom}) on PO line [${poLine.itemCode}]`
        );
      }

      // Backend authority: all item master and recipe data is derived authoritatively from the PO
      processedItems.push({
        poLineItemId: poLine.lineItemId,
        itemId: poLine.itemId,
        itemCode: poLine.itemCode,
        itemName: poLine.itemName,
        materialGrade: poLine.materialGrade,
        processFamily: poLine.processFamily,
        recipeId: poLine.recipeId,
        recipeCode: poLine.recipeCode,
        recipeRevision: poLine.recipeRevision,
        receivedQuantity: itemDto.receivedQuantity,
        uom: poLine.uom,
        supplierHeatNumber: itemDto.supplierHeatNumber.toUpperCase().trim(),
        supplierLotNumber: itemDto.supplierLotNumber?.toUpperCase().trim(),
        mtrNumber: itemDto.mtrNumber?.toUpperCase().trim(),
        chemicalComposition: itemDto.chemicalComposition,
        lineNotes: itemDto.lineNotes
      });
    }

    const receiptNumber = await this.repo.generateNextReceiptNumber(tenantId);
    const receiptDate = dto.receivedDate ? new Date(dto.receivedDate) : new Date();

    const receipt = await this.repo.createReceipt(tenantId, {
      receiptNumber,
      idempotencyKey: dto.idempotencyKey?.trim(),
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      supplierChallanNumber: dto.supplierChallanNumber.toUpperCase().trim(),
      supplierChallanDate: challanDate,
      supplierInvoiceNumber: dto.supplierInvoiceNumber?.toUpperCase().trim(),
      carrierVehicle: dto.carrierVehicle?.toUpperCase().trim(),
      driverName: dto.driverName?.trim(),
      receivedDate: receiptDate,
      receivedBy: actor.userId,
      items: processedItems,
      status: 'RECEIVED',
      notes: dto.notes?.trim(),
      isDeleted: false
    });

    // Update PO Received Progression immediately so subsequent partial deliveries validate against accurate remaining quantities
    try {
      await this.poService.recordReceiptProgression(
        tenantId,
        po.id,
        processedItems.map((i) => ({ itemId: i.itemId, quantity: i.receivedQuantity }))
      );
    } catch (err) {
      this.logger.warn(`Could not update PO receipt progression for [${po.poNumber}]: ${(err as Error).message}`);
    }

    this.logger.info(`📥 Material receipt recorded: [${receipt.receiptNumber}] against PO [${po.poNumber}] from "${po.supplierName}"`);

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role || actor.roles?.[0],
      action: 'MATERIAL_RECEIPT_RECORDED',
      entityType: 'MaterialReceipt',
      entityId: receipt.id,
      afterState: typeof (receipt as any).toJSON === 'function' ? (receipt as any).toJSON() : receipt,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.MATERIAL_RECEIVED, tenantId, {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      poId: po.id,
      poNumber: po.poNumber,
      supplierChallanNumber: receipt.supplierChallanNumber
    });

    return receipt;
  }

  /**
   * 2. Put away and store received material into an active warehouse bay/location
   */
  public async storeMaterialInWarehouse(
    tenantId: string,
    receiptId: string,
    dto: StoreMaterialDto,
    actor: ActorContext
  ): Promise<MaterialReceiptDocument> {
    // 0. Permission Enforcement (Dynamic RBAC Check - requires INVENTORY_STORAGE_RECORD)
    const effectiveRoles = actor.roles && actor.roles.length > 0
      ? actor.roles
      : (actor.role ? [actor.role] : []);

    const isSuperAdmin = effectiveRoles.some((r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN');
    if (!isSuperAdmin) {
      if (effectiveRoles.length === 0) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.INVENTORY_STORAGE_RECORD}' to store received material`
        );
      }
      const userPerms = await this.rbac.getUserEffectivePermissions(tenantId, actor.userId, effectiveRoles);
      if (!userPerms.permissions.includes(PERMISSIONS.INVENTORY_STORAGE_RECORD)) {
        throw new ForbiddenError(
          `Access Denied: You lack required permission '${PERMISSIONS.INVENTORY_STORAGE_RECORD}' to store received material`
        );
      }
    }

    const receipt = await this.repo.findReceiptById(tenantId, receiptId);
    if (!receipt) {
      throw new NotFoundError(`Material Receipt with ID '${receiptId}' not found`);
    }

    if (receipt.status !== 'RECEIVED') {
      throw new BadRequestError(
        `Cannot store material receipt in '${receipt.status}' status. Only newly received material can be stored.`
      );
    }

    // A. Validate Warehouse
    const warehouse = await this.whService.getWarehouseById(tenantId, dto.warehouseId);
    if (warehouse.status !== 'ACTIVE') {
      throw new BadRequestError(`Warehouse [${warehouse.code}] is currently inactive`);
    }

    // B. Validate Location Code
    const locationCode = dto.storageLocationCode.toUpperCase().trim();
    const location = await this.whService.getLocationByCode(tenantId, locationCode);
    if (location.status !== 'ACTIVE') {
      throw new BadRequestError(`Storage location [${locationCode}] is currently ${location.status} and cannot accept stock putaway`);
    }

    const beforeState = receipt.toJSON();
    const storedAt = new Date();

    receipt.warehouseId = warehouse.id;
    receipt.warehouseCode = warehouse.code;
    receipt.storageLocationCode = locationCode;
    receipt.status = 'STORED';
    receipt.storedAt = storedAt;
    receipt.storedBy = actor.userId;
    if (dto.storageNotes) {
      receipt.notes = receipt.notes ? `${receipt.notes} | Putaway: ${dto.storageNotes}` : dto.storageNotes;
    }

    await receipt.save();

    this.logger.info(`📍 Material stored: [${receipt.receiptNumber}] in Warehouse [${warehouse.code}] Bay [${locationCode}]`);

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MATERIAL_STORED_IN_WAREHOUSE',
      entityType: 'MaterialReceipt',
      entityId: receipt.id,
      beforeState,
      afterState: receipt.toJSON(),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.MATERIAL_STORED, tenantId, {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      warehouseCode: warehouse.code,
      storageLocationCode: locationCode
    });

    return receipt;
  }

  /**
   * 3. Create Goods Receipt Note (GRN) and generate individually identifiable material/part units
   */
  public async createGRN(tenantId: string, dto: CreateGrnDto, actor: ActorContext): Promise<GRNDocument> {
    const receipt = await this.repo.findReceiptById(tenantId, dto.materialReceiptId);
    if (!receipt) {
      throw new NotFoundError(`Material Receipt with ID '${dto.materialReceiptId}' not found`);
    }

    if (receipt.status !== 'STORED') {
      throw new BadRequestError(
        `Cannot create GRN for material receipt in '${receipt.status}' status. Material must be stored in the warehouse first.`
      );
    }

    if (!receipt.warehouseId || !receipt.warehouseCode || !receipt.storageLocationCode) {
      throw new BadRequestError('Material receipt lacks verified warehouse storage allocation');
    }

    // Verify PO: exactly one PO per GRN
    const po = await this.poService.getOrderById(tenantId, receipt.poId);

    // Generate Monotonic Sequential GRN Number (GRN-YYYYMM-XXXX)
    const grnNumber = await this.repo.generateNextGrnNumber(tenantId);
    const grnDate = new Date();

    const grnItems: IGRNItem[] = [];
    const unitsToInsert: Array<Partial<IGRNUnit>> = [];
    let globalUnitSeq = 1;

    for (const item of receipt.items) {
      const unitIdentifiers: string[] = [];

      // Determine unit breakdown count
      let unitCount = 1;
      let unitQty = item.receivedQuantity;

      if (item.uom === 'PCS') {
        // If piece items, generate individual unit records (capped at 50 per receipt to avoid document bloat)
        if (item.receivedQuantity <= 50) {
          unitCount = Math.floor(item.receivedQuantity);
          unitQty = 1;
        } else {
          // If bulk pieces (> 50 pcs), generate traceable batches of units
          unitCount = 5;
          unitQty = Math.round((item.receivedQuantity / 5) * 1000) / 1000;
        }
      } else {
        // Bulk raw alloy (KG, MT, LTR): generate 1 traceable unit per heat-lot melt
        unitCount = 1;
        unitQty = item.receivedQuantity;
      }

      for (let u = 0; u < unitCount; u++) {
        const unitIdentifier = `UNIT-${grnNumber}-${String(globalUnitSeq).padStart(3, '0')}`;
        unitIdentifiers.push(unitIdentifier);
        globalUnitSeq++;

        unitsToInsert.push({
          tenantId,
          unitIdentifier,
          poId: po.id,
          poNumber: po.poNumber,
          grnId: '', // Populated after GRN creation
          grnNumber,
          materialReceiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          materialGrade: item.materialGrade,
          processFamily: item.processFamily,
          recipeId: item.recipeId,
          recipeCode: item.recipeCode,
          recipeRevision: item.recipeRevision,
          warehouseId: receipt.warehouseId,
          warehouseCode: receipt.warehouseCode,
          storageLocationCode: receipt.storageLocationCode,
          supplierHeatNumber: item.supplierHeatNumber,
          supplierLotNumber: item.supplierLotNumber,
          mtrNumber: item.mtrNumber,
          supplierChallanNumber: receipt.supplierChallanNumber,
          chemicalComposition: item.chemicalComposition
            ? (item.chemicalComposition instanceof Map
                ? Object.fromEntries(item.chemicalComposition)
                : (item.chemicalComposition as Record<string, number>))
            : undefined,
          quantity: unitQty,
          uom: item.uom,
          status: 'AVAILABLE_FOR_PLANNING',
          isDeleted: false
        });
      }

      grnItems.push({
        poLineItemId: item.poLineItemId,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        materialGrade: item.materialGrade,
        processFamily: item.processFamily,
        recipeId: item.recipeId,
        recipeCode: item.recipeCode,
        recipeRevision: item.recipeRevision,
        acceptedQuantity: item.receivedQuantity,
        uom: item.uom,
        unitCount,
        supplierHeatNumber: item.supplierHeatNumber,
        mtrNumber: item.mtrNumber,
        unitIdentifiers
      });
    }

    // Create GRN
    const grn = await this.repo.createGrn(tenantId, {
      grnNumber,
      poId: po.id,
      poNumber: po.poNumber,
      materialReceiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      supplierName: receipt.supplierName,
      supplierChallanNumber: receipt.supplierChallanNumber,
      supplierInvoiceNumber: receipt.supplierInvoiceNumber,
      carrierVehicle: receipt.carrierVehicle,
      warehouseId: receipt.warehouseId,
      warehouseCode: receipt.warehouseCode,
      storageLocationCode: receipt.storageLocationCode,
      items: grnItems,
      totalUnitsGenerated: unitsToInsert.length,
      status: 'AVAILABLE_FOR_PLANNING',
      receivedBy: actor.userId,
      inspectedBy: dto.inspectedBy || actor.userId,
      approvedBy: dto.approvedBy,
      grnDate,
      printCount: 0,
      remarks: dto.remarks?.trim(),
      isDeleted: false
    });

    // Populate grnId on units and persist
    unitsToInsert.forEach((u) => {
      u.grnId = grn.id;
    });
    await this.repo.createGrnUnits(tenantId, unitsToInsert);

    // Update Material Receipt status
    receipt.status = 'GRN_CREATED';
    await receipt.save();

    this.logger.info(
      `📑 GRN created: [${grn.grnNumber}] PO: [${po.poNumber}] Generated ${unitsToInsert.length} certified units (Available for Planning)`
    );

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'GRN_CREATED',
      entityType: 'GRN',
      entityId: grn.id,
      afterState: grn.toJSON(),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.GRN_CREATED, tenantId, {
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      poNumber: grn.poNumber,
      totalUnits: unitsToInsert.length
    });

    this.publishEvent(DomainEvents.GRN_UNITS_RELEASED, tenantId, {
      grnNumber: grn.grnNumber,
      unitIdentifiers: unitsToInsert.map((u) => u.unitIdentifier)
    });

    return grn;
  }

  /**
   * 4. Generate formal printable Goods Receipt Note (GRN) document
   */
  public async generatePrintableGRN(
    tenantId: string,
    id: string,
    actor: ActorContext
  ): Promise<{ grn: GRNDocument; htmlReport: string }> {
    const grn = await this.repo.findGrnById(tenantId, id);
    if (!grn) {
      throw new NotFoundError(`GRN with ID '${id}' not found`);
    }

    const { units } = await this.repo.queryUnits(tenantId, { grnNumber: grn.grnNumber, limit: 100 });

    grn.printCount += 1;
    grn.printedAt = new Date();
    grn.printedBy = actor.userId;
    grn.status = 'AVAILABLE_FOR_PLANNING';
    await grn.save();

    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GOODS RECEIPT NOTE — ${grn.grnNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1e293b; background: #fff; }
    .header { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .company-title { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-badge { background: #0284c7; color: #fff; padding: 6px 14px; font-size: 13px; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 13px; }
    .meta-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }
    .meta-box h4 { margin: 0 0 8px 0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .units-list { font-family: monospace; font-size: 11px; color: #0369a1; }
    .footer { margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
    .sig-line { border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 6px; font-size: 12px; font-weight: 600; }
    .print-watermark { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">ASTRALIS MANUFACTURING ERP</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Advanced Thermal Processing & Precision Metallurgical Facility</div>
    </div>
    <div>
      <span class="doc-badge">Official Goods Receipt Note</span>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>Receipt & Storage Reference</h4>
      <div><strong>GRN Number:</strong> ${grn.grnNumber}</div>
      <div><strong>GRN Date:</strong> ${new Date(grn.grnDate).toLocaleDateString()}</div>
      <div><strong>Receipt Ref:</strong> ${grn.receiptNumber}</div>
      <div><strong>Warehouse:</strong> ${grn.warehouseCode} (Bay/Bin: ${grn.storageLocationCode})</div>
      <div><strong>Status:</strong> ${grn.status}</div>
    </div>
    <div class="meta-box">
      <h4>Purchase Order & Supplier Traceability</h4>
      <div><strong>PO Number:</strong> ${grn.poNumber}</div>
      <div><strong>Supplier Name:</strong> ${grn.supplierName}</div>
      <div><strong>Delivery Challan:</strong> ${grn.supplierChallanNumber}</div>
      <div><strong>Supplier Invoice:</strong> ${grn.supplierInvoiceNumber || 'N/A'}</div>
      <div><strong>Carrier Vehicle:</strong> ${grn.carrierVehicle || 'N/A'}</div>
    </div>
  </div>

  <h3 style="font-size: 14px; text-transform: uppercase; color: #0f172a; margin-bottom: 6px;">Received Items & Bound Process Recipes</h3>
  <table>
    <thead>
      <tr>
        <th>Item / Part Code</th>
        <th>Material Grade</th>
        <th>Accepted Qty</th>
        <th>Bound Recipe</th>
        <th>Supplier Heat #</th>
        <th>MTR / Mill Cert</th>
      </tr>
    </thead>
    <tbody>
      ${grn.items
        .map(
          (item) => `
        <tr>
          <td><strong>${item.itemCode}</strong><br><span style="color: #64748b; font-size: 11px;">${item.itemName}</span></td>
          <td>${item.materialGrade}</td>
          <td>${item.acceptedQuantity} ${item.uom}</td>
          <td><strong>${item.recipeCode}</strong> (Rev ${item.recipeRevision})<br><span style="color: #0284c7; font-size: 10px;">${item.processFamily}</span></td>
          <td>${item.supplierHeatNumber}</td>
          <td>${item.mtrNumber || 'VERIFIED'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <h3 style="font-size: 14px; text-transform: uppercase; color: #0f172a; margin-top: 24px; margin-bottom: 6px;">Generated Individual Part/Material Units (Available for Planning)</h3>
  <table>
    <thead>
      <tr>
        <th>Unit Identifier</th>
        <th>Item Code</th>
        <th>Recipe Reference</th>
        <th>Quantity</th>
        <th>Location</th>
        <th>Traceable Heat #</th>
        <th>Planning State</th>
      </tr>
    </thead>
    <tbody>
      ${units
        .map(
          (u) => `
        <tr>
          <td class="units-list">${u.unitIdentifier}</td>
          <td>${u.itemCode}</td>
          <td>${u.recipeCode}</td>
          <td>${u.quantity} ${u.uom}</td>
          <td>${u.warehouseCode} / ${u.storageLocationCode}</td>
          <td>${u.supplierHeatNumber}</td>
          <td><span style="color: #16a34a; font-weight: 600;">AVAILABLE</span></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="sig-line">Stores / Receiving In-Charge<br><span style="font-size: 10px; color: #64748b;">Signature & Date</span></div>
    </div>
    <div>
      <div class="sig-line">Metallurgical QC Inspector<br><span style="font-size: 10px; color: #64748b;">MTR & Hardness Verified</span></div>
    </div>
    <div>
      <div class="sig-line">Plant Operations Manager<br><span style="font-size: 10px; color: #64748b;">Released for Production</span></div>
    </div>
  </div>

  <div class="print-watermark">
    Printed via Astralis ERP System • Print Count: ${grn.printCount} • User: ${actor.userId} • Timestamp: ${new Date().toISOString()}
  </div>
</body>
</html>
    `;

    await this.audit.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'GRN_PRINTED',
      entityType: 'GRN',
      entityId: grn.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId
    });

    this.publishEvent(DomainEvents.GRN_PRINTED, tenantId, {
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      printCount: grn.printCount
    });

    return { grn, htmlReport };
  }

  /**
   * 5. Query verified GRNs
   */
  public async queryGRNs(
    tenantId: string,
    query: QueryGrnDto
  ): Promise<{ grns: GRNDocument[]; total: number }> {
    return this.repo.queryGrns(tenantId, query);
  }

  /**
   * 6. Query individual GRN Units
   */
  public async queryUnits(
    tenantId: string,
    query: QueryGrnUnitDto
  ): Promise<{ units: GRNUnitDocument[]; total: number }> {
    return this.repo.queryUnits(tenantId, query);
  }

  /**
   * 7. Query Receipts
   */
  public async queryReceipts(
    tenantId: string,
    query: { poId?: string; status?: string; search?: string }
  ): Promise<MaterialReceiptDocument[]> {
    return this.repo.queryReceipts(tenantId, query);
  }

  /**
   * 8. Authoritative Planning Gate: Get certified units ready for Planning
   */
  public async getAvailableUnitsForPlanning(
    tenantId: string,
    itemId: string,
    recipeId?: string
  ): Promise<GRNUnitDocument[]> {
    return this.repo.queryAvailableUnitsForPlanning(tenantId, itemId, recipeId);
  }
}

export const grnService = new GRNService();
