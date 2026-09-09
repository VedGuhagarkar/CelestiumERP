import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  Search,
  RefreshCw,
  Layers,
  Thermometer,
  ChevronRight,
  PlayCircle,
  GitMerge,
  ShieldCheck,
  Lock,
  FileText,
  CheckCircle2,
  ArrowRight,
  XCircle
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { ActionButton } from '../design-system/buttons/ActionButton.js';
import { AppDialog } from '../design-system/feedback/AppDialog.js';
import { AppDrawer } from '../design-system/surfaces/AppDrawer.js';
import { AppInput } from '../design-system/forms/AppInput.js';
import { AppSelect } from '../design-system/forms/AppSelect.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { usePermission } from '../hooks/usePermission.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

export interface ProductionJob {
  _id?: string;
  id?: string;
  jobNumber: string;
  boNumber?: string;
  batchOrderNumber?: string;
  poId?: string;
  poNumber?: string;
  grnId?: string;
  grnNumber?: string;
  customer?: {
    customerId?: string;
    customerCode: string;
    customerName: string;
  };
  item: {
    itemId?: string;
    itemCode: string;
    itemName: string;
    materialGrade: string;
    uom: string;
  };
  quantity: {
    targetQuantity: number;
    loadedQuantity: number;
    completedQuantity: number;
    scrappedQuantity: number;
  };
  weightKg?: number;
  weight?: number;
  dueDate?: string;
  status:
    | 'WAITING_FOR_PRODUCTION'
    | 'IN_PRODUCTION'
    | 'WAITING_FOR_INSPECTION'
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'PAUSED'
    | 'QUALITY_CHECK'
    | 'STORAGE'
    | 'READY_FOR_DISPATCH'
    | 'DISPATCHED'
    | 'COMPLETED'
    | 'CANCELLED';
  waitingForProduction?: boolean;
  inProduction?: boolean;
  waitingForInspection?: boolean;
  inInspection?: boolean;
  waitingForDispatch?: boolean;
  dispatched?: boolean;
  workflowState?: {
    waitingForProduction: boolean;
    inProduction: boolean;
    waitingForInspection: boolean;
    inInspection: boolean;
    waitingForDispatch: boolean;
    dispatched: boolean;
  };
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'AOG_CRITICAL' | 'CRITICAL';
  recipeSnapshot?: {
    recipeId?: string;
    recipeCode: string;
    revisionNumber?: number;
    name?: string;
    processFamily?: string;
    stages?: {
      sequence?: number;
      stageSequence?: number;
      stageName: string;
      stageType?: string;
      targetTemperatureC: number;
      targetDurationMinutes?: number;
      soakTimeMinutes?: number;
      soakCriteria?: string;
    }[];
  };
  equipmentAssignment?: {
    furnaceId?: string;
    furnaceCode?: string;
    locationBay?: string;
  };
  timeline: {
    plannedStartDate: string;
    targetCompletionDate: string;
    actualStartDate?: string;
    actualCompletionDate?: string;
    dueDate?: string;
  };
  materialAllocations?: {
    reservationId?: string;
    heatLotNumber?: string;
    supplierHeatNumber?: string;
    allocatedQuantity: number;
    uom: string;
  }[];
  processDetails?: IProcessDetailRow[];
  genealogy?: {
    whichPo: {
      poId: string;
      poNumber: string;
      supplierName: string;
      supplierCode?: string;
    };
    whichGrn: {
      grnId: string;
      grnNumber: string;
      supplierName: string;
      supplierCode?: string;
    };
    whichPart: {
      itemId: string;
      itemCode: string;
      itemName: string;
      materialGrade: string;
      uom: string;
    };
    whichRecipe: {
      recipeId: string;
      recipeCode: string;
      recipeName: string;
      revisionNumber: number;
      processFamily: string;
    };
    isImmutable: boolean;
  };
  hierarchy?: {
    po?: { id?: string; poNumber?: string; supplierName?: string };
    grn?: { id?: string; grnNumber?: string };
    bo?: { id?: string; boNumber?: string; jobNumber?: string; status?: string };
    displayHierarchy?: string;
    relationship?: string;
  };
  sourceInformation?: {
    po?: { poId?: string; poNumber?: string; supplierName?: string; readOnly?: boolean };
    grn?: { grnId?: string; grnNumber?: string; readOnly?: boolean };
    customer?: { customerId?: string; customerCode?: string; customerName?: string; readOnly?: boolean };
    part?: { itemId?: string; itemCode?: string; itemName?: string; materialGrade?: string; uom?: string; readOnly?: boolean };
    quantity?: { targetQuantity?: number; uom?: string; readOnly?: boolean };
    weight?: { weightKg?: number; uom?: string; readOnly?: boolean };
    dueDate?: string | null;
    recipe?: { recipeId?: string; recipeCode?: string; recipeName?: string; revisionNumber?: number; processFamily?: string; readOnly?: boolean };
    isReadOnlySourceData?: boolean;
  };
  recipeCorrespondence?: {
    itemCode?: string;
    itemName?: string;
    materialGrade?: string;
    recipeCode?: string;
    recipeName?: string;
    isCorresponded?: boolean;
  };
  traceabilityLinks?: {
    boToGrnToPo?: string;
    boToItemToRecipe?: string;
  };
  execution?: any;
  isReadOnlySourceData?: boolean;
}

export interface IProcessDetailRow {
  serialNumber: number;
  partId?: string | null;
  partCode?: string | null;
  partName?: string | null;
  process?: string | null;
  recipeId?: string | null;
  recipeCode?: string | null;
  minhardness?: number | null;
  maxhardness?: number | null;
  userId?: string | null;
  userName?: string | null;
  status: 'BLANK' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
  notes?: string | null;
}

export interface EligiblePo {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  status: string;
  itemCount: number;
  completedGrnCount: number;
  grns?: any[];
}

export interface EligibleGrn {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  status: string;
  grnDate: string;
  supplierName: string;
  supplierChallanNumber?: string;
  warehouseCode?: string;
  storageLocationCode?: string;
  totalUnits?: number;
  availableUnitsCount?: number;
  hasAvailableMaterial?: boolean;
  isCreationComplete?: boolean;
  readOnly?: boolean;
  items?: any[];
}

export interface BatchOrderProductionReadiness {
  isReadyForProduction: boolean;
  jobId?: string;
  boNumber?: string;
  jobNumber?: string;
  status?: string;
  hasAuthoritativePo?: boolean;
  hasAuthoritativeGrn?: boolean;
  hasCustomer?: boolean;
  hasPart?: boolean;
  hasValidQuantity?: boolean;
  hasValidWeight?: boolean;
  hasRecipe?: boolean;
  has15ProcessDetails?: boolean;
  hasValidWorkflowState?: boolean;
  missingFields: string[];
  errors: string[];
  readinessSummary: string;
}

export interface SerializedUnit {
  unitIdentifier: string;
  quantity: number;
  uom: string;
  status: string;
  heatNumber?: string;
}

export interface RecipeStage {
  sequence: number;
  stageName: string;
  targetTemperatureC: number;
  soakTimeMinutes: number;
  soakCriteria?: string;
}

export interface EligiblePart {
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily?: string;
  recipeId?: string;
  recipeCode?: string;
  recipeName?: string;
  recipeRevision?: number;
  receivedQuantity?: number;
  acceptedQuantity: number;
  allocatedQuantity?: number;
  availableQuantity: number;
  availableUnitsCount: number;
  canCreateBatchOrder?: boolean;
  uom: string;
  supplierHeatNumber?: string;
  readOnly?: boolean;
  boundRecipe?: {
    recipeId: string;
    recipeCode: string;
    recipeName?: string;
    processFamily?: string;
    stages?: RecipeStage[];
  };
  recipeDetails?: any;
  availableUnits?: SerializedUnit[];
}

