import {
  ConstraintCategory,
  IConstraintViolation,
  PlanFeasibilityReport,
  FactoryConstraintAuditSummary
} from './constraint-analysis.types.js';
import { productionPlanRepository } from '../production-planning/production-plan.repository.js';
import { recipeRepository } from '../recipe/recipe.repository.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { itemRepository } from '../item/item.repository.js';
import { heatLotRepository } from '../traceability/heat-lot.repository.js';
import { quarantineRepository } from '../quarantine/quarantine.repository.js';
import { furnaceCapacityRepository } from '../furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { NotFoundError } from '../../core/errors/app-error.js';

export class ConstraintAnalysisService {
  public async evaluatePlanConstraints(
    tenantId: string,
    planId: string
  ): Promise<PlanFeasibilityReport> {
    const plan = await productionPlanRepository.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${planId}' not found`);
    }

    const violations: IConstraintViolation[] = [];

    // =========================================================================
    // 1. RECIPE_VALIDITY
    // =========================================================================
    if (plan.recipe && plan.recipe.recipeId) {
      const recipe = await recipeRepository.findById(tenantId, plan.recipe.recipeId);
      if (!recipe || recipe.isDeleted) {
        violations.push({
          category: 'RECIPE_VALIDITY',
          severity: 'BLOCKING',
          code: 'ERR_RECIPE_NOT_FOUND',
          message: `Required recipe with ID '${plan.recipe.recipeId}' not found in recipe master`,
          impactedEntityId: plan.recipe.recipeId
        });
      } else {
        if (recipe.status !== 'APPROVED' && recipe.status !== 'ACTIVE') {
          violations.push({
            category: 'RECIPE_VALIDITY',
            severity: 'BLOCKING',
            code: 'ERR_RECIPE_UNAPPROVED',
            message: `Recipe '${recipe.recipeCode}' (Rev ${recipe.revision}) is in '${recipe.status}' status (Must be APPROVED or ACTIVE)`,
            impactedEntityIdentifier: recipe.recipeCode,
            details: { currentStatus: recipe.status, revision: recipe.revision }
          });
        }

        if (
          recipe.applicableMaterialGrades &&
          recipe.applicableMaterialGrades.length > 0 &&
          !recipe.applicableMaterialGrades.some(
            (g) => g.toUpperCase() === plan.item.materialGrade.toUpperCase()
          )
        ) {
          violations.push({
            category: 'RECIPE_VALIDITY',
            severity: 'WARNING',
            code: 'WARN_RECIPE_MATERIAL_MISMATCH',
            message: `Recipe '${recipe.recipeCode}' does not explicitly list material grade '${plan.item.materialGrade}'`,
            impactedEntityIdentifier: recipe.recipeCode
          });
        }
      }
    }

    // =========================================================================
    // 2. SPECIFICATION_VALIDITY
    // =========================================================================
    if (plan.specification && plan.specification.specificationId) {
      const spec = await specificationRepository.findById(
        tenantId,
        plan.specification.specificationId
      );
      if (!spec || spec.isDeleted) {
        violations.push({
          category: 'SPECIFICATION_VALIDITY',
          severity: 'BLOCKING',
          code: 'ERR_SPEC_NOT_FOUND',
          message: `Required specification with ID '${plan.specification.specificationId}' not found in specification master`,
          impactedEntityId: plan.specification.specificationId
        });
      } else {
        if (spec.status !== 'APPROVED' && spec.status !== 'ACTIVE') {
          violations.push({
            category: 'SPECIFICATION_VALIDITY',
            severity: 'BLOCKING',
            code: 'ERR_SPEC_UNAPPROVED',
            message: `Specification '${spec.specCode}' (Rev ${spec.revision}) is in '${spec.status}' status (Must be APPROVED or ACTIVE)`,
            impactedEntityIdentifier: spec.specCode,
            details: { currentStatus: spec.status, revision: spec.revision }
          });
        }
      }
    }

    // =========================================================================
    // 3. MATERIAL & 4. HEAT_LOT_AVAILABILITY
    // =========================================================================
    const item = await itemRepository.findByCode(tenantId, plan.item.itemCode);
    const requiredQty =
      plan.quantityTargets.plannedQuantity - plan.quantityTargets.completedQuantity;

    if (!item || item.isDeleted) {
      violations.push({
        category: 'MATERIAL',
        severity: 'BLOCKING',
        code: 'ERR_ITEM_NOT_FOUND',
        message: `Material Item '${plan.item.itemCode}' not found in master catalog`,
        impactedEntityIdentifier: plan.item.itemCode
      });
    } else {
      const availableStock = Math.max(0, item.currentStock - (item.allocatedStock || 0));
      if (availableStock < requiredQty) {
        violations.push({
          category: 'MATERIAL',
          severity: availableStock === 0 ? 'BLOCKING' : 'WARNING',
          code: 'ERR_MATERIAL_SHORTAGE',
          message: `Material stock shortage for '${item.itemCode}': Required ${requiredQty} ${item.uom}, but free stock is ${availableStock} ${item.uom}`,
          impactedEntityIdentifier: item.itemCode,
          details: { requiredQty, availableStock }
        });
      }
    }

