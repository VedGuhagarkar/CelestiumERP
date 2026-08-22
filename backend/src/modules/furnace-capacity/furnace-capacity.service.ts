import {
  IFurnaceCapacityRepository,
  furnaceCapacityRepository
} from './furnace-capacity.repository.js';
import {
  CreateFurnaceDto,
  CompatibilityCheckRequestDto,
  CompatibilityCheckResult,
  BookFurnaceCapacityDto,
  FurnaceUtilizationDto,
  FurnaceDocument,
  FurnaceAllocationDocument,
  FurnaceClassEnum
} from './furnace-capacity.types.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';

const PYROMETRY_CLASS_RANK: Record<FurnaceClassEnum, number> = {
  CLASS_1: 1, // Strictest (±3°C)
  CLASS_2: 2, // (±6°C)
  CLASS_3: 3, // (±8°C)
  CLASS_4: 4, // (±10°C)
  CLASS_5: 5  // Widest (±14°C)
};

export class FurnaceCapacityService {
  constructor(
    private readonly repo: IFurnaceCapacityRepository = furnaceCapacityRepository
  ) {}

  public async createFurnace(
    tenantId: string,
    actorId: string,
    dto: CreateFurnaceDto
  ): Promise<FurnaceDocument> {
    const existing = await this.repo.findFurnaceByCode(tenantId, dto.furnaceCode);
    if (existing && !existing.isDeleted) {
      throw new ConflictError(`Furnace with code '${dto.furnaceCode}' already exists`);
    }

    if (dto.thermalCapabilities.maxOperatingTempC <= dto.thermalCapabilities.minOperatingTempC) {
      throw new BadRequestError('Max operating temperature must be strictly greater than minimum operating temperature');
    }

    const furnace = await this.repo.createFurnace(tenantId, {
      ...dto,
      furnaceCode: dto.furnaceCode.toUpperCase(),
      status: 'OPERATIONAL'
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'CREATE',
      entityType: 'FURNACE_MASTER',
      entityId: furnace.id,
      afterState: furnace.toJSON()
    });

    return furnace;
  }

  public async getFurnaces(tenantId: string, filter: any = {}): Promise<FurnaceDocument[]> {
    return this.repo.findFurnaces(tenantId, filter);
  }

  public async getFurnaceById(tenantId: string, id: string): Promise<FurnaceDocument> {
    const furnace = await this.repo.findFurnaceById(tenantId, id);
    if (!furnace || furnace.isDeleted) {
      throw new NotFoundError(`Furnace with ID '${id}' not found`);
    }
    return furnace;
  }

  public async checkCompatibility(
    tenantId: string,
    dto: CompatibilityCheckRequestDto
  ): Promise<CompatibilityCheckResult> {
    const furnace = await this.getFurnaceById(tenantId, dto.furnaceId);
    const violations: string[] = [];
    const warnings: string[] = [];

    // 1. Operational Status Guard
    if (furnace.status !== 'OPERATIONAL') {
      violations.push(
        `Furnace '${furnace.furnaceCode}' is not OPERATIONAL (Current status: ${furnace.status})`
      );
    }

    // 2. Process Family Compatibility
    if (!furnace.processCapabilities.supportedProcessFamilies.includes(dto.processFamily)) {
      violations.push(
        `Process family '${dto.processFamily}' is not supported by furnace '${furnace.furnaceCode}' (Supported: [${furnace.processCapabilities.supportedProcessFamilies.join(', ')}])`
      );
    }

    // 3. Thermal Range Limits
    if (
      dto.targetTemperatureC > furnace.thermalCapabilities.maxOperatingTempC ||
      dto.targetTemperatureC < furnace.thermalCapabilities.minOperatingTempC
    ) {
      violations.push(
        `Target temperature ${dto.targetTemperatureC}°C is out of furnace operating range (${furnace.thermalCapabilities.minOperatingTempC}°C - ${furnace.thermalCapabilities.maxOperatingTempC}°C)`
      );
    }

    // 4. Pyrometry Classification Check (AMS 2750G)
    if (dto.requiredFurnaceClass) {
      const furnaceRank = PYROMETRY_CLASS_RANK[furnace.thermalCapabilities.pyrometryClass];
      const requiredRank = PYROMETRY_CLASS_RANK[dto.requiredFurnaceClass];

      if (furnaceRank > requiredRank) {
        violations.push(
          `Pyrometry class non-compliance: Process requires '${dto.requiredFurnaceClass}', but furnace is '${furnace.thermalCapabilities.pyrometryClass}'`
        );
      }
    }

    // 5. Atmosphere Compatibility
    if (dto.requiredAtmosphere) {
      if (
        !furnace.processCapabilities.supportedAtmospheres ||
        !furnace.processCapabilities.supportedAtmospheres.includes(dto.requiredAtmosphere)
      ) {
        violations.push(
          `Atmosphere '${dto.requiredAtmosphere}' is not available on furnace '${furnace.furnaceCode}'`
        );
      }
    }

    // 6. Quench Medium Compatibility
    if (dto.requiredQuenchMedium) {
      if (
        !furnace.processCapabilities.supportedQuenchMedia ||
        !furnace.processCapabilities.supportedQuenchMedia.includes(dto.requiredQuenchMedium)
      ) {
        violations.push(
          `Quench medium '${dto.requiredQuenchMedium}' is not supported on furnace '${furnace.furnaceCode}'`
        );
      }
    }

    // 7. Maximum Gross Load Weight
    if (dto.totalBatchWeightKg > furnace.dimensions.maxGrossWeightKg) {
      violations.push(
        `Batch weight ${dto.totalBatchWeightKg} kg exceeds furnace maximum gross weight limit (${furnace.dimensions.maxGrossWeightKg} kg)`
      );
    }

    // 8. Time-Window Overlap Check
    if (dto.requestedStartTime && dto.requestedEndTime) {
      const start = new Date(dto.requestedStartTime);
      const end = new Date(dto.requestedEndTime);
      const overlapping = await this.repo.findOverlappingAllocations(tenantId, furnace.id, start, end);

      if (overlapping.length > 0) {
        violations.push(
          `Furnace '${furnace.furnaceCode}' has ${overlapping.length} overlapping booking(s) in requested window (${start.toISOString()} to ${end.toISOString()})`
        );
      }
    }

    return {
      isCompatible: violations.length === 0,
      violations,
      warnings,
      furnace: {
        id: furnace.id,
        furnaceCode: furnace.furnaceCode,
        name: furnace.name,
        status: furnace.status,
        pyrometryClass: furnace.thermalCapabilities.pyrometryClass,
        maxOperatingTempC: furnace.thermalCapabilities.maxOperatingTempC,
        maxGrossWeightKg: furnace.dimensions.maxGrossWeightKg
      }
    };
  }

