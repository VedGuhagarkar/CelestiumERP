import React, { useState, useEffect, useMemo } from 'react';
import {
  Microscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Layers,
  Award,
  Scale,
  Calendar,
  Lock,
  Save,
  Plus,
  Trash2,
  Truck,
  FileCheck,
  Clock,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
  Sliders
} from 'lucide-react';
import { AppCard } from '../../design-system/surfaces/AppCard.js';
import { AppButton } from '../../design-system/buttons/AppButton.js';
import { AppDialog } from '../../design-system/feedback/AppDialog.js';
import { AppInput } from '../../design-system/forms/AppInput.js';
import { AppSelect } from '../../design-system/forms/AppSelect.js';
import { AppAlert } from '../../design-system/feedback/AppAlert.js';
import { StatusBadge } from '../../design-system/feedback/StatusBadge.js';
import { env } from '../../config/env.config.js';
import { authenticatedFetch } from '../../utils/apiAuth.js';

export interface HardnessTestPoint {
  pointIdentifier: string;
  location: string;
  measuredValue: number;
  scale: string;
  passed: boolean;
}

export interface ProcessDetailRow {
  serialNumber: number;
  processNumber: number;
  partId?: string;
  partCode?: string;
  partName?: string;
  process: string;
  targetTemp?: number;
  targetDurationMinutes?: number;
  quenchMedium?: string;
  atmosphere?: string;
  operatorNotes?: string;
  inspectorNotes?: string;
  verifiedBy?: string;
  completedAt?: string;
  actualHardness?: number;
  isCompliant?: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLANK' | 'SKIPPED' | 'PASSED' | 'FAILED' | 'CANCELLED';
}

export interface InspectionWorkbenchProps {
  jobId: string;
  onClose?: () => void;
  onStateChange?: () => void;
  readOnlyOverride?: boolean;
}