    // Heat Lot verification
    const heatLots = await heatLotRepository.searchHeatLots(
      tenantId,
      { itemCode: plan.item.itemCode },
      { page: 1, limit: 20, sort: { createdAt: -1 } }
    );

    let freeLotStock = 0;
    let quarantinedLotCount = 0;

    for (const lot of heatLots.items) {
      const isQuarantined = await quarantineRepository.findActiveQuarantineForTarget(
        tenantId,
        'HEAT_LOT',
        lot.heatLotNumber
      );

      if (isQuarantined) {
        quarantinedLotCount++;
        violations.push({
          category: 'HEAT_LOT_AVAILABILITY',
          severity: 'BLOCKING',
          code: 'ERR_HEAT_LOT_QUARANTINED',
          message: `Heat Lot '${lot.heatLotNumber}' for material '${lot.itemCode}' is currently locked under active QUARANTINE`,
          impactedEntityIdentifier: lot.heatLotNumber,
          impactedEntityId: lot.id
        });
      } else {
        freeLotStock += Math.max(0, lot.currentQuantity - (lot.allocatedQuantity || 0));
      }
    }

    if (heatLots.items.length === 0 || (freeLotStock < requiredQty && quarantinedLotCount === 0)) {
      violations.push({
        category: 'HEAT_LOT_AVAILABILITY',
        severity: freeLotStock === 0 ? 'BLOCKING' : 'WARNING',
        code: 'ERR_HEAT_LOT_SHORTAGE',
        message: `Insufficient qualified heat-lot stock for '${plan.item.itemCode}': Free lot quantity is ${freeLotStock} ${plan.item.uom} (Required: ${requiredQty} ${plan.item.uom})`,
        impactedEntityIdentifier: plan.item.itemCode,
        details: { requiredQty, freeLotStock }
      });
    }

    // =========================================================================
    // 5. FURNACE_CAPABILITY & 6. MACHINE_AVAILABILITY & 7. FURNACE_CAPACITY
    // =========================================================================
    const candidateFurnaces = await furnaceCapacityRepository.findFurnaces(tenantId, {
      status: 'OPERATIONAL'
    });

    const processFamily = plan.recipe?.processFamily || 'CARBURIZING';
    const capableFurnaces = candidateFurnaces.filter((f) =>
      f.processCapabilities.supportedProcessFamilies.includes(processFamily)
    );

    if (capableFurnaces.length === 0) {
      violations.push({
        category: 'FURNACE_CAPABILITY',
        severity: 'BLOCKING',
        code: 'ERR_NO_CAPABLE_FURNACE',
        message: `No operational furnace currently configured to support process family '${processFamily}'`
      });
    }

    // Check specific furnace if planned
    if (plan.timeline && plan.timeline.plannedStartDate && capableFurnaces.length > 0) {
      const primaryFurnace = capableFurnaces[0];
      const overlaps = await furnaceCapacityRepository.findOverlappingAllocations(
        tenantId,
        primaryFurnace.id,
        new Date(plan.timeline.plannedStartDate),
        new Date(plan.timeline.targetCompletionDate),
        plan.id
      );

      if (overlaps.length > 0) {
        violations.push({
          category: 'FURNACE_CAPACITY',
          severity: 'WARNING',
          code: 'WARN_FURNACE_SLOT_BUSY',
          message: `Primary furnace '${primaryFurnace.furnaceCode}' has ${overlaps.length} existing booking(s) during target window`,
          impactedEntityIdentifier: primaryFurnace.furnaceCode
        });
      }
    }

    // =========================================================================
    // 8. OPERATOR_AVAILABILITY & 9. OPERATOR_QUALIFICATION
    // =========================================================================
    const targetDate = plan.timeline?.plannedStartDate
      ? new Date(plan.timeline.plannedStartDate)
      : new Date();

    const coverageCheck = await workforceCapacityRepository.findEmployees(tenantId, {
      isDeleted: false,
      status: 'ACTIVE'
    });

    const reqSkill = `${processFamily}_OPERATION`;
    const qualifiedActive = coverageCheck.filter((emp) => {
      const onLeave = emp.approvedLeaves.some((l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return targetDate >= start && targetDate <= end;
      });

      if (onLeave) return false;

      return emp.skills.some(
        (s) =>
          (s.skillCode === reqSkill ||
            s.skillCode === 'SEALED_QUENCH_FURNACE_OPERATION' ||
            s.skillCode === 'VACUUM_FURNACE_OPERATION' ||
            s.skillCode === 'PIT_FURNACE_OPERATION') &&
          s.isCertified &&
          (!s.expiryDate || new Date(s.expiryDate) >= targetDate)
      );
    });