  public async bookCapacity(
    tenantId: string,
    actorId: string,
    dto: BookFurnaceCapacityDto
  ): Promise<FurnaceAllocationDocument> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestError('End time must be after start time');
    }

    const durationHours = Math.round(((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;

    // 1. Run Compatibility & Availability Checks
    const check = await this.checkCompatibility(tenantId, {
      furnaceId: dto.furnaceId,
      processFamily: dto.processFamily,
      targetTemperatureC: dto.targetTemperatureC,
      totalBatchWeightKg: dto.allocatedWeightKg,
      requestedStartTime: dto.startTime,
      requestedEndTime: dto.endTime
    });

    if (!check.isCompatible) {
      throw new BadRequestError(
        `Cannot book furnace capacity: Incompatible equipment or slot overload - ${check.violations.join('; ')}`
      );
    }

    // 2. Create Allocation
    const allocationNumber = await this.repo.generateNextAllocationNumber(tenantId);

    const allocation = await this.repo.createAllocation(tenantId, {
      allocationNumber,
      furnaceId: dto.furnaceId,
      furnaceCode: check.furnace.furnaceCode,
      planId: dto.planId || null,
      jobCardId: dto.jobCardId || null,
      processFamily: dto.processFamily,
      targetTemperatureC: dto.targetTemperatureC,
      allocatedWeightKg: dto.allocatedWeightKg,
      startTime,
      endTime,
      durationHours,
      status: 'BOOKED',
      bookedByActorId: actorId,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'BOOK_FURNACE_CAPACITY',
      entityType: 'FURNACE_ALLOCATION',
      entityId: allocation.id,
      afterState: allocation.toJSON(),
      metadata: { furnaceCode: check.furnace.furnaceCode, durationHours }
    });

    return allocation;
  }

  public async releaseAllocation(
    tenantId: string,
    id: string,
    actorId: string
  ): Promise<FurnaceAllocationDocument> {
    const allocation = await this.repo.findAllocationById(tenantId, id);
    if (!allocation || allocation.isDeleted) {
      throw new NotFoundError(`Furnace Allocation with ID '${id}' not found`);
    }

    if (allocation.status === 'CANCELLED') {
      return allocation;
    }

    const previousState = allocation.toJSON();
    allocation.status = 'CANCELLED';
    await allocation.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'RELEASE_FURNACE_CAPACITY',
      entityType: 'FURNACE_ALLOCATION',
      entityId: allocation.id,
      beforeState: previousState,
      afterState: allocation.toJSON()
    });

    return allocation;
  }

  public async getUtilization(
    tenantId: string,
    startDateStr?: string,
    endDateStr?: string,
    furnaceType?: string
  ): Promise<FurnaceUtilizationDto[]> {
    const periodStart = startDateStr ? new Date(startDateStr) : new Date();
    const periodEnd = endDateStr
      ? new Date(endDateStr)
      : new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days window

    const filter: any = { isDeleted: false };
    if (furnaceType) filter.furnaceType = furnaceType;

    const furnaces = await this.repo.findFurnaces(tenantId, filter);
    const results: FurnaceUtilizationDto[] = [];

    const daysInPeriod = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

    for (const furnace of furnaces) {
      const allocations = await this.repo.findAllocationsInPeriod(
        tenantId,
        furnace.id,
        periodStart,
        periodEnd
      );

      const totalAvailableHours = Math.round((furnace.nominalDailyOperatingHours || 24.0) * daysInPeriod);
      const bookedHours = allocations.reduce((sum, a) => sum + a.durationHours, 0);

      const utilizationPercentage =
        totalAvailableHours > 0
          ? Math.round((bookedHours / totalAvailableHours) * 100)
          : 0;

      results.push({
        furnaceId: furnace.id,
        furnaceCode: furnace.furnaceCode,
        furnaceName: furnace.name,
        furnaceType: furnace.furnaceType,
        status: furnace.status,
        periodStart,
        periodEnd,
        totalAvailableHours,
        bookedHours,
        utilizationPercentage,
        isOverloaded: utilizationPercentage > 100,
        isUnderutilized: utilizationPercentage < 60,
        isBottleneck: utilizationPercentage >= 90,
        allocationsCount: allocations.length
      });
    }

    return results;
  }
}

export const furnaceCapacityService = new FurnaceCapacityService();
