import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Microscope,
  Truck,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Flame,
  Save,
  Plus,
  Trash2,
  Layers,
  FileCheck,
  Award,
  Lock,
  Scale,
  Calendar,
  Check
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppTabs, TabItem } from '../design-system/navigation/AppTabs.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { AppDialog } from '../design-system/feedback/AppDialog.js';
import { AppInput } from '../design-system/forms/AppInput.js';
import { AppSelect } from '../design-system/forms/AppSelect.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { EmptyState } from '../design-system/states/EmptyState.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

interface HardnessTestPoint {
  pointIdentifier: string;
  location: string;
  measuredValue: number;
  scale: string;
  passed: boolean;
}

interface BatchOrderInspection {
  _id?: string;
  id?: string;
  jobNumber: string;
  boNumber?: string;
  poNumber?: string;
  poId?: string;
  customerName?: string;
  customerCode?: string;
  supplierName?: string;
  grnId?: string;
  grnNumber?: string;
  heatLotNumber?: string;
  rawMaterialReceivedDate?: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  materialGrade?: string;
  drawingNumber?: string;
  uom?: string;
  recipeId?: string;
  recipeCode?: string;
  recipeName?: string;
  recipeRevision?: number | string;
  processFamily?: string;
  recipeStagesCount?: number;
  recipeStages?: Array<{
    sequence: number;
    stageName: string;
    targetTemperatureC: number;
    soakTimeMinutes: number;
    rampRateCPerMin?: number;
    atmosphere?: string;
  }>;
  isMasterRecipeProtected?: boolean;
  targetQuantity?: number;
  loadedQuantity?: number;
  completedQuantity?: number;
  scrappedQuantity?: number;
  weightKg?: number;
  loadedWeightKg?: number;
  dueDate?: string;
  actualCompletionDate?: string;
  assignedFurnaceCode?: string;
  assignedOperatorName?: string;
  shiftId?: string;
  chargeNumber?: string;
  stagesCompletedCount?: number;
  totalRecipeStages?: number;
  hasDeviations?: boolean;
  concessionApproved?: boolean;
  concessionReason?: string;
  productionCompleted?: boolean;
  isProductionDataLocked?: boolean;
  priority?: string;
  status: string;
  waitingForProduction?: boolean;
  inProduction?: boolean;
  waitingForInspection?: boolean;
  inInspection?: boolean;
  waitingForDispatch?: boolean;
  dispatched?: boolean;
  inspection?: boolean;
  workflowState?: {
    waitingForProduction?: boolean;
    inProduction?: boolean;
    waitingForInspection?: boolean;
    inInspection?: boolean;
    waitingForDispatch?: boolean;
    dispatched?: boolean;
    inspection?: boolean;
  };
  customer?: {
    customerCode: string;
    customerName: string;
  };
  item?: {
    itemCode: string;
    itemName: string;
    materialGrade: string;
    drawingNumber?: string;
    uom?: string;
  };
  quantity?: {
    targetQuantity: number;
    loadedQuantity: number;
    completedQuantity: number;
    scrappedQuantity: number;
    weightKg?: number;
  };
  recipeSnapshot?: {
    recipeCode: string;
    name: string;
    revision?: number;
    processFamily?: string;
    stages?: Array<{
      sequence: number;
      stageName: string;
      targetTemperatureC: number;
      soakTimeMinutes: number;
    }>;
  };
  equipmentAssignment?: {
    furnaceCode: string;
    furnaceId?: string;
    locationBay?: string;
  };
  execution?: {
    operatorAssignment?: {
      operatorName?: string;
      shiftId?: string;
    };
    recipeExecution?: {
      stagesCompleted?: any[];
      deviations?: any[];
      concessionApproved?: boolean;
      concessionReason?: string;
    };
    furnaceCharge?: {
      furnaceId?: string;
      furnaceCode?: string;
      loadedWeightKg?: number;
      chargeNumber?: string;
      loadedAt?: string;
    };
    inspectionData?: {
      furnaceId?: string;
      furnaceCode?: string;
      hardnessSpecification?: {
        minHardness?: number;
        maxHardness?: number;
        scale?: string;
        targetLocation?: string;
      };
      actualHardness?: {
        measuredAverage?: number;
        testPoints?: HardnessTestPoint[];
        isHardnessCompliant?: boolean;
      };
      caseDepth?: {
        effectiveCaseDepthMm?: number;
        caseDepthMethod?: string;
        isCaseDepthCompliant?: boolean;
      };
      quantityReceived?: number;
      quantityDelivered?: number;
      quantityRejected?: number;
      inspectedBy?: {
        userId?: string;
        email?: string;
        role?: string;
      };
      inspectedAt?: string;
      microstructureNotes?: string;
      remarks?: string;
      defectCategory?: string;
      defectReason?: string;
      [key: string]: any;
    };
    qualityHandoff?: {
      completedQuantity?: number;
      scrappedQuantity?: number;
      handoffNotes?: string;
    };
  };
  timeline?: {
    actualEndDate?: string;
    targetCompletionDate?: string;
    dueDate?: string;
  };
}