    if (qualifiedActive.length === 0) {
      violations.push({
        category: 'OPERATOR_QUALIFICATION',
        severity: 'BLOCKING',
        code: 'ERR_NO_QUALIFIED_OPERATOR',
        message: `No active, qualified operator available with certified qualification for '${processFamily}' on scheduled date`
      });
    }

    // =========================================================================
    // Aggregation & Feasibility Status Calculation
    // =========================================================================
    const blockingViolationsCount = violations.filter((v) => v.severity === 'BLOCKING').length;
    const warningsCount = violations.filter((v) => v.severity === 'WARNING').length;
    const isBlocked = blockingViolationsCount > 0;
    const isFeasible = !isBlocked;

    let status: 'FULLY_FEASIBLE' | 'FEASIBLE_WITH_WARNINGS' | 'BLOCKED' = 'FULLY_FEASIBLE';
    if (isBlocked) {
      status = 'BLOCKED';
    } else if (warningsCount > 0) {
      status = 'FEASIBLE_WITH_WARNINGS';
    }

    const bottleneckCategories = Array.from(new Set(violations.map((v) => v.category)));

    return {
      planId: plan.id,
      planNumber: plan.planNumber,
      customerCode: plan.customer.customerCode,
      itemCode: plan.item.itemCode,
      materialGrade: plan.item.materialGrade,
      status,
      isFeasible,
      isBlocked,
      blockingViolationsCount,
      warningsCount,
      violations,
      bottleneckCategories,
      evaluatedAt: new Date()
    };
  }

  public async factoryAudit(
    tenantId: string,
    query: any = {}
  ): Promise<FactoryConstraintAuditSummary> {
    const { plans } = await productionPlanRepository.queryPlans(tenantId, {
      status: query.status,
      limit: Math.min(100, Number(query.limit) || 50)
    });

    const planReports: PlanFeasibilityReport[] = [];
    const categoryCounts: Record<ConstraintCategory, { blocking: number; warning: number }> = {
      MATERIAL: { blocking: 0, warning: 0 },
      HEAT_LOT_AVAILABILITY: { blocking: 0, warning: 0 },
      FURNACE_CAPABILITY: { blocking: 0, warning: 0 },
      FURNACE_CAPACITY: { blocking: 0, warning: 0 },
      MACHINE_AVAILABILITY: { blocking: 0, warning: 0 },
      OPERATOR_AVAILABILITY: { blocking: 0, warning: 0 },
      OPERATOR_QUALIFICATION: { blocking: 0, warning: 0 },
      RECIPE_VALIDITY: { blocking: 0, warning: 0 },
      SPECIFICATION_VALIDITY: { blocking: 0, warning: 0 }
    };

    for (const plan of plans) {
      const report = await this.evaluatePlanConstraints(tenantId, plan.id);
      planReports.push(report);

      for (const v of report.violations) {
        if (categoryCounts[v.category]) {
          if (v.severity === 'BLOCKING') categoryCounts[v.category].blocking++;
          else if (v.severity === 'WARNING') categoryCounts[v.category].warning++;
        }
      }
    }

    const totalPlansEvaluated = planReports.length;
    const fullyFeasiblePlansCount = planReports.filter((r) => r.status === 'FULLY_FEASIBLE').length;
    const plansWithWarningsCount = planReports.filter(
      (r) => r.status === 'FEASIBLE_WITH_WARNINGS'
    ).length;
    const blockedPlansCount = planReports.filter((r) => r.isBlocked).length;

    const overallReadinessPercentage =
      totalPlansEvaluated > 0
        ? Math.round(((totalPlansEvaluated - blockedPlansCount) / totalPlansEvaluated) * 100)
        : 100;

    const categoryBreakdown = Object.entries(categoryCounts).map(([cat, counts]) => ({
      category: cat as ConstraintCategory,
      blockingCount: counts.blocking,
      warningCount: counts.warning
    }));

    const topBottlenecks = categoryBreakdown
      .filter((c) => c.blockingCount > 0)
      .sort((a, b) => b.blockingCount - a.blockingCount)
      .map((c) => ({
        category: c.category,
        affectedPlansCount: c.blockingCount,
        description: `Found ${c.blockingCount} blocking constraint(s) in category '${c.category}'`
      }));

    return {
      totalPlansEvaluated,
      fullyFeasiblePlansCount,
      plansWithWarningsCount,
      blockedPlansCount,
      overallReadinessPercentage,
      categoryBreakdown,
      topBottlenecks,
      planReports,
      auditedAt: new Date()
    };
  }
}

export const constraintAnalysisService = new ConstraintAnalysisService();
