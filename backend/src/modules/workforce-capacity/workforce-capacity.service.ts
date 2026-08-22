import {
  IWorkforceCapacityRepository,
  workforceCapacityRepository
} from './workforce-capacity.repository.js';
import {
  CreateEmployeeDto,
  AddSkillDto,
  EvaluateCoverageRequestDto,
  EvaluateCoverageResult,
  AssignOperatorDto,
  ShiftCapacitySummaryDto,
  WorkforceMemberDocument,
  WorkforceShiftAllocationDocument,
  ShiftType
} from './workforce-capacity.types.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';

export class WorkforceCapacityService {
  constructor(
    private readonly repo: IWorkforceCapacityRepository = workforceCapacityRepository
  ) {}

  public async createEmployee(
    tenantId: string,
    actorId: string,
    dto: CreateEmployeeDto
  ): Promise<WorkforceMemberDocument> {
    const existing = await this.repo.findEmployeeByCode(tenantId, dto.employeeCode);
    if (existing && !existing.isDeleted) {
      throw new ConflictError(`Employee with code '${dto.employeeCode}' already exists`);
    }

    const skills = (dto.skills || []).map((s) => ({
      ...s,
      skillCode: s.skillCode.toUpperCase(),
      certifiedDate: new Date(s.certifiedDate),
      expiryDate: s.expiryDate ? new Date(s.expiryDate) : null,
      certifiedByActorId: actorId,
      isCertified: true
    }));

    const employee = await this.repo.createEmployee(tenantId, {
      ...dto,
      employeeCode: dto.employeeCode.toUpperCase(),
      status: 'ACTIVE',
      skills,
      approvedLeaves: []
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'CREATE',
      entityType: 'WORKFORCE_MEMBER',
      entityId: employee.id,
      afterState: employee.toJSON()
    });

    return employee;
  }

