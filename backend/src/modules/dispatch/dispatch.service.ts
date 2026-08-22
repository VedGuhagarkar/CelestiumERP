import { BaseService } from '../../core/services/base.service.js';
import { IDispatchRepository, dispatchRepository } from './dispatch.repository.js';
import { IFinishedGoodsRepository, finishedGoodsRepository } from '../finished-goods/finished-goods.repository.js';
import { FinishedGoodsService, finishedGoodsService } from '../finished-goods/finished-goods.service.js';
import { ICustomerRepository, customerRepository } from '../customer/customer.repository.js';
import { IProductionJobRepository, productionJobRepository } from '../production-job/production-job.repository.js';
import { IQualityInspectionRepository, qualityInspectionRepository } from '../quality-inspection/quality-inspection.repository.js';
import { IQualityDocumentationRepository, qualityDocumentationRepository } from '../quality-documentation/quality-documentation.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  DispatchConsignmentDocument,
  CreateDispatchDto,
  VerifyDispatchQualityDto,
  ScheduleDispatchDto,
  ApproveDispatchDto,
  DepartDispatchDto,
  DeliverDispatchDto,
  CancelDispatchDto,
  QueryDispatchesDto,
  IDispatchLine,
  DispatchStatus
} from './dispatch.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class DispatchService extends BaseService {
  constructor(
    private readonly repo: IDispatchRepository = dispatchRepository,
    private readonly fgRepo: IFinishedGoodsRepository = finishedGoodsRepository,
    private readonly fgService: FinishedGoodsService = finishedGoodsService,
    private readonly custRepo: ICustomerRepository = customerRepository,
    private readonly jobRepo: IProductionJobRepository = productionJobRepository,
    private readonly qcInspectionRepo: IQualityInspectionRepository = qualityInspectionRepository,
    private readonly qcDocRepo: IQualityDocumentationRepository = qualityDocumentationRepository
  ) {
    super('DispatchService');
  }

  /**
   * 1. Create a new Finished-Goods Dispatch Consignment in DRAFT status
   * Validates customer, verifies finished-goods availability, and reserves stock.
   */
  public async createDispatch(
    tenantId: string,
    actor: IActorContext,
    dto: CreateDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const customer = await this.custRepo.findById(tenantId, dto.customerId);
    if (
      !customer ||
      customer.isDeleted ||
      customer.qualityStatus === 'inactive' ||
      customer.qualityStatus === 'suspended'
    ) {
      throw new NotFoundError(
        `Active Customer with ID '${dto.customerId}' not found or is inactive`
      );
    }

    const dispatchNumber = await this.repo.generateNextDispatchNumber(tenantId);
    const deliveryChallanNumber = await this.repo.generateNextDeliveryChallanNumber(tenantId);
    const now = new Date();

    const lines: IDispatchLine[] = [];
    let totalQuantity = 0;
    let totalPackages = 0;
    let totalGrossWeight = 0;
    let totalNetWeight = 0;

    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const fg = await this.fgRepo.findById(tenantId, lineDto.finishedGoodsId);
      if (!fg || fg.isDeleted) {
        throw new NotFoundError(
          `Finished goods lot with ID '${lineDto.finishedGoodsId}' not found`
        );
      }

      if (fg.customerCode && fg.customerCode !== customer.customerCode) {
        throw new BadRequestError(
          `Finished goods lot '${fg.fgLotNumber}' belongs to customer '${fg.customerCode}', but dispatch is for '${customer.customerCode}'`
        );
      }

      if (fg.status === 'QUARANTINED') {
        throw new BadRequestError(
          `Finished goods lot '${fg.fgLotNumber}' is QUARANTINED and strictly blocked from dispatch allocation`
        );
      }

      if (fg.availableQuantity < lineDto.dispatchedQuantity) {
        throw new BadRequestError(
          `Insufficient available quantity for lot '${fg.fgLotNumber}'. Requested: ${lineDto.dispatchedQuantity} ${fg.uom}, Available: ${fg.availableQuantity} ${fg.uom}`
        );
      }

      // Reserve finished goods for this dispatch
      await this.fgService.reserveForDispatch(
        tenantId,
        fg.id,
        {
          quantity: lineDto.dispatchedQuantity,
          deliveryChallanNumber,
          comments: `Reserved for Dispatch Consignment ${dispatchNumber}`
        },
        actor
      );

      const pkg = lineDto.packageDetails || {
        packagingType: 'PALLET',
        packageCount: 1
      };

      totalQuantity += lineDto.dispatchedQuantity;
      totalPackages += pkg.packageCount || 1;
      if (pkg.grossWeightKg) totalGrossWeight += pkg.grossWeightKg;
      if (pkg.netWeightKg) totalNetWeight += pkg.netWeightKg;

      lines.push({
        lineId: `LINE-${String(i + 1).padStart(3, '0')}`,
        finishedGoodsId: fg.id,
        fgLotNumber: fg.fgLotNumber,
        jobId: fg.jobCardId,
        jobNumber: fg.jobCardNumber,
        heatLotNumber: fg.heatLotNumber,
        itemId: fg.itemId,
        itemCode: fg.itemCode,
        itemName: fg.description || fg.itemCode,
        dispatchedQuantity: lineDto.dispatchedQuantity,
        uom: fg.uom,
        packageDetails: pkg,
        notes: lineDto.notes
      });
    }

    const consignment = await this.repo.create(tenantId, {
      dispatchNumber,
      deliveryChallanNumber,
      status: 'DRAFT',
      customer: {
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: (customer as any).customerName || customer.companyName,
        destinationAddress:
          dto.destinationAddress ||
          (customer.billingAddress
            ? `${customer.billingAddress.street}, ${customer.billingAddress.city}`
            : (customer as any).contactInfo?.address || undefined),
        contactPerson:
          dto.contactPerson ||
          customer.contacts?.[0]?.name ||
          (customer as any).contactInfo?.primaryContactName ||
          undefined,
        contactPhone:
          dto.contactPhone ||
          customer.contacts?.[0]?.phone ||
          (customer as any).contactInfo?.phone ||
          undefined,
        purchaseOrderNumber: dto.purchaseOrderNumber
      },
      lines,
      totalQuantity,
      totalPackages,
      totalGrossWeightKg: totalGrossWeight > 0 ? totalGrossWeight : undefined,
      totalNetWeightKg: totalNetWeight > 0 ? totalNetWeight : undefined,
      carrier: {
        carrierName: dto.carrierName,
        transportMode: dto.transportMode || 'ROAD'
      },
      timeline: {
        createdAt: now,
        scheduledDepartureTime: dto.scheduledDepartureTime ? new Date(dto.scheduledDepartureTime) : undefined
      },
      history: [
        {
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          timestamp: now,
          performedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          reason: 'Dispatch consignment initialized in DRAFT state'
        }
      ],
      notes: dto.notes
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_CONSIGNMENT_CREATED',
      entityType: 'DispatchConsignment',
      entityId: consignment.id,
      afterState: consignment.toJSON(),
      metadata: {
        dispatchNumber: consignment.dispatchNumber,
        deliveryChallanNumber: consignment.deliveryChallanNumber,
        customerCode: customer.customerCode,
        totalQuantity,
        lineCount: lines.length
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_CREATED,
      tenantId,
      {
        dispatchId: consignment.id,
        dispatchNumber: consignment.dispatchNumber,
        customerCode: customer.customerCode,
        totalQuantity
      },
      actor.userId
    );

    return consignment;
  }

  /**
   * 2. Verify Quality Approval & Required Documents for all lines in Dispatch
   */
  public async verifyQuality(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: VerifyDispatchQualityDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status !== 'DRAFT' && consignment.status !== 'QUALITY_VERIFIED') {
      throw new BadRequestError(
        `Cannot run quality verification on dispatch in '${consignment.status}' status. Expected 'DRAFT'.`
      );
    }

    const now = new Date();

    for (const line of consignment.lines) {
      const fg = await this.fgRepo.findById(tenantId, line.finishedGoodsId);
      if (!fg || fg.isDeleted) {
        throw new NotFoundError(
          `Finished goods lot with ID '${line.finishedGoodsId}' no longer exists`
        );
      }

      if (fg.status === 'QUARANTINED') {
        throw new BadRequestError(
          `Line item lot '${line.fgLotNumber}' is marked as QUARANTINED. Quality verification failed.`
        );
      }

      let inspectionDoc = null;
      if (fg.qualityRelease?.inspectionReportId) {
        inspectionDoc = await this.qcInspectionRepo.findById(
          tenantId,
          fg.qualityRelease.inspectionReportId
        );
      } else if (line.jobId) {
        const jobInspections = await this.qcInspectionRepo.findByJobId(tenantId, line.jobId);
        inspectionDoc = jobInspections.find((i) => i.status === 'APPROVED') || null;
      }

      // Check Quality Inspection Conformance
      const isApproved =
        fg.qualityRelease?.isReleased === true ||
        (inspectionDoc !== null &&
          inspectionDoc.status === 'APPROVED' &&
          inspectionDoc.disposition === 'CONFORMING');

      if (!isApproved) {
        throw new BadRequestError(
          `Quality Verification failed: Finished goods lot '${line.fgLotNumber}' (Job: '${line.jobNumber}') lacks approved Quality Inspection release.`
        );
      }

      // Check for valid Certificate of Conformance (CoC)
      let cocDoc = null;
      if (fg.qualityRelease?.cocNumber) {
        cocDoc = await this.qcDocRepo.findByDocumentNumber(
          tenantId,
          fg.qualityRelease.cocNumber
        );
      } else if (line.jobId) {
        const jobDocs = await this.qcDocRepo.findByJobId(tenantId, line.jobId);
        cocDoc =
          jobDocs.find(
            (d) =>
              d.reportType === 'CERTIFICATE_OF_CONFORMANCE' &&
              (d.status === 'ISSUED' || (d as any).isApproved) &&
              !d.revocation?.isRevoked
          ) || null;
      }

      line.qualityVerification = {
        isQualityApproved: true,
        inspectionId: inspectionDoc?.id,
        inspectionNumber: inspectionDoc?.inspectionNumber || fg.qualityRelease?.inspectionReportId,
        cocId: cocDoc?.id,
        cocNumber: cocDoc?.documentNumber || fg.qualityRelease?.cocNumber,
        verifiedAt: now,
        verifiedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        verificationNotes: dto.verificationNotes || 'Quality approval and CoC verified successfully'
      };
    }

    const prevStatus = consignment.status;
    consignment.status = 'QUALITY_VERIFIED';
    consignment.timeline.qualityVerifiedAt = now;
    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'QUALITY_VERIFIED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.verificationNotes || 'All manifest lines verified conforming with active CoC'
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_QUALITY_VERIFIED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        linesVerified: updated.lines.length
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_QUALITY_VERIFIED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        verifiedLineCount: updated.lines.length
      },
      actor.userId
    );

    return updated;
  }

  /**
   * 3. Schedule Dispatch with Carrier, Vehicle, Driver, and Timeline
   */
  public async scheduleDispatch(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ScheduleDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status !== 'DRAFT' && consignment.status !== 'QUALITY_VERIFIED' && consignment.status !== 'SCHEDULED') {
      throw new BadRequestError(
        `Cannot schedule dispatch in status '${consignment.status}'. Expected 'QUALITY_VERIFIED' or 'DRAFT'.`
      );
    }

    const now = new Date();
    const scheduledDeparture = new Date(dto.scheduledDepartureTime);

    if (dto.carrierName || dto.transportMode) {
      consignment.carrier = {
        carrierName: dto.carrierName || consignment.carrier?.carrierName,
        transportMode: dto.transportMode || consignment.carrier?.transportMode || 'ROAD',
        trackingNumber: dto.trackingNumber || consignment.carrier?.trackingNumber,
        freightBillNumber: dto.freightBillNumber || consignment.carrier?.freightBillNumber
      };
    }

    if (dto.vehicleNumber || dto.vehicleType || dto.ewayBillNumber) {
      consignment.vehicle = {
        vehicleNumber: dto.vehicleNumber || consignment.vehicle?.vehicleNumber,
        vehicleType: dto.vehicleType || consignment.vehicle?.vehicleType,
        ewayBillNumber: dto.ewayBillNumber || consignment.vehicle?.ewayBillNumber,
        sealNumber: consignment.vehicle?.sealNumber
      };
    }

    if (dto.driverName || dto.driverPhone || dto.driverLicenseNumber) {
      consignment.driver = {
        driverName: dto.driverName || consignment.driver?.driverName,
        driverPhone: dto.driverPhone || consignment.driver?.driverPhone,
        driverLicenseNumber: dto.driverLicenseNumber || consignment.driver?.driverLicenseNumber
      };
    }

    consignment.timeline.scheduledDepartureTime = scheduledDeparture;
    if (dto.estimatedArrivalTime) {
      consignment.timeline.estimatedArrivalTime = new Date(dto.estimatedArrivalTime);
    }

    const prevStatus = consignment.status;
    consignment.status = 'SCHEDULED';
    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'SCHEDULED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.notes || `Scheduled for departure at ${scheduledDeparture.toISOString()}`
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_SCHEDULED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        scheduledDepartureTime: scheduledDeparture.toISOString(),
        carrier: updated.carrier?.carrierName,
        vehicleNumber: updated.vehicle?.vehicleNumber
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_SCHEDULED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        scheduledDepartureTime: scheduledDeparture
      },
      actor.userId
    );

    return updated;
  }

  /**
   * 4. Approve Dispatch Consignment and generate Security Gate Pass
   */
  public async approveDispatch(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ApproveDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status !== 'QUALITY_VERIFIED' && consignment.status !== 'SCHEDULED') {
      throw new BadRequestError(
        `Cannot approve dispatch in status '${consignment.status}'. Dispatch must be QUALITY_VERIFIED or SCHEDULED before final approval.`
      );
    }

    // Verify all lines have quality approval
    const unverifiedLines = consignment.lines.filter((l) => !l.qualityVerification?.isQualityApproved);
    if (unverifiedLines.length > 0) {
      throw new BadRequestError(
        `Cannot approve dispatch: ${unverifiedLines.length} line item(s) have not passed quality verification.`
      );
    }

    const now = new Date();
    const gatePassNumber = await this.repo.generateNextGatePassNumber(tenantId);

    const prevStatus = consignment.status;
    consignment.status = 'APPROVED';
    consignment.timeline.approvedAt = now;
    consignment.approvals = {
      approvedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      approvedAt: now,
      approvalNotes: dto.approvalNotes || 'Approved for factory departure'
    };
    consignment.gatePass = {
      gatePassNumber,
      issuedAt: now
    };

    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'APPROVED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.approvalNotes || `Dispatch approved. Gate Pass issued: ${gatePassNumber}`
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_APPROVED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        gatePassNumber
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_APPROVED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        gatePassNumber
      },
      actor.userId
    );

    return updated;
  }

  /**
   * 5. Record Physical Departure (Gate Departure Clearance)
   * Deducts finished goods stock permanently.
   */
  public async recordDeparture(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: DepartDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot record departure for dispatch in '${consignment.status}' status. Dispatch must be APPROVED first.`
      );
    }

    const now = dto.actualDepartureTime ? new Date(dto.actualDepartureTime) : new Date();

    // Deduct stock permanently from FinishedGoods for each line
    for (const line of consignment.lines) {
      const fg = await this.fgRepo.findById(tenantId, line.finishedGoodsId);
      if (fg) {
        const beforeState = fg.toJSON();
        fg.reservedQuantity = Math.max(0, fg.reservedQuantity - line.dispatchedQuantity);
        fg.dispatchedQuantity += line.dispatchedQuantity;
        if (fg.dispatchedQuantity >= fg.totalQuantity) {
          fg.status = 'FULLY_DISPATCHED';
        }
        await fg.save();

        await auditService.record(tenantId, {
          actorId: actor.userId,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: 'FINISHED_GOODS_DISPATCH_DEDUCTED',
          entityType: 'FinishedGoods',
          entityId: fg.id,
          beforeState,
          afterState: fg.toJSON(),
          metadata: {
            dispatchNumber: consignment.dispatchNumber,
            dispatchedQuantity: line.dispatchedQuantity
          }
        });
      }
    }

    const prevStatus = consignment.status;
    consignment.status = 'DISPATCHED';
    consignment.timeline.actualDepartureTime = now;

    if (!consignment.gatePass) {
      const gatePassNumber = await this.repo.generateNextGatePassNumber(tenantId);
      consignment.gatePass = {
        gatePassNumber,
        issuedAt: now
      };
    }
    consignment.gatePass.securityOfficerName = dto.securityOfficerName;
    if (dto.sealNumber) consignment.gatePass.sealNumber = dto.sealNumber;

    if (dto.vehicleNumber && consignment.vehicle) consignment.vehicle.vehicleNumber = dto.vehicleNumber;
    if (dto.driverName && consignment.driver) consignment.driver.driverName = dto.driverName;

    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'DISPATCHED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.notes || `Departed factory premises cleared by Security Officer '${dto.securityOfficerName}'`
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_DEPARTED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        actualDepartureTime: now.toISOString(),
        securityOfficerName: dto.securityOfficerName
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_SHIPPED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        actualDepartureTime: now
      },
      actor.userId
    );

    return updated;
  }

  /**
   * 6. Confirm Customer Delivery & Record Proof of Delivery (POD)
   */
  public async confirmDelivery(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: DeliverDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status !== 'DISPATCHED') {
      throw new BadRequestError(
        `Cannot confirm delivery for dispatch in status '${consignment.status}'. Expected 'DISPATCHED'.`
      );
    }

    const now = dto.actualDeliveryTime ? new Date(dto.actualDeliveryTime) : new Date();

    const prevStatus = consignment.status;
    consignment.status = 'DELIVERED';
    consignment.timeline.actualDeliveryTime = now;
    consignment.proofOfDelivery = {
      receiverName: dto.receiverName,
      receiverSignatureRef: dto.receiverSignatureRef,
      podDocumentUrl: dto.podDocumentUrl,
      receivedQuantity: dto.receivedQuantity ?? consignment.totalQuantity,
      receivedCondition: dto.receivedCondition,
      podRecordedAt: now,
      remarks: dto.remarks
    };

    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'DELIVERED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Proof of Delivery logged. Received by '${dto.receiverName}' in condition '${dto.receivedCondition}'`
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_DELIVERED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        receiverName: dto.receiverName,
        receivedCondition: dto.receivedCondition
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_DELIVERED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        receiverName: dto.receiverName,
        receivedCondition: dto.receivedCondition
      },
      actor.userId
    );

    return updated;
  }

  /**
   * 7. Cancel Dispatch Consignment and release reserved finished goods
   */
  public async cancelDispatch(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: CancelDispatchDto
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }

    if (consignment.status === 'DISPATCHED' || consignment.status === 'DELIVERED') {
      throw new BadRequestError(
        `Cannot cancel dispatch in status '${consignment.status}'. Physical departure has already occurred.`
      );
    }

    if (consignment.status === 'CANCELLED') {
      throw new BadRequestError(`Dispatch consignment '${consignment.dispatchNumber}' is already CANCELLED`);
    }

    const now = new Date();

    // Release all reserved finished goods back to available stock
    for (const line of consignment.lines) {
      try {
        await this.fgService.releaseDispatchReservation(
          tenantId,
          line.finishedGoodsId,
          {
            quantity: line.dispatchedQuantity,
            comments: `Released due to cancellation of Dispatch Consignment ${consignment.dispatchNumber}`
          },
          actor
        );
      } catch (err: any) {
        this.logger.warn(`Failed to release reservation for line lot ${line.fgLotNumber}: ${err.message}`);
      }
    }

    const prevStatus = consignment.status;
    consignment.status = 'CANCELLED';
    consignment.timeline.cancelledAt = now;
    consignment.cancellation = {
      cancelledBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      cancellationReason: dto.cancellationReason,
      cancelledAt: now
    };

    consignment.history.push({
      fromStatus: prevStatus,
      toStatus: 'CANCELLED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Cancelled: ${dto.cancellationReason}`
    });

    const updated = await consignment.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DISPATCH_CANCELLED',
      entityType: 'DispatchConsignment',
      entityId: updated.id,
      afterState: updated.toJSON(),
      metadata: {
        dispatchNumber: updated.dispatchNumber,
        cancellationReason: dto.cancellationReason
      }
    });

    this.publishEvent(
      DomainEvents.DISPATCH_CANCELLED,
      tenantId,
      {
        dispatchId: updated.id,
        dispatchNumber: updated.dispatchNumber,
        cancellationReason: dto.cancellationReason
      },
      actor.userId
    );

    return updated;
  }

  /**
   * Query dispatches with filtering and pagination
   */
  public async queryDispatches(
    tenantId: string,
    query: QueryDispatchesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<DispatchConsignmentDocument>> {
    return await this.repo.query(tenantId, query, pagination);
  }

  /**
   * Get single dispatch by ID
   */
  public async getDispatchById(
    tenantId: string,
    id: string
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findById(tenantId, id);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with ID '${id}' not found`);
    }
    return consignment;
  }

  /**
   * Get single dispatch by Dispatch Number
   */
  public async getDispatchByNumber(
    tenantId: string,
    dispatchNumber: string
  ): Promise<DispatchConsignmentDocument> {
    const consignment = await this.repo.findByDispatchNumber(tenantId, dispatchNumber);
    if (!consignment || consignment.isDeleted) {
      throw new NotFoundError(`Dispatch consignment with number '${dispatchNumber}' not found`);
    }
    return consignment;
  }
}

export const dispatchService = new DispatchService();
