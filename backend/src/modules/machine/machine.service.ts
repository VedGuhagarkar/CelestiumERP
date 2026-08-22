import crypto from 'crypto';
import { BaseService } from '../../core/services/base.service.js';
import { IMachineRepository, machineRepository } from './machine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  MachineDocument,
  CreateMachineDto,
  UpdateMachineDto,
  ChangeMachineStatusDto,
  AddMachineNoteDto,
  QueryMachinesDto,
  MachineFleetSummary,
  MachineStatus,
  IMachineNote
} from './machine.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class MachineService extends BaseService {
  constructor(private readonly repo: IMachineRepository = machineRepository) {
    super('MachineService');
  }

  /**
   * Registers a new factory machine / furnace equipment
   */
  public async createMachine(
    tenantId: string,
    actor: IActorContext,
    dto: CreateMachineDto
  ): Promise<MachineDocument> {
    const existing = await this.repo.findByCode(tenantId, dto.machineCode);
    if (existing) {
      throw new ConflictError(`Machine with code '${dto.machineCode.toUpperCase()}' already exists`);
    }

    if (dto.thermalLimits.minOperatingTempC > dto.thermalLimits.maxOperatingTempC) {
      throw new BadRequestError(
        `minOperatingTempC (${dto.thermalLimits.minOperatingTempC}°C) cannot exceed maxOperatingTempC (${dto.thermalLimits.maxOperatingTempC}°C)`
      );
    }

    const now = new Date();
    const initialStatus: MachineStatus = dto.status || 'IDLE';

    const notes: IMachineNote[] = [];
    if (dto.initialNote) {
      notes.push({
        noteId: `NOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        content: dto.initialNote,
        category: 'OPERATIONAL',
        authorId: actor.userId,
        authorEmail: actor.email,
        authorRole: actor.role,
        createdAt: now
      });
    }

    const machine = await this.repo.create(tenantId, {
      machineCode: dto.machineCode.toUpperCase(),
      name: dto.name,
      category: dto.category,
      status: initialStatus,
      technicalSpecs: {
        ...dto.technicalSpecs,
        commissioningDate: dto.technicalSpecs.commissioningDate
          ? new Date(dto.technicalSpecs.commissioningDate)
          : null
      },
      thermalLimits: dto.thermalLimits,
      workingDimensions: dto.workingDimensions,
      location: dto.location,
      capabilities: dto.capabilities,
      pyrometryCompliance: {
        lastTusDate: dto.pyrometryCompliance?.lastTusDate
          ? new Date(dto.pyrometryCompliance.lastTusDate)
          : null,
        nextTusDueDate: dto.pyrometryCompliance?.nextTusDueDate
          ? new Date(dto.pyrometryCompliance.nextTusDueDate)
          : null,
        lastSatDate: dto.pyrometryCompliance?.lastSatDate
          ? new Date(dto.pyrometryCompliance.lastSatDate)
          : null,
        nextSatDueDate: dto.pyrometryCompliance?.nextSatDueDate
          ? new Date(dto.pyrometryCompliance.nextSatDueDate)
          : null,
        isTusValid: true,
        isSatValid: true
      },
      statusHistory: [
        {
          fromStatus: 'IDLE',
          toStatus: initialStatus,
          changedAt: now,
          changedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          reason: 'Initial equipment commissioning registration'
        }
      ],
      notes
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_REGISTERED',
      entityType: 'Machine',
      entityId: machine.id,
      metadata: {
        machineCode: machine.machineCode,
        category: machine.category,
        pyrometryClass: machine.capabilities.furnaceClass
      }
    });

    this.publishEvent(DomainEvents.MACHINE_REGISTERED, tenantId, {
      machineId: machine.id,
      machineCode: machine.machineCode,
      category: machine.category,
      status: machine.status
    }, actor.userId);

    return machine;
  }

  /**
   * Updates machine configuration and technical specifications
   */
  public async updateMachine(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: UpdateMachineDto
  ): Promise<MachineDocument> {
    const machine = await this.repo.findById(tenantId, id);
    if (!machine) {
      throw new NotFoundError(`Machine with ID '${id}' not found`);
    }

    if (dto.thermalLimits) {
      const minTemp = dto.thermalLimits.minOperatingTempC ?? machine.thermalLimits.minOperatingTempC;
      const maxTemp = dto.thermalLimits.maxOperatingTempC ?? machine.thermalLimits.maxOperatingTempC;
      if (minTemp > maxTemp) {
        throw new BadRequestError(`minOperatingTempC (${minTemp}°C) cannot exceed maxOperatingTempC (${maxTemp}°C)`);
      }
    }

    const updated = await this.repo.update(tenantId, id, dto as any);
    if (!updated) {
      throw new NotFoundError(`Machine with ID '${id}' not found`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_CONFIG_UPDATED',
      entityType: 'Machine',
      entityId: updated.id,
      metadata: { machineCode: updated.machineCode, updates: Object.keys(dto) }
    });

    return updated;
  }

  /**
   * Transitions operational state with validation against the transition matrix
   */
  public async changeMachineStatus(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ChangeMachineStatusDto
  ): Promise<MachineDocument> {
    const machine = await this.repo.findById(tenantId, id);
    if (!machine) {
      throw new NotFoundError(`Machine with ID '${id}' not found`);
    }

    const fromStatus = machine.status;
    const toStatus = dto.status;

    if (fromStatus === toStatus) {
      return machine;
    }

    // Validate State Transition Matrix
    this.validateStateTransition(machine.machineCode, fromStatus, toStatus);

    const now = new Date();

    // Update current job tracking if transitioning to/from RUNNING
    if (toStatus === 'RUNNING' && dto.jobId) {
      machine.currentJob = {
        jobId: dto.jobId,
        jobNumber: dto.jobNumber || null,
        startedAt: now,
        expectedCompletionAt: null
      };
    } else if (fromStatus === 'RUNNING' && toStatus !== 'RUNNING') {
      machine.currentJob = null;
    }

    machine.status = toStatus;
    machine.statusHistory.push({
      fromStatus,
      toStatus,
      changedAt: now,
      changedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.reason || null,
      workOrderId: dto.workOrderId || null
    });

    await machine.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_STATUS_CHANGED',
      entityType: 'Machine',
      entityId: machine.id,
      metadata: {
        machineCode: machine.machineCode,
        fromStatus,
        toStatus,
        reason: dto.reason,
        workOrderId: dto.workOrderId
      }
    });

    let eventName: string = DomainEvents.MACHINE_STATUS_CHANGED;
    if (toStatus === 'BREAKDOWN') eventName = DomainEvents.MACHINE_BREAKDOWN_REPORTED;
    else if (fromStatus === 'BREAKDOWN' && (toStatus === 'MAINTENANCE' || toStatus === 'CALIBRATING')) {
      eventName = DomainEvents.MACHINE_BREAKDOWN_RESOLVED;
    } else if (toStatus === 'MAINTENANCE') eventName = DomainEvents.MACHINE_MAINTENANCE_TRIGGERED;
    else if (fromStatus === 'MAINTENANCE' && (toStatus === 'IDLE' || toStatus === 'CALIBRATING')) {
      eventName = DomainEvents.MACHINE_MAINTENANCE_COMPLETED;
    } else if (toStatus === 'CALIBRATING') eventName = DomainEvents.MACHINE_CALIBRATION_LOGGED;

    this.publishEvent(eventName as any, tenantId, {
      machineId: machine.id,
      machineCode: machine.machineCode,
      fromStatus,
      toStatus,
      reason: dto.reason
    }, actor.userId);

    return machine;
  }

  /**
   * Adds an operational / maintenance / safety note to a machine
   */
  public async addNote(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: AddMachineNoteDto
  ): Promise<MachineDocument> {
    const machine = await this.repo.findById(tenantId, id);
    if (!machine) {
      throw new NotFoundError(`Machine with ID '${id}' not found`);
    }

    const note: IMachineNote = {
      noteId: `NOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      content: dto.content,
      category: dto.category,
      authorId: actor.userId,
      authorEmail: actor.email,
      authorRole: actor.role,
      createdAt: new Date()
    };

    machine.notes.push(note);
    await machine.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_NOTE_ADDED',
      entityType: 'Machine',
      entityId: machine.id,
      metadata: { machineCode: machine.machineCode, category: dto.category }
    });

    return machine;
  }

  public async getMachineById(tenantId: string, id: string): Promise<MachineDocument> {
    const machine = await this.repo.findById(tenantId, id);
    if (!machine) {
      throw new NotFoundError(`Machine with ID '${id}' not found`);
    }
    return machine;
  }

  public async getMachineByCode(tenantId: string, machineCode: string): Promise<MachineDocument> {
    const machine = await this.repo.findByCode(tenantId, machineCode);
    if (!machine) {
      throw new NotFoundError(`Machine with code '${machineCode}' not found`);
    }
    return machine;
  }

  public async queryMachines(
    tenantId: string,
    query: QueryMachinesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MachineDocument>> {
    return await this.repo.query(tenantId, query, pagination);
  }

  public async findCapableMachines(
    tenantId: string,
    criteria: {
      processFamily?: string;
      targetTemperatureC?: number;
      requiredLoadWeightKg?: number;
      status?: MachineStatus;
    }
  ): Promise<MachineDocument[]> {
    return await this.repo.findCapableMachines(tenantId, criteria);
  }

  public async getFleetSummary(tenantId: string): Promise<MachineFleetSummary> {
    return await this.repo.getFleetSummary(tenantId);
  }

  /**
   * Strictly validates allowed operational state transitions
   */
  private validateStateTransition(machineCode: string, from: MachineStatus, to: MachineStatus): void {
    const invalidTransitions: Array<{ from: MachineStatus; to: MachineStatus; reason: string }> = [
      {
        from: 'RUNNING',
        to: 'MAINTENANCE',
        reason: 'Cannot start scheduled maintenance while machine is actively RUNNING a production batch. Stop the cycle or return to IDLE first.'
      },
      {
        from: 'RUNNING',
        to: 'CALIBRATING',
        reason: 'Cannot start pyrometry calibration while machine is actively RUNNING a production batch.'
      },
      {
        from: 'BREAKDOWN',
        to: 'RUNNING',
        reason: 'Cannot start production directly from BREAKDOWN status without completing MAINTENANCE repair or CALIBRATING verification.'
      }
    ];

    const match = invalidTransitions.find((t) => t.from === from && t.to === to);
    if (match) {
      throw new BadRequestError(
        `Invalid machine state transition for '${machineCode}' from '${from}' to '${to}': ${match.reason}`
      );
    }
  }
}

export const machineService = new MachineService();