export const QualityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('WAITING_FOR_INSPECTION');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Queues
  const [waitingJobs, setWaitingJobs] = useState<BatchOrderInspection[]>([]);
  const [inInspectionJobs, setInInspectionJobs] = useState<BatchOrderInspection[]>([]);
  const [waitingDispatchJobs, setWaitingDispatchJobs] = useState<BatchOrderInspection[]>([]);
  const [failedJobs, setFailedJobs] = useState<BatchOrderInspection[]>([]);

  // Selected Active Job for Workbench
  const [activeJob, setActiveJob] = useState<BatchOrderInspection | null>(null);

  // Inspection Modals State
  const [recipeModalJob, setRecipeModalJob] = useState<BatchOrderInspection | null>(null);
  const [takeModalJob, setTakeModalJob] = useState<BatchOrderInspection | null>(null);
  const [takeNotes, setTakeNotes] = useState<string>('Claimed by inspector at QA station');

  // 6 Mandatory Heat-Treatment Inspection Fields Form State
  const [furnaceCode, setFurnaceCode] = useState<string>('');
  const [furnaceId, setFurnaceId] = useState<string>('');
  const [minHardness, setMinHardness] = useState<number>(58);
  const [maxHardness, setMaxHardness] = useState<number>(62);
  const [scale, setScale] = useState<string>('HRC');
  const [testPoints, setTestPoints] = useState<HardnessTestPoint[]>([
    { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 60.0, scale: 'HRC', passed: true },
    { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true },
    { pointIdentifier: 'P3-CORE', location: 'CORE', measuredValue: 35.0, scale: 'HRC', passed: true }
  ]);
  const [effectiveCaseDepthMm, setEffectiveCaseDepthMm] = useState<number>(0.85);
  const [caseDepthMethod, setCaseDepthMethod] = useState<string>('Microhardness Traverse (HV0.5 to 50 HRC)');
  const [isCaseDepthCompliant, setIsCaseDepthCompliant] = useState<boolean>(true);
  const [quantityReceived, setQuantityReceived] = useState<number>(100);
  const [quantityDelivered, setQuantityDelivered] = useState<number>(100);
  const [microstructureNotes, setMicrostructureNotes] = useState<string>('Tempered martensite matrix, CQI-9 compliant.');
  const [inspectionRemarks, setInspectionRemarks] = useState<string>('Heat treatment cycle verified and hardness certified.');

  // Quarantine / Failure Dialog State
  const [isQuarantineOpen, setIsQuarantineOpen] = useState<boolean>(false);
  const [defectCategory, setDefectCategory] = useState<string>('OUT_OF_SPEC_HARDNESS');
  const [defectReason, setDefectReason] = useState<string>('');

  const fetchAllQueues = useCallback(async () => {
    setIsLoading(true);
    try {
      const [waitRes, inInspRes, waitDispRes, failRes] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/api/v1/production-jobs/queue/waiting-for-inspection`),
        authenticatedFetch(`${env.API_BASE_URL}/api/v1/production-jobs/queue/in-inspection`),
        authenticatedFetch(`${env.API_BASE_URL}/api/v1/production-jobs/queue/waiting-for-dispatch`),
        authenticatedFetch(`${env.API_BASE_URL}/api/v1/production-jobs/queue/inspection-failed`)
      ]);

      if (waitRes.status === 403 || inInspRes.status === 403) {
        setFeedback({
          type: 'error',
          message: 'Access Denied: Quality Inspection permissions (QUALITY_INSPECTION_VIEW) are required to access this workspace.'
        });
        setIsLoading(false);
        return;
      }

      if (waitRes.ok) {
        const data = await waitRes.json();
        setWaitingJobs(data.data || []);
      }
      if (inInspRes.ok) {
        const data = await inInspRes.json();
        const inJobs: BatchOrderInspection[] = data.data || [];
        setInInspectionJobs(inJobs);

        if (inJobs.length > 0) {
          setActiveJob((prev) => {
            if (!prev) return inJobs[0];
            const found = inJobs.find((j) => (j.id || j._id) === (prev.id || prev._id));
            return found || inJobs[0];
          });
        } else {
          setActiveJob(null);
        }
      }
      if (waitDispRes.ok) {
        const data = await waitDispRes.json();
        setWaitingDispatchJobs(data.data || []);
      }
      if (failRes.ok) {
        const data = await failRes.json();
        setFailedJobs(data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching inspection queues:', err);
      setFeedback({
        type: 'error',
        message: 'Could not refresh inspection queues from server: ' + (err.message || 'Network error')
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllQueues();
  }, [fetchAllQueues]);

  // Synchronize form values whenever activeJob changes
  useEffect(() => {
    if (!activeJob) return;

    const data = activeJob.execution?.inspectionData;
    const fallbackFurnaceCode =
      data?.furnaceCode ||
      activeJob.execution?.furnaceCharge?.furnaceCode ||
      activeJob.equipmentAssignment?.furnaceCode ||
      'FURNACE-HT-01';
    const fallbackFurnaceId =
      data?.furnaceId ||
      activeJob.execution?.furnaceCharge?.furnaceId ||
      activeJob.equipmentAssignment?.furnaceId ||
      'furnace_01';

    setFurnaceCode(fallbackFurnaceCode);
    setFurnaceId(fallbackFurnaceId);

    const hardnessSpec = data?.hardnessSpecification;
    setMinHardness(hardnessSpec?.minHardness ?? 58);
    setMaxHardness(hardnessSpec?.maxHardness ?? 62);
    setScale(hardnessSpec?.scale || 'HRC');

    const points = data?.actualHardness?.testPoints;
    if (points && points.length > 0) {
      setTestPoints(points);
    } else {
      setTestPoints([
        { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 60.0, scale: 'HRC', passed: true },
        { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true },
        { pointIdentifier: 'P3-CORE', location: 'CORE', measuredValue: 35.0, scale: 'HRC', passed: true }
      ]);
    }

    const cd = data?.caseDepth;
    setEffectiveCaseDepthMm(cd?.effectiveCaseDepthMm ?? 0.85);
    setCaseDepthMethod(cd?.caseDepthMethod || 'Microhardness Traverse (HV0.5 to 50 HRC)');
    setIsCaseDepthCompliant(cd?.isCaseDepthCompliant ?? true);

    const loadedQty =
      data?.quantityReceived ??
      activeJob.execution?.qualityHandoff?.completedQuantity ??
      activeJob.quantity?.completedQuantity ??
      activeJob.quantity?.loadedQuantity ??
      activeJob.quantity?.targetQuantity ??
      100;
    setQuantityReceived(loadedQty);

    const deliveredQty = data?.quantityDelivered ?? loadedQty;
    setQuantityDelivered(deliveredQty);

    setMicrostructureNotes(data?.microstructureNotes || 'Tempered martensite matrix, CQI-9 compliant.');
    setInspectionRemarks(data?.remarks || 'Heat treatment cycle verified and hardness certified.');
  }, [activeJob]);

  // Derived calculation for hardness average and compliance
  const measuredAverage =
    testPoints.length > 0
      ? Number((testPoints.reduce((sum, p) => sum + (Number(p.measuredValue) || 0), 0) / testPoints.length).toFixed(2))
      : 0;

  const isHardnessCompliant =
    measuredAverage >= minHardness &&
    measuredAverage <= maxHardness &&
    testPoints.every((p) => p.passed !== false);

  const quantityRejected = Math.max(0, quantityReceived - quantityDelivered);

  // Take for Inspection Handler
  const handleTakeForInspection = async (job: BatchOrderInspection, notes?: string) => {
    setIsActionLoading(true);
    setFeedback(null);
    try {
      const jobId = job.id || job._id;
      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/take-for-inspection`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: notes || takeNotes || 'Claimed by inspector at QA station'
          })
        }
      );

      const json = await res.json();

      if (res.status === 409) {
        setFeedback({
          type: 'warning',
          message: `Concurrency Conflict: Batch Order ${job.boNumber || job.jobNumber} was just claimed by another inspector. The queue has been automatically refreshed.`
        });
        setTakeModalJob(null);
        await fetchAllQueues();
        return;
      }

      if (res.status === 403) {
        setFeedback({
          type: 'error',
          message: `Access Denied: Quality Inspection permissions are required to claim Batch Orders for inspection.`
        });
        setTakeModalJob(null);
        return;
      }

      if (!res.ok) {
        throw new Error(json.message || 'Failed to claim Batch Order for inspection');
      }

      setFeedback({
        type: 'success',
        message: `Batch Order ${job.boNumber || job.jobNumber} successfully taken for inspection! Active workbench opened.`
      });

      setTakeModalJob(null);
      await fetchAllQueues();
      setActiveJob(json.data || job);
      setActiveTab('IN_INSPECTION');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error taking job for inspection'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Save Inspection Progress Handler
  const handleSaveProgress = async () => {
    if (!activeJob) return;
    setIsActionLoading(true);
    setFeedback(null);
    try {
      const jobId = activeJob.id || activeJob._id;
      const payload = {
        furnaceId,
        furnaceCode,
        minHardness,
        maxHardness,
        scale,
        hardnessSpecification: {
          minHardness,
          maxHardness,
          scale,
          targetLocation: 'Surface & Core'
        },
        actualHardness: {
          measuredAverage,
          testPoints,
          isHardnessCompliant
        },
        caseDepth: {
          effectiveCaseDepthMm,
          caseDepthMethod,
          isCaseDepthCompliant
        },
        effectiveCaseDepthMm,
        caseDepthMethod,
        isCaseDepthCompliant,
        quantityReceived,
        quantityDelivered,
        quantityRejected,
        microstructureNotes,
        remarks: inspectionRemarks
      };

      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/inspection-data`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save inspection draft data');
      }

      setFeedback({
        type: 'success',
        message: 'Inspection telemetry and test data saved successfully.'
      });
      await fetchAllQueues();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error saving inspection data'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Approve for Dispatch Handler
  const handleApproveForDispatch = async () => {
    if (!activeJob) return;

    if (!furnaceCode || !furnaceId) {
      setFeedback({ type: 'warning', message: 'Mandatory Field 1 Missing: Valid furnace/equipment identifier is required.' });
      return;
    }
    if (minHardness == null || maxHardness == null || minHardness <= 0 || maxHardness < minHardness) {
      setFeedback({ type: 'warning', message: 'Mandatory Field 2 Invalid: Valid min & max hardness specification is required.' });
      return;
    }
    if (!testPoints || testPoints.length === 0 || measuredAverage <= 0) {
      setFeedback({ type: 'warning', message: 'Mandatory Field 3 Invalid: Actual hardness test points and compliant average required.' });
      return;
    }
    if (effectiveCaseDepthMm == null || effectiveCaseDepthMm <= 0 || !caseDepthMethod) {
      setFeedback({ type: 'warning', message: 'Mandatory Field 4 Missing: Case depth measurement and method are required.' });
      return;
    }
    if (!quantityReceived || quantityReceived <= 0) {
      setFeedback({ type: 'warning', message: 'Mandatory Field 5 Invalid: Quantity received must be greater than 0.' });
      return;
    }
    if (!quantityDelivered || quantityDelivered <= 0 || quantityDelivered > quantityReceived) {
      setFeedback({
        type: 'warning',
        message: `Mandatory Field 6 Invalid: Quantity delivered must be between 1 and quantity received (${quantityReceived}).`
      });
      return;
    }

    setIsActionLoading(true);
    setFeedback(null);
    try {
      const jobId = activeJob.id || activeJob._id;
      const payload = {
        furnaceId,
        furnaceCode,
        minHardness,
        maxHardness,
        scale,
        measuredAverage,
        effectiveCaseDepthMm,
        caseDepthMethod,
        isCaseDepthCompliant,
        quantityReceived,
        quantityDelivered,
        quantityRejected,
        testPoints,
        microstructureNotes,
        remarks: inspectionRemarks
      };

      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/approve-inspection`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to approve inspection for dispatch');
      }

      setFeedback({
        type: 'success',
        message: `Batch Order ${activeJob.boNumber || activeJob.jobNumber} approved! Moved to 'Waiting for Dispatch'. Note: Dispatch Department will execute final customer delivery.`
      });

      await fetchAllQueues();
      setActiveTab('WAITING_FOR_DISPATCH');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error approving inspection'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Fail Inspection Handler
  const handleFailInspection = async () => {
    if (!activeJob) return;
    if (!defectReason.trim()) {
      setFeedback({ type: 'warning', message: 'Defect Reason is required to fail inspection and quarantine.' });
      return;
    }

    setIsActionLoading(true);
    setFeedback(null);
    try {
      const jobId = activeJob.id || activeJob._id;
      const payload = {
        defectCategory,
        defectReason,
        furnaceId,
        furnaceCode,
        minHardness,
        maxHardness,
        scale,
        measuredAverage,
        effectiveCaseDepthMm,
        quantityReceived,
        testPoints,
        remarks: inspectionRemarks
      };

      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/fail-inspection`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to record inspection failure');
      }

      setFeedback({
        type: 'error',
        message: `Batch Order ${activeJob.boNumber || activeJob.jobNumber} failed inspection and was quarantined. State moved to 'INSPECTION'.`
      });

      setIsQuarantineOpen(false);
      setDefectReason('');
      await fetchAllQueues();
      setActiveTab('INSPECTION_FAILED');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error failing inspection'
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Hardness Test Point Mutators
  const handleAddTestPoint = () => {
    const nextIdx = testPoints.length + 1;
    setTestPoints([
      ...testPoints,
      {
        pointIdentifier: `P${nextIdx}-SURFACE`,
        location: 'SURFACE',
        measuredValue: Number(minHardness) || 60,
        scale,
        passed: true
      }
    ]);
  };

  const handleUpdateTestPoint = (idx: number, field: keyof HardnessTestPoint, value: any) => {
    const next = [...testPoints];
    next[idx] = { ...next[idx], [field]: value };
    if (field === 'measuredValue') {
      const val = Number(value);
      next[idx].passed = val >= minHardness && val <= maxHardness;
    }
    setTestPoints(next);
  };

  const handleRemoveTestPoint = (idx: number) => {
    if (testPoints.length <= 1) return;
    setTestPoints(testPoints.filter((_, i) => i !== idx));
  };

  // Tabs Configuration
  const tabs: TabItem[] = [
    {
      id: 'WAITING_FOR_INSPECTION',
      label: 'Waiting for Inspection',
      icon: <Clock size={16} />,
      count: waitingJobs.length
    },
    {
      id: 'IN_INSPECTION',
      label: 'In-Inspection Active Workbench',
      icon: <Microscope size={16} />,
      count: inInspectionJobs.length
    },
    {
      id: 'WAITING_FOR_DISPATCH',
      label: 'Waiting for Dispatch',
      icon: <Truck size={16} />,
      count: waitingDispatchJobs.length
    },
    {
      id: 'INSPECTION_FAILED',
      label: 'Quarantined / Failed',
      icon: <AlertTriangle size={16} />,
      count: failedJobs.length
    }
  ];

  // Filtering helpers
  const filterJobs = (list: BatchOrderInspection[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (j) =>
        (j.boNumber && j.boNumber.toLowerCase().includes(q)) ||
        (j.jobNumber && j.jobNumber.toLowerCase().includes(q)) ||
        (j.customer?.customerName && j.customer.customerName.toLowerCase().includes(q)) ||
        (j.item?.itemName && j.item.itemName.toLowerCase().includes(q)) ||
        (j.item?.materialGrade && j.item.materialGrade.toLowerCase().includes(q))
    );
  };

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Heat-Treatment Quality & Inspection Phase"
        subtitle="Authoritative QA Gate: Waiting for Inspection → In-Inspection Workbench → Waiting for Dispatch / Quarantined"
        badge={
          <StatusBadge
            status={`Total Active In Queue: ${waitingJobs.length + inInspectionJobs.length}`}
            variant="info"
          />
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <AppButton
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
              onClick={fetchAllQueues}
              disabled={isLoading}
            >
              Refresh Queues
            </AppButton>
          </div>
        }
      />

      {/* Global Feedback Banner */}
      {feedback && (
        <div style={{ marginBottom: '16px' }}>
          <AppAlert
            type={feedback.type}
            title={feedback.type === 'success' ? 'Success' : feedback.type === 'error' ? 'Quality Alert' : 'Verification Required'}
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <AppCard
          style={{
            borderLeft: '4px solid var(--color-warning, #f59e0b)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Waiting for Inspection
              </p>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 700 }}>
                {waitingJobs.length}
              </h2>
            </div>
            <Clock size={28} color="var(--color-warning, #f59e0b)" />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'block' }}>
            Handoffs pending inspector claim
          </span>
        </AppCard>

        <AppCard
          style={{
            borderLeft: '4px solid var(--color-info, #0ea5e9)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                In-Inspection Workbench
              </p>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 700 }}>
                {inInspectionJobs.length}
              </h2>
            </div>
            <Microscope size={28} color="var(--color-info, #0ea5e9)" />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'block' }}>
            Active testing & data verification
          </span>
        </AppCard>

        <AppCard
          style={{
            borderLeft: '4px solid var(--color-success, #10b981)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Waiting for Dispatch
              </p>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 700 }}>
                {waitingDispatchJobs.length}
              </h2>
            </div>
            <Truck size={28} color="var(--color-success, #10b981)" />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'block' }}>
            Approved conforming — ready for dispatch
          </span>
        </AppCard>

        <AppCard
          style={{
            borderLeft: '4px solid var(--color-danger, #ef4444)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Quarantined / Defective
              </p>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 700 }}>
                {failedJobs.length}
              </h2>
            </div>
            <AlertTriangle size={28} color="var(--color-danger, #ef4444)" />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'block' }}>
            Non-conforming lots in status INSPECTION
          </span>
        </AppCard>
      </div>

      {/* Tabs Navigation */}
      <div style={{ marginBottom: '16px' }}>
        <AppTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} />
      </div>

      {/* Search Bar for Queues */}
      {activeTab !== 'IN_INSPECTION' && (
        <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <AppInput
            placeholder="Search by BO#, Customer, Part, or Grade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: WAITING FOR INSPECTION QUEUE                                       */}
      {/* ========================================================================= */}
      {activeTab === 'WAITING_FOR_INSPECTION' && (
        <div>
          {filterJobs(waitingJobs).length === 0 ? (
            <EmptyState
              title="No Batch Orders Waiting for Inspection"
              description="All production batch orders have either been claimed for inspection or are currently in manufacturing."
              icon={<ShieldCheck size={48} color="var(--color-text-secondary)" />}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filterJobs(waitingJobs).map((job) => {
                const poNum = job.poNumber || (job as any).genealogy?.poNumber || 'N/A';
                const grnNum = job.grnNumber || (job as any).genealogy?.grnNumber || 'N/A';
                const heatLot = job.heatLotNumber || (job as any).genealogy?.heatLotNumber || 'N/A';
                const custName = job.customerName || job.customer?.customerName || 'N/A';
                const custCode = job.customerCode || job.customer?.customerCode;

                const itmCode = job.itemCode || job.item?.itemCode || 'N/A';
                const itmName = job.itemName || job.item?.itemName || 'Heat Treated Part';
                const matGrade = job.materialGrade || job.item?.materialGrade || 'Alloy';
                const drwNum = job.drawingNumber || job.item?.drawingNumber || 'N/A';
                const uomVal = job.uom || job.item?.uom || 'PCS';

                const rcpCode = job.recipeCode || job.recipeSnapshot?.recipeCode || 'N/A';
                const rcpName = job.recipeName || job.recipeSnapshot?.name || 'Heat Treatment Recipe';
                const rcpRev = job.recipeRevision || job.recipeSnapshot?.revision || 1;

                const loadedQty = job.loadedQuantity || job.quantity?.loadedQuantity || 0;
                const completedQty =
                  job.completedQuantity ??
                  job.execution?.qualityHandoff?.completedQuantity ??
                  job.quantity?.completedQuantity ??
                  loadedQty;
                const scrapQty =
                  job.scrappedQuantity ??
                  job.execution?.qualityHandoff?.scrappedQuantity ??
                  job.quantity?.scrappedQuantity ??
                  0;
                const weightVal =
                  job.weightKg ??
                  job.execution?.furnaceCharge?.loadedWeightKg ??
                  job.quantity?.weightKg ??
                  0;

                const dueDt = job.dueDate || job.timeline?.dueDate || job.timeline?.targetCompletionDate;
                const isOverdue = dueDt ? new Date(dueDt).getTime() < Date.now() : false;

                const furnace =
                  job.assignedFurnaceCode ||
                  job.execution?.furnaceCharge?.furnaceCode ||
                  job.equipmentAssignment?.furnaceCode ||
                  'N/A';
                const operator =
                  job.assignedOperatorName ||
                  job.execution?.operatorAssignment?.operatorName ||
                  'Authorized Operator';
                const shift = job.shiftId || job.execution?.operatorAssignment?.shiftId || 'SHIFT-A';
                const charge =
                  job.chargeNumber ||
                  job.execution?.furnaceCharge?.chargeNumber ||
                  'CHG-01';
                const stagesComp =
                  job.stagesCompletedCount ||
                  job.execution?.recipeExecution?.stagesCompleted?.length ||
                  0;
                const totalStages =
                  job.totalRecipeStages ||
                  job.recipeStagesCount ||
                  job.recipeSnapshot?.stages?.length ||
                  stagesComp;

                return (
                  <AppCard
                    key={job.id || job._id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      padding: '20px 24px',
                      borderLeft: '5px solid var(--color-warning, #f59e0b)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* Top Header Bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        paddingBottom: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {job.boNumber || job.jobNumber}
                        </span>
                        <StatusBadge status="WAITING FOR INSPECTION" variant="warning" size="sm" />
                        {job.priority && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                job.priority === 'URGENT'
                                  ? 'var(--color-danger-subtle, rgba(239, 68, 68, 0.15))'
                                  : 'var(--color-neutral-subtle, rgba(100, 116, 139, 0.15))',
                              color:
                                job.priority === 'URGENT'
                                  ? 'var(--color-danger, #ef4444)'
                                  : 'var(--color-text-secondary)'
                            }}
                          >
                            {job.priority} PRIORITY
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Check size={12} /> Production Complete — Ready for QA
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-secondary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Lock size={12} /> Production Records Locked
                        </span>
                      </div>
                    </div>

                    {/* Authoritative Information Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '16px'
                      }}
                    >
                      {/* Column 1: Lineage (PO & GRN) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          Lineage & Traceability
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          Customer: <strong>{custName}</strong> {custCode && `(${custCode})`}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          PO: <strong>{poNum}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          GRN: <strong>{grnNum}</strong> | Heat: <strong>{heatLot}</strong>
                        </div>
                      </div>

                      {/* Column 2: Part Specs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          Part & Metallurgy
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                          {itmCode} — {itmName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Material Grade: <strong>{matGrade}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Drawing: <strong>{drwNum}</strong>
                        </div>
                      </div>

                      {/* Column 3: Recipe Authority & Protection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          Governing Recipe (Protected)
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                          {rcpCode}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {rcpName} <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>(REV {rcpRev})</span>
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          <AppButton
                            variant="ghost"
                            size="sm"
                            leftIcon={<FileCheck size={13} />}
                            onClick={() => setRecipeModalJob(job)}
                            style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                          >
                            View Recipe Specifications
                          </AppButton>
                        </div>
                      </div>

                      {/* Column 4: Quantities & Weight */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          Quantities & Weight
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          QA Intake Qty: <strong style={{ color: 'var(--color-primary)' }}>{completedQty} {uomVal}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Loaded: {loadedQty} {uomVal} | Scrap: {scrapQty} {uomVal}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Scale size={13} /> Weight: <strong>{weightVal} kg</strong>
                        </div>
                      </div>

                      {/* Column 5: Production Execution Telemetry */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          Production Execution
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Furnace: <strong>{furnace}</strong> | Chg: <strong>{charge}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Op: <strong>{operator}</strong> ({shift})
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Stages: <strong>{stagesComp} of {totalStages}</strong> verified
                        </div>
                        {(job.hasDeviations || job.concessionApproved) && (
                          <div style={{ fontSize: '11px', color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>
                            ⚠ Concession: {job.concessionReason || 'Approved deviation'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions Strip */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: isOverdue ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary)',
                            fontWeight: isOverdue ? 700 : 400,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Calendar size={13} /> Due Date:{' '}
                          {dueDt ? new Date(dueDt).toLocaleDateString() : 'N/A'}{' '}
                          {isOverdue && '(OVERDUE)'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <AppButton
                          variant="secondary"
                          size="sm"
                          leftIcon={<FileCheck size={14} />}
                          onClick={() => setRecipeModalJob(job)}
                        >
                          View Recipe
                        </AppButton>
                        <AppButton
                          variant="primary"
                          size="sm"
                          leftIcon={<Microscope size={14} />}
                          onClick={() => {
                            setTakeModalJob(job);
                            setTakeNotes('Claimed by inspector at QA station');
                          }}
                          disabled={isActionLoading}
                        >
                          Take for Inspection
                        </AppButton>
                      </div>
                    </div>
                  </AppCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: IN-INSPECTION ACTIVE WORKBENCH                                     */}
      {/* ========================================================================= */}
      {activeTab === 'IN_INSPECTION' && (
        <div>
          {inInspectionJobs.length === 0 ? (
            <EmptyState
              title="No Batch Orders Currently in Inspection"
              description="Claim a batch order from the 'Waiting for Inspection' queue to begin active metallurgical testing."
              icon={<Microscope size={48} color="var(--color-text-secondary)" />}
              actionLabel="View Waiting Queue"
              onAction={() => setActiveTab('WAITING_FOR_INSPECTION')}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
              {/* Left Column: Active In-Inspection List */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Inspections ({inInspectionJobs.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inInspectionJobs.map((job) => {
                    const isSelected = (job.id || job._id) === (activeJob?.id || activeJob?._id);
                    return (
                      <div
                        key={job.id || job._id}
                        onClick={() => setActiveJob(job)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md, 8px)',
                          background: isSelected ? 'var(--color-primary-subtle, rgba(249, 115, 22, 0.1))' : 'var(--material-thin)',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? 'var(--color-primary)' : 'inherit' }}>
                            {job.boNumber || job.jobNumber}
                          </span>
                          <StatusBadge status="IN INSPECTION" variant="info" size="sm" dot={false} />
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          {job.customer?.customerName || 'Standard Client'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {job.item?.itemName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Complete Heat-Treatment Inspection Workbench */}
              {activeJob && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* BO Lineage & Recipe Target Banner */}
                  <AppCard style={{ padding: '16px 20px', borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px' }}>
                            {activeJob.boNumber || activeJob.jobNumber}
                          </h3>
                          <StatusBadge status="IN INSPECTION" variant="info" />
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            PO: <strong>{activeJob.poNumber || 'N/A'}</strong> | GRN: <strong>{activeJob.grnNumber || 'N/A'}</strong>
                          </span>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          Customer: <strong>{activeJob.customer?.customerName}</strong> | Item:{' '}
                          <strong>{activeJob.item?.itemName}</strong> ({activeJob.item?.materialGrade})
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Process Family
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>
                          {activeJob.recipeSnapshot?.processFamily || 'HEAT_TREATMENT'}
                        </div>
                      </div>
                    </div>
                  </AppCard>

                  {/* 6 Mandatory Heat-Treatment Fields Container */}
                  <AppCard style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <FileCheck size={20} color="var(--color-primary)" />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                        Six Mandatory Heat-Treatment Inspection Fields
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                        * All 6 fields strictly enforced before approval
                      </span>
                    </div>

                    {/* Section 1: Furnace / Equipment Verification */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Flame size={14} /> 1. Equipment & Furnace Verification
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Furnace / Equipment Code *
                          </label>
                          <AppInput
                            value={furnaceCode}
                            onChange={(e) => setFurnaceCode(e.target.value)}
                            placeholder="e.g. FURNACE-VAC-01"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Equipment ID *
                          </label>
                          <AppInput
                            value={furnaceId}
                            onChange={(e) => setFurnaceId(e.target.value)}
                            placeholder="e.g. furnace_vac_01"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Hardness Specification Targets */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={14} /> 2. Hardness Specification Targets
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Minimum Hardness *
                          </label>
                          <AppInput
                            type="number"
                            value={minHardness}
                            onChange={(e) => setMinHardness(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Maximum Hardness *
                          </label>
                          <AppInput
                            type="number"
                            value={maxHardness}
                            onChange={(e) => setMaxHardness(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Hardness Scale *
                          </label>
                          <AppSelect
                            value={scale}
                            onChange={(e) => setScale(e.target.value)}
                            options={[
                              { value: 'HRC', label: 'Rockwell C (HRC)' },
                              { value: 'HBW', label: 'Brinell (HBW)' },
                              { value: 'HV', label: 'Vickers (HV)' },
                              { value: 'HRB', label: 'Rockwell B (HRB)' }
                            ]}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Actual Hardness Measurements & Test Points */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Microscope size={14} /> 3. Actual Hardness & Multi-Point Traverse
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '13px' }}>
                            Average:{' '}
                            <strong style={{ color: isHardnessCompliant ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {measuredAverage} {scale}
                            </strong>
                          </div>
                          <StatusBadge
                            status={isHardnessCompliant ? 'HARDNESS COMPLIANT' : 'OUT OF SPECIFICATION'}
                            variant={isHardnessCompliant ? 'success' : 'danger'}
                            size="sm"
                          />
                          <AppButton
                            variant="secondary"
                            size="sm"
                            leftIcon={<Plus size={12} />}
                            onClick={handleAddTestPoint}
                          >
                            Add Test Point
                          </AppButton>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {testPoints.map((pt, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px 140px 140px 100px 40px',
                              gap: '12px',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'var(--material-thin)',
                              borderRadius: '6px'
                            }}
                          >
                            <AppInput
                              value={pt.pointIdentifier}
                              onChange={(e) => handleUpdateTestPoint(idx, 'pointIdentifier', e.target.value)}
                              placeholder="ID (e.g. P1)"
                            />
                            <AppSelect
                              value={pt.location}
                              onChange={(e) => handleUpdateTestPoint(idx, 'location', e.target.value)}
                              options={[
                                { value: 'SURFACE', label: 'Surface' },
                                { value: 'CORE', label: 'Core' },
                                { value: 'TRANSITION', label: 'Transition' },
                                { value: 'ROOT', label: 'Tooth Root' }
                              ]}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <AppInput
                                type="number"
                                step="0.1"
                                value={pt.measuredValue}
                                onChange={(e) => handleUpdateTestPoint(idx, 'measuredValue', Number(e.target.value))}
                              />
                              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{scale}</span>
                            </div>
                            <StatusBadge
                              status={pt.passed ? 'PASS' : 'FAIL'}
                              variant={pt.passed ? 'success' : 'danger'}
                              size="sm"
                              dot={false}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveTestPoint(idx)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text-secondary)'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 4: Case Depth Verification */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} /> 4. Effective Case Depth Verification
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Effective Case Depth (mm) *
                          </label>
                          <AppInput
                            type="number"
                            step="0.01"
                            value={effectiveCaseDepthMm}
                            onChange={(e) => setEffectiveCaseDepthMm(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Measurement Method *
                          </label>
                          <AppInput
                            value={caseDepthMethod}
                            onChange={(e) => setCaseDepthMethod(e.target.value)}
                            placeholder="e.g. Microhardness Traverse (HV0.5 to 50 HRC)"
                          />
                        </div>
                        <div style={{ paddingTop: '20px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={isCaseDepthCompliant}
                              onChange={(e) => setIsCaseDepthCompliant(e.target.checked)}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <strong>Case Depth Compliant</strong>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Section 5 & 6: Quantity Received & Delivered */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} /> 5 & 6. Quantity Reconciliation & Delivery Staging
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            5. Quantity Received from Production *
                          </label>
                          <AppInput
                            type="number"
                            value={quantityReceived}
                            onChange={(e) => setQuantityReceived(Number(e.target.value))}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            Must be greater than 0
                          </span>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            6. Quantity Delivered (Conforming) *
                          </label>
                          <AppInput
                            type="number"
                            value={quantityDelivered}
                            onChange={(e) => setQuantityDelivered(Number(e.target.value))}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            Staged for Dispatch (1 to {quantityReceived})
                          </span>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Quantity Rejected / Non-Conforming
                          </label>
                          <AppInput
                            type="number"
                            disabled
                            value={quantityRejected}
                          />
                          <span style={{ fontSize: '11px', color: quantityRejected > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                            {quantityRejected > 0 ? `${quantityRejected} parts rejected` : 'Zero defect lot'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metallurgical Notes & Remarks */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Microstructure & Metallurgical Observation Notes
                          </label>
                          <AppInput
                            value={microstructureNotes}
                            onChange={(e) => setMicrostructureNotes(e.target.value)}
                            placeholder="e.g. Fine tempered martensite, no decarburization."
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            Quality Inspector Remarks / Certificate Notes
                          </label>
                          <AppInput
                            value={inspectionRemarks}
                            onChange={(e) => setInspectionRemarks(e.target.value)}
                            placeholder="e.g. Conforms to drawing HT-4340-REV-C."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--color-border-subtle)'
                      }}
                    >
                      <AppButton
                        variant="secondary"
                        size="md"
                        leftIcon={<Save size={16} />}
                        onClick={handleSaveProgress}
                        disabled={isActionLoading}
                      >
                        Save Progress
                      </AppButton>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <AppButton
                          variant="danger"
                          size="md"
                          leftIcon={<XCircle size={16} />}
                          onClick={() => setIsQuarantineOpen(true)}
                          disabled={isActionLoading}
                        >
                          Fail Inspection / Quarantine
                        </AppButton>

                        <AppButton
                          variant="primary"
                          size="md"
                          leftIcon={<CheckCircle2 size={16} />}
                          onClick={handleApproveForDispatch}
                          disabled={isActionLoading}
                        >
                          Approve for Dispatch
                        </AppButton>
                      </div>
                    </div>
                  </AppCard>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WAITING FOR DISPATCH QUEUE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'WAITING_FOR_DISPATCH' && (
        <div>
          <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--color-info-subtle)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-info)' }}>
            <strong>Inspection Boundary Rule:</strong> Inspection approves conformity and stages batch orders into this queue.
            Actual dispatch release, customer packing slip, and freight logistics are performed exclusively by the <strong>Dispatch Phase</strong>.
          </div>

          {filterJobs(waitingDispatchJobs).length === 0 ? (
            <EmptyState
              title="No Batch Orders Waiting for Dispatch"
              description="Batch orders that pass inspection will appear here ready for dispatch handoff."
              icon={<Truck size={48} color="var(--color-text-secondary)" />}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filterJobs(waitingDispatchJobs).map((job) => {
                const insp = job.execution?.inspectionData;
                return (
                  <AppCard
                    key={job.id || job._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderLeft: '4px solid var(--color-success, #10b981)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-success)' }}>
                          {job.boNumber || job.jobNumber}
                        </span>
                        <StatusBadge status="WAITING FOR DISPATCH" variant="success" size="sm" />
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Customer: <strong>{job.customer?.customerName}</strong> | Item:{' '}
                        <strong>{job.item?.itemName}</strong> ({job.item?.materialGrade})
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Delivered Qty</div>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>
                          {insp?.quantityDelivered ?? job.quantity?.completedQuantity} {job.item?.uom || 'PCS'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Measured Hardness</div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>
                          {insp?.actualHardness?.measuredAverage ?? '60.2'} {insp?.hardnessSpecification?.scale || 'HRC'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '16px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Effective Case Depth</div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>
                          {insp?.caseDepth?.effectiveCaseDepthMm ?? '0.85'} mm
                        </div>
                      </div>

                      <StatusBadge status="CONFORMING" variant="success" size="md" />
                    </div>
                  </AppCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INSPECTION FAILED / QUARANTINED QUEUE                              */}
      {/* ========================================================================= */}
      {activeTab === 'INSPECTION_FAILED' && (
        <div>
          {filterJobs(failedJobs).length === 0 ? (
            <EmptyState
              title="No Quarantined Batch Orders"
              description="Zero non-conforming batch orders currently flagged in quarantine."
              icon={<CheckCircle2 size={48} color="var(--color-success)" />}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filterJobs(failedJobs).map((job) => {
                const insp = job.execution?.inspectionData;
                return (
                  <AppCard
                    key={job.id || job._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderLeft: '4px solid var(--color-danger, #ef4444)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-danger)' }}>
                          {job.boNumber || job.jobNumber}
                        </span>
                        <StatusBadge status="INSPECTION (FAILED)" variant="danger" size="sm" />
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>
                          Category: {insp?.defectCategory || 'OUT_OF_SPEC'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Customer: <strong>{job.customer?.customerName}</strong> | Item:{' '}
                        <strong>{job.item?.itemName}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '4px', fontStyle: 'italic' }}>
                        Reason: {insp?.defectReason || 'Failed hardness or case depth criteria.'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Scrapped / Quarantined Qty</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-danger)' }}>
                          {insp?.quantityRejected ?? job.quantity?.loadedQuantity} {job.item?.uom || 'PCS'}
                        </div>
                      </div>

                      <StatusBadge status="QUARANTINED" variant="danger" size="md" />
                    </div>
                  </AppCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quarantine / Fail Dialog */}
      <AppDialog
        isOpen={isQuarantineOpen}
        onClose={() => setIsQuarantineOpen(false)}
        title="Fail Inspection & Quarantine Batch Order"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsQuarantineOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              leftIcon={<AlertTriangle size={16} />}
              onClick={handleFailInspection}
              disabled={isActionLoading || !defectReason.trim()}
            >
              Confirm Quarantine Failure
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Failing this batch order will immediately set its state to the authoritative failure status{' '}
            <strong style={{ color: 'var(--color-danger)' }}>INSPECTION</strong> (with flag{' '}
            <code>inspection: true</code>) and lock it in quarantine.
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Defect Category *
            </label>
            <AppSelect
              value={defectCategory}
              onChange={(e) => setDefectCategory(e.target.value)}
              options={[
                { value: 'OUT_OF_SPEC_HARDNESS', label: 'Out of Specification Hardness' },
                { value: 'SURFACE_DECARBURIZATION', label: 'Surface Decarburization' },
                { value: 'INSUFFICIENT_CASE_DEPTH', label: 'Insufficient Case Depth' },
                { value: 'EXCESSIVE_DISTORTION_WARPAGE', label: 'Excessive Distortion / Warpage' },
                { value: 'MICROSTRUCTURE_DEFECT', label: 'Microstructure Non-Conformance (AMS/CQI-9)' },
                { value: 'QUENCH_CRACKING', label: 'Quench Cracking' }
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Defect Reason / Failure Justification *
            </label>
            <AppInput
              value={defectReason}
              onChange={(e) => setDefectReason(e.target.value)}
              placeholder="Detail the failure mode, traverse deviations, and metallurgical findings..."
            />
          </div>
        </div>
      </AppDialog>

      {/* Recipe Specifications Read-Only Inspection Dialog */}
      <AppDialog
        isOpen={Boolean(recipeModalJob)}
        onClose={() => setRecipeModalJob(null)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={20} color="var(--color-primary)" />
            <span>
              Governing Recipe: {recipeModalJob?.recipeCode || recipeModalJob?.recipeSnapshot?.recipeCode}
            </span>
          </div>
        }
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" onClick={() => setRecipeModalJob(null)}>
              Close Specifications
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Master Recipe Immutability Banner */}
          <AppAlert type="info" title="Governing Recipe Specification Locked">
            <div style={{ fontSize: '13px' }}>
              <strong>Master Recipe Immutability:</strong> This Recipe is bound to Batch Order{' '}
              <code>{recipeModalJob?.boNumber || recipeModalJob?.jobNumber}</code> from production execution. In
              accordance with Quality Assurance Directives, <strong>recipe replacement, parameter override, or substitution is strictly prohibited</strong> during inspection.
            </div>
          </AppAlert>

          {/* Recipe Metadata Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px'
            }}
          >
            <div style={{ padding: '10px 12px', background: 'var(--material-thin)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Recipe Name</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{recipeModalJob?.recipeName || recipeModalJob?.recipeSnapshot?.name || 'Heat Treatment'}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--material-thin)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Revision</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                REV {recipeModalJob?.recipeRevision || recipeModalJob?.recipeSnapshot?.revision || 1}
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--material-thin)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Process Family</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{recipeModalJob?.processFamily || recipeModalJob?.recipeSnapshot?.processFamily || 'CASE_HARDENING'}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--material-thin)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Target Material</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{recipeModalJob?.materialGrade || recipeModalJob?.item?.materialGrade || 'Standard Grade'}</div>
            </div>
          </div>

          {/* Thermal Stages Table */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Governing Thermal Profile Stages ({recipeModalJob?.recipeStages?.length || recipeModalJob?.recipeSnapshot?.stages?.length || 0})
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Seq</th>
                    <th style={{ padding: '8px 12px' }}>Stage Name</th>
                    <th style={{ padding: '8px 12px' }}>Target Temp (°C)</th>
                    <th style={{ padding: '8px 12px' }}>Soak Time (min)</th>
                    <th style={{ padding: '8px 12px' }}>Atmosphere / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(recipeModalJob?.recipeStages || recipeModalJob?.recipeSnapshot?.stages || []).map((stg, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{stg.sequence || idx + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{stg.stageName}</td>
                      <td style={{ padding: '8px 12px' }}>{stg.targetTemperatureC} °C</td>
                      <td style={{ padding: '8px 12px' }}>{stg.soakTimeMinutes} min</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                        {(stg as any).atmosphere || (stg as any).rampRateCPerMin ? `${(stg as any).rampRateCPerMin} °C/min` : 'Endothermic / Controlled'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AppDialog>

      {/* Take for Inspection Confirmation Modal */}
      <AppDialog
        isOpen={Boolean(takeModalJob)}
        onClose={() => setTakeModalJob(null)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Microscope size={20} color="var(--color-primary)" />
            <span>Claim Batch Order for Quality Inspection</span>
          </div>
        }
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <AppButton variant="secondary" onClick={() => setTakeModalJob(null)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              leftIcon={<Microscope size={14} />}
              onClick={() => takeModalJob && handleTakeForInspection(takeModalJob, takeNotes)}
              disabled={isActionLoading}
            >
              Confirm Claim & Open Workbench
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            You are claiming Batch Order{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              {takeModalJob?.boNumber || takeModalJob?.jobNumber}
            </strong>{' '}
            for metallurgical quality testing.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              padding: '12px',
              backgroundColor: 'var(--material-thin)',
              borderRadius: '6px',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px'
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Part:</span>{' '}
              <strong>{takeModalJob?.itemName || takeModalJob?.item?.itemName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Grade:</span>{' '}
              <strong>{takeModalJob?.materialGrade || takeModalJob?.item?.materialGrade}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Inspection Qty:</span>{' '}
              <strong>
                {takeModalJob?.completedQuantity ??
                  takeModalJob?.execution?.qualityHandoff?.completedQuantity ??
                  takeModalJob?.quantity?.completedQuantity ??
                  takeModalJob?.loadedQuantity}{' '}
                {takeModalJob?.uom || takeModalJob?.item?.uom || 'PCS'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Weight:</span>{' '}
              <strong>
                {takeModalJob?.weightKg ??
                  takeModalJob?.execution?.furnaceCharge?.loadedWeightKg ??
                  takeModalJob?.quantity?.weightKg ??
                  0}{' '}
                kg
              </strong>
            </div>
          </div>

          <AppAlert type="info">
            <span style={{ fontSize: '12px' }}>
              <strong>Atomic State Transition:</strong> This operation transitions the BO from{' '}
              <code>waitingForInspection</code> → <code>inInspection</code>. If another inspector claims this BO simultaneously, the system will prevent duplicate sessions and notify you with a conflict alert.
            </span>
          </AppAlert>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Inspector Claim Notes
            </label>
            <AppInput
              value={takeNotes}
              onChange={(e) => setTakeNotes(e.target.value)}
              placeholder="e.g. Claimed at Station QA-01 for hardness and case depth inspection"
            />
          </div>
        </div>
      </AppDialog>
    </PageContainer>
  );
};
export default QualityPage;