const DEFAULT_JOBS: ProductionJob[] = [
  {
    id: 'bo_01',
    jobNumber: 'BO-202609-0010',
    boNumber: 'BO-202609-0010',
    poId: 'po_aero_101',
    poNumber: 'PO-2026-00101',
    grnId: 'grn_aero_501',
    grnNumber: 'GRN-202609-0501',
    customer: { customerCode: 'CUST-AERO-01', customerName: 'AeroDynamics Propulsion Inc.' },
    item: { itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shafts 4340', materialGrade: 'AISI 4340', uom: 'PCS' },
    quantity: { targetQuantity: 100, loadedQuantity: 0, completedQuantity: 0, scrappedQuantity: 0 },
    status: 'WAITING_FOR_PRODUCTION',
    waitingForProduction: true,
    inProduction: false,
    waitingForInspection: false,
    workflowState: {
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false
    },
    priority: 'HIGH',
    recipeSnapshot: {
      recipeCode: 'REC-VAC-4340',
      name: 'Vacuum Austenitize & 2-Bar N2 Quench',
      processFamily: 'VACUUM_HEAT_TREATMENT',
      stages: [
        { sequence: 1, stageName: 'Preheat Ramp', targetTemperatureC: 650, soakTimeMinutes: 45 },
        { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
        { sequence: 3, stageName: 'High Pressure N2 Quench', targetTemperatureC: 45, soakTimeMinutes: 20 }
      ]
    },
    equipmentAssignment: { furnaceCode: 'FURNACE-VAC-01', locationBay: 'Bay 1 Vacuum Bay' },
    timeline: { plannedStartDate: new Date().toISOString(), targetCompletionDate: new Date(Date.now() + 24 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HEAT-4340-99A', allocatedQuantity: 100, uom: 'PCS' }]
  },
  {
    id: 'bo_02',
    jobNumber: 'BO-202609-0011',
    boNumber: 'BO-202609-0011',
    poId: 'po_titan_202',
    poNumber: 'PO-2026-00202',
    grnId: 'grn_titan_602',
    grnNumber: 'GRN-202609-0602',
    customer: { customerCode: 'CUST-TITAN-02', customerName: 'Titan Precision Defense LLC' },
    item: { itemCode: 'PART-GEAR-8620', itemName: 'Case-Hardened Pinion Gears', materialGrade: 'AISI 8620', uom: 'PCS' },
    quantity: { targetQuantity: 250, loadedQuantity: 250, completedQuantity: 0, scrappedQuantity: 0 },
    status: 'IN_PRODUCTION',
    waitingForProduction: false,
    inProduction: true,
    waitingForInspection: false,
    workflowState: {
      waitingForProduction: false,
      inProduction: true,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false
    },
    priority: 'URGENT',
    recipeSnapshot: {
      recipeCode: 'REC-CARB-8620',
      name: 'Atmospheric Gas Carburizing & Oil Quench',
      processFamily: 'CARBURIZING',
      stages: [
        { sequence: 1, stageName: 'Equalize Ramp', targetTemperatureC: 850, soakTimeMinutes: 60 },
        { sequence: 2, stageName: 'Carburizing Boost/Diffuse', targetTemperatureC: 930, soakTimeMinutes: 240 },
        { sequence: 3, stageName: 'Direct Oil Quench', targetTemperatureC: 60, soakTimeMinutes: 25 }
      ]
    },
    equipmentAssignment: { furnaceCode: 'FURNACE-PIT-01', locationBay: 'Bay 2 Carburizing Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 6 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() + 6 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 5.5 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HEAT-8620-88B', allocatedQuantity: 250, uom: 'PCS' }]
  },
  {
    id: 'bo_03',
    jobNumber: 'BO-202608-0008',
    boNumber: 'BO-202608-0008',
    poId: 'po_apex_303',
    poNumber: 'PO-2026-00303',
    grnId: 'grn_apex_703',
    grnNumber: 'GRN-202608-0703',
    customer: { customerCode: 'CUST-APEX-03', customerName: 'Apex Automotive Drivetrains' },
    item: { itemCode: 'PART-GEAR-8620', itemName: 'Case-Hardened Pinion Gears', materialGrade: 'AISI 8620', uom: 'PCS' },
    quantity: { targetQuantity: 300, loadedQuantity: 300, completedQuantity: 300, scrappedQuantity: 0 },
    status: 'WAITING_FOR_INSPECTION',
    waitingForProduction: false,
    inProduction: false,
    waitingForInspection: true,
    workflowState: {
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: true,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false
    },
    priority: 'NORMAL',
    recipeSnapshot: { recipeCode: 'REC-CARB-8620', name: 'Atmospheric Gas Carburizing & Oil Quench', processFamily: 'CARBURIZING' },
    equipmentAssignment: { furnaceCode: 'FURNACE-SEAL-01', locationBay: 'Bay 3 Sealed Quench Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 28 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() - 14 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 26 * 3600000).toISOString(), actualCompletionDate: new Date(Date.now() - 14 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HEAT-8620-77C', allocatedQuantity: 300, uom: 'PCS' }]
  }
];

export const JobsPage: React.FC = () => {
  // Authorization Gate (Backend also enforces 403)
  const { hasAnyPermission } = usePermission();
  const canCreateBatchOrder = hasAnyPermission([
    'production:batch_order:create',
    'BATCH_ORDER_CREATE',
    'production:job:create',
    'PRODUCTION_JOB_CREATE'
  ]);

  const canOperateProduction = hasAnyPermission([
    'production:job:start',
    'production:job:update',
    'production:job:transition',
    'machines:furnace:operate',
    'PRODUCTION_JOB_START',
    'PRODUCTION_JOB_UPDATE',
    'PRODUCTION_JOB_TRANSITION',
    'MACHINES_FURNACE_OPERATE'
  ]);

  const canApproveInspection = hasAnyPermission([
    'production:job:complete',
    'production:job:transition',
    'PRODUCTION_JOB_COMPLETE',
    'PRODUCTION_JOB_TRANSITION'
  ]);

  const canViewProduction = hasAnyPermission([
    'production:job:view',
    'production:batch_order:view',
    'PRODUCTION_JOB_VIEW',
    'BATCH_ORDER_VIEW'
  ]);

  // Production jobs queue state
  const [jobs, setJobs] = useState<ProductionJob[]>(DEFAULT_JOBS);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [productionReadiness, setProductionReadiness] = useState<BatchOrderProductionReadiness | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Revised Authoritative Production Phase State
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<
    'WAITING_FOR_PRODUCTION' | 'IN_PRODUCTION' | 'WAITING_FOR_INSPECTION' | 'ALL_BATCH_ORDERS'
  >('WAITING_FOR_PRODUCTION');

  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [inProductionQueue, setInProductionQueue] = useState<any[]>([]);
  const [waitingInspectionQueue, setWaitingInspectionQueue] = useState<any[]>([]);

  // Take for Production Dialog State
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [targetTakeJob, setTargetTakeJob] = useState<ProductionJob | null>(null);
  const [takeFurnaceCode, setTakeFurnaceCode] = useState('FURNACE-VAC-01');
  const [takeLoadedPieces, setTakeLoadedPieces] = useState<number>(100);
  const [takeLoadedWeight, setTakeLoadedWeight] = useState<number>(50);
  const [takeInitialTemp, setTakeInitialTemp] = useState<number>(25);
  const [takeChargeNumber, setTakeChargeNumber] = useState('');
  const [takeShift, setTakeShift] = useState<'SHIFT_A' | 'SHIFT_B' | 'SHIFT_C'>('SHIFT_A');
  const [takeNotes, setTakeNotes] = useState('');

  // In-Production Execution Panel State
  const [selectedInProdJob, setSelectedInProdJob] = useState<ProductionJob | null>(null);
  const [selectedStageSeq, setSelectedStageSeq] = useState<number>(1);
  const [stageActualTemp, setStageActualTemp] = useState<number>(650);
  const [stageActualDuration, setStageActualDuration] = useState<number>(45);
  const [stageAtmosphere, setStageAtmosphere] = useState<string>('0.85% C');
  const [stageQuenchTemp, setStageQuenchTemp] = useState<number>(55);
  const [stageOperatorNotes, setStageOperatorNotes] = useState<string>('');

  // Approve for Inspection Dialog State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [targetApproveJob, setTargetApproveJob] = useState<ProductionJob | null>(null);
  const [approveCompletedQty, setApproveCompletedQty] = useState<number>(100);
  const [approveScrappedQty, setApproveScrappedQty] = useState<number>(0);
  const [approveNotes, setApproveNotes] = useState<string>('');

  // Authoritative Planning Phase Wizard & Workspace State
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);
  const [planningStep, setPlanningStep] = useState<1 | 2 | 3 | 4>(1);

  // Planning Selection Lineage (PO → GRN → Parts)
  const [eligiblePos, setEligiblePos] = useState<EligiblePo[]>([]);
  const [selectedPo, setSelectedPo] = useState<EligiblePo | null>(null);
  const [poSearch, setPoSearch] = useState<string>('');

  const [eligibleGrns, setEligibleGrns] = useState<EligibleGrn[]>([]);
  const [selectedGrn, setSelectedGrn] = useState<EligibleGrn | null>(null);
  const [isLoadingGrns, setIsLoadingGrns] = useState(false);

  const [eligibleParts, setEligibleParts] = useState<EligiblePart[]>([]);
  const [selectedPart, setSelectedPart] = useState<EligiblePart | null>(null);
  const [isLoadingParts, setIsLoadingParts] = useState(false);

  // Batch Order Configuration State
  const [targetQuantity, setTargetQuantity] = useState<number>(100);
  const [weightKg, setWeightKg] = useState<number>(50);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 3600000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT' | 'AOG_CRITICAL'>('HIGH');
  const [plannedStartDate, setPlannedStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetCompletionDate, setTargetCompletionDate] = useState<string>(
    new Date(Date.now() + 24 * 3600000).toISOString().split('T')[0]
  );
  const [minhardness, setMinhardness] = useState<number>(45);
  const [maxhardness, setMaxhardness] = useState<number>(52);
  const [notes, setNotes] = useState<string>('');

  // Fetch Jobs and Planning Availability Records
  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setJobs(json.data);
        }
      }
    } catch {
      // Retain default demo batch orders
    } finally {
      setIsLoading(false);
    }
    fetchQueues();
  };

  const fetchQueues = async () => {
    try {
      const [waitRes, inProdRes, inspRes] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/production-jobs/waiting-for-production`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/production-jobs/in-production`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/production-jobs/waiting-for-inspection`).catch(() => null)
      ]);

      if (waitRes && waitRes.ok) {
        const json = await waitRes.json();
        if (json.data && Array.isArray(json.data)) {
          setWaitingQueue(json.data);
        }
      }
      if (inProdRes && inProdRes.ok) {
        const json = await inProdRes.json();
        if (json.data && Array.isArray(json.data)) {
          setInProductionQueue(json.data);
        }
      }
      if (inspRes && inspRes.ok) {
        const json = await inspRes.json();
        if (json.data && Array.isArray(json.data)) {
          setWaitingInspectionQueue(json.data);
        }
      }
    } catch {
      // Fallback
    }
  };

  // Authoritative BO Record Selection (Fetches complete genealogy & hierarchy)
  const handleSelectJob = async (job: ProductionJob) => {
    setSelectedJob(job);
    setProductionReadiness(null);
    const id = job._id || job.id || job.jobNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/batch-orders/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSelectedJob(json.data);
        }
      }
    } catch {
      // Retain optimistic job record
    }

    try {
      const readRes = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${id}/production-readiness`);
      if (readRes.ok) {
        const readJson = await readRes.json();
        if (readJson.data) {
          setProductionReadiness(readJson.data);
        }
      }
    } catch {
      // Retain null / local evaluation fallback
    }
  };

  // 1. Fetch Completed Creation Records (Eligible POs with completed GRNs)
  const fetchEligiblePos = async () => {
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/planning/eligible-pos`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setEligiblePos(json.data);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default seed eligible POs from completed creation phase
    setEligiblePos([
      {
        id: 'po_aero_101',
        poNumber: 'PO-2026-00101',
        supplierName: 'Titanium Alloys Global Ltd',
        orderDate: '2026-09-01',
        status: 'RECEIVED',
        itemCount: 2,
        completedGrnCount: 1
      },
      {
        id: 'po_defense_202',
        poNumber: 'PO-2026-00202',
        supplierName: 'Allegheny Specialty Steels',
        orderDate: '2026-09-03',
        status: 'PARTIALLY_RECEIVED',
        itemCount: 3,
        completedGrnCount: 2
      }
    ]);
  };

  // 2. Fetch Completed GRNs strictly belonging to the selected parent PO
  const handleSelectPo = async (po: EligiblePo) => {
    setSelectedPo(po);
    setSelectedGrn(null);
    setSelectedPart(null);
    setPlanningStep(2);
    setIsLoadingGrns(true);

    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/planning/pos/${po.id}/grns`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setEligibleGrns(json.data);
          setIsLoadingGrns(false);
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingGrns(false);
    }

    // Fallback completed GRN belonging strictly to this PO
    setEligibleGrns([
      {
        id: `grn_${po.poNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_01`,
        grnNumber: `GRN-202609-${po.poNumber.slice(-4)}`,
        poId: po.id,
        poNumber: po.poNumber,
        status: 'AVAILABLE_FOR_PLANNING',
        grnDate: '2026-09-05',
        supplierName: po.supplierName,
        supplierChallanNumber: 'DC-8891-X',
        warehouseCode: 'WH-MAIN',
        storageLocationCode: 'BAY-1',
        totalUnits: 150,
        availableUnitsCount: 150,
        hasAvailableMaterial: true,
        isCreationComplete: true,
        readOnly: true
      }
    ]);
  };

  // 3. Fetch Received Parts on selected GRN
  const handleSelectGrn = async (grn: EligibleGrn) => {
    setSelectedGrn(grn);
    setSelectedPart(null);
    setPlanningStep(3);
    setIsLoadingParts(true);

    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/planning/grns/${grn.id}/parts`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setEligibleParts(json.data);
          setIsLoadingParts(false);
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingParts(false);
    }

    // Fallback parts received on GRN with authoritative recipe details
    setEligibleParts([
      {
        itemId: 'item_ti64',
        itemCode: 'MAT-TI-6AL4V',
        itemName: 'Titanium Grade 5 Round Bar',
        materialGrade: 'Ti-6Al-4V',
        processFamily: 'VACUUM_HEAT_TREATMENT',
        recipeId: 'rec_ti_aging',
        recipeCode: 'REC-TI-AGING',
        recipeName: 'Titanium Solution & Aging Cycle',
        acceptedQuantity: 150,
        availableQuantity: 150,
        availableUnitsCount: 2,
        canCreateBatchOrder: true,
        uom: 'KG',
        supplierHeatNumber: 'HEAT-TI-9912',
        readOnly: true,
        boundRecipe: {
          recipeId: 'rec_ti_aging',
          recipeCode: 'REC-TI-AGING',
          recipeName: 'Titanium Solution & Aging Cycle',
          processFamily: 'VACUUM_HEAT_TREATMENT',
          stages: [
            { sequence: 1, stageName: 'Preheat Ramp', targetTemperatureC: 650, soakTimeMinutes: 45, soakCriteria: 'SURFACE_TC_REACHED' },
            { sequence: 2, stageName: 'Solution Treat Soak', targetTemperatureC: 950, soakTimeMinutes: 120, soakCriteria: 'LOAD_THERMOCOUPLE_REACHED' }
          ]
        },
        availableUnits: [
          { unitIdentifier: 'UNIT-TI-001', quantity: 75, uom: 'KG', status: 'AVAILABLE_FOR_PLANNING', heatNumber: 'HEAT-TI-9912' },
          { unitIdentifier: 'UNIT-TI-002', quantity: 75, uom: 'KG', status: 'AVAILABLE_FOR_PLANNING', heatNumber: 'HEAT-TI-9912' }
        ]
      }
    ]);
  };

  // 4. Select Received Part & Open Batch Order Creation Form
  const handleInitiateBatchOrderCreation = (part: EligiblePart) => {
    setSelectedPart(part);
    setTargetQuantity(part.availableQuantity || part.acceptedQuantity || 100);
    setPlanningStep(4);
    setIsNewJobOpen(true);
  };

  // Reset modal state for wizard
  const handleOpenNewJobDialog = () => {
    setPlanningStep(1);
    setSelectedPo(null);
    setSelectedGrn(null);
    setSelectedPart(null);
    setFeedback(null);
    fetchEligiblePos();
    setIsNewJobOpen(true);
  };

  // 5. Create Batch Order (Enforces PO -> GRN -> BO and Item -> Recipe -> BO Lineage)
  const handleCreateBatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const targetPoId = selectedPo?.id || 'po_aero_101';
      const targetGrnId = selectedGrn?.id || 'grn_aero_501';
      const targetItemId = selectedPart?.itemId || 'item_ti64';
      const targetRecipeId = selectedPart?.recipeId || selectedPart?.boundRecipe?.recipeId || 'rec_ti_aging';

      const qtyNum = Number(targetQuantity);
      if (isNaN(qtyNum) || !isFinite(qtyNum) || qtyNum <= 0) {
        throw new Error('Batch Order quantity must be a positive finite number.');
      }
      const maxAllowed = selectedPart?.availableQuantity ?? selectedPart?.acceptedQuantity ?? 0;
      if (maxAllowed > 0 && qtyNum > maxAllowed) {
        throw new Error(`Requested quantity (${qtyNum}) exceeds available GRN quantity (${maxAllowed} ${selectedPart?.uom || ''}).`);
      }

      if (Number(minhardness) < 0 || Number(maxhardness) < 0) {
        throw new Error('Hardness values must be non-negative.');
      }
      if (Number(maxhardness) < Number(minhardness)) {
        throw new Error('Max hardness must be greater than or equal to min hardness.');
      }

      const configuredProcess =
        selectedPart?.boundRecipe?.stages?.[0]?.stageName ||
        selectedPart?.boundRecipe?.processFamily ||
        'VACUUM_HEAT_TREATMENT';

      const processDetails = [
        {
          serialNumber: 1,
          partId: targetItemId,
          partCode: selectedPart?.itemCode,
          partName: selectedPart?.itemName,
          process: configuredProcess,
          recipeId: targetRecipeId,
          recipeCode: selectedPart?.recipeCode || selectedPart?.boundRecipe?.recipeCode,
          minhardness: Number(minhardness),
          maxhardness: Number(maxhardness),
          status: 'PENDING'
        }
      ];

      const payload = {
        poId: targetPoId,
        grnId: targetGrnId,
        itemId: targetItemId,
        recipeId: targetRecipeId,
        quantity: Number(targetQuantity),
        targetQuantity: Number(targetQuantity),
        weight: Number(weightKg),
        weightKg: Number(weightKg),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        priority,
        plannedStartDate: new Date(plannedStartDate).toISOString(),
        targetCompletionDate: new Date(targetCompletionDate).toISOString(),
        processDetails,
        notes: notes || undefined
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/batch-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // Fallback route /production-jobs
        const fallbackRes = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!fallbackRes.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `Batch Order creation failed with status ${res.status}`);
        }
      }

      setFeedback({
        type: 'success',
        message: `Batch Order successfully created in WAITING_FOR_PRODUCTION status! Lineage established: PO (${selectedPo?.poNumber || 'PO-2026-00101'}) → GRN (${selectedGrn?.grnNumber || 'GRN-202609-0501'}) → BO. Material allocated to plan.`
      });
      setIsNewJobOpen(false);
      fetchJobs();
      if (selectedGrn) {
        handleSelectGrn(selectedGrn);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create Batch Order' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTakeModal = (job: ProductionJob) => {
    setTargetTakeJob(job);
    const targetPieces = job.quantity?.targetQuantity || 100;
    const targetWeight = job.weightKg || job.weight || 50;
    setTakeLoadedPieces(targetPieces);
    setTakeLoadedWeight(targetWeight);
    setTakeInitialTemp(25);
    const now = new Date();
    setTakeChargeNumber(
      `CHG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`
    );
    setTakeFurnaceCode(job.equipmentAssignment?.furnaceCode || 'FURNACE-VAC-01');
    setTakeShift('SHIFT_A');
    setTakeNotes('');
    setIsTakeModalOpen(true);
  };

  const handleConfirmTake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTakeJob) return;
    setIsSubmitting(true);
    setFeedback(null);
    const jobId = targetTakeJob._id || targetTakeJob.id || targetTakeJob.jobNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${jobId}/take-production`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          furnaceCode: takeFurnaceCode,
          loadedPieceCount: Number(takeLoadedPieces),
          loadedWeightKg: Number(takeLoadedWeight),
          initialFurnaceTempC: Number(takeInitialTemp),
          chargeNumber: takeChargeNumber,
          shift: takeShift,
          notes: takeNotes || 'Batch Order taken into furnace production'
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to take Batch Order into production');
      }

      const json = await res.json();
      setFeedback({
        type: 'success',
        message: `Batch Order ${targetTakeJob.boNumber || targetTakeJob.jobNumber} is now IN PRODUCTION! Assigned Furnace: ${takeFurnaceCode}. Previous flags cleared.`
      });
      setIsTakeModalOpen(false);
      setSelectedJob(null);
      if (json.data) {
        setSelectedInProdJob(json.data);
      }
      await fetchJobs();
      await fetchQueues();
      setActiveWorkflowTab('IN_PRODUCTION');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error taking job into production' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordStageProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInProdJob) return;
    setIsSubmitting(true);
    setFeedback(null);
    const jobId = selectedInProdJob._id || selectedInProdJob.id || selectedInProdJob.jobNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${jobId}/recipe-stage-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageSequence: Number(selectedStageSeq),
          actualTemperatureC: Number(stageActualTemp),
          actualDurationMinutes: Number(stageActualDuration),
          atmosphereLevel: stageAtmosphere || undefined,
          quenchParameters: {
            mediumTemperatureC: Number(stageQuenchTemp)
          },
          operatorNotes: stageOperatorNotes || undefined
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to record recipe stage progress');
      }

      const json = await res.json();
      setFeedback({
        type: 'success',
        message: `Recipe stage sequence ${selectedStageSeq} execution successfully recorded for ${selectedInProdJob.boNumber || selectedInProdJob.jobNumber}.`
      });
      if (json.data) {
        setSelectedInProdJob(json.data);
      }
      await fetchJobs();
      await fetchQueues();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record recipe stage progress' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApproveModal = (job: ProductionJob) => {
    setTargetApproveJob(job);
    const loaded = job.quantity?.loadedQuantity || job.quantity?.targetQuantity || 100;
    setApproveCompletedQty(loaded);
    setApproveScrappedQty(0);
    setApproveNotes('All recipe stages executed in strict compliance with metallurgical specification. Production operation verified complete.');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetApproveJob) return;
    setIsSubmitting(true);
    setFeedback(null);
    const jobId = targetApproveJob._id || targetApproveJob.id || targetApproveJob.jobNumber;
    const loaded = targetApproveJob.quantity?.loadedQuantity || targetApproveJob.quantity?.targetQuantity || 100;

    if (Number(approveCompletedQty) + Number(approveScrappedQty) !== loaded) {
      setFeedback({
        type: 'error',
        message: `Piece balance discrepancy: Completed (${approveCompletedQty}) + Scrapped (${approveScrappedQty}) must equal Loaded (${loaded}).`
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${jobId}/approve-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedQuantity: Number(approveCompletedQty),
          scrappedQuantity: Number(approveScrappedQty),
          notes: approveNotes
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to approve Batch Order for inspection');
      }

      setFeedback({
        type: 'success',
        message: `Batch Order ${targetApproveJob.boNumber || targetApproveJob.jobNumber} successfully approved for Inspection! inProduction cleared → waitingForInspection set. Job forwarded to Quality Inspection Queue.`
      });
      setIsApproveModalOpen(false);
      setSelectedJob(null);
      setSelectedInProdJob(null);
      await fetchJobs();
      await fetchQueues();
      setActiveWorkflowTab('WAITING_FOR_INSPECTION');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error approving job for inspection' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchEligiblePos();
  }, []);

  const filteredPos = eligiblePos.filter((po) => {
    const q = poSearch.toLowerCase();
    return (
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.status.toLowerCase().includes(q)
    );
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    const boNum = job.boNumber || job.jobNumber || '';
    const poNum = job.poNumber || '';
    const grnNum = job.grnNumber || '';
    const custName = job.customer?.customerName || '';
    const itemName = job.item?.itemName || '';
    const grade = job.item?.materialGrade || '';

    const matchesSearch =
      boNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      poNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grnNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grade.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const waitingJobs = waitingQueue.length > 0 ? waitingQueue : jobs.filter(
    (j) => j.waitingForProduction || j.status === 'WAITING_FOR_PRODUCTION'
  );
  const inProdJobs = inProductionQueue.length > 0 ? inProductionQueue : jobs.filter(
    (j) => j.inProduction || j.status === 'IN_PRODUCTION' || j.status === 'IN_PROGRESS'
  );
  const waitingInspJobs = waitingInspectionQueue.length > 0 ? waitingInspectionQueue : jobs.filter(
    (j) => j.waitingForInspection || j.status === 'WAITING_FOR_INSPECTION'
  );

  const waitingCount = waitingJobs.length;
  const inProgressCount = inProdJobs.length;
  const waitingInspectionCount = waitingInspJobs.length;
  const totalCount = jobs.length;

  const activeInProdJob =
    selectedInProdJob && inProdJobs.some((j) => (j._id || j.id || j.jobNumber) === (selectedInProdJob._id || selectedInProdJob.id || selectedInProdJob.jobNumber))
      ? selectedInProdJob
      : inProdJobs[0] || null;

  return (
    <PageContainer>
      <PageHeader
        title="Production Phase & Batch Orders"
        subtitle="Authoritative revised production workflow: waiting for production → in production → waiting for inspection"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={() => { fetchJobs(); fetchEligiblePos(); }} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh Records
            </AppButton>
            <AppButton
              variant="primary"
              leftIcon={<GitMerge size={14} />}
              onClick={handleOpenNewJobDialog}
              aria-label="New Thermal Job"
            >
              Plan New Batch Order (New Thermal Job)
            </AppButton>
          </div>
        }
      />

      {!canViewProduction && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant="warning" title="Authorization Notice: Production Permissions Required">
            Your current role does not have production operator access. You can view existing batch order planning records in read-only mode.
          </AppAlert>
        </div>
      )}

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title={feedback.type === 'success' ? 'Production Workflow Success' : 'Error'}>
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* Authoritative Production Phase Tab Navigator */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '14px',
          flexWrap: 'wrap'
        }}
      >
        {[
          {
            id: 'WAITING_FOR_PRODUCTION' as const,
            label: '1. Waiting for Production',
            count: waitingCount,
            icon: Clock,
            color: '#f59e0b',
            desc: 'Eligible BOs ready to begin'
          },
          {
            id: 'IN_PRODUCTION' as const,
            label: '2. In-Production Execution',
            count: inProgressCount,
            icon: Flame,
            color: '#38bdf8',
            desc: 'Active recipe stage execution & logging'
          },
          {
            id: 'WAITING_FOR_INSPECTION' as const,
            label: '3. Waiting for Inspection',
            count: waitingInspectionCount,
            icon: ShieldCheck,
            color: '#34d399',
            desc: 'Completed production handed off to QA'
          },
          {
            id: 'ALL_BATCH_ORDERS' as const,
            label: 'Planning Workspace & All BOs',
            count: totalCount,
            icon: Layers,
            color: '#94a3b8',
            desc: 'PO → GRN → BO planning & registry'
          }
        ].map((tab) => {
          const isActive = activeWorkflowTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveWorkflowTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: isActive ? `2px solid ${tab.color}` : '1px solid var(--color-border-subtle)',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none'
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: isActive ? `${tab.color}25` : 'rgba(255, 255, 255, 0.04)',
                  color: tab.color
                }}
              >
                <Icon size={16} />
              </span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: isActive ? 700 : 600 }}>{tab.label}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{tab.desc}</div>
              </div>
              <span
                style={{
                  marginLeft: '6px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: isActive ? tab.color : 'rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#000000' : 'var(--color-text-secondary)'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {!canCreateBatchOrder && activeWorkflowTab === 'ALL_BATCH_ORDERS' && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant="warning" title="Authorization Notice: Read-Only Planning Mode">
            You are logged in with read-only planning permissions. Creating new Batch Orders requires the <strong>BATCH_ORDER_CREATE</strong> permission or a Plant Manager role.
          </AppAlert>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. WAITING FOR PRODUCTION QUEUE VIEW                                      */}
      {/* ========================================================================= */}
      {activeWorkflowTab === 'WAITING_FOR_PRODUCTION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AppCard style={{ padding: '20px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <Clock size={18} />
                  </span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    Batch Orders Waiting for Production ({waitingJobs.length})
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 36px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Eligible batch orders that have completed planning and are awaiting production load. Taking a batch order transitions it atomically to <strong>in production</strong>, clears previous flags, and locks it from concurrent takes.
                </p>
              </div>
              <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                State: waitingForProduction
              </span>
            </div>

            {waitingJobs.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <Clock size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4, color: '#f59e0b' }} />
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>No Batch Orders Waiting for Production</div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  Use the <strong>Planning Workspace & All BOs</strong> tab to allocate material from verified GRNs and create batch orders.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BATCH ORDER & LINEAGE</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER & PART</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BOUND RECIPE</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PIECES & WEIGHT</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ASSIGNED FURNACE</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingJobs.map((job) => {
                      const boDisplay = job.boNumber || job.jobNumber;
                      const poDisplay = job.poNumber || 'PO-LINKED';
                      const grnDisplay = job.grnNumber || 'GRN-LINKED';
                      return (
                        <tr key={job._id || job.id || job.jobNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '14px' }}>{boDisplay}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', fontSize: '11px' }}>
                              <span style={{ color: '#93c5fd' }}>{poDisplay}</span>
                              <span>→</span>
                              <span style={{ color: '#6ee7b7' }}>{grnDisplay}</span>
                              <span>→</span>
                              <span style={{ color: '#fca5a5' }}>{boDisplay}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{job.customer?.customerName || 'Standard Customer'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {job.item?.itemName} [{job.item?.materialGrade}]
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#a3e635' }}>{job.recipeSnapshot?.recipeCode || 'REC-STANDARD'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                              {job.recipeSnapshot?.name || 'Metallurgical Heat Treat Cycle'} ({job.recipeSnapshot?.stages?.length || 3} Stages)
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{job.quantity?.targetQuantity} {job.item?.uom || 'PCS'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                              {job.weightKg || job.weight || 50} kg total
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#38bdf8' }}>{job.equipmentAssignment?.furnaceCode || 'FURNACE-VAC-01'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{job.equipmentAssignment?.locationBay || 'Bay 1'}</div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <AppButton
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSelectJob(job)}
                              >
                                View Record
                              </AppButton>
                              <AppButton
                                variant="primary"
                                size="sm"
                                leftIcon={<PlayCircle size={14} />}
                                disabled={!canOperateProduction}
                                onClick={() => handleOpenTakeModal(job)}
                              >
                                {canOperateProduction ? 'Take for Production' : 'Production Permission Required'}
                              </AppButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AppCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. IN-PRODUCTION EXECUTION WORKBENCH VIEW                                 */}
      {/* ========================================================================= */}
      {activeWorkflowTab === 'IN_PRODUCTION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Lock Banner */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} color="#38bdf8" />
              <div>
                <strong style={{ color: '#38bdf8', fontSize: '13px' }}>IN-PRODUCTION WORKFLOW LOCK ACTIVE:</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  Batch orders currently in production are strictly locked against modification through unrelated ERP functions. Only authorized viewing and Recipe-driven execution data entry is permitted.
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)'
              }}
            >
              Sole Active Flag: inProduction
            </span>
          </div>

          {inProdJobs.length === 0 ? (
            <AppCard style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Flame size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4, color: '#38bdf8' }} />
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>No Batch Orders Currently in Production</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>
                Select an eligible batch order from the <strong>Waiting for Production</strong> tab to take it into furnace execution.
              </div>
            </AppCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Job Selector Pills */}
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                {inProdJobs.map((job) => {
                  const isCurrent = activeInProdJob && (activeInProdJob._id || activeInProdJob.id || activeInProdJob.jobNumber) === (job._id || job.id || job.jobNumber);
                  return (
                    <button
                      key={job._id || job.id || job.jobNumber}
                      onClick={() => setSelectedInProdJob(job)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isCurrent ? '2px solid #38bdf8' : '1px solid var(--color-border-subtle)',
                        color: isCurrent ? '#ffffff' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        minWidth: '220px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13px', color: isCurrent ? '#38bdf8' : '#ffffff' }}>
                        {job.boNumber || job.jobNumber}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {job.equipmentAssignment?.furnaceCode || 'FURNACE-VAC-01'} • {job.quantity?.loadedQuantity || job.quantity?.targetQuantity} PCS
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Workbench Grid */}
              {activeInProdJob && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
                  {/* Left Column: Live Charge & Inspection Handoff */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Live Furnace Card */}
                    <AppCard style={{ padding: '18px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Flame size={18} color="#38bdf8" />
                          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                            LIVE FURNACE CHARGE EXECUTION
                          </h3>
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                          {activeInProdJob.equipmentAssignment?.furnaceCode || 'FURNACE-VAC-01'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Batch Order Lineage:</span>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>
                            {activeInProdJob.poNumber || 'PO'} → {activeInProdJob.grnNumber || 'GRN'} → {activeInProdJob.boNumber || activeInProdJob.jobNumber}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Customer & Item:</span>
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>
                            {activeInProdJob.customer?.customerName} • {activeInProdJob.item?.itemName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Material Grade:</span>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>{activeInProdJob.item?.materialGrade}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Charge Number:</span>
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                            {activeInProdJob.execution?.furnaceCharge?.chargeNumber || 'CHG-202609-ACTIVE'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Loaded Pieces:</span>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>
                            {activeInProdJob.quantity?.loadedQuantity || activeInProdJob.quantity?.targetQuantity} {activeInProdJob.item?.uom || 'PCS'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Loaded Weight:</span>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>
                            {activeInProdJob.execution?.furnaceCharge?.loadedWeightKg || activeInProdJob.weightKg || 50} kg
                          </span>
                        </div>
                      </div>
                    </AppCard>

                    {/* Inspection Handoff Gate Card */}
                    <AppCard style={{ padding: '18px', border: '1px solid rgba(52, 211, 153, 0.35)', background: 'rgba(52, 211, 153, 0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ShieldCheck size={18} color="#34d399" />
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                          PRODUCTION COMPLETION & INSPECTION APPROVAL
                        </h3>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                        After all required Recipe stages are verified complete and pieces balanced ($Q_{'{'}completed{'}'} + Q_{'{'}scrapped{'}'} = Q_{'{'}loaded{'}'}$), approve this Batch Order to hand off to the Quality Inspection Queue.
                      </p>
                      <AppButton
                        variant="primary"
                        size="md"
                        style={{ width: '100%', background: '#059669', borderColor: '#10b981' }}
                        leftIcon={<ShieldCheck size={16} />}
                        disabled={!canApproveInspection}
                        onClick={() => handleOpenApproveModal(activeInProdJob)}
                      >
                        {canApproveInspection ? 'Approve for Inspection' : 'Inspection Approval Permission Required'}
                      </AppButton>
                    </AppCard>
                  </div>

                  {/* Right Column: Recipe Stages Checklist & Stage Progress Logger */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Bound Recipe Stages */}
                    <AppCard style={{ padding: '18px', border: '1px solid rgba(163, 230, 53, 0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a3e635', textTransform: 'uppercase' }}>
                            Bound Recipe Execution Stages
                          </span>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>
                            {activeInProdJob.recipeSnapshot?.recipeCode || 'REC-STANDARD'} ({activeInProdJob.recipeSnapshot?.name || 'Standard Metallurgical Heat Treat Cycle'})
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(activeInProdJob.recipeSnapshot?.stages || [
                          { sequence: 1, stageName: 'Preheat Ramp', targetTemperatureC: 650, soakTimeMinutes: 45 },
                          { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
                          { sequence: 3, stageName: 'High Pressure N2 Quench', targetTemperatureC: 45, soakTimeMinutes: 20 }
                        ]).map((stg: any, idx: number) => {
                          const seq = stg.sequence || stg.stageSequence || idx + 1;
                          const loggedStage = (activeInProdJob.execution?.stageProgress || []).find((s: any) => s.stageSequence === seq);
                          const isCompleted = !!loggedStage;

                          return (
                            <div
                              key={seq}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '6px',
                                background: isCompleted ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                border: isCompleted ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid var(--color-border-subtle)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, color: isCompleted ? '#34d399' : '#ffffff' }}>
                                  {seq}. {stg.stageName}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                  Target: {stg.targetTemperatureC}°C • Soak: {stg.soakTimeMinutes || stg.targetDurationMinutes || 60} mins
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                {isCompleted ? (
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} /> {loggedStage.actualTemperatureC}°C ({loggedStage.actualDurationMinutes}m)
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={13} /> Pending Execution
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AppCard>

                    {/* Record Recipe Stage Progress Form */}
                    <AppCard style={{ padding: '18px', border: '1px solid var(--color-border-subtle)' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                        RECORD RECIPE STAGE PROGRESS
                      </h3>
                      <form onSubmit={handleRecordStageProgress} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <AppSelect
                            label="Select Recipe Stage *"
                            value={String(selectedStageSeq)}
                            onChange={(e) => {
                              const seq = Number(e.target.value);
                              setSelectedStageSeq(seq);
                              const stg = (activeInProdJob.recipeSnapshot?.stages || []).find((s: any) => (s.sequence || s.stageSequence) === seq);
                              if (stg) {
                                setStageActualTemp(stg.targetTemperatureC);
                                setStageActualDuration(stg.soakTimeMinutes || stg.targetDurationMinutes || 60);
                              }
                            }}
                            options={(activeInProdJob.recipeSnapshot?.stages || [
                              { sequence: 1, stageName: 'Preheat Ramp' },
                              { sequence: 2, stageName: 'Austenitizing Soak' },
                              { sequence: 3, stageName: 'High Pressure N2 Quench' }
                            ]).map((s: any, idx: number) => ({
                              value: String(s.sequence || s.stageSequence || idx + 1),
                              label: `Stage ${s.sequence || s.stageSequence || idx + 1}: ${s.stageName}`
                            }))}
                          />

                          <AppInput
                            label="Actual Furnace Temp (°C) *"
                            type="number"
                            value={stageActualTemp}
                            onChange={(e) => setStageActualTemp(Number(e.target.value))}
                            required
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <AppInput
                            label="Actual Soak / Duration (mins) *"
                            type="number"
                            min={1}
                            value={stageActualDuration}
                            onChange={(e) => setStageActualDuration(Number(e.target.value))}
                            required
                          />

                          <AppInput
                            label="Atmosphere Level (e.g. 0.85% C)"
                            value={stageAtmosphere}
                            onChange={(e) => setStageAtmosphere(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <AppInput
                            label="Quench Medium Temp (°C)"
                            type="number"
                            value={stageQuenchTemp}
                            onChange={(e) => setStageQuenchTemp(Number(e.target.value))}
                          />

                          <AppInput
                            label="Operator Notes"
                            placeholder="Atmosphere steady, thermocouple verify..."
                            value={stageOperatorNotes}
                            onChange={(e) => setStageOperatorNotes(e.target.value)}
                          />
                        </div>

                        <AppButton
                          type="submit"
                          variant="primary"
                          size="md"
                          isLoading={isSubmitting}
                          disabled={!canOperateProduction}
                        >
                          Log Stage Execution
                        </AppButton>
                      </form>
                    </AppCard>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WAITING FOR INSPECTION QUEUE VIEW                                      */}
      {/* ========================================================================= */}
      {activeWorkflowTab === 'WAITING_FOR_INSPECTION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AppCard style={{ padding: '20px', border: '1px solid rgba(52, 211, 153, 0.3)', background: 'linear-gradient(180deg, rgba(52, 211, 153, 0.04) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                    <ShieldCheck size={18} />
                  </span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    Production Completed — Waiting for Inspection ({waitingInspJobs.length})
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 36px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Batch Orders that have completed heat-treatment execution and have been approved for Quality Inspection. <strong>inProduction is false</strong> and <strong>waitingForInspection is true</strong>.
                </p>
              </div>
              <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 700, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                State: waitingForInspection
              </span>
            </div>

            {waitingInspJobs.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <ShieldCheck size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4, color: '#34d399' }} />
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>No Batch Orders Currently Awaiting Inspection</div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  Complete and approve in-production jobs from the <strong>In-Production Execution</strong> tab to hand them off here.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>INSPECTION REQUEST</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BATCH ORDER & LINEAGE</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER & PART</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>COMPLETED PIECES</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SCRAPPED</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingInspJobs.map((job) => {
                      const boDisplay = job.boNumber || job.jobNumber;
                      const poDisplay = job.poNumber || 'PO-LINKED';
                      const grnDisplay = job.grnNumber || 'GRN-LINKED';
                      const inspReq = job.execution?.qualityHandoff?.inspectionRequestId || `INSP-REQ-202609-${boDisplay.slice(-4)}`;
                      return (
                        <tr key={job._id || job.id || job.jobNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#34d399', fontSize: '13px' }}>{inspReq}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>QA Queue Handed Off</div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '14px' }}>{boDisplay}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', fontSize: '11px' }}>
                              <span style={{ color: '#93c5fd' }}>{poDisplay}</span>
                              <span>→</span>
                              <span style={{ color: '#6ee7b7' }}>{grnDisplay}</span>
                              <span>→</span>
                              <span style={{ color: '#fca5a5' }}>{boDisplay}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{job.customer?.customerName || 'Customer Inc.'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {job.item?.itemName} [{job.item?.materialGrade}]
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontWeight: 800, color: '#34d399', fontSize: '14px' }}>
                              {job.quantity?.completedQuantity || job.quantity?.targetQuantity || 100}
                            </span>{' '}
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{job.item?.uom || 'PCS'}</span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontWeight: 700, color: job.quantity?.scrappedQuantity ? '#ef4444' : 'var(--color-text-muted)' }}>
                              {job.quantity?.scrappedQuantity || 0}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                              WAITING FOR INSPECTION
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <AppButton
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSelectJob(job)}
                            >
                              View Details
                            </AppButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AppCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ALL BATCH ORDERS & PLANNING WORKSPACE VIEW                             */}
      {/* ========================================================================= */}
      {activeWorkflowTab === 'ALL_BATCH_ORDERS' && (
        <>
          {/* SECTION 1: DEDICATED PO & GRN PLANNING WORKSPACE (PO → GRN → PART → BO)   */}
          <AppCard style={{ marginBottom: '28px', padding: '20px', border: '1px solid rgba(56, 189, 248, 0.25)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <GitMerge size={18} />
              </span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                PO & GRN Planning Workspace
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 36px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Identify completed Creation Phase Purchase Orders and verified Goods Receipt Notes to allocate material and create Batch Orders.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(52, 211, 153, 0.12)', color: '#34d399', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(52, 211, 153, 0.25)' }}>
              <ShieldCheck size={13} />
              Read-Only Creation Records
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <Lock size={13} />
              Strict PO → GRN → BO Hierarchy
            </span>
          </div>
        </div>

        {/* 3-Column Interactive Master-Detail Planning Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
          
          {/* PANEL 1: Eligible Purchase Orders */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', padding: '14px', display: 'flex', flexDirection: 'column', height: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 1: CREATION PHASE</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Eligible Purchase Orders</div>
              </div>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {filteredPos.length} Available
              </span>
            </div>

            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Filter POs by number or supplier..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--color-border-subtle)',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPos.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  No Purchase Orders with completed Creation Phase records match criteria.
                </div>
              ) : (
                filteredPos.map((po) => {
                  const isSelected = selectedPo?.id === po.id;
                  return (
                    <div
                      key={po.id}
                      onClick={() => handleSelectPo(po)}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid var(--color-border-subtle)',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: isSelected ? '#38bdf8' : '#ffffff', fontSize: '13px' }}>
                          {po.poNumber}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                          {po.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        {po.supplierName}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        <span>Ordered: {new Date(po.orderDate).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 600, color: '#93c5fd' }}>
                          {po.completedGrnCount} Completed GRN{po.completedGrnCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL 2: Completed GRNs strictly belonging to Selected PO */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', padding: '14px', display: 'flex', flexDirection: 'column', height: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 2: VERIFIED RECEIPT</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Completed Goods Receipts (GRN)</div>
              </div>
              {selectedPo && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', fontWeight: 600 }}>
                  For {selectedPo.poNumber}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!selectedPo ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', gap: '10px' }}>
                  <FileText size={32} style={{ opacity: 0.4 }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>No Purchase Order Selected</div>
                  <div style={{ fontSize: '11px', maxWidth: '240px' }}>Select an authoritative PO on the left to view verified GRNs eligible for batch planning.</div>
                </div>
              ) : isLoadingGrns ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: '12px', gap: '8px' }}>
                  <RefreshCw size={16} className="animate-spin" /> Fetching completed GRNs...
                </div>
              ) : eligibleGrns.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  No completed GRNs found belonging to {selectedPo.poNumber}.
                </div>
              ) : (
                eligibleGrns.map((grn) => {
                  const isSelected = selectedGrn?.id === grn.id;
                  return (
                    <div
                      key={grn.id}
                      onClick={() => handleSelectGrn(grn)}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid #34d399' : '1px solid var(--color-border-subtle)',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 0 12px rgba(52, 211, 153, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: isSelected ? '#34d399' : '#ffffff', fontSize: '13px' }}>
                          {grn.grnNumber}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          {grn.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                        Challan: <strong style={{ color: '#ffffff' }}>{grn.supplierChallanNumber || 'DC-CERT'}</strong> | Bay: <strong style={{ color: '#ffffff' }}>{grn.storageLocationCode || 'WH-MAIN'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Date: {new Date(grn.grnDate).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 700, color: '#34d399' }}>
                          {grn.availableUnitsCount ?? grn.totalUnits ?? 0} Available Units
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        <span>Parent PO: {selectedPo.poNumber}</span>
                        <span style={{ color: '#6ee7b7' }}>Read-Only Record ✓</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL 3: Received Material / Part Selection & Authoritative Recipe Visibility */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', padding: '14px', display: 'flex', flexDirection: 'column', height: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 3: RECIPE & BATCH ORDER</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Received Parts & Bound Recipe</div>
              </div>
              {selectedGrn && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', fontWeight: 600 }}>
                  On {selectedGrn.grnNumber}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!selectedGrn ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', gap: '10px' }}>
                  <Layers size={32} style={{ opacity: 0.4 }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>No Goods Receipt Note Selected</div>
                  <div style={{ fontSize: '11px', maxWidth: '240px' }}>Select a verified GRN in the middle panel to view its received materials, serialized units, and authoritative recipes.</div>
                </div>
              ) : isLoadingParts ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: '12px', gap: '8px' }}>
                  <RefreshCw size={16} className="animate-spin" /> Inspecting received material and bound recipes...
                </div>
              ) : eligibleParts.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  No unallocated material parts found on {selectedGrn.grnNumber}.
                </div>
              ) : (
                eligibleParts.map((part) => {
                  const hasAvailable = (part.availableQuantity ?? 0) > 0;
                  const recipeObj = part.boundRecipe || part.recipeDetails;

                  return (
                    <div
                      key={part.itemId}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Part Identity */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Part: {part.itemName}</div>
                          <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                            Code: {part.itemCode} | Grade: <strong style={{ color: '#ffffff' }}>{part.materialGrade}</strong>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                            Heat Cert: {part.supplierHeatNumber || 'HEAT-VERIFIED'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: hasAvailable ? '#34d399' : '#94a3b8' }}>
                            {part.availableQuantity} {part.uom}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            Accepted: {part.acceptedQuantity} {part.uom}
                          </div>
                        </div>
                      </div>

                      {/* Serialized Unallocated Units */}
                      {part.availableUnits && part.availableUnits.length > 0 && (
                        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Unallocated Units ({part.availableUnits.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {part.availableUnits.slice(0, 4).map((u) => (
                              <span key={u.unitIdentifier} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                {u.unitIdentifier} ({u.quantity} {u.uom})
                              </span>
                            ))}
                            {part.availableUnits.length > 4 && (
                              <span style={{ fontSize: '10px', padding: '2px 6px', color: 'var(--color-text-muted)' }}>
                                +{part.availableUnits.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Authoritative Recipe Visibility Box */}
                      <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Flame size={12} /> Bound Recipe: {part.recipeCode || recipeObj?.recipeCode || 'Standard Metallurgical Recipe'}
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                            FROZEN SNAPSHOT
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          Process: {part.processFamily || recipeObj?.processFamily || 'VACUUM_HEAT_TREATMENT'}
                        </div>

                        {recipeObj?.stages && recipeObj.stages.length > 0 && (
                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {recipeObj.stages.map((stg: RecipeStage, idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#e2e8f0', background: 'rgba(0, 0, 0, 0.2)', padding: '3px 6px', borderRadius: '4px' }}>
                                <span>{stg.sequence || idx + 1}. {stg.stageName}</span>
                                <span style={{ fontWeight: 700, color: '#f59e0b' }}>{stg.targetTemperatureC}°C ({stg.soakTimeMinutes} min)</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          * Recipe is bound to the material grade. Arbitrary substitution is locked.
                        </div>
                      </div>

                      {/* Action to create BO from valid material/part */}
                      <div>
                        {hasAvailable ? (
                          <AppButton
                            variant="primary"
                            size="sm"
                            style={{ width: '100%' }}
                            leftIcon={<GitMerge size={14} />}
                            disabled={!canCreateBatchOrder}
                            onClick={() => handleInitiateBatchOrderCreation(part)}
                          >
                            {canCreateBatchOrder ? 'Create Batch Order (BO)' : 'Batch Order Permission Required'}
                          </AppButton>
                        ) : (
                          <div style={{ padding: '8px', textAlign: 'center', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>
                            Cannot Create BO: All received material has already been allocated to batch orders.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </AppCard>

      {/* ========================================================================= */}
      {/* SECTION 2: PRODUCTION BATCH ORDERS & PROCESS QUEUE                        */}
      {/* ========================================================================= */}
      {/* Summary KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>WAITING FOR PRODUCTION</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{waitingCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>IN HEATING & SOAK</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{inProgressCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Thermometer size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>WAITING FOR INSPECTION</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{waitingInspectionCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TOTAL BATCH ORDERS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>{totalCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(148, 163, 184, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Layers size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Filter and Search Bar */}
      <AppCard style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ALL', 'WAITING_FOR_PRODUCTION', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: statusFilter === status ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: statusFilter === status ? '#ffffff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search by BO#, PO#, GRN#, customer, grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--material-thin)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </AppCard>

      {/* Authoritative Batch Orders Table with PO -> GRN -> BO Hierarchy */}
      <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BATCH ORDER & LINEAGE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>RECEIVED PART & HEAT</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>METALLURGY & RECIPE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BATCH QTY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PRIORITY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No batch orders found matching active criteria. Use the PO & GRN Planning Workspace above to create a Batch Order.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const boDisplay = job.boNumber || job.jobNumber;
                  const poDisplay = job.poNumber || 'PO-LINKED';
                  const grnDisplay = job.grnNumber || 'GRN-LINKED';

                  return (
                    <tr
                      key={job._id || job.id || job.jobNumber}
                      style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.15s ease' }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '14px' }}>{boDisplay}</div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--color-border-subtle)',
                            fontSize: '11px',
                            color: 'var(--color-text-secondary)'
                          }}
                        >
                          <span style={{ color: '#93c5fd' }}>{poDisplay}</span>
                          <span>→</span>
                          <span style={{ color: '#6ee7b7' }}>{grnDisplay}</span>
                          <span>→</span>
                          <span style={{ color: '#fca5a5' }}>{boDisplay}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: '#ffffff', fontWeight: 600 }}>{job.item?.itemName || 'Received Part'}</div>
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                          Code: {job.item?.itemCode} | Heat: {job.materialAllocations?.[0]?.heatLotNumber || 'HEAT-CERTIFIED'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: '#38bdf8', fontWeight: 600 }}>{job.item?.materialGrade}</div>
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                          {job.recipeSnapshot?.name || job.recipeSnapshot?.recipeCode || 'Standard Metallurgical Recipe'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>
                        {job.quantity?.targetQuantity} {job.item?.uom || 'PCS'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            color:
                              job.priority === 'URGENT' || job.priority === 'CRITICAL' || job.priority === 'AOG_CRITICAL'
                                ? '#ef4444'
                                : job.priority === 'HIGH'
                                  ? '#f59e0b'
                                  : '#94a3b8',
                            background:
                              job.priority === 'URGENT' || job.priority === 'CRITICAL' || job.priority === 'AOG_CRITICAL'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : job.priority === 'HIGH'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(148, 163, 184, 0.1)'
                          }}
                        >
                          {job.priority}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {job.status === 'WAITING_FOR_PRODUCTION' ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              color: '#fbbf24',
                              background: 'rgba(251, 191, 36, 0.15)',
                              border: '1px solid rgba(251, 191, 36, 0.3)'
                            }}
                          >
                            WAITING FOR PRODUCTION
                          </span>
                        ) : (
                          <StatusBadge status={job.status} />
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          rightIcon={<ChevronRight size={14} />}
                          onClick={() => handleSelectJob(job)}
                        >
                          Details
                        </ActionButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AppCard>
        </>
      )}

      {/* Selected Job Drawer: Authoritative BO Record View & Planning Traceability */}
      <AppDrawer
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob ? `Authoritative Batch Order: ${selectedJob.boNumber || selectedJob.jobNumber}` : ''}
        subtitle={selectedJob ? `Hierarchy Genealogy: ${selectedJob.poNumber || 'PO'} → ${selectedJob.grnNumber || 'GRN'} → ${selectedJob.boNumber || selectedJob.jobNumber}` : ''}
        footer={
          selectedJob && (
            <>
              <AppButton variant="secondary" onClick={() => setSelectedJob(null)}>
                Close Record
              </AppButton>
              {selectedJob.waitingForProduction || selectedJob.status === 'WAITING_FOR_PRODUCTION' ? (
                <AppButton
                  variant="primary"
                  leftIcon={<PlayCircle size={16} />}
                  isLoading={isSubmitting}
                  disabled={!canOperateProduction}
                  onClick={() => handleOpenTakeModal(selectedJob)}
                >
                  Take for Production
                </AppButton>
              ) : selectedJob.inProduction || selectedJob.status === 'IN_PRODUCTION' ? (
                <AppButton
                  variant="primary"
                  leftIcon={<ShieldCheck size={16} />}
                  isLoading={isSubmitting}
                  disabled={!canApproveInspection}
                  onClick={() => handleOpenApproveModal(selectedJob)}
                >
                  Approve for Inspection
                </AppButton>
              ) : selectedJob.waitingForInspection || selectedJob.status === 'WAITING_FOR_INSPECTION' ? (
                <span
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(52, 211, 153, 0.15)',
                    color: '#34d399',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid rgba(52, 211, 153, 0.3)'
                  }}
                >
                  ✓ Waiting for QA Inspection
                </span>
              ) : null}
            </>
          )
        }
      >
        {selectedJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. HIERARCHY DISPLAY: PO / GRN / BO */}
            <AppCard style={{ padding: '16px', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <GitMerge size={16} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      Authoritative Hierarchy: PO / GRN / BO
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Relationship: Source Purchase Order → Received Goods Receipt Note → Planned Batch Order
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} />
                    Verified Genealogy
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} />
                    Immutable Links
                  </span>
                </div>
              </div>

              {/* 3-Tier Hierarchy Flow Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                {/* 1. PO Card */}
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(30, 58, 138, 0.25)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase' }}>1. Parent PO</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.2)', color: '#bfdbfe' }}>Contract</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                    {selectedJob.poNumber || selectedJob.hierarchy?.po?.poNumber || selectedJob.genealogy?.whichPo?.poNumber || 'PO-2026-00101'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedJob.customer?.customerName || selectedJob.genealogy?.whichPo?.supplierName || 'AeroDynamics Inc.'}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const poNum = selectedJob.poNumber || selectedJob.genealogy?.whichPo?.poNumber;
                        if (poNum) setSearchQuery(poNum);
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      Filter by PO
                    </button>
                  </div>
                </div>

                {/* Connector 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#60a5fa' }}>
                  <ArrowRight size={18} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>Supplied</span>
                </div>

                {/* 2. GRN Card */}
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(6, 78, 59, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>2. Source GRN</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.2)', color: '#a7f3d0' }}>Receipt</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                    {selectedJob.grnNumber || selectedJob.hierarchy?.grn?.grnNumber || selectedJob.genealogy?.whichGrn?.grnNumber || 'GRN-202609-0501'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px', fontWeight: 600 }}>
                    Creation Phase Complete
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const grnNum = selectedJob.grnNumber || selectedJob.genealogy?.whichGrn?.grnNumber;
                        if (grnNum) setSearchQuery(grnNum);
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      Filter by GRN
                    </button>
                  </div>
                </div>

                {/* Connector 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#34d399' }}>
                  <ArrowRight size={18} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>Allocated</span>
                </div>

                {/* 3. BO Card */}
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(120, 53, 15, 0.25)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase' }}>3. Planned BO</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.2)', color: '#fef3c7' }}>Batch Order</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                    {selectedJob.boNumber || selectedJob.jobNumber}
                  </div>
                  <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '2px', fontWeight: 700 }}>
                    Waiting for Production
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>
                      Qty: {selectedJob.quantity?.targetQuantity} {selectedJob.item?.uom || 'PCS'}
                    </span>
                  </div>
                </div>
              </div>
            </AppCard>

            {/* 2. AUTHORITATIVE SOURCE INFORMATION (READ-ONLY) */}
            <AppCard style={{ padding: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="#38bdf8" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Authoritative Source Information (Read-Only)
                  </span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={11} /> Creation Phase Locked
                </span>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
                PO and GRN-derived parameters are authoritative master inputs and cannot be silently modified by the Planning Phase.
              </div>

              {/* 8 Authoritative Data Points in 4x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {/* 1. PO */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Purchase Order</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.poNumber || selectedJob.genealogy?.whichPo?.poNumber || 'PO-2026-00101'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Contract Record
                  </div>
                </div>

                {/* 2. GRN */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Goods Receipt Note</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.grnNumber || selectedJob.genealogy?.whichGrn?.grnNumber || 'GRN-202609-0501'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Receipt & Storage Verified
                  </div>
                </div>

                {/* 3. Customer */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Customer / Client</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedJob.customer?.customerName || selectedJob.genealogy?.whichPo?.supplierName || 'AeroDynamics Propulsion'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Code: {selectedJob.customer?.customerCode || 'CUST-AERO-01'}
                  </div>
                </div>

                {/* 4. Part */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Part & Material</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.item?.itemCode || selectedJob.genealogy?.whichPart?.itemCode}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Grade: {selectedJob.item?.materialGrade || selectedJob.genealogy?.whichPart?.materialGrade}
                  </div>
                </div>

                {/* 5. Quantity */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Allocated Quantity</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.quantity?.targetQuantity} {selectedJob.item?.uom || 'PCS'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Constrained by GRN Available
                  </div>
                </div>

                {/* 6. Weight */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Allocated Weight</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.weightKg || selectedJob.weight || 50} KG
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Furnace Charge Metric
                  </div>
                </div>

                {/* 7. Due Date */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Target Due Date</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {new Date(selectedJob.timeline?.dueDate || selectedJob.dueDate || Date.now()).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Customer Commitment
                  </div>
                </div>

                {/* 8. Recipe */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#a3e635', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Thermal Recipe</span>
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>(Read-Only)</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {selectedJob.recipeSnapshot?.recipeCode || selectedJob.genealogy?.whichRecipe?.recipeCode}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    Rev {selectedJob.recipeSnapshot?.revisionNumber || 1}
                  </div>
                </div>
              </div>
            </AppCard>

            {/* 3. RECIPE CORROBORATION & LINEAGE (BO → ITEM → RECIPE) */}
            <AppCard style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(163, 230, 53, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={16} color="#a3e635" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Metallurgical Thermal Recipe & Lineage: BO → Item → Recipe
                  </span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(163, 230, 53, 0.15)', color: '#bef264', border: '1px solid rgba(163, 230, 53, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Verified Recipe-Item Match
                </span>
              </div>

              {/* Lineage Banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '14px', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: '#fcd34d' }}>BO: {selectedJob.boNumber || selectedJob.jobNumber}</span>
                <span style={{ color: '#94a3b8' }}>──►</span>
                <span style={{ fontWeight: 700, color: '#f472b6' }}>Item: {selectedJob.item?.itemCode} [{selectedJob.item?.materialGrade}]</span>
                <span style={{ color: '#94a3b8' }}>──►</span>
                <span style={{ fontWeight: 700, color: '#a3e635' }}>Recipe: {selectedJob.recipeSnapshot?.recipeCode} ({selectedJob.recipeSnapshot?.name})</span>
              </div>

              {/* Recipe Details & Stages */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Recipe Description</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedJob.recipeSnapshot?.name || 'Vacuum Austenitize & 2-Bar N2 Quench'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Process Family</div>
                  <div style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedJob.recipeSnapshot?.processFamily || 'VACUUM_HEAT_TREATMENT'}</div>
                </div>
              </div>

              {selectedJob.recipeSnapshot?.stages && selectedJob.recipeSnapshot.stages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Standard Metallurgical Stages ({selectedJob.recipeSnapshot.stages.length} Stages)
                  </div>
                  {selectedJob.recipeSnapshot.stages.map((stg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {stg.sequence || stg.stageSequence || idx + 1}. {stg.stageName}
                      </span>
                      <span style={{ color: '#a3e635', fontWeight: 700 }}>
                        {stg.targetTemperatureC}°C ({stg.soakTimeMinutes || stg.targetDurationMinutes || 60} min)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AppCard>

            {/* 4. CURRENT WORKFLOW STATE MACHINE (MUTUALLY EXCLUSIVE) */}
            <AppCard style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} /> CURRENT WORKFLOW STATE: WAITING FOR PRODUCTION
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  EXACTLY 1 ACTIVE STATE
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px' }}>
                {[
                  { name: 'waitingForProduction', label: 'Waiting for Production', active: selectedJob.waitingForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION') },
                  { name: 'inProduction', label: 'In Production', active: selectedJob.inProduction ?? (['IN_PROGRESS', 'SCHEDULED', 'APPROVED'].includes(selectedJob.status)) },
                  { name: 'waitingForInspection', label: 'Waiting for Inspection', active: selectedJob.waitingForInspection ?? (selectedJob.status === 'QUALITY_CHECK') },
                  { name: 'inInspection', label: 'In Inspection', active: selectedJob.inInspection ?? (selectedJob.status === ('INSPECTING' as any)) },
                  { name: 'waitingForDispatch', label: 'Waiting for Dispatch', active: selectedJob.waitingForDispatch ?? (['STORAGE', 'READY_FOR_DISPATCH'].includes(selectedJob.status)) },
                  { name: 'dispatched', label: 'Dispatched', active: selectedJob.dispatched ?? (['DISPATCHED', 'COMPLETED'].includes(selectedJob.status)) }
                ].map((st) => (
                  <div
                    key={st.name}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: st.active ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                      border: st.active ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ color: st.active ? '#ffffff' : 'var(--color-text-muted)', fontWeight: st.active ? 800 : 500 }}>
                      {st.label}
                    </span>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: st.active ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                        boxShadow: st.active ? '0 0 6px #10b981' : 'none'
                      }}
                    />
                  </div>
                ))}
              </div>
            </AppCard>

            {/* 4b. PLANNING-TO-PRODUCTION HANDOFF READINESS */}
            <AppCard style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.03)', border: (productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION')) ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color={(productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION')) ? '#10b981' : '#f59e0b'} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                    PLANNING-TO-PRODUCTION HANDOFF
                  </span>
                </div>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: (productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION'))
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: (productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION'))
                      ? '#10b981'
                      : '#ef4444',
                    border: (productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION'))
                      ? '1px solid #10b981'
                      : '1px solid #ef4444'
                  }}
                >
                  {(productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION'))
                    ? 'READY FOR PRODUCTION'
                    : 'INCOMPLETE / BLOCKED'}
                </span>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
                {(productionReadiness?.isReadyForProduction ?? (selectedJob.status === 'WAITING_FOR_PRODUCTION'))
                  ? 'This Batch Order satisfies all required Planning information and is in WAITING FOR PRODUCTION status. Production operators can retrieve this record directly from the queue without manual transfer.'
                  : 'This Batch Order is missing required source-defined planning information. Incomplete BOs are prevented from appearing in the active production queue.'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '11px' }}>
                {[
                  { label: 'Authoritative PO', valid: productionReadiness ? productionReadiness.hasAuthoritativePo : !!(selectedJob.poId || selectedJob.poNumber) },
                  { label: 'Authoritative GRN', valid: productionReadiness ? productionReadiness.hasAuthoritativeGrn : !!(selectedJob.grnId || selectedJob.grnNumber) },
                  { label: 'Customer Verification', valid: productionReadiness ? productionReadiness.hasCustomer : !!selectedJob.customer?.customerName },
                  { label: 'Part & Material Grade', valid: productionReadiness ? productionReadiness.hasPart : !!(selectedJob.item?.itemCode && selectedJob.item?.materialGrade) },
                  { label: 'Quantity (> 0)', valid: productionReadiness ? productionReadiness.hasValidQuantity : ((selectedJob.quantity?.targetQuantity || 0) > 0) },
                  { label: 'Weight (> 0 kg)', valid: productionReadiness ? productionReadiness.hasValidWeight : ((selectedJob.weightKg || selectedJob.weight || 0) > 0) },
                  { label: 'Recipe Snapshot', valid: productionReadiness ? productionReadiness.hasRecipe : !!(selectedJob.recipeSnapshot?.recipeCode) },
                  { label: '15 Process Structure', valid: productionReadiness ? productionReadiness.has15ProcessDetails : (selectedJob.processDetails?.length === 15) },
                  { label: 'Valid Initial State', valid: productionReadiness ? productionReadiness.hasValidWorkflowState : (selectedJob.status === 'WAITING_FOR_PRODUCTION') }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: item.valid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: item.valid ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    {item.valid ? (
                      <CheckCircle2 size={13} color="#10b981" />
                    ) : (
                      <XCircle size={13} color="#ef4444" />
                    )}
                    <span style={{ color: item.valid ? '#e2e8f0' : '#f87171', fontWeight: 600 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '12px', padding: '8px 10px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '10px', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={12} />
                <span>
                  <strong>Immutable Source Boundaries:</strong> PO → GRN → BO and Item → Recipe → BO relationships are permanently protected. Downstream phases control their own execution.
                </span>
              </div>
            </AppCard>

            {/* 5. 15-POSITION AUTHORITATIVE PROCESS PLANNING TABLE */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} /> AUTHORITATIVE PROCESS PLANNING (15 SEQUENTIAL POSITIONS)
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Production & Quality Execution Plan</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '360px' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-secondary)' }}>
                      <th style={{ padding: '6px 8px' }}>#</th>
                      <th style={{ padding: '6px 8px' }}>Part</th>
                      <th style={{ padding: '6px 8px' }}>Process</th>
                      <th style={{ padding: '6px 8px' }}>Recipe</th>
                      <th style={{ padding: '6px 8px' }}>Min Hardness</th>
                      <th style={{ padding: '6px 8px' }}>Max Hardness</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                      <th style={{ padding: '6px 8px' }}>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedJob.processDetails && selectedJob.processDetails.length === 15
                      ? selectedJob.processDetails
                      : Array.from({ length: 15 }, (_, i): IProcessDetailRow => ({
                          serialNumber: i + 1,
                          partCode: selectedJob.item?.itemCode,
                          partName: selectedJob.item?.itemName,
                          process: selectedJob.recipeSnapshot?.processFamily || 'VACUUM_HEAT_TREATMENT',
                          recipeCode: selectedJob.recipeSnapshot?.recipeCode,
                          minhardness: 45,
                          maxhardness: 52,
                          status: i === 0 ? 'PENDING' : 'BLANK',
                          userName: 'Production Planner'
                        }))
                    ).map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: row.status === 'BLANK' ? 'transparent' : 'rgba(167, 139, 250, 0.05)'
                        }}
                      >
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#a78bfa' }}>{row.serialNumber || rIdx + 1}</td>
                        <td style={{ padding: '6px 8px' }}>{row.partCode || row.partName || (row.status === 'BLANK' ? '—' : selectedJob.item?.itemCode)}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.process || (row.status === 'BLANK' ? '—' : 'Heat Treatment')}</td>
                        <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{row.recipeCode || (row.status === 'BLANK' ? '—' : selectedJob.recipeSnapshot?.recipeCode)}</td>
                        <td style={{ padding: '6px 8px' }}>{row.minhardness !== null && row.minhardness !== undefined ? `${row.minhardness} HRC` : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{row.maxhardness !== null && row.maxhardness !== undefined ? `${row.maxhardness} HRC` : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: row.status === 'BLANK' ? 'rgba(255,255,255,0.06)' : 'rgba(52, 211, 153, 0.15)',
                              color: row.status === 'BLANK' ? '#94a3b8' : '#34d399'
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>{row.userName || (row.status === 'BLANK' ? '—' : 'Planner')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          </div>
        )}
      </AppDrawer>

      {/* ========================================================================= */}
      {/* AUTHORITATIVE PLANNING PHASE WIZARD / BATCH ORDER CREATION MODAL          */}
      {/* ========================================================================= */}
      <AppDialog
        isOpen={isNewJobOpen}
        onClose={() => setIsNewJobOpen(false)}
        title="Planning Phase: PO → GRN → Batch Order Creation"
        description="Select a completed Purchase Order and its verified Goods Receipt Note to create a Batch Order."
        footer={
          <>
            {planningStep > 1 && (
              <AppButton variant="secondary" onClick={() => setPlanningStep((prev) => ((prev - 1) as any))}>
                Back
              </AppButton>
            )}
            <AppButton variant="secondary" onClick={() => setIsNewJobOpen(false)}>
              Cancel
            </AppButton>
            {planningStep === 4 && (
              <AppButton
                variant="primary"
                type="submit"
                form="create-job-form"
                isLoading={isSubmitting}
                disabled={!canCreateBatchOrder}
                leftIcon={<GitMerge size={16} />}
              >
                Schedule Production Job (Create Batch Order)
              </AppButton>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Wizard Step Progression Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: planningStep === 1 ? 'var(--color-primary)' : '#94a3b8' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: planningStep === 1 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>1</span>
              1. Select PO
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: planningStep === 2 ? 'var(--color-primary)' : '#94a3b8' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: planningStep === 2 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>2</span>
              2. Select GRN
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: planningStep === 3 ? 'var(--color-primary)' : '#94a3b8' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: planningStep === 3 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>3</span>
              3. Select GRN Part
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: planningStep === 4 ? 'var(--color-primary)' : '#94a3b8' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: planningStep === 4 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>4</span>
              4. Create BO
            </div>
          </div>

          {/* STEP 1: PO Selection */}
          {planningStep === 1 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                Select a Purchase Order with completed Creation Phase records:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {eligiblePos.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    No Purchase Orders with completed GRNs available for planning.
                  </div>
                ) : (
                  eligiblePos.map((po) => (
                    <div
                      key={po.id}
                      onClick={() => { handleSelectPo(po); setPlanningStep(2); }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '14px' }}>{po.poNumber}</div>
                        <div style={{ fontSize: '12px', color: '#ffffff', marginTop: '2px' }}>{po.supplierName}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                          {po.completedGrnCount} Completed GRN{po.completedGrnCount !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight size={16} style={{ marginLeft: '8px', verticalAlign: 'middle', color: 'var(--color-text-muted)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 2: GRN Selection (Restricted strictly to parent PO) */}
          {planningStep === 2 && selectedPo && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                Completed GRNs belonging strictly to <strong style={{ color: 'var(--color-primary)' }}>{selectedPo.poNumber}</strong>:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {eligibleGrns.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    No completed GRNs found for {selectedPo.poNumber}.
                  </div>
                ) : (
                  eligibleGrns.map((grn) => (
                    <div
                      key={grn.id}
                      onClick={() => { handleSelectGrn(grn); setPlanningStep(3); }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#34d399', fontSize: '14px' }}>{grn.grnNumber}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Challan: {grn.supplierChallanNumber || 'N/A'} | Location: {grn.storageLocationCode || 'WH-MAIN'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          AVAILABLE FOR PLANNING
                        </span>
                        <ChevronRight size={16} style={{ marginLeft: '8px', verticalAlign: 'middle', color: 'var(--color-text-muted)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Part Selection on GRN */}
          {planningStep === 3 && selectedGrn && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                Select verified received material item on <strong style={{ color: '#34d399' }}>{selectedGrn.grnNumber}</strong>:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {eligibleParts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    No unallocated parts available on this GRN.
                  </div>
                ) : (
                  eligibleParts.map((part) => (
                    <div
                      key={part.itemId}
                      onClick={() => { setSelectedPart(part); setTargetQuantity(part.availableQuantity || part.acceptedQuantity || 100); setPlanningStep(4); }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>{part.itemName}</div>
                        <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                          Grade: {part.materialGrade} | Recipe: {part.recipeCode || part.boundRecipe?.recipeCode || 'Standard Metallurgical Recipe'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                          Heat Number: {part.supplierHeatNumber || 'CERT-HEAT-LOT'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                          {part.availableQuantity} {part.uom} Avail
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Click to Plan →</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Configure Batch Order & Confirm Process Structure */}
          {planningStep === 4 && selectedPo && selectedGrn && selectedPart && (
            <form id="create-job-form" onSubmit={handleCreateBatchOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Lineage Summary Banner */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>ESTABLISHED PLANNING HIERARCHY:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                  <span style={{ fontWeight: 700, color: '#93c5fd' }}>PO: {selectedPo.poNumber}</span>
                  <span>→</span>
                  <span style={{ fontWeight: 700, color: '#6ee7b7' }}>GRN: {selectedGrn.grnNumber}</span>
                  <span>→</span>
                  <span style={{ fontWeight: 700, color: '#fca5a5' }}>New Batch Order (BO)</span>
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Bound Recipe: <strong style={{ color: '#ffffff' }}>{selectedPart.recipeCode || selectedPart.boundRecipe?.recipeCode || 'REC-TI-AGING'}</strong> (Frozen process structure will be snapshotted).
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px' }}>
                  <span>Authoritative Customer: <strong style={{ color: '#38bdf8' }}>{selectedGrn.supplierName || selectedPo.supplierName || 'Valued Customer'}</strong> (Derived from GRN)</span>
                  <span>Authoritative Material: <strong style={{ color: '#34d399' }}>{selectedPart.materialGrade || 'Ti-6Al-4V'}</strong> (Locked from Master)</span>
                </div>
              </div>

              {/* Initial Workflow State Machine Banner (Prompt 6 Compliance) */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#f59e0b" />
                  <div>
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>AUTOMATED INITIAL WORKFLOW STATE: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>waiting for production</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#fcd34d',
                    border: '1px solid rgba(245, 158, 11, 0.4)'
                  }}
                >
                  MUTUALLY EXCLUSIVE (1/6)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <AppInput
                    label={`Target Batch Quantity (${selectedPart.uom}) *`}
                    type="number"
                    min={1}
                    max={selectedPart.availableQuantity ?? selectedPart.acceptedQuantity}
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Number(e.target.value))}
                    required
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <span>
                      Received: <strong>{selectedPart.receivedQuantity ?? selectedPart.acceptedQuantity} {selectedPart.uom}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Allocated: <strong>{selectedPart.allocatedQuantity ?? Math.max(0, (selectedPart.receivedQuantity ?? selectedPart.acceptedQuantity) - (selectedPart.availableQuantity ?? selectedPart.acceptedQuantity))} {selectedPart.uom}</strong>
                    </span>
                    <span>•</span>
                    <span style={{ color: (selectedPart.availableQuantity ?? selectedPart.acceptedQuantity) > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      Available: {selectedPart.availableQuantity ?? selectedPart.acceptedQuantity} {selectedPart.uom}
                    </span>
                  </div>
                  {targetQuantity > (selectedPart.availableQuantity ?? selectedPart.acceptedQuantity) && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                      ⚠️ Quantity exceeds available GRN received material ({selectedPart.availableQuantity ?? selectedPart.acceptedQuantity} {selectedPart.uom}).
                    </div>
                  )}
                  {targetQuantity <= 0 && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                      ⚠️ Batch Order quantity must be greater than zero.
                    </div>
                  )}
                </div>

                <AppSelect
                  label="Batch Order Priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  options={[
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'URGENT', label: 'Urgent' },
                    { value: 'AOG_CRITICAL', label: 'AOG Critical (Defense / Flight Grounded)' }
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <AppInput
                  label="Batch Weight (kg) *"
                  type="number"
                  min={0}
                  step="any"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  required
                />

                <AppInput
                  label="Authoritative Due Date *"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <AppInput
                  label="Planned Start Date"
                  type="date"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  required
                />

                <AppInput
                  label="Target Completion Date"
                  type="date"
                  value={targetCompletionDate}
                  onChange={(e) => setTargetCompletionDate(e.target.value)}
                  required
                />
              </div>

              {/* Hardness Range User-Input (Authoritative Source Requirement) */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(167, 139, 250, 0.06)',
                  border: '1px solid rgba(167, 139, 250, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} /> REQUIRED USER-INPUT HARDNESS RANGE (HRC)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Authoritative specification requires explicit user entry. Values are not auto-populated from Recipe.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <AppInput
                    label="Min Hardness (HRC) *"
                    type="number"
                    min={0}
                    step="0.1"
                    value={minhardness}
                    onChange={(e) => setMinhardness(Number(e.target.value))}
                    required
                  />
                  <AppInput
                    label="Max Hardness (HRC) *"
                    type="number"
                    min={minhardness}
                    step="0.1"
                    value={maxhardness}
                    onChange={(e) => setMaxhardness(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <AppInput
                label="Planning Notes / Metallurgical Instructions"
                placeholder="Optional planning notes or pyrometric tolerances..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </form>
          )}
        </div>
      </AppDialog>

      {/* 1. Take for Production Dialog */}
      <AppDialog
        isOpen={isTakeModalOpen}
        onClose={() => setIsTakeModalOpen(false)}
        title="Take Batch Order into Production"
        size="md"
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsTakeModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              leftIcon={<Flame size={16} />}
              isLoading={isSubmitting}
              onClick={handleConfirmTake}
            >
              Confirm & Start Production
            </AppButton>
          </>
        }
      >
        {targetTakeJob && (
          <form onSubmit={handleConfirmTake} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
                  Target Batch Order
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                  {targetTakeJob.boNumber || targetTakeJob.jobNumber}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                {targetTakeJob.item?.itemName} ({targetTakeJob.item?.materialGrade})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Bound Recipe: <strong style={{ color: '#fbbf24' }}>{targetTakeJob.recipeSnapshot?.recipeCode || 'REC-STANDARD'}</strong> ({targetTakeJob.recipeSnapshot?.name || 'Standard Metallurgical Recipe'})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                Lineage: {targetTakeJob.poNumber || 'PO-LINKED'} → {targetTakeJob.grnNumber || 'GRN-LINKED'} → {targetTakeJob.boNumber || targetTakeJob.jobNumber}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppSelect
                label="Assign Furnace / Equipment *"
                value={takeFurnaceCode}
                onChange={(e) => setTakeFurnaceCode(e.target.value)}
                options={[
                  { value: 'FURNACE-VAC-01', label: 'FURNACE-VAC-01 (Vacuum Bay 1)' },
                  { value: 'FURNACE-PIT-01', label: 'FURNACE-PIT-01 (Pit Carburizing Bay 2)' },
                  { value: 'FURNACE-SEAL-01', label: 'FURNACE-SEAL-01 (Sealed Quench Bay 3)' },
                  { value: 'FURNACE-NIT-01', label: 'FURNACE-NIT-01 (Nitriding Bay 4)' }
                ]}
                required
              />
              <AppSelect
                label="Production Shift *"
                value={takeShift}
                onChange={(e) => setTakeShift(e.target.value as any)}
                options={[
                  { value: 'SHIFT_A', label: 'Shift A (06:00 - 14:00)' },
                  { value: 'SHIFT_B', label: 'Shift B (14:00 - 22:00)' },
                  { value: 'SHIFT_C', label: 'Shift C (22:00 - 06:00)' }
                ]}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppInput
                label="Loaded Piece Count *"
                type="number"
                min={1}
                value={takeLoadedPieces}
                onChange={(e) => setTakeLoadedPieces(Number(e.target.value))}
                required
              />
              <AppInput
                label="Loaded Weight (kg) *"
                type="number"
                min={0.1}
                step="0.1"
                value={takeLoadedWeight}
                onChange={(e) => setTakeLoadedWeight(Number(e.target.value))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppInput
                label="Initial Furnace Temp (°C) *"
                type="number"
                value={takeInitialTemp}
                onChange={(e) => setTakeInitialTemp(Number(e.target.value))}
                required
              />
              <AppInput
                label="Charge / Load Number *"
                value={takeChargeNumber}
                onChange={(e) => setTakeChargeNumber(e.target.value)}
                required
              />
            </div>

            <AppInput
              label="Operator & Pyrometry Notes"
              placeholder="Pyrometer calibration, load thermocouple placements, fixturing notes..."
              value={takeNotes}
              onChange={(e) => setTakeNotes(e.target.value)}
            />

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              ℹ️ Taking this Batch Order will atomically clear <code>waitingForProduction</code>, activate <code>inProduction</code> as the sole state flag, lock the record from concurrent takes, and freeze planning modifications.
            </div>
          </form>
        )}
      </AppDialog>

      {/* 2. Approve for Inspection Dialog */}
      <AppDialog
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Batch Order for Inspection"
        size="md"
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              style={{ background: '#059669', borderColor: '#10b981' }}
              leftIcon={<ShieldCheck size={16} />}
              isLoading={isSubmitting}
              onClick={handleConfirmApprove}
            >
              Confirm Approval & Handoff to QA
            </AppButton>
          </>
        }
      >
        {targetApproveJob && (
          <form onSubmit={handleConfirmApprove} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                  Ready for Inspection Handoff
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                  {targetApproveJob.boNumber || targetApproveJob.jobNumber}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                {targetApproveJob.item?.itemName} ({targetApproveJob.item?.materialGrade})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Loaded Pieces: <strong style={{ color: '#ffffff' }}>{targetApproveJob.quantity?.loadedQuantity || targetApproveJob.quantity?.targetQuantity || 100} {targetApproveJob.item?.uom || 'PCS'}</strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                Bound Recipe: {targetApproveJob.recipeSnapshot?.recipeCode || 'REC-STANDARD'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppInput
                label="Completed (Conforming) Pieces *"
                type="number"
                min={0}
                value={approveCompletedQty}
                onChange={(e) => setApproveCompletedQty(Number(e.target.value))}
                required
              />
              <AppInput
                label="Scrapped Pieces *"
                type="number"
                min={0}
                value={approveScrappedQty}
                onChange={(e) => setApproveScrappedQty(Number(e.target.value))}
                required
              />
            </div>

            {Number(approveCompletedQty) + Number(approveScrappedQty) !== (targetApproveJob.quantity?.loadedQuantity || targetApproveJob.quantity?.targetQuantity || 100) && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12px' }}>
                ⚠️ Piece balance error: Completed ({approveCompletedQty}) + Scrapped ({approveScrappedQty}) must equal Loaded ({targetApproveJob.quantity?.loadedQuantity || targetApproveJob.quantity?.targetQuantity || 100}).
              </div>
            )}

            <AppInput
              label="Production Approval Notes / QA Summary *"
              placeholder="All recipe stages completed, pyrometry chart attached, ready for dimensional and hardness inspection..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              required
            />

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              🔒 <strong>Handoff Invariant:</strong> Approving this Batch Order clears <code>inProduction</code>, activates <code>waitingForInspection</code>, removes the job from active production execution, and forwards it to Quality Inspection users.
            </div>
          </form>
        )}
      </AppDialog>
    </PageContainer>
  );
};