export const InspectionWorkbench: React.FC<InspectionWorkbenchProps> = ({
  jobId,
  onClose,
  onStateChange,
  readOnlyOverride = false
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Workbench Data State from Backend
  const [workbenchData, setWorkbenchData] = useState<any>(null);

  // 6 Mandatory Heat-Treatment Fields Form State
  const [furnaceCode, setFurnaceCode] = useState<string>('');
  const [furnaceId, setFurnaceId] = useState<string>('');
  const [minHardness, setMinHardness] = useState<number>(58);
  const [maxHardness, setMaxHardness] = useState<number>(62);
  const [scale, setScale] = useState<string>('HRC');
  const [testPoints, setTestPoints] = useState<HardnessTestPoint[]>([]);
  const [effectiveCaseDepthMm, setEffectiveCaseDepthMm] = useState<number>(0.85);
  const [caseDepthMethod, setCaseDepthMethod] = useState<string>('Microhardness Traverse (HV0.5 to 50 HRC)');
  const [isCaseDepthCompliant, setIsCaseDepthCompliant] = useState<boolean>(true);
  const [quantityReceived, setQuantityReceived] = useState<number>(100);
  const [quantityDelivered, setQuantityDelivered] = useState<number>(100);
  const [microstructureNotes, setMicrostructureNotes] = useState<string>('Fine tempered martensite, CQI-9 compliant.');
  const [inspectionRemarks, setInspectionRemarks] = useState<string>('Heat treatment cycle verified and hardness certified.');

  // Process Details Rows State (15 positions)
  const [processRows, setProcessRows] = useState<ProcessDetailRow[]>([]);
  const [verifyingRow, setVerifyingRow] = useState<ProcessDetailRow | null>(null);
  const [verifyHardness, setVerifyHardness] = useState<number>(60);
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [verifyStatus, setVerifyStatus] = useState<'PASSED' | 'FAILED'>('PASSED');

  // Modals State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isFailModalOpen, setIsFailModalOpen] = useState<boolean>(false);
  const [defectCategory, setDefectCategory] = useState<string>('OUT_OF_SPEC_HARDNESS');
  const [defectReason, setDefectReason] = useState<string>('');

  // Fetch Authoritative Inspection Workbench Data
  const fetchWorkbench = async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/inspection-workbench`
      );

      if (res.status === 403) {
        setFeedback({
          type: 'error',
          message: 'Access Denied: Quality Inspection permissions are required to view this workbench.'
        });
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to load inspection workbench data');
      }

      const json = await res.json();
      const data = json.data;
      setWorkbenchData(data);

      // Populate Form State from persisted inspectionData and recipeAuthority
      const insp = data.inspectionData || {};
      const hdr = data.headerContext || {};
      const rcpAuth = data.recipeAuthority || {};

      setFurnaceCode(insp.furnaceCode || hdr.equipment?.furnaceCode || 'FURNACE-HT-01');
      setFurnaceId(insp.furnaceId || hdr.equipment?.furnaceId || 'furnace_01');

      const targetHardnessMin =
        insp.minHardness ??
        insp.hardnessSpecification?.minHardness ??
        rcpAuth.surfaceHardnessTarget?.min ??
        58;
      const targetHardnessMax =
        insp.maxHardness ??
        insp.hardnessSpecification?.maxHardness ??
        rcpAuth.surfaceHardnessTarget?.max ??
        62;
      const targetScale =
        insp.scale ||
        insp.hardnessSpecification?.scale ||
        rcpAuth.surfaceHardnessTarget?.scale ||
        'HRC';

      setMinHardness(Number(targetHardnessMin));
      setMaxHardness(Number(targetHardnessMax));
      setScale(targetScale);

      const existingPoints =
        insp.testPoints ||
        insp.actualHardness?.testPoints ||
        [];
      if (existingPoints.length > 0) {
        setTestPoints(existingPoints);
      } else {
        setTestPoints([
          { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: Number(targetHardnessMin) + 1.5, scale: targetScale, passed: true },
          { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: Number(targetHardnessMin) + 2.0, scale: targetScale, passed: true },
          { pointIdentifier: 'P3-CORE', location: 'CORE', measuredValue: 35.0, scale: targetScale, passed: true }
        ]);
      }

      setEffectiveCaseDepthMm(
        insp.effectiveCaseDepthMm ??
        insp.caseDepth?.effectiveCaseDepthMm ??
        rcpAuth.caseDepthTarget?.minMm ??
        0.85
      );
      setCaseDepthMethod(
        insp.caseDepthMethod ||
        insp.caseDepth?.caseDepthMethod ||
        'Microhardness Traverse (HV0.5 to 50 HRC)'
      );
      setIsCaseDepthCompliant(
        insp.isCaseDepthCompliant ??
        insp.caseDepth?.isCaseDepthCompliant ??
        true
      );

      const recQty =
        insp.quantityReceived ??
        insp.quantities?.quantityReceived ??
        hdr.quantity?.completedQuantity ??
        hdr.quantity?.loadedQuantity ??
        100;
      setQuantityReceived(Number(recQty));

      const delQty =
        insp.quantityDelivered ??
        insp.quantities?.quantityDelivered ??
        recQty;
      setQuantityDelivered(Number(delQty));

      setMicrostructureNotes(
        insp.microstructureNotes || 'Fine tempered martensite, CQI-9 compliant.'
      );
      setInspectionRemarks(
        insp.remarks || insp.notes || 'Heat treatment cycle verified and hardness certified.'
      );

      // Process rows
      setProcessRows(data.processDetails || data.processTable || []);
    } catch (err: any) {
      console.error('Error fetching inspection workbench:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error loading inspection workbench'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkbench();
  }, [jobId]);

  // Derived Calculations
  const measuredAverage = useMemo(() => {
    if (!testPoints || testPoints.length === 0) return 0;
    const sum = testPoints.reduce((acc, pt) => acc + (Number(pt.measuredValue) || 0), 0);
    return Number((sum / testPoints.length).toFixed(2));
  }, [testPoints]);

  const isHardnessCompliant = useMemo(() => {
    if (testPoints.length === 0 || measuredAverage <= 0) return false;
    return (
      measuredAverage >= minHardness &&
      measuredAverage <= maxHardness &&
      testPoints.every((pt) => pt.passed !== false)
    );
  }, [measuredAverage, minHardness, maxHardness, testPoints]);

  const quantityRejected = Math.max(0, quantityReceived - quantityDelivered);

  // Determine State Awareness: only truly editable if BO is in IN_INSPECTION
  const currentState = workbenchData?.workflowState?.status || workbenchData?.headerContext?.currentWorkflowState || 'IN_INSPECTION';
  const isJobInActiveInspection =
    !readOnlyOverride &&
    (workbenchData?.workflowState?.inInspection === true ||
      currentState === 'IN_INSPECTION');

  // Process Rows Status Metrics
  const failedProcessRowsCount = useMemo(() => {
    return processRows.filter((r) => r.status === 'FAILED').length;
  }, [processRows]);

  const passedProcessRowsCount = useMemo(() => {
    return processRows.filter((r) => r.status === 'PASSED' || r.status === 'COMPLETED').length;
  }, [processRows]);

  // Comprehensive 7-Point Validation Checklist
  const validationChecks = useMemo(() => {
    const isFurnaceValid = Boolean(furnaceCode.trim() && furnaceId.trim());
    const isHardnessSpecValid = minHardness > 0 && maxHardness >= minHardness;
    const isHardnessResultValid = isHardnessCompliant && testPoints.length > 0;
    const isCaseDepthValid = effectiveCaseDepthMm > 0 && isCaseDepthCompliant && Boolean(caseDepthMethod.trim());
    const isQtyReceivedValid = quantityReceived > 0;
    const isQtyDeliveredValid = quantityDelivered > 0 && quantityDelivered <= quantityReceived;
    const isProcessTableValid = failedProcessRowsCount === 0;

    const allValid =
      isFurnaceValid &&
      isHardnessSpecValid &&
      isHardnessResultValid &&
      isCaseDepthValid &&
      isQtyReceivedValid &&
      isQtyDeliveredValid &&
      isProcessTableValid;

    return {
      isFurnaceValid,
      isHardnessSpecValid,
      isHardnessResultValid,
      isCaseDepthValid,
      isQtyReceivedValid,
      isQtyDeliveredValid,
      isProcessTableValid,
      allValid
    };
  }, [
    furnaceCode,
    furnaceId,
    minHardness,
    maxHardness,
    isHardnessCompliant,
    testPoints,
    effectiveCaseDepthMm,
    isCaseDepthCompliant,
    caseDepthMethod,
    quantityReceived,
    quantityDelivered,
    failedProcessRowsCount
  ]);

  // Test Point Mutators
  const handleAddTestPoint = () => {
    if (!isJobInActiveInspection) return;
    const nextIdx = testPoints.length + 1;
    const defVal = Number(minHardness) + 1;
    setTestPoints([
      ...testPoints,
      {
        pointIdentifier: `P${nextIdx}-SURFACE`,
        location: 'SURFACE',
        measuredValue: defVal,
        scale,
        passed: defVal >= minHardness && defVal <= maxHardness
      }
    ]);
  };

  const handleUpdateTestPoint = (idx: number, field: keyof HardnessTestPoint, val: any) => {
    if (!isJobInActiveInspection) return;
    const next = [...testPoints];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'measuredValue') {
      const numVal = Number(val);
      next[idx].passed = numVal >= minHardness && numVal <= maxHardness;
    }
    setTestPoints(next);
  };

  const handleRemoveTestPoint = (idx: number) => {
    if (!isJobInActiveInspection || testPoints.length <= 1) return;
    setTestPoints(testPoints.filter((_, i) => i !== idx));
  };

  // Save Progress Handler (without state advancement)
  const handleSaveProgress = async () => {
    if (!isJobInActiveInspection) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
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
          scale,
          isCompliant: isHardnessCompliant,
          testPoints
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
          method: 'POST',
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
        message: 'Inspection progress and test point data successfully saved.'
      });
      await fetchWorkbench();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error saving inspection data'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify Single Process Row Handler
  const handleVerifyRowSubmit = async () => {
    if (!verifyingRow || !isJobInActiveInspection) return;
    setIsSubmitting(true);
    try {
      const payload = {
        serialNumber: verifyingRow.serialNumber,
        actualHardness: Number(verifyHardness),
        status: verifyStatus,
        inspectorNotes: verifyNotes,
        notes: verifyNotes
      };

      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/api/v1/production-jobs/${jobId}/verify-process-row`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to verify process row');
      }

      setFeedback({
        type: 'success',
        message: `Process position ${verifyingRow.serialNumber} verified as ${verifyStatus}.`
      });

      setVerifyingRow(null);
      await fetchWorkbench();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error verifying process row'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve for Dispatch Handler (explicit state transition to WAITING_FOR_DISPATCH)
  const handleApproveForDispatch = async () => {
    if (!isJobInActiveInspection) return;
    if (!validationChecks.allValid) {
      setFeedback({
        type: 'warning',
        message: 'Cannot approve inspection: all six required heat-treatment fields and process details must be valid and compliant.'
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
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
        message: `Inspection approved! Batch Order moved to 'WAITING_FOR_DISPATCH'. ${quantityDelivered} conforming pieces staged for outbound logistics.`
      });

      setIsApproveModalOpen(false);
      await fetchWorkbench();
      if (onStateChange) onStateChange();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error approving inspection'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fail Inspection Handler (explicit state transition to INSPECTION quarantine)
  const handleFailInspectionSubmit = async () => {
    if (!isJobInActiveInspection) return;
    if (!defectReason.trim()) {
      setFeedback({
        type: 'warning',
        message: 'Defect reason and justification are required to fail inspection and quarantine lot.'
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
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
        quantityRejected,
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
        throw new Error(json.message || 'Failed to fail inspection');
      }

      setFeedback({
        type: 'error',
        message: `Batch Order failed inspection! State updated to 'INSPECTION' and quarantined against dispatch.`
      });

      setIsFailModalOpen(false);
      setDefectReason('');
      await fetchWorkbench();
      if (onStateChange) onStateChange();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error failing inspection'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !workbenchData) {
    return (
      <AppCard style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--color-primary)' }} />
        <h3 style={{ margin: 0, fontSize: '18px' }}>Loading Authoritative Inspection Workbench...</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          Retrieving BO lineage, recipe specifications, thermal execution results, and test actuals.
        </p>
      </AppCard>
    );
  }

  const hdr = workbenchData?.headerContext || {};
  const rcpAuth = workbenchData?.recipeAuthority || {};
  const exec = workbenchData?.executionSummary || {};

  const boNum = hdr.boNumber || hdr.jobNumber || 'BO-N/A';
  const poNum = hdr.poNumber || 'N/A';
  const grnNum = hdr.grnNumber || 'N/A';
  const custName = hdr.customer?.customerName || hdr.customerName || 'N/A';
  const partCode = hdr.part?.itemCode || 'N/A';
  const partName = hdr.part?.itemName || 'N/A';
  const matGrade = hdr.part?.materialGrade || 'N/A';
  const uom = hdr.part?.uom || hdr.quantity?.uom || hdr.uom || 'PCS';
  const targetQty = hdr.quantity?.targetQuantity || 0;
  const loadedQty = hdr.quantity?.loadedQuantity || 0;
  const completedQty = hdr.quantity?.completedQuantity || 0;
  const scrappedQty = hdr.quantity?.scrappedQuantity || 0;
  const weightKg = hdr.weightKg || exec.loadedWeightKg || 0;
  const dueDt = hdr.dueDate;
  const isOverdue = dueDt ? new Date(dueDt).getTime() < Date.now() : false;
  const rcpCode = rcpAuth.recipeCode || hdr.recipe?.recipeCode || 'N/A';
  const rcpName = rcpAuth.recipeName || hdr.recipe?.recipeName || hdr.recipe?.name || 'N/A';
  const rcpRev = rcpAuth.recipeRevision ?? rcpAuth.revision ?? hdr.recipeRevision ?? hdr.recipe?.recipeRevision ?? hdr.recipe?.revision ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Global Feedback Alert */}
      {feedback && (
        <AppAlert
          type={feedback.type}
          title={feedback.type === 'success' ? 'Success' : feedback.type === 'error' ? 'Quality Alert' : 'Verification Notice'}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </AppAlert>
      )}

      {/* ========================================================================= */}
      {/* 9. STATE AWARENESS BANNER                                                 */}
      {/* ========================================================================= */}
      {!isJobInActiveInspection ? (
        <AppAlert
          type="warning"
          title={`Read-Only Inspection Record View — Status: ${currentState}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px' }}>
              <strong>State Awareness Protection:</strong> This Batch Order is currently in{' '}
              <strong style={{ textDecoration: 'underline' }}>{currentState}</strong>. Quality inspection mutation controls are permanently locked to prevent stale sessions from modifying historical records.
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
              LOCK ENFORCED
            </span>
          </div>
        </AppAlert>
      ) : (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--color-info-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: 'var(--color-info)'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9', display: 'inline-block' }} className="animate-pulse" />
            <strong>Active Inspection Session:</strong> You have exclusive claimed authority over this Batch Order. Enter test points, verify process details, and disposition release.
          </span>
          <StatusBadge status="ACTIVE SESSION" variant="info" size="sm" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BO CONTEXT HEADER CARD                                                 */}
      {/* ========================================================================= */}
      <AppCard
        style={{
          padding: '20px 24px',
          borderLeft: `5px solid ${isJobInActiveInspection ? 'var(--color-primary)' : 'var(--color-border-regular)'}`,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>
              {boNum}
            </h2>
            <StatusBadge status={currentState} variant={currentState === 'WAITING_FOR_DISPATCH' ? 'success' : currentState === 'INSPECTION' ? 'danger' : 'info'} size="md" />
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Customer: <strong>{custName}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '12px',
                color: isOverdue ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary)',
                fontWeight: isOverdue ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Calendar size={14} /> Due:{' '}
              {dueDt ? new Date(dueDt).toLocaleDateString() : 'N/A'}{' '}
              {isOverdue && '(OVERDUE)'}
            </span>
            {onClose && (
              <AppButton variant="secondary" size="sm" onClick={onClose}>
                Back to Queue
              </AppButton>
            )}
          </div>
        </div>

        {/* 10-Point Context Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            fontSize: '13px'
          }}
        >
          {/* Item 1: Lineage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Lineage Line
            </span>
            <div>PO: <strong>{poNum}</strong></div>
            <div>GRN: <strong>{grnNum}</strong></div>
          </div>

          {/* Item 2: Part & Metallurgy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Part & Grade
            </span>
            <div style={{ fontWeight: 600 }}>{partCode}</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{partName} ({matGrade})</div>
          </div>

          {/* Item 3: Quantities & Weight */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Piece Count & Weight
            </span>
            <div>
              Loaded: <strong>{loadedQty} {uom}</strong> | Target: {targetQty}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
              <Scale size={13} /> Weight: <strong>{weightKg} kg</strong>
            </div>
          </div>

          {/* Item 4: Recipe & Revision Authority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Governing Recipe
            </span>
            <div style={{ fontWeight: 700 }}>{rcpCode}</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              {rcpName} <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>(REV {rcpRev})</span>
            </div>
          </div>
        </div>
      </AppCard>

      {/* ========================================================================= */}
      {/* 2 & 3. PRODUCTION RESULTS (READ-ONLY) vs RECIPE REQUIREMENTS (SIDE-BY-SIDE) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Card: 3. Recipe Requirements (Required Specifications) */}
        <AppCard style={{ padding: '20px', borderTop: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={18} color="#6366f1" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Governing Recipe Requirements
              </h3>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} /> SPECIFICATION
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Required Hardness Target:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {rcpAuth.surfaceHardnessTarget?.min ?? 58.0} - {rcpAuth.surfaceHardnessTarget?.max ?? 62.0} {rcpAuth.surfaceHardnessTarget?.scale || 'HRC'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Effective Case Depth:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {rcpAuth.caseDepthTarget?.minMm ?? 0.80} - {rcpAuth.caseDepthTarget?.maxMm ?? 1.20} mm
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Process Family:</span>
              <strong>{rcpAuth.processFamily || 'HEAT_TREATMENT'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Thermal Profile Stages:</span>
              <strong>{rcpAuth.stages?.length || 0} sequential stages</strong>
            </div>
          </div>
        </AppCard>

        {/* Right Card: 2. Production Execution Information (Read-Only) */}
        <AppCard style={{ padding: '20px', borderTop: '4px solid #0ea5e9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="#0ea5e9" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Production Execution Results (Read-Only)
              </h3>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} /> LOCKED HISTORY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Furnace / Charge Number:</span>
              <strong>{exec.furnaceUsed} | {exec.chargeNumber}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Operator & Shift:</span>
              <strong>{exec.operatorName} ({exec.shiftId})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Loaded Pieces & Weight:</span>
              <strong>{exec.loadedPieces} {uom} | {exec.loadedWeightKg} kg</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--material-thin)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Stages Executed:</span>
              <strong>{exec.totalStagesExecuted} of {rcpAuth.stages?.length || exec.totalStagesExecuted} verified</strong>
            </div>

            {exec.concessionApproved && (
              <div style={{ padding: '8px 12px', background: 'var(--color-warning-subtle)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-warning)' }}>
                ⚠ <strong>Authorized Concession:</strong> {exec.concessionReason || 'Deviation accepted by plant QA'}
              </div>
            )}
          </div>
        </AppCard>
      </div>

      {/* ========================================================================= */}
      {/* 4. AUTHORITATIVE INSPECTION FORM — SIX MANDATORY HEAT-TREATMENT FIELDS   */}
      {/* ========================================================================= */}
      <AppCard style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} color="var(--color-primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Six Mandatory Heat-Treatment Inspection Fields
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Authoritative metallurgical release gates. All six fields must be complete and compliant before dispatch approval.
              </p>
            </div>
          </div>

          <StatusBadge
            status={validationChecks.allValid ? 'ALL 6 FIELDS COMPLIANT' : 'VALIDATION GATES PENDING'}
            variant={validationChecks.allValid ? 'success' : 'warning'}
            size="md"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Field 1: Furnace / Equipment Identification */}
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--material-thin)', border: '1px solid var(--color-border-subtle)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={15} /> 1. Equipment / Furnace Identification *
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Furnace / Equipment Code *
                </label>
                <AppInput
                  value={furnaceCode}
                  onChange={(e) => setFurnaceCode(e.target.value)}
                  disabled={!isJobInActiveInspection}
                  placeholder="e.g. FURNACE-HT-01"
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Equipment ID *
                </label>
                <AppInput
                  value={furnaceId}
                  onChange={(e) => setFurnaceId(e.target.value)}
                  disabled={!isJobInActiveInspection}
                  placeholder="e.g. furnace_01"
                />
              </div>
            </div>
          </div>

          {/* Field 2: Hardness Specification Targets */}
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--material-thin)', border: '1px solid var(--color-border-subtle)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={15} /> 2. Hardness Specification Targets *
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
                  disabled={!isJobInActiveInspection}
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
                  disabled={!isJobInActiveInspection}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Scale *
                </label>
                <AppSelect
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  disabled={!isJobInActiveInspection}
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

          {/* Field 3: Actual Hardness & Discrete Multi-Point Test Points */}
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--material-thin)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Microscope size={15} /> 3. Actual Hardness & Test Points Traverse *
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '14px' }}>
                  Measured Average:{' '}
                  <strong style={{ color: isHardnessCompliant ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)' }}>
                    {measuredAverage} {scale}
                  </strong>
                </div>
                <StatusBadge
                  status={isHardnessCompliant ? 'IN-SPEC' : 'OUT-OF-SPEC'}
                  variant={isHardnessCompliant ? 'success' : 'danger'}
                  size="sm"
                />
                {isJobInActiveInspection && (
                  <AppButton
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus size={13} />}
                    onClick={handleAddTestPoint}
                  >
                    Add Test Point
                  </AppButton>
                )}
              </div>
            </div>

            {/* Discrete Test Points Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {testPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 150px 140px 100px 40px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--color-bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <AppInput
                    value={pt.pointIdentifier}
                    onChange={(e) => handleUpdateTestPoint(idx, 'pointIdentifier', e.target.value)}
                    disabled={!isJobInActiveInspection}
                    placeholder="Point ID"
                  />
                  <AppSelect
                    value={pt.location}
                    onChange={(e) => handleUpdateTestPoint(idx, 'location', e.target.value)}
                    disabled={!isJobInActiveInspection}
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
                      onChange={(e) => handleUpdateTestPoint(idx, 'measuredValue', e.target.value)}
                      disabled={!isJobInActiveInspection}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{scale}</span>
                  </div>
                  <StatusBadge
                    status={pt.passed ? 'PASS' : 'FAIL'}
                    variant={pt.passed ? 'success' : 'danger'}
                    size="sm"
                    dot={false}
                  />
                  {isJobInActiveInspection && (
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
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Field 4: Effective Case Depth */}
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--material-thin)', border: '1px solid var(--color-border-subtle)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} /> 4. Effective Case Depth Verification *
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
                  disabled={!isJobInActiveInspection}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Measurement Method *
                </label>
                <AppInput
                  value={caseDepthMethod}
                  onChange={(e) => setCaseDepthMethod(e.target.value)}
                  disabled={!isJobInActiveInspection}
                  placeholder="e.g. Microhardness Traverse (HV0.5 to 50 HRC)"
                />
              </div>
              <div style={{ paddingTop: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isJobInActiveInspection ? 'pointer' : 'default', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={isCaseDepthCompliant}
                    onChange={(e) => isJobInActiveInspection && setIsCaseDepthCompliant(e.target.checked)}
                    disabled={!isJobInActiveInspection}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <strong>Case Depth Compliant</strong>
                </label>
              </div>
            </div>
          </div>

          {/* Field 5 & 6: Quantity Received & Delivered */}
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--material-thin)', border: '1px solid var(--color-border-subtle)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={15} /> 5 & 6. Piece Reconciliation & Dispatch Staging Quantities *
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
                  disabled={!isJobInActiveInspection}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Total pieces handed off to QA ({uom})
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
                  disabled={!isJobInActiveInspection}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Approved for Dispatch staging ({uom})
                </span>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Quantity Rejected (Scrapped)
                </label>
                <AppInput
                  type="number"
                  disabled
                  value={quantityRejected}
                />
                <span style={{ fontSize: '11px', color: quantityRejected > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                  {quantityRejected > 0 ? `${quantityRejected} non-conforming pieces scrapped` : 'Zero defect lot'}
                </span>
              </div>
            </div>
          </div>

          {/* Metallurgical Observation & Remarks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Microstructure Observation Notes
              </label>
              <AppInput
                value={microstructureNotes}
                onChange={(e) => setMicrostructureNotes(e.target.value)}
                disabled={!isJobInActiveInspection}
                placeholder="e.g. Tempered martensite matrix, CQI-9 compliant."
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Quality Inspector Remarks
              </label>
              <AppInput
                value={inspectionRemarks}
                onChange={(e) => setInspectionRemarks(e.target.value)}
                disabled={!isJobInActiveInspection}
                placeholder="e.g. Heat treatment cycle certified and hardness approved."
              />
            </div>
          </div>
        </div>
      </AppCard>

      {/* ========================================================================= */}
      {/* 5. AUTHORITATIVE 15-POSITION PROCESS DETAILS TABLE                        */}
      {/* ========================================================================= */}
      <AppCard style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              Authoritative 15-Position Process Details Verification
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Inspect and verify individual manufacturing process positions. Failed positions block dispatch approval.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px' }}>
              Verified: <strong>{passedProcessRowsCount} / 15</strong>
            </span>
            {failedProcessRowsCount > 0 && (
              <StatusBadge status={`${failedProcessRowsCount} FAILED`} variant="danger" size="sm" />
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Pos #</th>
                <th style={{ padding: '10px 12px' }}>Process Name</th>
                <th style={{ padding: '10px 12px' }}>Target Temp</th>
                <th style={{ padding: '10px 12px' }}>Target Soak</th>
                <th style={{ padding: '10px 12px' }}>Atmosphere / Quench</th>
                <th style={{ padding: '10px 12px' }}>Operator Notes</th>
                <th style={{ padding: '10px 12px' }}>Actual Hardness</th>
                <th style={{ padding: '10px 12px' }}>Inspector Notes</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No process details rows recorded on this Batch Order.
                  </td>
                </tr>
              ) : (
                processRows.map((row) => {
                  const isRowPassed = row.status === 'PASSED' || row.status === 'COMPLETED';
                  const isRowFailed = row.status === 'FAILED';

                  return (
                    <tr
                      key={row.serialNumber}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        background: isRowFailed ? 'rgba(239, 68, 68, 0.05)' : undefined
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                        {row.serialNumber}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {row.process || `Stage ${row.serialNumber}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.targetTemp ? `${row.targetTemp} °C` : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.targetDurationMinutes ? `${row.targetDurationMinutes} min` : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                        {row.quenchMedium || row.atmosphere || 'Standard'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                        {row.operatorNotes || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {row.actualHardness ? `${row.actualHardness} ${scale}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                        {row.inspectorNotes || '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge
                          status={row.status || 'PENDING'}
                          variant={isRowPassed ? 'success' : isRowFailed ? 'danger' : 'neutral'}
                          size="sm"
                          dot={false}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {isJobInActiveInspection ? (
                          <AppButton
                            variant="ghost"
                            size="sm"
                            leftIcon={<Sliders size={13} />}
                            onClick={() => {
                              setVerifyingRow(row);
                              setVerifyHardness(row.actualHardness || minHardness || 60);
                              setVerifyNotes(row.inspectorNotes || '');
                              setVerifyStatus(row.status === 'FAILED' ? 'FAILED' : 'PASSED');
                            }}
                            style={{ padding: '2px 8px', height: '24px', fontSize: '11px' }}
                          >
                            Verify Row
                          </AppButton>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* ========================================================================= */}
      {/* 6. VALIDATION GATE & ACTION BAR                                           */}
      {/* ========================================================================= */}
      <AppCard style={{ padding: '20px 24px', borderTop: '4px solid var(--color-primary)' }}>
        {/* Checklist Strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isFurnaceValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isFurnaceValid ? <Check size={14} /> : <XCircle size={14} />}
            Equipment Identified
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isHardnessSpecValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isHardnessSpecValid ? <Check size={14} /> : <XCircle size={14} />}
            Hardness Spec Defined
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isHardnessResultValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isHardnessResultValid ? <Check size={14} /> : <XCircle size={14} />}
            Hardness In-Spec ({measuredAverage} {scale})
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isCaseDepthValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isCaseDepthValid ? <Check size={14} /> : <XCircle size={14} />}
            Case Depth Compliant ({effectiveCaseDepthMm}mm)
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isQtyReceivedValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isQtyReceivedValid ? <Check size={14} /> : <XCircle size={14} />}
            Qty Received Valid
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isQtyDeliveredValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isQtyDeliveredValid ? <Check size={14} /> : <XCircle size={14} />}
            Qty Delivered Balanced ({quantityDelivered})
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: validationChecks.isProcessTableValid ? '#10b981' : '#ef4444' }}>
            {validationChecks.isProcessTableValid ? <Check size={14} /> : <XCircle size={14} />}
            Process Table Clean (0 Failed)
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <div>
            <AppButton
              variant="secondary"
              size="md"
              leftIcon={<Save size={16} />}
              onClick={handleSaveProgress}
              disabled={!isJobInActiveInspection || isSubmitting}
            >
              Save Progress
            </AppButton>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {/* 8. Failure Action */}
            <AppButton
              variant="danger"
              size="md"
              leftIcon={<XCircle size={16} />}
              onClick={() => setIsFailModalOpen(true)}
              disabled={!isJobInActiveInspection || isSubmitting}
            >
              Fail Inspection / Quarantine
            </AppButton>

            {/* 7. Approval Action */}
            <AppButton
              variant="primary"
              size="md"
              leftIcon={<CheckCircle2 size={16} />}
              onClick={() => setIsApproveModalOpen(true)}
              disabled={!isJobInActiveInspection || !validationChecks.allValid || isSubmitting}
            >
              Approve for Dispatch
            </AppButton>
          </div>
        </div>
      </AppCard>

      {/* ========================================================================= */}
      {/* VERIFY PROCESS ROW MODAL                                                  */}
      {/* ========================================================================= */}
      <AppDialog
        isOpen={Boolean(verifyingRow)}
        onClose={() => setVerifyingRow(null)}
        title={`Verify Process Position #${verifyingRow?.serialNumber}: ${verifyingRow?.process}`}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <AppButton variant="secondary" onClick={() => setVerifyingRow(null)}>
              Cancel
            </AppButton>
            <AppButton
              variant={verifyStatus === 'FAILED' ? 'danger' : 'primary'}
              onClick={handleVerifyRowSubmit}
              disabled={isSubmitting}
            >
              Confirm Position Verification
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Comparing process position against governing recipe hardness target: <strong>{minHardness} - {maxHardness} {scale}</strong>.
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Measured Hardness ({scale}) *
            </label>
            <AppInput
              type="number"
              step="0.1"
              value={verifyHardness}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVerifyHardness(val);
                if (val < minHardness || val > maxHardness) {
                  setVerifyStatus('FAILED');
                } else {
                  setVerifyStatus('PASSED');
                }
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Verification Status *
            </label>
            <AppSelect
              value={verifyStatus}
              onChange={(e) => setVerifyStatus(e.target.value as any)}
              options={[
                { value: 'PASSED', label: 'PASSED — Conforms to Recipe Specification' },
                { value: 'FAILED', label: 'FAILED — Non-Conforming / Out of Tolerance' }
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Quality Inspector Notes
            </label>
            <AppInput
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="e.g. Verified surface hardness on test coupon"
            />
          </div>
        </div>
      </AppDialog>

      {/* ========================================================================= */}
      {/* 7. APPROVE FOR DISPATCH MODAL                                             */}
      {/* ========================================================================= */}
      <AppDialog
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Authoritative Quality Release: Approve for Dispatch"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              leftIcon={<CheckCircle2 size={16} />}
              onClick={handleApproveForDispatch}
              disabled={isSubmitting}
            >
              Confirm Release to Dispatch Staging
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            You are authoritatively approving Batch Order <strong style={{ color: 'var(--color-primary)' }}>{boNum}</strong> for dispatch staging.
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--material-thin)', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Conforming Pieces Staged for Dispatch:</span>
              <strong style={{ color: '#10b981' }}>{quantityDelivered} {uom}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Pieces Scrapped / Rejected:</span>
              <strong style={{ color: quantityRejected > 0 ? '#ef4444' : 'inherit' }}>{quantityRejected} {uom}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Certified Hardness Average:</span>
              <strong>{measuredAverage} {scale}</strong>
            </div>
          </div>

          <AppAlert type="info">
            <span style={{ fontSize: '12px' }}>
              <strong>Dispatch Phase Boundary:</strong> This action moves the Batch Order to <code>WAITING_FOR_DISPATCH</code>. Outward Challan (OC) generation and customer delivery notes are executed exclusively by the Dispatch Department.
            </span>
          </AppAlert>
        </div>
      </AppDialog>

      {/* ========================================================================= */}
      {/* 8. FAIL INSPECTION & QUARANTINE MODAL                                     */}
      {/* ========================================================================= */}
      <AppDialog
        isOpen={isFailModalOpen}
        onClose={() => setIsFailModalOpen(false)}
        title="Fail Quality Inspection & Quarantine Batch Order"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsFailModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              leftIcon={<AlertTriangle size={16} />}
              onClick={handleFailInspectionSubmit}
              disabled={isSubmitting || !defectReason.trim()}
            >
              Confirm Quarantine Failure
            </AppButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Failing this inspection will immediately move Batch Order <strong style={{ color: 'var(--color-danger)' }}>{boNum}</strong> into quarantined status <strong style={{ color: 'var(--color-danger)' }}>INSPECTION</strong>.
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
                { value: 'INSUFFICIENT_CASE_DEPTH', label: 'Insufficient Case Depth' },
                { value: 'SURFACE_DECARBURIZATION', label: 'Surface Decarburization' },
                { value: 'EXCESSIVE_DISTORTION_WARPAGE', label: 'Excessive Distortion / Warpage' },
                { value: 'MICROSTRUCTURE_DEFECT', label: 'Microstructure Non-Conformance' },
                { value: 'QUENCH_CRACKING', label: 'Quench Cracking' },
                { value: 'PROCESS_TABLE_FAILURE', label: 'Process Table Non-Conformance' }
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Defect Reason / Metallurgical Findings *
            </label>
            <AppInput
              value={defectReason}
              onChange={(e) => setDefectReason(e.target.value)}
              placeholder="Detail hardness traverse excursions, decarburization, or case depth deviations..."
            />
          </div>
        </div>
      </AppDialog>
    </div>
  );
};

export default InspectionWorkbench;