  public async addOrUpdateSkill(
    tenantId: string,
    actorId: string,
    employeeId: string,
    dto: AddSkillDto
  ): Promise<WorkforceMemberDocument> {
    const employee = await this.getEmployeeById(tenantId, employeeId);

    const previousState = employee.toJSON();
    const existingSkillIndex = employee.skills.findIndex(
      (s) => s.skillCode === dto.skillCode.toUpperCase()
    );

    const skillData = {
      skillCode: dto.skillCode.toUpperCase(),
      skillName: dto.skillName,
      proficiency: dto.proficiency,
      certifiedDate: new Date(dto.certifiedDate),
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      certifiedByActorId: actorId,
      isCertified: true
    };

    if (existingSkillIndex >= 0) {
      employee.skills[existingSkillIndex] = skillData as any;
    } else {
      employee.skills.push(skillData as any);
    }

    await employee.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'CERTIFY_SKILL',
      entityType: 'WORKFORCE_MEMBER',
      entityId: employee.id,
      beforeState: previousState,
      afterState: employee.toJSON(),
      metadata: { skillCode: dto.skillCode }
    });

    return employee;
  }

  public async getEmployees(
    tenantId: string,
    filter: any = {}
  ): Promise<WorkforceMemberDocument[]> {
    return this.repo.findEmployees(tenantId, filter);
  }

  public async getEmployeeById(
    tenantId: string,
    id: string
  ): Promise<WorkforceMemberDocument> {
    const employee = await this.repo.findEmployeeById(tenantId, id);
    if (!employee || employee.isDeleted) {
      throw new NotFoundError(`Workforce member with ID '${id}' not found`);
    }
    return employee;
  }

  public async evaluateCoverage(
    tenantId: string,
    dto: EvaluateCoverageRequestDto
  ): Promise<EvaluateCoverageResult> {
    const targetDate = new Date(dto.date);
    const requiredCount = dto.requiredOperatorCount || 1;
    const violations: string[] = [];

    // Query active employees
    const employees = await this.repo.findEmployees(tenantId, {
      isDeleted: false,
      status: { $ne: 'INACTIVE' }
    });

    const qualifiedOperators: EvaluateCoverageResult['qualifiedOperators'] = [];
    const unqualifiedOperatorsInShift: EvaluateCoverageResult['unqualifiedOperatorsInShift'] = [];

    for (const emp of employees) {
      // Check leave
      const isOnLeave = emp.approvedLeaves.some((l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return targetDate >= start && targetDate <= end;
      });

      if (isOnLeave || emp.status === 'ON_LEAVE') {
        continue;
      }

      // Check qualifications
      const missingSkills: string[] = [];
      let minProficiency: any = 'EXPERT';

      for (const reqSkill of dto.requiredSkills) {
        const cert = emp.skills.find(
          (s) => s.skillCode === reqSkill.toUpperCase() && s.isCertified
        );

        if (!cert) {
          missingSkills.push(reqSkill);
        } else if (cert.expiryDate && new Date(cert.expiryDate) < targetDate) {
          missingSkills.push(`${reqSkill} (EXPIRED)`);
        } else {
          if (cert.proficiency === 'BASIC') minProficiency = 'BASIC';
          else if (cert.proficiency === 'COMPETENT' && minProficiency === 'EXPERT') {
            minProficiency = 'COMPETENT';
          }
        }
      }

      if (missingSkills.length === 0) {
        // Qualified! Check shift allocations
        const allocations = await this.repo.findEmployeeAllocationsOnDate(
          tenantId,
          emp.id,
          targetDate,
          dto.shift
        );

        const bookedShiftHours = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
        const availableHours = Math.max(0, emp.maxDailyHours - bookedShiftHours);

        qualifiedOperators.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          proficiency: minProficiency,
          isAssignedInShift: allocations.length > 0,
          availableHours
        });
      } else {
        unqualifiedOperatorsInShift.push({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          missingSkills
        });
      }
    }

    const availableQualifiedCount = qualifiedOperators.filter((o) => o.availableHours > 0).length;
    const shortageCount = Math.max(0, requiredCount - availableQualifiedCount);

    if (shortageCount > 0) {
      violations.push(
        `Operator shortage on ${dto.shift} (${dto.date}): Required ${requiredCount} qualified operator(s) for [${dto.requiredSkills.join(', ')}], but only ${availableQualifiedCount} available`
      );
    }

    return {
      isSufficient: shortageCount === 0,
      requiredCount,
      availableQualifiedCount,
      shortageCount,
      qualifiedOperators,
      unqualifiedOperatorsInShift,
      violations
    };
  }

  public async assignOperator(
    tenantId: string,
    actorId: string,
    dto: AssignOperatorDto
  ): Promise<WorkforceShiftAllocationDocument> {
    const employee = await this.getEmployeeById(tenantId, dto.employeeId);
    const targetDate = new Date(dto.date);

    if (employee.status !== 'ACTIVE') {
      throw new BadRequestError(
        `Cannot assign operator '${employee.fullName}': status is ${employee.status}`
      );
    }

    // 1. Check Approved Leave
    const isOnLeave = employee.approvedLeaves.some((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      return targetDate >= start && targetDate <= end;
    });

    if (isOnLeave) {
      throw new BadRequestError(
        `Cannot assign operator '${employee.fullName}': operator is on approved leave on ${dto.date}`
      );
    }

    // 2. Technical Skill & Pyrometry Certification Check
    if (dto.requiredSkills && dto.requiredSkills.length > 0) {
      for (const reqSkill of dto.requiredSkills) {
        const cert = employee.skills.find(
          (s) => s.skillCode === reqSkill.toUpperCase() && s.isCertified
        );

        if (!cert) {
          throw new BadRequestError(
            `Operator qualification check failed: '${employee.fullName}' lacks required certification for '${reqSkill}'`
          );
        }

        if (cert.expiryDate && new Date(cert.expiryDate) < targetDate) {
          throw new BadRequestError(
            `Operator qualification check failed: '${employee.fullName}' certification for '${reqSkill}' expired on ${cert.expiryDate.toISOString()}`
          );
        }
      }
    }

    // 3. Double-Booking Guard
    const existingShiftAllocations = await this.repo.findEmployeeAllocationsOnDate(
      tenantId,
      employee.id,
      targetDate,
      dto.shift
    );

    if (existingShiftAllocations.length > 0) {
      throw new BadRequestError(
        `Double-booking prevented: Operator '${employee.fullName}' is already allocated to shift ${dto.shift} on ${dto.date} (Allocation: ${existingShiftAllocations[0].allocationNumber})`
      );
    }

    // 4. Daily Overtime Capacity Limit Check
    const allDailyAllocations = await this.repo.findEmployeeAllocationsOnDate(
      tenantId,
      employee.id,
      targetDate
    );

    const currentBookedHours = allDailyAllocations.reduce((sum, a) => sum + a.allocatedHours, 0);
    const maxPermittedDaily = employee.maxDailyHours + (employee.maxWeeklyOvertimeHours > 0 ? 4 : 0);

    if (currentBookedHours + dto.allocatedHours > maxPermittedDaily) {
      throw new BadRequestError(
        `Configured capacity exceeded: Operator '${employee.fullName}' maximum daily working limit is ${maxPermittedDaily}h (Currently booked: ${currentBookedHours}h, Requested: ${dto.allocatedHours}h)`
      );
    }

    const isOvertime = currentBookedHours + dto.allocatedHours > employee.maxDailyHours;

    // 5. Create Allocation Record
    const allocationNumber = await this.repo.generateNextAllocationNumber(tenantId);

    const allocation = await this.repo.createAllocation(tenantId, {
      allocationNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      date: targetDate,
      shift: dto.shift,
      furnaceId: dto.furnaceId || null,
      planId: dto.planId || null,
      jobCardId: dto.jobCardId || null,
      allocatedHours: dto.allocatedHours,
      isOvertime,
      requiredSkills: dto.requiredSkills || [],
      status: 'ASSIGNED',
      assignedByActorId: actorId,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'ASSIGN_WORKFORCE_SHIFT',
      entityType: 'WORKFORCE_SHIFT_ALLOCATION',
      entityId: allocation.id,
      afterState: allocation.toJSON(),
      metadata: { employeeCode: employee.employeeCode, shift: dto.shift }
    });

    return allocation;
  }

  public async releaseAssignment(
    tenantId: string,
    id: string,
    actorId: string
  ): Promise<WorkforceShiftAllocationDocument> {
    const allocation = await this.repo.findAllocationById(tenantId, id);
    if (!allocation || allocation.isDeleted) {
      throw new NotFoundError(`Workforce Shift Allocation with ID '${id}' not found`);
    }

    if (allocation.status === 'CANCELLED') {
      return allocation;
    }

    const previousState = allocation.toJSON();
    allocation.status = 'CANCELLED';
    await allocation.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'RELEASE_WORKFORCE_SHIFT_ALLOCATION',
      entityType: 'WORKFORCE_SHIFT_ALLOCATION',
      entityId: allocation.id,
      beforeState: previousState,
      afterState: allocation.toJSON()
    });

    return allocation;
  }

  public async getShiftCapacity(
    tenantId: string,
    dateStr?: string,
    shift?: ShiftType,
    skillCode?: string
  ): Promise<ShiftCapacitySummaryDto> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const targetShift = shift || 'SHIFT_1_MORNING';

    const employees = await this.repo.findEmployees(tenantId, {
      isDeleted: false,
      status: { $ne: 'INACTIVE' }
    });

    let totalScheduled = 0;
    let onLeaveCount = 0;
    let activeCount = 0;
    let totalAvailableHours = 0;

    const skillMap = new Map<string, { qualified: number; assigned: number }>();

    for (const emp of employees) {
      totalScheduled++;

      const isOnLeave = emp.approvedLeaves.some((l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return targetDate >= start && targetDate <= end;
      });

      if (isOnLeave || emp.status === 'ON_LEAVE') {
        onLeaveCount++;
        continue;
      }

      activeCount++;
      totalAvailableHours += emp.maxDailyHours;

      for (const skill of emp.skills) {
        if (skill.isCertified && (!skill.expiryDate || new Date(skill.expiryDate) >= targetDate)) {
          if (!skillMap.has(skill.skillCode)) {
            skillMap.set(skill.skillCode, { qualified: 0, assigned: 0 });
          }
          skillMap.get(skill.skillCode)!.qualified++;
        }
      }
    }

    const allocations = await this.repo.findAllocationsForShift(
      tenantId,
      targetDate,
      targetShift
    );

    const bookedHours = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
    const freeHours = Math.max(0, totalAvailableHours - bookedHours);
    const utilizationPercentage =
      totalAvailableHours > 0 ? Math.round((bookedHours / totalAvailableHours) * 100) : 0;

    for (const alloc of allocations) {
      for (const reqSkill of alloc.requiredSkills) {
        if (skillMap.has(reqSkill)) {
          skillMap.get(reqSkill)!.assigned++;
        }
      }
    }

    const skillBreakdown = Array.from(skillMap.entries()).map(([code, counts]) => ({
      skillCode: code,
      qualifiedCount: counts.qualified,
      assignedCount: counts.assigned
    }));

    return {
      date: targetDate,
      shift: targetShift,
      totalScheduledOperators: totalScheduled,
      onLeaveOperators: onLeaveCount,
      activeOperators: activeCount,
      totalAvailableHours,
      bookedHours,
      freeHours,
      utilizationPercentage,
      skillBreakdown
    };
  }
}

export const workforceCapacityService = new WorkforceCapacityService();
