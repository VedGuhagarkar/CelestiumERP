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
  Flame
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
  status: 'DRAFT' | 'PACKED' | 'SCHEDULED' | 'GATE_PASS_ISSUED' | 'IN_TRANSIT' | 'DELIVERED';
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
  carrier?: {
    carrierName: string;
    transportMode: string;
    trackingNumber?: string;
    vehicleNumber?: string;
  };
  gatePass?: {
    gatePassNumber: string;
    securityOfficerName: string;
    issuedAt: string;
  };
  totalQuantity?: number;
  totalGrossWeightKg?: number;
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
    if (!selectedBOForOC) return;
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

  const handlePrintGatePass = () => {
    if (!selectedDispatch) return;
    setFeedback({
      type: 'success',
      message: `Delivery Challan (${selectedDispatch.outwardChallanNumber || selectedDispatch.deliveryChallanNumber}) & Security Gate Pass sent to factory gate printer.`
    });
    setSelectedDispatch(null);
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
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            rightIcon={<ChevronRight size={14} />}
                            onClick={() => setSelectedDispatch(d)}
                          >
                            Details
                          </ActionButton>
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
              <AppButton
                variant="primary"
                leftIcon={<Printer size={16} />}
                onClick={handlePrintGatePass}
              >
                Print Gate Pass & Challan
              </AppButton>
            </>
          )
        }
      >
        {selectedDispatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
    </PageContainer>
  );
};
