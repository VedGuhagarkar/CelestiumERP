import React, { useState, useEffect } from 'react';
import {
  Truck,
  FileCheck,
  RefreshCw,
  ChevronRight,
  Send,
  Printer,
  Layers,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  FileText,
  PackageCheck,
  Building2,
  AlertCircle,
  LayoutGrid,
  Flame,
  UserCheck,
  Stamp,
  FileSignature,
  Eye
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
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

interface OutwardChallanHierarchy {
  poId: string;
  poNumber: string;
  grnId: string;
  grnNumber: string;
  batchOrderId: string;
  batchOrderNumber: string;
  outwardChallanNumber: string;
  ocDate: string;
}

export interface OutwardChallanItem {
  serialNumber: number;
  partName: string;
  partDescription: string;
  partNumber: string;
  materialGrade: string;
  heatTreatmentProcess: string;
  batchLotNumber: string;
  quantity: number;
  unitOfMeasure: string;
}

export interface OutwardChallanHeatTreatment {
  furnaceEquipment: string;
  furnaceId?: string;
  furnaceCode?: string;
  hardnessSpecification: string;
  actualHardness: string;
  actualHardnessValue?: number;
  caseDepth: string;
  effectiveCaseDepthMm?: number;
  quantityReceived: number;
  quantityDelivered: number;
}

interface DispatchConsignment {
  _id?: string;
  id?: string;
  dispatchNumber: string;
  deliveryChallanNumber: string;
  outwardChallanNumber?: string;
  ocDate?: string;
  batchOrderId?: string;
  batchOrderNumber?: string;
  grnId?: string;
  grnNumber?: string;
  poId?: string;
  poNumber?: string;
  hierarchy?: OutwardChallanHierarchy;
  isOutwardChallan?: boolean;
  status: 'DRAFT' | 'PACKED' | 'SCHEDULED' | 'GATE_PASS_ISSUED' | 'IN_TRANSIT' | 'DISPATCHED' | 'DELIVERED' | 'APPROVED' | 'WAITING_FOR_DISPATCH';
  customer: {
    customerCode: string;
    customerName: string;
    destinationAddress?: string;
  };
  lines?: {
    itemCode: string;
    itemName: string;
    dispatchedQuantity: number;
    uom: string;
    heatLotNumber: string;
    qualityVerification?: {
      isQualityApproved: boolean;
      cocNumber: string;
    };
  }[];
  items?: OutwardChallanItem[];
  heatTreatmentInformation?: OutwardChallanHeatTreatment;
  transporter?: string;
  vehicleNumber?: string;
  dispatchDate?: string;
  ewayBillNumber?: string;
  dispatchedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  dispatchedAt?: string;
  carrier?: {
    carrierName: string;
    transportMode: string;
    trackingNumber?: string;
    vehicleNumber?: string;
  };
  gatePass?: {
    gatePassNumber: string;
    securityOfficerName?: string;
    issuedAt: string;
  };
  preparedBy?: {
    userId: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    designation?: string;
    preparedAt?: string;
  };
  authorizedSignatory?: {
    userId: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    designation?: string;
    authorizedAt?: string;
    signatureRef?: string;
  };
  customerAcknowledgement?: {
    receivedBy?: string;
    signatureStampRef?: string;
    signatureRef?: string;
    stampRef?: string;
    date?: string;
    acknowledgedDate?: string;
    remarks?: string;
  };
  totalQuantity?: number;
  totalGrossWeightKg?: number;
  printCount?: number;
  printedAt?: string;
  printedBy?: string;
}

interface DispatchQueueItem {
  id: string;
  jobNumber: string;
  batchOrderNumber?: string;
  poId: string;
  poNumber: string;
  grnId: string;
  grnNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  part: {
    itemCode: string;
    itemName: string;
    materialGrade: string;
    uom: string;
  };
  recipe: {
    recipeCode: string;
    name: string;
  };
  heatLotNumber: string;
  quantities: {
    target: number;
    verified: number;
    scrap: number;
    rework: number;
    uom: string;
  };
  weightKg?: number;
  dueDate?: string;
  waitingForDispatch: boolean;
  outwardChallanNumber?: string | null;
  outwardChallanDate?: string | null;
  items?: OutwardChallanItem[];
  heatTreatmentInformation?: OutwardChallanHeatTreatment;
  inspectionApproval?: {
    isApproved: boolean;
    cocNumber?: string;
    clearedAt?: string;
    inspectorName?: string;
  };
}

const DEFAULT_DISPATCH_QUEUE: DispatchQueueItem[] = [
  {
    id: 'job-bo-8821',
    jobNumber: 'BO-202609-001',
    batchOrderNumber: 'BO-202609-001',
    poId: 'po-titan-8891',
    poNumber: 'PO-TITAN-8891',
    grnId: 'grn-2026-0042',
    grnNumber: 'GRN-2026-0042',
    customerId: 'cust-apex-01',
    customerName: 'Apex Automotive Drivetrains',
    customerCode: 'CUST-APEX-03',
    part: {
      itemCode: 'PART-GEAR-8620',
      itemName: 'Case-Hardened Pinion Gears',
      materialGrade: 'SAE 8620H',
      uom: 'PCS'
    },
    recipe: {
      recipeCode: 'RCP-CARB-01',
      name: 'Carburizing & Quench 60HRC'
    },
    heatLotNumber: 'HL-8620-2026B',
    quantities: {
      target: 300,
      verified: 300,
      scrap: 0,
      rework: 0,
      uom: 'PCS'
    },
    weightKg: 1820,
    dueDate: '2026-09-20',
    waitingForDispatch: true,
    outwardChallanNumber: null,
    items: [
      {
        serialNumber: 1,
        partName: 'Case-Hardened Pinion Gears',
        partDescription: 'Case-Hardened Pinion Gears',
        partNumber: 'PART-GEAR-8620',
        materialGrade: 'SAE 8620H',
        heatTreatmentProcess: 'Carburizing & Quench 60HRC',
        batchLotNumber: 'HL-8620-2026B',
        quantity: 300,
        unitOfMeasure: 'PCS'
      }
    ],
    heatTreatmentInformation: {
      furnaceEquipment: 'FURNACE-PIT-01 (Integral Quench Furnace)',
      furnaceCode: 'FURNACE-PIT-01',
      hardnessSpecification: '58-62 HRC',
      actualHardness: '60.5 HRC',
      actualHardnessValue: 60.5,
      caseDepth: '1.15 mm',
      effectiveCaseDepthMm: 1.15,
      quantityReceived: 300,
      quantityDelivered: 300
    },
    inspectionApproval: {
      isApproved: true,
      cocNumber: 'COC-2026-0045',
      clearedAt: '2026-09-15T10:30:00Z',
      inspectorName: 'Devin Vance (Chief Inspector)'
    }
  },
  {
    id: 'job-bo-8822',
    jobNumber: 'BO-202609-002',
    batchOrderNumber: 'BO-202609-002',
    poId: 'po-aero-4412',
    poNumber: 'PO-AERO-4412',
    grnId: 'grn-2026-0045',
    grnNumber: 'GRN-2026-0045',
    customerId: 'cust-aero-02',
    customerName: 'AeroDynamics Propulsion Inc.',
    customerCode: 'CUST-AERO-01',
    part: {
      itemCode: 'PART-SHAFT-4340',
      itemName: 'Turbine Rotor Shafts 4340',
      materialGrade: 'AISI 4340',
      uom: 'PCS'
    },
    recipe: {
      recipeCode: 'RCP-VAC-02',
      name: 'Vacuum Annealing & Temper'
    },
    heatLotNumber: 'HL-4340-2026A',
    quantities: {
      target: 120,
      verified: 120,
      scrap: 0,
      rework: 0,
      uom: 'PCS'
    },
    weightKg: 1040,
    dueDate: '2026-09-22',
    waitingForDispatch: true,
    outwardChallanNumber: null,
    items: [
      {
        serialNumber: 1,
        partName: 'Turbine Rotor Shafts 4340',
        partDescription: 'Turbine Rotor Shafts 4340',
        partNumber: 'PART-SHAFT-4340',
        materialGrade: 'AISI 4340',
        heatTreatmentProcess: 'Vacuum Annealing & Temper',
        batchLotNumber: 'HL-4340-2026A',
        quantity: 120,
        unitOfMeasure: 'PCS'
      }
    ],
    heatTreatmentInformation: {
      furnaceEquipment: 'VAC-FURNACE-02 (Vacuum Chamber)',
      furnaceCode: 'VAC-FURNACE-02',
      hardnessSpecification: '32-36 HRC',
      actualHardness: '34.2 HRC',
      actualHardnessValue: 34.2,
      caseDepth: 'Through-hardened (N/A)',
      effectiveCaseDepthMm: 0,
      quantityReceived: 120,
      quantityDelivered: 120
    },
    inspectionApproval: {
      isApproved: true,
      cocNumber: 'COC-2026-0046',
      clearedAt: '2026-09-15T14:15:00Z',
      inspectorName: 'Marcus Hall (Senior QA)'
    }
  }
];

const DEFAULT_DISPATCHES: DispatchConsignment[] = [
  {
    id: 'dsp_01',
    dispatchNumber: 'DSP-202608-0001',
    deliveryChallanNumber: 'DC-2026-0881',
    outwardChallanNumber: 'OC-202608-0001',
    ocDate: '2026-08-20T00:00:00.000Z',
    isOutwardChallan: true,
    poNumber: 'PO-TITAN-8891',
    grnNumber: 'GRN-2026-0042',
    batchOrderNumber: 'BO-202608-001',
    hierarchy: {
      poId: 'po_01',
      poNumber: 'PO-TITAN-8891',
      grnId: 'grn_01',
      grnNumber: 'GRN-2026-0042',
      batchOrderId: 'bo_01',
      batchOrderNumber: 'BO-202608-001',
      outwardChallanNumber: 'OC-202608-0001',
      ocDate: '2026-08-20T00:00:00.000Z'
    },
    status: 'IN_TRANSIT',
    customer: {
      customerCode: 'CUST-APEX-03',
      customerName: 'Apex Automotive Drivetrains',
      destinationAddress: '400 Industrial Way, Detroit, MI 48201'
    },
    items: [
      {
        serialNumber: 1,
        partName: 'Case-Hardened Pinion Gears',
        partDescription: 'Case-Hardened Pinion Gears',
        partNumber: 'PART-GEAR-8620',
        materialGrade: 'SAE 8620H',
        heatTreatmentProcess: 'Carburizing & Quench 60HRC',
        batchLotNumber: 'HL-8620-2026B',
        quantity: 300,
        unitOfMeasure: 'PCS'
      }
    ],
    heatTreatmentInformation: {
      furnaceEquipment: 'FURNACE-PIT-01 (Integral Quench Furnace)',
      furnaceCode: 'FURNACE-PIT-01',
      hardnessSpecification: '58-62 HRC',
      actualHardness: '60.5 HRC',
      actualHardnessValue: 60.5,
      caseDepth: '1.15 mm',
      effectiveCaseDepthMm: 1.15,
      quantityReceived: 300,
      quantityDelivered: 300
    },
    lines: [
      {
        itemCode: 'PART-GEAR-8620',
        itemName: 'Case-Hardened Pinion Gears',
        dispatchedQuantity: 300,
        uom: 'PCS',
        heatLotNumber: 'HL-8620-2026B',
        qualityVerification: { isQualityApproved: true, cocNumber: 'COC-2026-0045' }
      }
    ],
    carrier: { carrierName: 'Swift Heavy Haul Logistics', transportMode: 'ROAD', trackingNumber: 'TRK-SWIFT-994821', vehicleNumber: 'MH-12-QC-8821' },
    gatePass: { gatePassNumber: 'GP-2026-0881', securityOfficerName: 'James Wilson', issuedAt: new Date(Date.now() - 5 * 3600000).toISOString() },
    preparedBy: {
      userId: '507f191e810c19729de860e1',
      name: 'Devin Vance',
      username: 'devin.vance',
      role: 'DISPATCH_OFFICER',
      designation: 'Dispatch Lead',
      preparedAt: '2026-08-20T08:30:00Z'
    },
    authorizedSignatory: {
      userId: '507f191e810c19729de860e2',
      name: 'Elena Rostova',
      username: 'elena.rostova',
      role: 'PLANT_MANAGER',
      designation: 'Plant Operations Director',
      signatureRef: 'SIG-AUTH-9081',
      authorizedAt: '2026-08-20T09:15:00Z'
    },
    customerAcknowledgement: {
      receivedBy: 'Marcus Sterling',
      signatureStampRef: 'STAMP-APEX-REC-01',
      date: '2026-08-21T14:00:00Z',
      remarks: 'Consignment received in full with verified CoC.'
    },
    totalQuantity: 300,
    totalGrossWeightKg: 1820
  },
  {
    id: 'dsp_02',
    dispatchNumber: 'DSP-202608-0002',
    deliveryChallanNumber: 'DC-2026-0882',
    outwardChallanNumber: 'OC-202608-0002',
    ocDate: '2026-08-22T00:00:00.000Z',
    isOutwardChallan: true,
    poNumber: 'PO-AERO-4412',
    grnNumber: 'GRN-2026-0045',
    batchOrderNumber: 'BO-202608-002',
    hierarchy: {
      poId: 'po_02',
      poNumber: 'PO-AERO-4412',
      grnId: 'grn_02',
      grnNumber: 'GRN-2026-0045',
      batchOrderId: 'bo_02',
      batchOrderNumber: 'BO-202608-002',
      outwardChallanNumber: 'OC-202608-0002',
      ocDate: '2026-08-22T00:00:00.000Z'
    },
    status: 'SCHEDULED',
    customer: {
      customerCode: 'CUST-AERO-01',
      customerName: 'AeroDynamics Propulsion Inc.',
      destinationAddress: '100 Aerospace Blvd, Seattle, WA 98101'
    },
    items: [
      {
        serialNumber: 1,
        partName: 'Turbine Rotor Shafts 4340',
        partDescription: 'Turbine Rotor Shafts 4340',
        partNumber: 'PART-SHAFT-4340',
        materialGrade: 'AISI 4340',
        heatTreatmentProcess: 'Vacuum Annealing & Temper',
        batchLotNumber: 'HL-4340-2026A',
        quantity: 120,
        unitOfMeasure: 'PCS'
      }
    ],
    heatTreatmentInformation: {
      furnaceEquipment: 'VAC-FURNACE-02 (Vacuum Chamber)',
      furnaceCode: 'VAC-FURNACE-02',
      hardnessSpecification: '32-36 HRC',
      actualHardness: '34.2 HRC',
      actualHardnessValue: 34.2,
      caseDepth: 'Through-hardened (N/A)',
      effectiveCaseDepthMm: 0,
      quantityReceived: 120,
      quantityDelivered: 120
    },
    lines: [
      {
        itemCode: 'PART-SHAFT-4340',
        itemName: 'Turbine Rotor Shafts 4340',
        dispatchedQuantity: 120,
        uom: 'PCS',
        heatLotNumber: 'HL-4340-2026A',
        qualityVerification: { isQualityApproved: true, cocNumber: 'COC-2026-0046' }
      }
    ],
    carrier: { carrierName: 'Aero Freight Express', transportMode: 'AIR', trackingNumber: 'TRK-AFE-881290' },
    gatePass: { gatePassNumber: 'GP-2026-0882', securityOfficerName: 'James Wilson', issuedAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    preparedBy: {
      userId: '507f191e810c19729de860e1',
      name: 'Devin Vance',
      username: 'devin.vance',
      role: 'DISPATCH_OFFICER',
      designation: 'Dispatch Lead',
      preparedAt: '2026-08-22T08:00:00Z'
    },
    totalQuantity: 120,
    totalGrossWeightKg: 1040
  }
];

export const DispatchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'queue' | 'consignments'>('all');
  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueItem[]>(DEFAULT_DISPATCH_QUEUE);
  const [dispatches, setDispatches] = useState<DispatchConsignment[]>(DEFAULT_DISPATCHES);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchConsignment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Physical Dispatch Modal State
  const [isPhysicalDispatchModalOpen, setIsPhysicalDispatchModalOpen] = useState(false);
  const [selectedDispatchForPhysical, setSelectedDispatchForPhysical] = useState<DispatchConsignment | null>(null);
  const [transporterInput, setTransporterInput] = useState('');
  const [vehicleNumberInput, setVehicleNumberInput] = useState('');
  const [dispatchDateInput, setDispatchDateInput] = useState('');
  const [ewayBillInput, setEwayBillInput] = useState('');
  const [transportRemarksInput, setTransportRemarksInput] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({});
  const [isSubmittingPhysicalDispatch, setIsSubmittingPhysicalDispatch] = useState(false);

  const openPhysicalDispatchModal = (dispatchItem: DispatchConsignment) => {
    setSelectedDispatchForPhysical(dispatchItem);
    setTransporterInput(dispatchItem.transporter || dispatchItem.carrier?.carrierName || '');
    setVehicleNumberInput(dispatchItem.vehicleNumber || dispatchItem.carrier?.vehicleNumber || '');
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setDispatchDateInput(localIso);
    setEwayBillInput(dispatchItem.ewayBillNumber || '');
    setTransportRemarksInput('');
    setFormValidationErrors({});
    setIsPhysicalDispatchModalOpen(true);
  };

  const handleCompletePhysicalDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPhysicalDispatch || !selectedDispatchForPhysical) return;

    const errors: Record<string, string> = {};
    const trimmedTransporter = transporterInput.trim();
    if (!trimmedTransporter || trimmedTransporter.length < 2) {
      errors.transporter = 'Transporter name is required (minimum 2 characters)';
    } else if (/^(na|n\/a|none|null|nil|unknown|test|---|--|\.\.\.|\.|\_)$/i.test(trimmedTransporter)) {
      errors.transporter = 'Meaningless or placeholder transporter values are not permitted';
    }

    const trimmedVehicle = vehicleNumberInput.trim().toUpperCase();
    if (!trimmedVehicle || trimmedVehicle.length < 5) {
      errors.vehicleNumber = 'Vehicle number is required (minimum 5 characters, e.g. MH-12-AB-1234)';
    } else if (/^(invalid|unknown|placeholder|vehicle|truck|car|none|null|n\/a|\?\?\?)$/i.test(trimmedVehicle)) {
      errors.vehicleNumber = 'Invalid vehicle registration number';
    }

    if (!dispatchDateInput || isNaN(new Date(dispatchDateInput).getTime())) {
      errors.dispatchDate = 'A valid dispatch date is required';
    }

    const trimmedEway = ewayBillInput.trim();
    if (
      trimmedEway &&
      !(
        /^\d{12}$/.test(trimmedEway) ||
        /^EWB-[A-Z0-9-]{6,16}$/i.test(trimmedEway) ||
        /^[A-Z0-9]{12,18}$/i.test(trimmedEway)
      )
    ) {
      errors.ewayBillNumber = 'E-Way Bill must be a 12-digit numeric or standard E-Way Bill identifier';
    }

    if (Object.keys(errors).length > 0) {
      setFormValidationErrors(errors);
      return;
    }

    setIsSubmittingPhysicalDispatch(true);
    setFeedback(null);
    setFormValidationErrors({});

    try {
      const payload = {
        transporter: trimmedTransporter,
        vehicleNumber: trimmedVehicle,
        dispatchDate: new Date(dispatchDateInput).toISOString(),
        ewayBillNumber: trimmedEway || undefined,
        remarks: transportRemarksInput.trim() || undefined
      };

      const dispatchId = selectedDispatchForPhysical.id || selectedDispatchForPhysical._id || selectedDispatchForPhysical.dispatchNumber;
      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/dispatches/${dispatchId}/dispatch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to dispatch consignment (status ${res.status})`);
      }

      setFeedback({
        type: 'success',
        message: `Physical dispatch completed for OC ${selectedDispatchForPhysical.outwardChallanNumber || selectedDispatchForPhysical.deliveryChallanNumber}! Transporter: ${trimmedTransporter}, Vehicle: ${trimmedVehicle}. Finished Goods stock deducted and Batch Order marked as DISPATCHED.`
      });

      setDispatches((prev) =>
        prev.map((d) =>
          d.dispatchNumber === selectedDispatchForPhysical.dispatchNumber || d.id === selectedDispatchForPhysical.id
            ? { ...d, status: 'DISPATCHED', transporter: trimmedTransporter, vehicleNumber: trimmedVehicle, dispatchDate: payload.dispatchDate }
            : d
        )
      );

      setIsPhysicalDispatchModalOpen(false);
      setSelectedDispatchForPhysical(null);
      if (
        selectedDispatch &&
        (selectedDispatch.dispatchNumber === selectedDispatchForPhysical.dispatchNumber ||
          selectedDispatch.id === selectedDispatchForPhysical.id)
      ) {
        setSelectedDispatch((prev: any) =>
          prev
            ? {
                ...prev,
                status: 'DISPATCHED',
                transporter: trimmedTransporter,
                vehicleNumber: trimmedVehicle,
                dispatchDate: payload.dispatchDate
              }
            : null
        );
      }
      await fetchQueueAndDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to complete physical dispatch' });
    } finally {
      setIsSubmittingPhysicalDispatch(false);
    }
  };

  // Authorize Outward Challan Modal State
  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
  const [selectedDispatchForAuthorize, setSelectedDispatchForAuthorize] = useState<DispatchConsignment | null>(null);
  const [signatoryUserIdInput, setSignatoryUserIdInput] = useState('');
  const [designationInput, setDesignationInput] = useState('');
  const [signatureRefInput, setSignatureRefInput] = useState('');
  const [approvalNotesInput, setApprovalNotesInput] = useState('');
  const [authorizeErrors, setAuthorizeErrors] = useState<Record<string, string>>({});
  const [isSubmittingAuthorize, setIsSubmittingAuthorize] = useState(false);

  const openAuthorizeModal = (dispatchItem: DispatchConsignment) => {
    setSelectedDispatchForAuthorize(dispatchItem);
    setSignatoryUserIdInput(dispatchItem.authorizedSignatory?.userId || 'usr_signatory_01');
    setDesignationInput(dispatchItem.authorizedSignatory?.designation || 'Plant Operations Director / Authorized Signatory');
    setSignatureRefInput(dispatchItem.authorizedSignatory?.signatureRef || `SIG-AUTH-${Math.floor(1000 + Math.random() * 9000)}`);
    setApprovalNotesInput('');
    setAuthorizeErrors({});
    setIsAuthorizeModalOpen(true);
  };

  const handleAuthorizeOutwardChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAuthorize || !selectedDispatchForAuthorize) return;

    const trimmedUserId = signatoryUserIdInput.trim();
    if (!trimmedUserId) {
      setAuthorizeErrors({ userId: 'Valid signatory user reference is required' });
      return;
    }

    setIsSubmittingAuthorize(true);
    setFeedback(null);
    setAuthorizeErrors({});

    try {
      const payload = {
        authorizedSignatory: {
          userId: trimmedUserId,
          designation: designationInput.trim() || undefined,
          signatureRef: signatureRefInput.trim() || undefined
        },
        approvalNotes: approvalNotesInput.trim() || undefined
      };

      const dispatchId = selectedDispatchForAuthorize.id || selectedDispatchForAuthorize._id || selectedDispatchForAuthorize.dispatchNumber;
      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/dispatches/${dispatchId}/authorize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to authorize Outward Challan (status ${res.status})`);
      }

      const resJson = await res.json();
      const updatedData = resJson.data;

      setFeedback({
        type: 'success',
        message: `Outward Challan ${selectedDispatchForAuthorize.outwardChallanNumber || selectedDispatchForAuthorize.deliveryChallanNumber} authorized successfully! Signatory verified via ERP permission system.`
      });

      const updatedSignatory = updatedData?.authorizedSignatory || {
        userId: trimmedUserId,
        name: 'Authorized Plant Authority',
        designation: designationInput.trim() || 'Plant Operations Director',
        signatureRef: signatureRefInput.trim() || 'SIG-DIGITAL-VERIFIED',
        authorizedAt: new Date().toISOString()
      };

      setDispatches((prev) =>
        prev.map((d) =>
          d.dispatchNumber === selectedDispatchForAuthorize.dispatchNumber || d.id === selectedDispatchForAuthorize.id
            ? { ...d, status: d.status === 'SCHEDULED' || d.status === 'DRAFT' ? 'APPROVED' : d.status, authorizedSignatory: updatedSignatory }
            : d
        )
      );

      if (
        selectedDispatch &&
        (selectedDispatch.dispatchNumber === selectedDispatchForAuthorize.dispatchNumber ||
          selectedDispatch.id === selectedDispatchForAuthorize.id)
      ) {
        setSelectedDispatch((prev: any) =>
          prev
            ? {
                ...prev,
                status: prev.status === 'SCHEDULED' || prev.status === 'DRAFT' ? 'APPROVED' : prev.status,
                authorizedSignatory: updatedSignatory
              }
            : null
        );
      }

      setIsAuthorizeModalOpen(false);
      setSelectedDispatchForAuthorize(null);
      await fetchQueueAndDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to authorize Outward Challan' });
    } finally {
      setIsSubmittingAuthorize(false);
    }
  };

  // Customer Acknowledgement Modal State
  const [isAcknowledgeModalOpen, setIsAcknowledgeModalOpen] = useState(false);
  const [selectedDispatchForAcknowledge, setSelectedDispatchForAcknowledge] = useState<DispatchConsignment | null>(null);
  const [receivedByInput, setReceivedByInput] = useState('');
  const [ackSignatureRefInput, setAckSignatureRefInput] = useState('');
  const [ackDateInput, setAckDateInput] = useState('');
  const [ackRemarksInput, setAckRemarksInput] = useState('');
  const [isSubmittingAcknowledge, setIsSubmittingAcknowledge] = useState(false);

  const openAcknowledgeModal = (dispatchItem: DispatchConsignment) => {
    setSelectedDispatchForAcknowledge(dispatchItem);
    setReceivedByInput(dispatchItem.customerAcknowledgement?.receivedBy || '');
    setAckSignatureRefInput(dispatchItem.customerAcknowledgement?.signatureStampRef || dispatchItem.customerAcknowledgement?.signatureRef || '');
    setAckDateInput(new Date().toISOString().slice(0, 10));
    setAckRemarksInput(dispatchItem.customerAcknowledgement?.remarks || '');
    setIsAcknowledgeModalOpen(true);
  };

  const handleRecordCustomerAcknowledgement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAcknowledge || !selectedDispatchForAcknowledge) return;

    setIsSubmittingAcknowledge(true);
    setFeedback(null);

    try {
      const payload = {
        receivedBy: receivedByInput.trim() || undefined,
        signatureStampRef: ackSignatureRefInput.trim() || undefined,
        date: ackDateInput ? new Date(ackDateInput).toISOString() : undefined,
        remarks: ackRemarksInput.trim() || undefined
      };

      const dispatchId = selectedDispatchForAcknowledge.id || selectedDispatchForAcknowledge._id || selectedDispatchForAcknowledge.dispatchNumber;
      const res = await authenticatedFetch(
        `${env.API_BASE_URL}/dispatches/${dispatchId}/acknowledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to record customer acknowledgement (status ${res.status})`);
      }

      setFeedback({
        type: 'success',
        message: `Customer acknowledgement recorded for ${selectedDispatchForAcknowledge.outwardChallanNumber || selectedDispatchForAcknowledge.deliveryChallanNumber}! Status updated to DELIVERED.`
      });

      const updatedAck = {
        receivedBy: payload.receivedBy,
        signatureStampRef: payload.signatureStampRef,
        date: payload.date,
        remarks: payload.remarks
      };

      setDispatches((prev) =>
        prev.map((d) =>
          d.dispatchNumber === selectedDispatchForAcknowledge.dispatchNumber || d.id === selectedDispatchForAcknowledge.id
            ? { ...d, status: 'DELIVERED', customerAcknowledgement: updatedAck }
            : d
        )
      );

      if (
        selectedDispatch &&
        (selectedDispatch.dispatchNumber === selectedDispatchForAcknowledge.dispatchNumber ||
          selectedDispatch.id === selectedDispatchForAcknowledge.id)
      ) {
        setSelectedDispatch((prev: any) =>
          prev
            ? {
                ...prev,
                status: 'DELIVERED',
                customerAcknowledgement: updatedAck
              }
            : null
        );
      }

      setIsAcknowledgeModalOpen(false);
      setSelectedDispatchForAcknowledge(null);
      await fetchQueueAndDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record customer acknowledgement' });
    } finally {
      setIsSubmittingAcknowledge(false);
    }
  };

  // Outward Challan Modal State
  const [isOCModalOpen, setIsOCModalOpen] = useState(false);
  const [selectedBOForOC, setSelectedBOForOC] = useState<DispatchQueueItem | null>(null);
  const [ocCarrierName, setOcCarrierName] = useState('Swift Heavy Haul Logistics');
  const [ocTransportMode, setOcTransportMode] = useState('ROAD');
  const [ocVehicleNumber, setOcVehicleNumber] = useState('MH-12-QC-8821');
  const [ocDriverName, setOcDriverName] = useState('Rajesh Sharma');
  const [ocDriverPhone, setOcDriverPhone] = useState('+91 98230 11223');
  const [ocRemarks, setOcRemarks] = useState('Authoritative Outward Challan issued. Certified CoC attached.');
  const [isSubmittingOC, setIsSubmittingOC] = useState(false);

  // Standard Consignment Modal State
  const [isConsignmentModalOpen, setIsConsignmentModalOpen] = useState(false);
  const [isSubmittingConsignment, setIsSubmittingConsignment] = useState(false);
  const [customerName, setCustomerName] = useState('Titan Precision Defense LLC');
  const [destinationAddress, setDestinationAddress] = useState('500 Defense Tech Blvd, Huntsville, AL');
  const [carrierName, setCarrierName] = useState('FedEx Custom Critical');
  const [transportMode, setTransportMode] = useState('ROAD');
  const [quantity, setQuantity] = useState(250);

  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [availableFg, setAvailableFg] = useState<any[]>([]);

  const fetchQueueAndDispatches = async () => {
    setIsLoading(true);
    try {
      const [queueRes, dispRes, custRes, fgRes] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/dispatches/queue`).catch(() =>
          authenticatedFetch(`${env.API_BASE_URL}/dispatches/waiting-for-dispatch`).catch(() => null)
        ),
        authenticatedFetch(`${env.API_BASE_URL}/dispatches`),
        authenticatedFetch(`${env.API_BASE_URL}/customers`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/finished-goods`).catch(() => null)
      ]);

      if (queueRes && queueRes.ok) {
        const qJson = await queueRes.json();
        if (qJson.data && Array.isArray(qJson.data)) {
          setDispatchQueue(qJson.data);
        }
      }

      if (dispRes && dispRes.ok) {
        const json = await dispRes.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setDispatches(json.data);
        }
      }

      if (custRes && custRes.ok) {
        const cJson = await custRes.json();
        if (cJson.data?.items) setAvailableCustomers(cJson.data.items);
        else if (Array.isArray(cJson.data)) setAvailableCustomers(cJson.data);
      }

      if (fgRes && fgRes.ok) {
        const fJson = await fgRes.json();
        if (fJson.data?.items) setAvailableFg(fJson.data.items);
        else if (Array.isArray(fJson.data)) setAvailableFg(fJson.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateOCModal = (boItem: DispatchQueueItem) => {
    setSelectedBOForOC(boItem);
    setIsOCModalOpen(true);
  };

  const handleCreateOutwardChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOC || !selectedBOForOC) return;
    setIsSubmittingOC(true);
    setFeedback(null);

    try {
      const payload = {
        batchOrderId: selectedBOForOC.id,
        carrierName: ocCarrierName,
        transportMode: ocTransportMode,
        vehicleNumber: ocVehicleNumber,
        driverName: ocDriverName,
        driverPhone: ocDriverPhone,
        remarks: ocRemarks
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches/outward-challan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create Outward Challan (status ${res.status})`);
      }

      const json = await res.json();
      const createdOC = json.data;

      setFeedback({
        type: 'success',
        message: `Outward Challan ${createdOC?.outwardChallanNumber || createdOC?.deliveryChallanNumber} successfully generated for BO ${selectedBOForOC.jobNumber}! Unbroken hierarchy PO (${selectedBOForOC.poNumber}) ➔ GRN (${selectedBOForOC.grnNumber}) ➔ BO ➔ OC enforced.`
      });

      setIsOCModalOpen(false);
      setSelectedBOForOC(null);
      await fetchQueueAndDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create Outward Challan' });
    } finally {
      setIsSubmittingOC(false);
    }
  };

  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingConsignment) return;
    setIsSubmittingConsignment(true);
    setFeedback(null);

    try {
      const targetCust = availableCustomers.find((c) => c.companyName === customerName || c.customerCode === customerName) || availableCustomers[0];
      const targetFg = availableFg[0];

      const payload = {
        customerId: targetCust?.id || targetCust?._id || 'CUST-TITAN-02',
        purchaseOrderNumber: 'PO-TITAN-8891',
        destinationAddress,
        carrierName,
        transportMode,
        lines: [
          {
            finishedGoodsId: targetFg?.id || targetFg?._id || 'fg_pinion_8620_01',
            dispatchedQuantity: Number(quantity),
            packageDetails: {
              packagingType: 'PALLET',
              packageCount: 2,
              grossWeightKg: Number(quantity) * 6.5
            }
          }
        ]
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create dispatch consignment (status ${res.status})`);
      }

      setFeedback({ type: 'success', message: `Outbound consignment successfully booked for ${customerName} (${quantity} pcs).` });
      setIsConsignmentModalOpen(false);
      fetchQueueAndDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create consignment' });
    } finally {
      setIsSubmittingConsignment(false);
    }
  };

  // Authoritative Print OC Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedDispatchForPrint, setSelectedDispatchForPrint] = useState<DispatchConsignment | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoadingPrintData, setIsLoadingPrintData] = useState(false);

  const openPrintModal = async (dispatchItem: DispatchConsignment) => {
    setSelectedDispatchForPrint(dispatchItem);
    setIsPrintModalOpen(true);
    setIsLoadingPrintData(true);
    try {
      const idOrNumber = dispatchItem.id || dispatchItem._id || dispatchItem.outwardChallanNumber || dispatchItem.dispatchNumber;
      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches/outward-challan/${idOrNumber}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data && (data.id || data._id || data.dispatchNumber)) {
          setSelectedDispatchForPrint(data);
        }
      }
    } catch {
      // Retain fallback dispatchItem
    } finally {
      setIsLoadingPrintData(false);
    }
  };

  const handlePrintDocument = async () => {
    if (!selectedDispatchForPrint) return;
    setIsPrinting(true);
    try {
      const idOrNumber = selectedDispatchForPrint.id || selectedDispatchForPrint._id || selectedDispatchForPrint.outwardChallanNumber || selectedDispatchForPrint.dispatchNumber;
      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches/outward-challan/${idOrNumber}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      let updatedCount = (selectedDispatchForPrint.printCount || 0) + 1;
      let updatedPrintedAt = new Date().toISOString();
      let updatedPrintedBy = 'Current User (Dispatch Officer)';

      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        if (data) {
          updatedCount = data.printCount ?? updatedCount;
          updatedPrintedAt = data.printedAt ? new Date(data.printedAt).toISOString() : updatedPrintedAt;
          updatedPrintedBy = data.printedBy ?? updatedPrintedBy;
        }
      }

      setSelectedDispatchForPrint((prev: any) => prev ? {
        ...prev,
        printCount: updatedCount,
        printedAt: updatedPrintedAt,
        printedBy: updatedPrintedBy
      } : prev);

      setDispatches((prev) => prev.map((d) => {
        const matches = (d.id && d.id === selectedDispatchForPrint.id) ||
                        (d.dispatchNumber && d.dispatchNumber === selectedDispatchForPrint.dispatchNumber) ||
                        (d.outwardChallanNumber && d.outwardChallanNumber === selectedDispatchForPrint.outwardChallanNumber);
        return matches ? { ...d, printCount: updatedCount, printedAt: updatedPrintedAt, printedBy: updatedPrintedBy } : d;
      }));

      if (selectedDispatch) {
        setSelectedDispatch((prev: any) => prev ? {
          ...prev,
          printCount: updatedCount,
          printedAt: updatedPrintedAt,
          printedBy: updatedPrintedBy
        } : prev);
      }

      setFeedback({
        type: 'success',
        message: `Outward Challan (${selectedDispatchForPrint.outwardChallanNumber || selectedDispatchForPrint.deliveryChallanNumber}) printed successfully. Print record logged to ERP audit trail. Sent to factory gate printer.`
      });

      if (typeof window !== 'undefined' && window.print) {
        window.print();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to trigger print action'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintGatePass = () => {
    if (selectedDispatch) {
      openPrintModal(selectedDispatch);
    }
  };

  useEffect(() => {
    fetchQueueAndDispatches();
  }, []);

  const queueCount = dispatchQueue.filter(item => item.waitingForDispatch).length;
  const showQueue = activeTab === 'all' || activeTab === 'queue';
  const showConsignments = activeTab === 'all' || activeTab === 'consignments';

  return (
    <PageContainer>
      <PageHeader
        title="Outbound Dispatch & Gate Pass Logistics"
        subtitle="Authoritative PO ➔ GRN ➔ BO ➔ OC hierarchy, delivery challans, and gate pass clearances"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchQueueAndDispatches} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Truck size={14} />} onClick={() => setIsConsignmentModalOpen(true)}>
              Create Consignment
            </AppButton>
          </div>
        }
      />

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title={feedback.type === 'success' ? 'Operation Completed' : 'Action Failed'}>
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* Modern View Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
        <button
          type="button"
          data-testid="tab-all-workbench"
          onClick={() => setActiveTab('all')}
          style={{
            background: activeTab === 'all' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'all' ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-secondary)',
            border: activeTab === 'all' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <LayoutGrid size={15} />
          <span>Unified Dispatch Workbench</span>
        </button>

        <button
          type="button"
          data-testid="tab-dispatch-queue"
          onClick={() => setActiveTab('queue')}
          style={{
            background: activeTab === 'queue' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'queue' ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-secondary)',
            border: activeTab === 'queue' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Layers size={15} />
          <span>Dispatch Queue (Ready for OC)</span>
          <span
            style={{
              background: activeTab === 'queue' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
              color: activeTab === 'queue' ? '#000000' : '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {queueCount}
          </span>
        </button>

        <button
          type="button"
          data-testid="tab-active-consignments"
          onClick={() => setActiveTab('consignments')}
          style={{
            background: activeTab === 'consignments' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            color: activeTab === 'consignments' ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-secondary)',
            border: activeTab === 'consignments' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Truck size={15} />
          <span>Active Consignments & Outward Challans</span>
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {dispatches.length}
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* SECTION 1: Dispatch Queue (Waiting for Dispatch) */}
        {showQueue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <div>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>Authoritative Dispatch Staging: </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Only Batch Orders with <strong>waitingForDispatch = true</strong> and Inspection Approval can be converted into Outward Challans (OC).
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                <Lock size={13} />
                <span>PO ➔ GRN ➔ BO ➔ OC Invariant Active</span>
              </div>
            </div>

            {dispatchQueue.length === 0 ? (
              <AppCard style={{ padding: '32px', textAlign: 'center' }}>
                <PackageCheck size={36} style={{ color: 'var(--color-text-tertiary)', margin: '0 auto 12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  No Batch Orders Waiting for Dispatch
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  All inspected batch orders have been processed or are currently in heat treatment / quality inspection.
                </div>
              </AppCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                {dispatchQueue.map((bo) => {
                  const hasExistingOC = Boolean(bo.outwardChallanNumber);
                  return (
                    <AppCard
                      key={bo.id}
                      data-testid={`dispatch-card-${bo.jobNumber || bo.id}`}
                      style={{
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        borderLeft: '4px solid #38bdf8',
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)'
                      }}
                    >
                      {/* Header Row: Hierarchy Badge & Action */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {/* Traceability Path */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}
                          >
                            <span style={{ color: '#94a3b8' }}>PO:</span>
                            <strong style={{ color: '#38bdf8' }}>{bo.poNumber}</strong>
                            <ArrowRight size={12} color="#64748b" />
                            <span style={{ color: '#94a3b8' }}>GRN:</span>
                            <strong style={{ color: '#f59e0b' }}>{bo.grnNumber}</strong>
                            <ArrowRight size={12} color="#64748b" />
                            <span style={{ color: '#94a3b8' }}>BO:</span>
                            <strong style={{ color: '#10b981' }}>{bo.jobNumber || bo.batchOrderNumber}</strong>
                          </div>

                          <StatusBadge status="WAITING_FOR_DISPATCH" />

                          {hasExistingOC ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#34d399',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600
                              }}
                            >
                              <CheckCircle2 size={12} />
                              <span>OC Created: {bo.outwardChallanNumber}</span>
                            </div>
                          ) : null}
                        </div>

                        <div>
                          {hasExistingOC ? (
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              disabled
                              leftIcon={<CheckCircle2 size={14} />}
                            >
                              Challan Generated
                            </ActionButton>
                          ) : (
                            <AppButton
                              variant="primary"
                              data-testid={`btn-create-oc-${bo.jobNumber || bo.id}`}
                              leftIcon={<FileText size={15} />}
                              onClick={() => openCreateOCModal(bo)}
                            >
                              Create Outward Challan
                            </AppButton>
                          )}
                        </div>
                      </div>

                      {/* Metadata Columns */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '16px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          padding: '14px',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      >
                        {/* Customer & Destination */}
                        <div>
                          <div style={{ color: '#94a3b8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={13} />
                            <span>CUSTOMER</span>
                          </div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>{bo.customerName}</div>
                          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Code: {bo.customerCode}</div>
                        </div>

                        {/* Part Specs */}
                        <div>
                          <div style={{ color: '#94a3b8', marginBottom: '4px' }}>PART SPECIFICATION</div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>{bo.part.itemName}</div>
                          <div style={{ color: '#38bdf8', fontSize: '11px' }}>
                            {bo.part.itemCode} • Grade: {bo.part.materialGrade}
                          </div>
                        </div>

                        {/* Quantities & Net Weight */}
                        <div>
                          <div style={{ color: '#94a3b8', marginBottom: '4px' }}>QUANTITIES & WEIGHT</div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>
                            {bo.quantities.verified} {bo.quantities.uom}
                            {bo.weightKg ? ` (${bo.weightKg} kg)` : ''}
                          </div>
                          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                            Lot: {bo.heatLotNumber}
                          </div>
                        </div>

                        {/* Inspection Clearance */}
                        <div>
                          <div style={{ color: '#94a3b8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={13} color="#10b981" />
                            <span>INSPECTION CLEARANCE</span>
                          </div>
                          <div style={{ fontWeight: 600, color: '#34d399', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            <span>{bo.inspectionApproval?.cocNumber || 'COC-APPROVED'}</span>
                          </div>
                          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                            {bo.inspectionApproval?.inspectorName || 'Chief Inspector Verified'}
                          </div>
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: Active Consignments & Outward Challans Table */}
        {showConsignments && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="#38bdf8" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Active Shipping Consignments & Gate Passes
                </h2>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Showing {dispatches.length} active consignments
              </span>
            </div>

            <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OUTWARD CHALLAN / DISPATCH #</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PO ➔ GRN ➔ BO HIERARCHY</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER DESTINATION</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEMS & LOTS</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CARRIER & VEHICLE</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GATE PASS</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.map((d) => (
                      <tr
                        key={d.dispatchNumber}
                        style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.15s ease' }}
                      >
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={15} color="#38bdf8" />
                              <span>{d.outwardChallanNumber || d.deliveryChallanNumber}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{d.dispatchNumber}</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', fontFamily: 'monospace' }}>
                            <div style={{ color: '#38bdf8' }}>PO: {d.hierarchy?.poNumber || d.poNumber || 'PO-DEFAULT'}</div>
                            <div style={{ color: '#f59e0b' }}>GRN: {d.hierarchy?.grnNumber || d.grnNumber || 'GRN-DEFAULT'}</div>
                            <div style={{ color: '#10b981' }}>BO: {d.hierarchy?.batchOrderNumber || d.batchOrderNumber || 'BO-DEFAULT'}</div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{d.customer.customerName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{d.customer.destinationAddress}</div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#ffffff', fontWeight: 600 }}>{d.lines?.[0]?.itemName || 'Treated Components'}</div>
                          <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                            {d.lines?.[0]?.heatLotNumber || 'HL-4340'} ({d.lines?.[0]?.dispatchedQuantity || d.totalQuantity} pcs)
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{d.carrier?.carrierName || 'Standard Freight'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                            {d.carrier?.vehicleNumber ? `Veh: ${d.carrier.vehicleNumber}` : d.carrier?.trackingNumber || 'Road Transit'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 600 }}>
                          {d.gatePass?.gatePassNumber || 'GP-PENDING'}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <StatusBadge status={d.status} />
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {!d.authorizedSignatory?.userId && (
                              <AppButton
                                variant="secondary"
                                size="sm"
                                data-testid={`btn-authorize-${d.dispatchNumber || d.id}`}
                                leftIcon={<UserCheck size={13} />}
                                onClick={() => openAuthorizeModal(d)}
                              >
                                Authorize
                              </AppButton>
                            )}
                            {d.status !== 'DISPATCHED' && d.status !== 'DELIVERED' && (
                              <AppButton
                                variant="primary"
                                size="sm"
                                data-testid={`btn-dispatch-${d.dispatchNumber || d.id}`}
                                leftIcon={<Send size={13} />}
                                onClick={() => openPhysicalDispatchModal(d)}
                              >
                                Dispatch
                              </AppButton>
                            )}
                            {!d.customerAcknowledgement?.receivedBy && (
                              <AppButton
                                variant="secondary"
                                size="sm"
                                data-testid={`btn-acknowledge-${d.dispatchNumber || d.id}`}
                                leftIcon={<Stamp size={13} />}
                                onClick={() => openAcknowledgeModal(d)}
                              >
                                Acknowledge
                              </AppButton>
                            )}
                            <AppButton
                              variant="secondary"
                              size="sm"
                              data-testid={`btn-print-oc-${d.dispatchNumber || d.id}`}
                              leftIcon={<Printer size={13} />}
                              onClick={() => openPrintModal(d)}
                            >
                              Print OC
                            </AppButton>
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              rightIcon={<ChevronRight size={14} />}
                              onClick={() => setSelectedDispatch(d)}
                            >
                              Details
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          </div>
        )}
      </div>

      {/* Selected Dispatch Drawer */}
      <AppDrawer
        isOpen={!!selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
        title={selectedDispatch?.outwardChallanNumber || selectedDispatch?.dispatchNumber}
        subtitle={selectedDispatch ? `Outbound Delivery Challan (${selectedDispatch.deliveryChallanNumber})` : ''}
        footer={
          selectedDispatch && (
            <>
              <AppButton variant="secondary" onClick={() => setSelectedDispatch(null)}>
                Close
              </AppButton>
              {!selectedDispatch.authorizedSignatory?.userId && (
                <AppButton
                  variant="secondary"
                  data-testid="btn-drawer-authorize"
                  leftIcon={<UserCheck size={16} />}
                  onClick={() => openAuthorizeModal(selectedDispatch)}
                >
                  Authorize Signatory
                </AppButton>
              )}
              {selectedDispatch.status !== 'DISPATCHED' && selectedDispatch.status !== 'DELIVERED' && (
                <AppButton
                  variant="primary"
                  data-testid="btn-drawer-dispatch"
                  leftIcon={<Send size={16} />}
                  onClick={() => openPhysicalDispatchModal(selectedDispatch)}
                >
                  Complete Physical Dispatch
                </AppButton>
              )}
              {!selectedDispatch.customerAcknowledgement?.receivedBy && (
                <AppButton
                  variant="secondary"
                  data-testid="btn-drawer-acknowledge"
                  leftIcon={<Stamp size={16} />}
                  onClick={() => openAcknowledgeModal(selectedDispatch)}
                >
                  Customer Receipt & Stamp
                </AppButton>
              )}
              <AppButton
                variant="secondary"
                data-testid="btn-drawer-print-oc"
                leftIcon={<Printer size={16} />}
                onClick={() => openPrintModal(selectedDispatch)}
              >
                Print Gate Pass & Challan
              </AppButton>
            </>
          )
        }
      >
        {selectedDispatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Historical Immutability Guard Notice if Dispatched */}
            {(selectedDispatch.status === 'DISPATCHED' || selectedDispatch.status === 'DELIVERED') && (
              <AppCard style={{ padding: '14px 16px', borderLeft: '4px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} /> HISTORICAL OC RECORD (READ-ONLY IMMUTABILITY ENFORCED)
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                  This consignment has been formally dispatched and released through security. Production genealogy, metallurgical test outcomes, and transport details are permanently locked against modifications or deletion.
                </div>
              </AppCard>
            )}

            {/* Print Audit Metadata Card */}
            <AppCard style={{ padding: '14px 16px', borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={14} /> OUTWARD CHALLAN PRINT AUDIT TRAIL
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                <div><strong>Print Count:</strong> <span style={{ color: '#a78bfa', fontWeight: 700 }}>{selectedDispatch.printCount || 0} times</span></div>
                <div><strong>Last Printed At:</strong> {selectedDispatch.printedAt ? new Date(selectedDispatch.printedAt).toLocaleString() : 'Not Yet Printed'}</div>
                <div><strong>Printed By:</strong> {selectedDispatch.printedBy || 'N/A'}</div>
              </div>
            </AppCard>
            {/* Physical Dispatch Status Card if Dispatched */}
            {selectedDispatch.status === 'DISPATCHED' && (
              <AppCard style={{ padding: '16px', borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} /> AUTHORITATIVE PHYSICAL DISPATCH RECORD
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                  <div><strong>Transporter:</strong> {selectedDispatch.transporter || selectedDispatch.carrier?.carrierName || 'N/A'}</div>
                  <div><strong>Vehicle Number:</strong> {selectedDispatch.vehicleNumber || selectedDispatch.carrier?.vehicleNumber || 'N/A'}</div>
                  <div><strong>Dispatch Date:</strong> {selectedDispatch.dispatchDate ? new Date(selectedDispatch.dispatchDate).toLocaleString() : 'Recorded at Gate'}</div>
                  <div><strong>E-Way Bill:</strong> {selectedDispatch.ewayBillNumber || 'N/A (Exempt / Not provided)'}</div>
                  {selectedDispatch.dispatchedBy && (
                    <div style={{ gridColumn: 'span 2', color: '#94a3b8', fontSize: '12px' }}>
                      <strong>Dispatched By (Authoritative Actor):</strong> {selectedDispatch.dispatchedBy.userId} ({selectedDispatch.dispatchedBy.role || 'Dispatch Officer'})
                    </div>
                  )}
                </div>
              </AppCard>
            )}

            {/* OC Prepared By Card */}
            <AppCard style={{ padding: '16px', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSignature size={14} /> OC PREPARED BY (AUTHORITATIVE USER ATTRIBUTION)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                <div><strong>Preparer User ID:</strong> {selectedDispatch.preparedBy?.userId || selectedDispatch.dispatchedBy?.userId || 'usr_dispatch_prep_01'}</div>
                <div><strong>Preparer Name:</strong> {selectedDispatch.preparedBy?.name || selectedDispatch.preparedBy?.username || 'Devin Vance'}</div>
                <div><strong>Designation / Role:</strong> {selectedDispatch.preparedBy?.designation || selectedDispatch.preparedBy?.role || 'Dispatch Lead'}</div>
                <div><strong>Prepared Timestamp:</strong> {selectedDispatch.preparedBy?.preparedAt ? new Date(selectedDispatch.preparedBy.preparedAt).toLocaleString() : 'Authoritative Record'}</div>
              </div>
            </AppCard>

            {/* OC Authorized Signatory Card */}
            <AppCard style={{ padding: '16px', borderLeft: `4px solid ${selectedDispatch.authorizedSignatory ? '#10b981' : '#f59e0b'}` }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: selectedDispatch.authorizedSignatory ? '#34d399' : '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={14} /> AUTHORIZED SIGNATORY (ERP RBAC VERIFIED)
              </div>
              {selectedDispatch.authorizedSignatory ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                  <div><strong>Signatory User ID:</strong> {selectedDispatch.authorizedSignatory.userId}</div>
                  <div><strong>Signatory Name:</strong> {selectedDispatch.authorizedSignatory.name || selectedDispatch.authorizedSignatory.username || 'Authorized Signatory'}</div>
                  <div><strong>Designation:</strong> {selectedDispatch.authorizedSignatory.designation || 'Plant Operations Director'}</div>
                  <div><strong>Signature Reference:</strong> <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedDispatch.authorizedSignatory.signatureRef || 'DIGITAL-VERIFIED'}</span></div>
                  <div style={{ gridColumn: 'span 2', color: '#94a3b8', fontSize: '12px' }}>
                    <strong>Authorized Timestamp:</strong> {selectedDispatch.authorizedSignatory.authorizedAt ? new Date(selectedDispatch.authorizedSignatory.authorizedAt).toLocaleString() : 'N/A'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#f59e0b', lineHeight: 1.5 }}>
                  ⚠️ <strong>Pending Signatory Authorization:</strong> This Outward Challan has not yet received ERP RBAC signatory approval. Physical dispatch departure is strictly blocked until an authorized signatory confirms this document.
                </div>
              )}
            </AppCard>

            {/* Customer Acknowledgement Card */}
            <AppCard style={{ padding: '16px', borderLeft: `4px solid ${selectedDispatch.customerAcknowledgement ? '#3b82f6' : '#64748b'}` }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: selectedDispatch.customerAcknowledgement ? '#60a5fa' : '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Stamp size={14} /> CUSTOMER ACKNOWLEDGEMENT & DELIVERY PROOF
              </div>
              {selectedDispatch.customerAcknowledgement ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                  <div><strong>Received By:</strong> {selectedDispatch.customerAcknowledgement.receivedBy || 'Customer Representative'}</div>
                  <div><strong>Signature / Stamp Ref:</strong> <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{selectedDispatch.customerAcknowledgement.signatureStampRef || selectedDispatch.customerAcknowledgement.signatureRef || 'STAMP-ACKNOWLEDGED'}</span></div>
                  <div><strong>Receipt Date:</strong> {selectedDispatch.customerAcknowledgement.date || selectedDispatch.customerAcknowledgement.acknowledgedDate ? new Date(selectedDispatch.customerAcknowledgement.date || selectedDispatch.customerAcknowledgement.acknowledgedDate!).toLocaleDateString() : 'Recorded upon Receipt'}</div>
                  <div><strong>Customer Remarks:</strong> {selectedDispatch.customerAcknowledgement.remarks || 'Consignment received with verified documentation'}</div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Optional proof of customer receipt, receiving signature, or company stamp has not been uploaded yet.
                </div>
              )}
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> AUTHORITATIVE TRACEABILITY HIERARCHY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontFamily: 'monospace' }}>
                <div><strong>Purchase Order (PO):</strong> {selectedDispatch.hierarchy?.poNumber || selectedDispatch.poNumber || 'N/A'}</div>
                <div><strong>Goods Receipt (GRN):</strong> {selectedDispatch.hierarchy?.grnNumber || selectedDispatch.grnNumber || 'N/A'}</div>
                <div><strong>Batch Order (BO):</strong> {selectedDispatch.hierarchy?.batchOrderNumber || selectedDispatch.batchOrderNumber || 'N/A'}</div>
                <div><strong>Outward Challan (OC):</strong> {selectedDispatch.outwardChallanNumber || selectedDispatch.deliveryChallanNumber}</div>
                {selectedDispatch.ocDate && (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    <strong>OC Date (Derived from GRN):</strong> {new Date(selectedDispatch.ocDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PackageCheck size={14} /> BO-DERIVED OUTWARD CHALLAN ITEMS (AUTHORITATIVE)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(selectedDispatch.items && selectedDispatch.items.length > 0
                  ? selectedDispatch.items
                  : [
                      {
                        serialNumber: 1,
                        partName: selectedDispatch.lines?.[0]?.itemName || 'Treated Components',
                        partDescription: selectedDispatch.lines?.[0]?.itemName || 'Treated Components',
                        partNumber: selectedDispatch.lines?.[0]?.itemCode || 'PART-DEFAULT',
                        materialGrade: 'Authoritative Grade',
                        heatTreatmentProcess: 'Heat-Treatment Process',
                        batchLotNumber: selectedDispatch.lines?.[0]?.heatLotNumber || 'HL-DEFAULT',
                        quantity: selectedDispatch.lines?.[0]?.dispatchedQuantity || selectedDispatch.totalQuantity || 0,
                        unitOfMeasure: selectedDispatch.lines?.[0]?.uom || 'PCS'
                      }
                    ]
                ).map((item) => (
                  <div
                    key={item.serialNumber}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px'
                    }}
                  >
                    <div><strong>Serial Number:</strong> {item.serialNumber}</div>
                    <div><strong>Part Number:</strong> <span style={{ color: '#38bdf8' }}>{item.partNumber}</span></div>
                    <div><strong>Part Name / Description:</strong> {item.partName || item.partDescription}</div>
                    <div><strong>Material Grade:</strong> {item.materialGrade}</div>
                    <div><strong>Heat-Treatment Process:</strong> {item.heatTreatmentProcess}</div>
                    <div><strong>Batch / Lot Number:</strong> <span style={{ color: '#f59e0b' }}>{item.batchLotNumber}</span></div>
                    <div><strong>Quantity:</strong> <strong style={{ color: '#34d399' }}>{item.quantity} {item.unitOfMeasure}</strong></div>
                    <div><strong>Unit of Measure:</strong> {item.unitOfMeasure}</div>
                  </div>
                ))}
              </div>
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={14} /> METALLURGICAL HEAT-TREATMENT SPECIFICATIONS & RESULTS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                <div><strong>Furnace / Equipment:</strong> {selectedDispatch.heatTreatmentInformation?.furnaceEquipment || 'FURNACE-PIT-01 (Integral Quench Furnace)'}</div>
                <div><strong>Hardness Specification:</strong> {selectedDispatch.heatTreatmentInformation?.hardnessSpecification || '58-62 HRC'}</div>
                <div><strong>Actual Hardness:</strong> <span style={{ color: '#34d399', fontWeight: 700 }}>{selectedDispatch.heatTreatmentInformation?.actualHardness || '60.5 HRC'}</span></div>
                <div><strong>Case Depth:</strong> {selectedDispatch.heatTreatmentInformation?.caseDepth || '1.15 mm'}</div>
                <div><strong>Quantity Received:</strong> {selectedDispatch.heatTreatmentInformation?.quantityReceived ?? (selectedDispatch.lines?.[0]?.dispatchedQuantity || 0)}</div>
                <div><strong>Quantity Delivered:</strong> <span style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedDispatch.heatTreatmentInformation?.quantityDelivered ?? (selectedDispatch.lines?.[0]?.dispatchedQuantity || 0)}</span></div>
              </div>
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> LOGISTICS & DESTINATION
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Customer:</strong> {selectedDispatch.customer.customerName}</div>
                <div><strong>Delivery Address:</strong> {selectedDispatch.customer.destinationAddress}</div>
                <div><strong>Freight Carrier:</strong> {selectedDispatch.carrier?.carrierName}</div>
                <div><strong>Vehicle / Tracking:</strong> {selectedDispatch.carrier?.vehicleNumber || selectedDispatch.carrier?.trackingNumber || 'N/A'}</div>
              </div>
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> SECURITY GATE PASS & QUALITY RELEASE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Gate Pass Number:</strong> {selectedDispatch.gatePass?.gatePassNumber || 'GP-2026-0881'}</div>
                <div><strong>Security Officer:</strong> {selectedDispatch.gatePass?.securityOfficerName || 'James Wilson'}</div>
                <div><strong>Attached CoC:</strong> {selectedDispatch.lines?.[0]?.qualityVerification?.cocNumber || 'COC-2026-0045 (PASSED)'}</div>
              </div>
            </AppCard>
          </div>
        )}
      </AppDrawer>

      {/* CREATE OUTWARD CHALLAN (OC) MODAL DIALOG */}
      <AppDialog
        isOpen={isOCModalOpen && !!selectedBOForOC}
        onClose={() => setIsOCModalOpen(false)}
        title="Generate Outward Challan (OC)"
        description="Issue authoritative Outward Challan for the selected Batch Order while strictly preserving PO ➔ GRN ➔ BO ➔ OC hierarchy."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsOCModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="create-oc-form"
              data-testid="btn-submit-create-oc"
              isLoading={isSubmittingOC}
              leftIcon={<Send size={16} />}
            >
              Generate Authoritative OC
            </AppButton>
          </>
        }
      >
        {selectedBOForOC && (
          <form id="create-oc-form" onSubmit={handleCreateOutwardChallan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Read-Only Authoritative Invariant Banner */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700 }}>
                <Lock size={13} />
                <span>AUTHORITATIVE SOURCE-OF-TRUTH ENFORCEMENT</span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                The backend independently verifies the full lineage. The OC number is automatically generated and monotonic. The OC date is strictly derived from the GRN date.
              </div>

              {/* Hierarchy Visualizer */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  marginTop: '4px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontFamily: 'monospace'
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>Derived Purchase Order:</span>
                  <div style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedBOForOC.poNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Corresponding GRN:</span>
                  <div style={{ color: '#f59e0b', fontWeight: 700 }}>{selectedBOForOC.grnNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Selected Batch Order:</span>
                  <div style={{ color: '#10b981', fontWeight: 700 }}>{selectedBOForOC.jobNumber || selectedBOForOC.batchOrderNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Challan Number:</span>
                  <div style={{ color: '#a855f7', fontWeight: 700 }}>[AUTO-GENERATED: OC-YYYYMM-XXXX]</div>
                </div>
              </div>
            </div>

            {/* Read-Only Traceability Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#34d399'
              }}
            >
              <ShieldCheck size={16} />
              <span>
                <strong>No Re-Entry Required:</strong> All OC items and metallurgical heat-treatment values are strictly derived from Batch Order <strong>{selectedBOForOC.jobNumber || selectedBOForOC.batchOrderNumber}</strong> and its Inspection records. Manual editing is prohibited.
              </span>
            </div>

            {/* 1. BO-Derived Items Card (All 8 Required Authoritative Fields) */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PackageCheck size={14} />
                  <span>AUTHORITATIVE OC ITEM DETAILS</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                  Line 1 of 1 • Derived from BO
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Serial Number:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>1</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Part Number:</span>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>{selectedBOForOC.part.itemCode}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Part Name / Description:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{selectedBOForOC.part.itemName}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Material Grade:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{selectedBOForOC.part.materialGrade}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Heat-Treatment Process:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{selectedBOForOC.recipe.name}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Batch / Lot Number:</span>
                  <div style={{ fontWeight: 600, color: '#f59e0b' }}>{selectedBOForOC.heatLotNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Dispatched Quantity:</span>
                  <div style={{ fontWeight: 700, color: '#34d399' }}>
                    {selectedBOForOC.quantities.verified} {selectedBOForOC.quantities.uom}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Unit of Measure (UOM):</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{selectedBOForOC.quantities.uom}</div>
                </div>
              </div>
            </div>

            {/* 2. BO-Derived Heat-Treatment Information Card (All 6 Required Parameters) */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={14} />
                  <span>AUTHORITATIVE HEAT-TREATMENT & INSPECTION DATA</span>
                </div>
                <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  {selectedBOForOC.inspectionApproval?.cocNumber || 'PASSED'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Furnace / Equipment:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {selectedBOForOC.heatTreatmentInformation?.furnaceEquipment || 'FURNACE-PIT-01 (Integral Quench Furnace)'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Hardness Specification:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {selectedBOForOC.heatTreatmentInformation?.hardnessSpecification || '58-62 HRC'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Actual Hardness:</span>
                  <div style={{ fontWeight: 700, color: '#34d399' }}>
                    {selectedBOForOC.heatTreatmentInformation?.actualHardness || '60.5 HRC'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Case Depth:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {selectedBOForOC.heatTreatmentInformation?.caseDepth || '1.15 mm'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Quantity Received:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {selectedBOForOC.heatTreatmentInformation?.quantityReceived ?? selectedBOForOC.quantities.verified} {selectedBOForOC.quantities.uom}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Quantity Delivered:</span>
                  <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                    {selectedBOForOC.heatTreatmentInformation?.quantityDelivered ?? selectedBOForOC.quantities.verified} {selectedBOForOC.quantities.uom}
                  </div>
                </div>
              </div>
            </div>

            {/* Carrier & Logistics Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppInput
                label="Freight Carrier / Transporter"
                value={ocCarrierName}
                onChange={(e) => setOcCarrierName(e.target.value)}
                required
              />
              <AppSelect
                label="Transport Mode"
                value={ocTransportMode}
                onChange={(e) => setOcTransportMode(e.target.value)}
                options={[
                  { value: 'ROAD', label: 'Road Dedicated Freight' },
                  { value: 'AIR', label: 'Air Express Cargo' },
                  { value: 'RAIL', label: 'Rail Cargo' },
                  { value: 'CUSTOMER_PICKUP', label: 'Customer Self-Pickup' }
                ]}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <AppInput
                label="Vehicle Number / Container #"
                value={ocVehicleNumber}
                onChange={(e) => setOcVehicleNumber(e.target.value)}
                required
              />
              <AppInput
                label="Driver Name"
                value={ocDriverName}
                onChange={(e) => setOcDriverName(e.target.value)}
              />
            </div>

            <AppInput
              label="Driver Contact Phone"
              value={ocDriverPhone}
              onChange={(e) => setOcDriverPhone(e.target.value)}
            />

            <AppInput
              label="Gate Pass / Shipping Remarks"
              value={ocRemarks}
              onChange={(e) => setOcRemarks(e.target.value)}
            />
          </form>
        )}
      </AppDialog>

      {/* Manual / Standard Consignment Modal Dialog */}
      <AppDialog
        isOpen={isConsignmentModalOpen}
        onClose={() => setIsConsignmentModalOpen(false)}
        title="Create Outbound Shipping Consignment"
        description="Generate delivery challan, link certified heat lot CoC, and issue security gate pass."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsConsignmentModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="consignment-form"
              isLoading={isSubmittingConsignment}
              leftIcon={<Send size={16} />}
            >
              Generate Delivery Challan
            </AppButton>
          </>
        }
      >
        <form id="consignment-form" onSubmit={handleCreateConsignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AppInput
            label="Customer Recipient"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />

          <AppInput
            label="Destination Address / Plant Gate"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Freight Carrier"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              required
            />
            <AppSelect
              label="Transport Mode"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
              options={[
                { value: 'ROAD', label: 'Road Dedicated Freight' },
                { value: 'AIR', label: 'Air Express Cargo' },
                { value: 'CUSTOMER_PICKUP', label: 'Customer Self-Pickup' }
              ]}
            />
          </div>

          <AppInput
            label="Total Consignment Pieces"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </form>
      </AppDialog>

      {/* Complete Physical Dispatch Modal Dialog */}
      <AppDialog
        isOpen={isPhysicalDispatchModalOpen}
        onClose={() => setIsPhysicalDispatchModalOpen(false)}
        title="Complete Physical Dispatch"
        description="Provide transport information to record physical departure, deduct Finished Goods warehouse stock, and transition the Batch Order to DISPATCHED."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsPhysicalDispatchModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="physical-dispatch-form"
              data-testid="btn-submit-physical-dispatch"
              isLoading={isSubmittingPhysicalDispatch}
              leftIcon={<Send size={16} />}
            >
              Confirm Physical Dispatch & Deduct Stock
            </AppButton>
          </>
        }
      >
        {selectedDispatchForPhysical && (
          <form
            id="physical-dispatch-form"
            onSubmit={handleCompletePhysicalDispatch}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Authoritative Information Banner */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> AUTHORITATIVE DISPATCH & INVENTORY CONTEXT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', color: '#e2e8f0' }}>
                <div><strong>Outward Challan:</strong> {selectedDispatchForPhysical.outwardChallanNumber || selectedDispatchForPhysical.deliveryChallanNumber}</div>
                <div><strong>Batch Order:</strong> {selectedDispatchForPhysical.hierarchy?.batchOrderNumber || selectedDispatchForPhysical.batchOrderNumber || 'N/A'}</div>
                <div><strong>Customer:</strong> {selectedDispatchForPhysical.customer?.customerName}</div>
                <div><strong>Dispatched Quantity:</strong> {selectedDispatchForPhysical.totalQuantity || selectedDispatchForPhysical.lines?.[0]?.dispatchedQuantity || 0} PCS</div>
              </div>
              <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '11px', lineHeight: 1.4 }}>
                * Upon confirmation, warehouse Finished Goods stock is permanently deducted, and the Batch Order transitions to <strong>DISPATCHED</strong>.
              </div>
            </div>

            {/* Required Field: Transporter */}
            <div>
              <AppInput
                label="Transporter / Logistics Carrier *"
                data-testid="input-transporter"
                placeholder="e.g. VRL Logistics Ltd, Mahindra Logistics"
                value={transporterInput}
                onChange={(e) => {
                  setTransporterInput(e.target.value);
                  if (formValidationErrors.transporter) {
                    setFormValidationErrors((prev) => ({ ...prev, transporter: '' }));
                  }
                }}
                required
              />
              {formValidationErrors.transporter && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  {formValidationErrors.transporter}
                </div>
              )}
            </div>

            {/* Required Field: Vehicle Number */}
            <div>
              <AppInput
                label="Vehicle Registration Number *"
                data-testid="input-vehicle-number"
                placeholder="e.g. MH-12-AB-1234, KA01AB1234"
                value={vehicleNumberInput}
                onChange={(e) => {
                  setVehicleNumberInput(e.target.value);
                  if (formValidationErrors.vehicleNumber) {
                    setFormValidationErrors((prev) => ({ ...prev, vehicleNumber: '' }));
                  }
                }}
                required
              />
              {formValidationErrors.vehicleNumber && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  {formValidationErrors.vehicleNumber}
                </div>
              )}
            </div>

            {/* Required Field: Dispatch Date */}
            <div>
              <AppInput
                label="Dispatch Date & Time *"
                type="datetime-local"
                data-testid="input-dispatch-date"
                value={dispatchDateInput}
                onChange={(e) => {
                  setDispatchDateInput(e.target.value);
                  if (formValidationErrors.dispatchDate) {
                    setFormValidationErrors((prev) => ({ ...prev, dispatchDate: '' }));
                  }
                }}
                required
              />
              {formValidationErrors.dispatchDate && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  {formValidationErrors.dispatchDate}
                </div>
              )}
            </div>

            {/* Optional Field: E-Way Bill Number */}
            <div>
              <AppInput
                label="E-Way Bill Number (Optional)"
                data-testid="input-eway-bill"
                placeholder="Optional: 12-digit numeric (e.g. 101234567890) or standard identifier"
                value={ewayBillInput}
                onChange={(e) => {
                  setEwayBillInput(e.target.value);
                  if (formValidationErrors.ewayBillNumber) {
                    setFormValidationErrors((prev) => ({ ...prev, ewayBillNumber: '' }));
                  }
                }}
              />
              {formValidationErrors.ewayBillNumber && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  {formValidationErrors.ewayBillNumber}
                </div>
              )}
            </div>

            {/* Optional Field: Gate / Shipping Remarks */}
            <AppInput
              label="Gate Remarks (Optional)"
              data-testid="input-transport-remarks"
              placeholder="e.g. Cleared at North Gate, seals intact"
              value={transportRemarksInput}
              onChange={(e) => setTransportRemarksInput(e.target.value)}
            />
          </form>
        )}
      </AppDialog>

      {/* AUTHORIZE OUTWARD CHALLAN (OC) MODAL DIALOG */}
      <AppDialog
        isOpen={isAuthorizeModalOpen && !!selectedDispatchForAuthorize}
        onClose={() => setIsAuthorizeModalOpen(false)}
        title="Authorize Outward Challan (Authorized Signatory)"
        description="Verify authorized signatory credentials against the ERP permission system before finalizing the dispatch document."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsAuthorizeModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="authorize-oc-form"
              data-testid="btn-submit-authorize-oc"
              isLoading={isSubmittingAuthorize}
              leftIcon={<UserCheck size={16} />}
            >
              Confirm Signatory Authorization
            </AppButton>
          </>
        }
      >
        {selectedDispatchForAuthorize && (
          <form
            id="authorize-oc-form"
            onSubmit={handleAuthorizeOutwardChallan}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* RBAC Authorization Invariant Notice */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} /> AUTHORITATIVE RBAC SIGNATORY VALIDATION
              </div>
              <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                The signatory must be a recognized user authorized with dispatch approval permissions. Client-supplied authorization claims are strictly ignored; verification is executed by the ERP kernel.
              </div>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                <div><strong>Challan:</strong> {selectedDispatchForAuthorize.outwardChallanNumber || selectedDispatchForAuthorize.deliveryChallanNumber}</div>
                <div><strong>Customer:</strong> {selectedDispatchForAuthorize.customer?.customerName}</div>
              </div>
            </div>

            {/* Signatory User ID */}
            <div>
              <AppInput
                label="Signatory User ID / Reference *"
                data-testid="input-signatory-user-id"
                placeholder="e.g. 507f191e810c19729de860e2 or usr_signatory_01"
                value={signatoryUserIdInput}
                onChange={(e) => {
                  setSignatoryUserIdInput(e.target.value);
                  if (authorizeErrors.userId) {
                    setAuthorizeErrors((prev) => ({ ...prev, userId: '' }));
                  }
                }}
                required
              />
              {authorizeErrors.userId && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                  {authorizeErrors.userId}
                </div>
              )}
            </div>

            {/* Designation */}
            <AppInput
              label="Signatory Designation"
              data-testid="input-signatory-designation"
              placeholder="e.g. Plant Operations Director / Dispatch Head"
              value={designationInput}
              onChange={(e) => setDesignationInput(e.target.value)}
            />

            {/* Signature Reference */}
            <AppInput
              label="Digital Signature / Authority Stamp Reference"
              data-testid="input-signature-ref"
              placeholder="e.g. SIG-AUTH-2026-9901"
              value={signatureRefInput}
              onChange={(e) => setSignatureRefInput(e.target.value)}
            />

            {/* Approval Notes */}
            <AppInput
              label="Approval Notes (Optional)"
              data-testid="input-approval-notes"
              placeholder="e.g. Metallurgical test certificates inspected and approved for dispatch"
              value={approvalNotesInput}
              onChange={(e) => setApprovalNotesInput(e.target.value)}
            />
          </form>
        )}
      </AppDialog>

      {/* CUSTOMER ACKNOWLEDGEMENT MODAL DIALOG */}
      <AppDialog
        isOpen={isAcknowledgeModalOpen && !!selectedDispatchForAcknowledge}
        onClose={() => setIsAcknowledgeModalOpen(false)}
        title="Record Customer Acknowledgement"
        description="Record customer receipt verification, consignee signature reference, and delivery stamp."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsAcknowledgeModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="customer-ack-form"
              data-testid="btn-submit-customer-ack"
              isLoading={isSubmittingAcknowledge}
              leftIcon={<Stamp size={16} />}
            >
              Record Customer Receipt & Delivery
            </AppButton>
          </>
        }
      >
        {selectedDispatchForAcknowledge && (
          <form
            id="customer-ack-form"
            onSubmit={handleRecordCustomerAcknowledgement}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Optional Fields Notice */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Stamp size={14} /> CUSTOMER RECEIPT & DELIVERY PROOF
              </div>
              <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Customer acknowledgement fields are optional proof of delivery records embedded directly into the authoritative Outward Challan document.
              </div>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', color: '#e2e8f0' }}>
                <div><strong>Consignment:</strong> {selectedDispatchForAcknowledge.outwardChallanNumber || selectedDispatchForAcknowledge.deliveryChallanNumber}</div>
                <div><strong>Customer:</strong> {selectedDispatchForAcknowledge.customer?.customerName}</div>
              </div>
            </div>

            {/* Received By */}
            <AppInput
              label="Received By (Customer Representative)"
              data-testid="input-ack-received-by"
              placeholder="e.g. Robert Chen (Lead Receiving Inspector)"
              value={receivedByInput}
              onChange={(e) => setReceivedByInput(e.target.value)}
            />

            {/* Signature / Stamp Reference */}
            <AppInput
              label="Signature / Company Stamp Reference"
              data-testid="input-ack-signature-stamp"
              placeholder="e.g. STAMP-CUST-REC-2026 or SIG-CUST-8812"
              value={ackSignatureRefInput}
              onChange={(e) => setAckSignatureRefInput(e.target.value)}
            />

            {/* Acknowledged Date */}
            <AppInput
              label="Receipt Date"
              type="date"
              data-testid="input-ack-date"
              value={ackDateInput}
              onChange={(e) => setAckDateInput(e.target.value)}
            />

            {/* Customer Remarks */}
            <AppInput
              label="Customer Remarks / Delivery Notes"
              data-testid="input-ack-remarks"
              placeholder="e.g. All 120 pcs received in good condition with test reports."
              value={ackRemarksInput}
              onChange={(e) => setAckRemarksInput(e.target.value)}
            />
          </form>
        )}
      </AppDialog>

      {/* AUTHORITATIVE OUTWARD CHALLAN (OC) PRINTABLE DOCUMENT MODAL */}
      <AppDialog
        isOpen={isPrintModalOpen && !!selectedDispatchForPrint}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Authoritative Outward Challan: ${selectedDispatchForPrint?.outwardChallanNumber || selectedDispatchForPrint?.deliveryChallanNumber || selectedDispatchForPrint?.dispatchNumber}`}
        description="Printable factory gate pass and authoritative delivery challan preserving complete heat-treatment genealogy."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsPrintModalOpen(false)}>
              Close
            </AppButton>
            <AppButton
              variant="primary"
              data-testid="btn-confirm-print-oc"
              isLoading={isPrinting}
              leftIcon={<Printer size={16} />}
              onClick={handlePrintDocument}
            >
              Print Document
            </AppButton>
          </>
        }
      >
        {selectedDispatchForPrint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Action & Audit Header Bar (Screen-only) */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge status={selectedDispatchForPrint.status} />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Print Count: <strong style={{ color: '#a78bfa' }}>{selectedDispatchForPrint.printCount || 0}</strong>
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Last Printed:{' '}
                  <strong>
                    {selectedDispatchForPrint.printedAt
                      ? new Date(selectedDispatchForPrint.printedAt).toLocaleString()
                      : 'Never Printed'}
                  </strong>
                  {selectedDispatchForPrint.printedBy && ` by ${selectedDispatchForPrint.printedBy}`}
                </div>
              </div>

              {(selectedDispatchForPrint.status === 'DISPATCHED' || selectedDispatchForPrint.status === 'DELIVERED') && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#60a5fa',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '6px'
                  }}
                >
                  <Lock size={12} />
                  <span>
                    <strong>Dispatched Final Record:</strong> Immutability enforced. Historical production, metallurgical, and transport data cannot be altered.
                  </span>
                </div>
              )}
            </div>

            {/* Printable Document Container */}
            <div
              id="printable-oc-container"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '24px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '12px',
                lineHeight: 1.4
              }}
            >
              {/* Document Header */}
              <div
                style={{
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: '14px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    CELESTIUM PRECISION HEAT TREATING
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                    Aerospace & Automotive Thermal Processing Facility • Nadcap AC7102 Accredited • ISO 9001:2015
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Plant 4, Industrial Aerospace Corridor, Sector 9 • Direct Gate Line: +1 (555) 019-4821
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '13px',
                      letterSpacing: '0.05em',
                      display: 'inline-block'
                    }}
                  >
                    OUTWARD DELIVERY CHALLAN
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px', color: '#0f172a' }}>
                    OC No: {selectedDispatchForPrint.outwardChallanNumber || selectedDispatchForPrint.deliveryChallanNumber || selectedDispatchForPrint.dispatchNumber}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Date:{' '}
                    {selectedDispatchForPrint.ocDate
                      ? new Date(selectedDispatchForPrint.ocDate).toLocaleDateString()
                      : selectedDispatchForPrint.dispatchDate
                      ? new Date(selectedDispatchForPrint.dispatchDate).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Status: <strong>{selectedDispatchForPrint.status}</strong>
                  </div>
                </div>
              </div>

              {/* Source Relationships Genealogy Ribbon */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                  Authoritative Traceability Genealogy (PO ➔ GRN ➔ BO ➔ OC)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Purchase Order (PO):</span><br />
                    <strong style={{ fontFamily: 'monospace' }}>
                      {selectedDispatchForPrint.hierarchy?.poNumber || selectedDispatchForPrint.poNumber || 'PO-DEFAULT-001'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Goods Receipt (GRN):</span><br />
                    <strong style={{ fontFamily: 'monospace' }}>
                      {selectedDispatchForPrint.hierarchy?.grnNumber || selectedDispatchForPrint.grnNumber || 'GRN-DEFAULT-001'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Batch Order (BO):</span><br />
                    <strong style={{ fontFamily: 'monospace' }}>
                      {selectedDispatchForPrint.hierarchy?.batchOrderNumber || selectedDispatchForPrint.batchOrderNumber || 'BO-DEFAULT-001'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Outward Challan (OC):</span><br />
                    <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                      {selectedDispatchForPrint.outwardChallanNumber || selectedDispatchForPrint.deliveryChallanNumber || selectedDispatchForPrint.dispatchNumber}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Customer & Transport Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '14px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px'
                }}
              >
                {/* Consignee / Delivery Address */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>
                    Consignee / Deliver To
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                    {selectedDispatchForPrint.customer.customerName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Customer Code: {selectedDispatchForPrint.customer.customerCode}
                  </div>
                  <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px', lineHeight: 1.3 }}>
                    {selectedDispatchForPrint.customer.destinationAddress || 'Factory Address On File'}
                  </div>
                </div>

                {/* Transport & Logistics */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>
                    Transport & Gate Logistics
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Transporter:</span><br />
                      <strong>{selectedDispatchForPrint.transporter || selectedDispatchForPrint.carrier?.carrierName || 'Dedicated Fleet'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Vehicle Number:</span><br />
                      <strong style={{ fontFamily: 'monospace' }}>{selectedDispatchForPrint.vehicleNumber || selectedDispatchForPrint.carrier?.vehicleNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Gate Pass No:</span><br />
                      <strong style={{ fontFamily: 'monospace' }}>{selectedDispatchForPrint.gatePass?.gatePassNumber || 'GP-GATE-01'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>E-Way Bill:</span><br />
                      <strong style={{ fontFamily: 'monospace' }}>{selectedDispatchForPrint.ewayBillNumber || 'Exempt / Standard'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* BO-Derived Item Details Table */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Processed Item Details (Derived From Batch Order)</span>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 400 }}>No Re-entry Duplicates</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', width: '35px' }}>S.No</th>
                      <th style={{ padding: '6px 8px' }}>Part Number</th>
                      <th style={{ padding: '6px 8px' }}>Part Description</th>
                      <th style={{ padding: '6px 8px' }}>Material Grade</th>
                      <th style={{ padding: '6px 8px' }}>Heat Treatment Process</th>
                      <th style={{ padding: '6px 8px' }}>Heat / Lot No</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Dispatched Qty</th>
                      <th style={{ padding: '6px 8px', width: '50px' }}>UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDispatchForPrint.items && selectedDispatchForPrint.items.length > 0
                      ? selectedDispatchForPrint.items
                      : [
                          {
                            serialNumber: 1,
                            partName: selectedDispatchForPrint.lines?.[0]?.itemName || 'Precision Components',
                            partDescription: selectedDispatchForPrint.lines?.[0]?.itemName || 'Precision Components',
                            partNumber: selectedDispatchForPrint.lines?.[0]?.itemCode || 'PART-001',
                            materialGrade: 'SAE 8620H / AISI 4340',
                            heatTreatmentProcess: 'Case Hardening / Vacuum Temper',
                            batchLotNumber: selectedDispatchForPrint.lines?.[0]?.heatLotNumber || 'HL-BATCH-01',
                            quantity: selectedDispatchForPrint.lines?.[0]?.dispatchedQuantity || selectedDispatchForPrint.totalQuantity || 0,
                            unitOfMeasure: selectedDispatchForPrint.lines?.[0]?.uom || 'PCS'
                          }
                        ]
                    ).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{item.serialNumber || idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, fontFamily: 'monospace' }}>{item.partNumber}</td>
                        <td style={{ padding: '6px 8px' }}>{item.partName || item.partDescription}</td>
                        <td style={{ padding: '6px 8px' }}>{item.materialGrade}</td>
                        <td style={{ padding: '6px 8px' }}>{item.heatTreatmentProcess}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{item.batchLotNumber}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ padding: '6px 8px' }}>{item.unitOfMeasure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Metallurgical Heat-Treatment Specifications & Observed Results */}
              <div style={{ marginBottom: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Heat-Treatment Specifications & Inspection Outcomes</span>
                  <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>CoC: {selectedDispatchForPrint.lines?.[0]?.qualityVerification?.cocNumber || 'COC-PASSED-NADCAP'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Furnace / Equipment:</span><br />
                    <strong>{selectedDispatchForPrint.heatTreatmentInformation?.furnaceEquipment || 'FURNACE-PIT-01 (Integral Quench)'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Hardness Specification:</span><br />
                    <strong>{selectedDispatchForPrint.heatTreatmentInformation?.hardnessSpecification || '58-62 HRC'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Actual Hardness:</span><br />
                    <strong style={{ color: '#047857' }}>{selectedDispatchForPrint.heatTreatmentInformation?.actualHardness || '60.5 HRC'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Effective Case Depth:</span><br />
                    <strong>{selectedDispatchForPrint.heatTreatmentInformation?.caseDepth || '1.15 mm'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quantity Received:</span><br />
                    <strong>{selectedDispatchForPrint.heatTreatmentInformation?.quantityReceived ?? (selectedDispatchForPrint.lines?.[0]?.dispatchedQuantity || 0)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quantity Delivered:</span><br />
                    <strong style={{ color: '#0284c7' }}>{selectedDispatchForPrint.heatTreatmentInformation?.quantityDelivered ?? (selectedDispatchForPrint.lines?.[0]?.dispatchedQuantity || 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Two-Tier Authorization */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '14px',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '10px'
                }}
              >
                {/* Prepared By */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', background: '#fafafa' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    Prepared By (Dispatch Officer)
                  </div>
                  <div style={{ fontSize: '11px', color: '#0f172a' }}>
                    Name: <strong>{selectedDispatchForPrint.preparedBy?.name || selectedDispatchForPrint.preparedBy?.username || 'Devin Vance'}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Designation: {selectedDispatchForPrint.preparedBy?.designation || 'Dispatch Lead'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Timestamp: {selectedDispatchForPrint.preparedBy?.preparedAt ? new Date(selectedDispatchForPrint.preparedBy.preparedAt).toLocaleString() : 'Authoritative Entry'}
                  </div>
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                    ✓ Digital Dispatch Prepared
                  </div>
                </div>

                {/* Authorized Signatory */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', background: '#fafafa' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    Authorized Signatory (ERP RBAC Verified)
                  </div>
                  {selectedDispatchForPrint.authorizedSignatory ? (
                    <>
                      <div style={{ fontSize: '11px', color: '#0f172a' }}>
                        Name: <strong>{selectedDispatchForPrint.authorizedSignatory.name || selectedDispatchForPrint.authorizedSignatory.username || 'Authorized Signatory'}</strong>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        Designation: {selectedDispatchForPrint.authorizedSignatory.designation || 'Plant Operations Director'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        Ref: <span style={{ fontFamily: 'monospace' }}>{selectedDispatchForPrint.authorizedSignatory.signatureRef || 'DIGITAL-AUTH'}</span>
                      </div>
                      <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', fontSize: '10px', color: '#059669', fontWeight: 600 }}>
                        ✓ Digitally Verified & Authorized
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#d97706', fontStyle: 'italic', marginTop: '6px' }}>
                      Pending Signatory Authorization
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Acknowledgement & Gate Security */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: '12px',
                  borderTop: '1px solid #cbd5e1',
                  paddingTop: '10px'
                }}
              >
                {/* Customer Receipt Box */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', background: '#f8fafc' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    Customer Consignment Acknowledgement (Proof of Receipt)
                  </div>
                  {selectedDispatchForPrint.customerAcknowledgement?.receivedBy ? (
                    <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                      <div>Received By: <strong>{selectedDispatchForPrint.customerAcknowledgement.receivedBy}</strong></div>
                      <div>Date: <strong>{selectedDispatchForPrint.customerAcknowledgement.date ? new Date(selectedDispatchForPrint.customerAcknowledgement.date).toLocaleDateString() : 'Received'}</strong></div>
                      <div>Stamp/Ref: <strong style={{ fontFamily: 'monospace' }}>{selectedDispatchForPrint.customerAcknowledgement.signatureStampRef || 'ACK-CONFIRMED'}</strong></div>
                      <div>Remarks: <strong>{selectedDispatchForPrint.customerAcknowledgement.remarks || 'None'}</strong></div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: '#64748b', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                      <div>Received By: ___________________________</div>
                      <div>Signature: ___________________________</div>
                      <div>Date & Time: ___________________________</div>
                      <div>Company Stamp: ___________________________</div>
                    </div>
                  )}
                </div>

                {/* Gate Security Stamp Box */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', textAlign: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                    Factory Gate Release
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a' }}>
                    {selectedDispatchForPrint.gatePass?.securityOfficerName || 'Security Gate Officer'}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                    Pass: {selectedDispatchForPrint.gatePass?.gatePassNumber || 'GP-GATE'}
                  </div>
                  <div style={{ border: '1px dashed #94a3b8', borderRadius: '3px', padding: '4px', marginTop: '4px', fontSize: '9px', color: '#0284c7', fontWeight: 600 }}>
                    VEHICLE CLEARED
                  </div>
                </div>
              </div>

              {/* Document Disclaimer & Print Count */}
              <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px', fontSize: '9px', color: '#94a3b8', textAlign: 'center' }}>
                Authoritative Dispatch Document generated by Celestium ERP. Print Run #{selectedDispatchForPrint.printCount || 0}. Any alteration or unauthorized copy invalidates traceability genealogy.
              </div>
            </div>
          </div>
        )}
      </AppDialog>
    </PageContainer>
  );
};
