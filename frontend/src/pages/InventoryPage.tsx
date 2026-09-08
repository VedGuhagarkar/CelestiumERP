import React, { useState, useEffect } from 'react';
import {
  Boxes,
  FileText,
  RefreshCw,
  Plus,
  Printer,
  Truck,
  Warehouse,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Eye,
  PackageCheck,
  Tag,
  Lock,
  AlertTriangle
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
import { AppTabs, TabItem } from '../design-system/navigation/AppTabs.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';
import { usePermission } from '../hooks/usePermission.js';

// --- DATA CONTRACTS ---

export interface Item {
  _id?: string;
  id?: string;
  itemCode: string;
  name: string;
  category: string;
  materialGrade: string;
  uom: string;
  hsnCode?: string;
  currentStock?: number;
  safetyStock?: number;
  unitCost?: number;
}

export interface Recipe {
  _id?: string;
  id?: string;
  recipeCode: string;
  revision?: number;
  recipeName?: string;
  processFamily: string;
  applicableMaterialGrades: string[];
  status: string;
}

export interface POItem {
  lineItemId?: string;
  poItemId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily?: string;
  processingRequirement?: string;
  recipeId: string;
  recipeCode: string;
  recipeRevision?: number;
  orderedQuantity: number;
  receivedQuantity?: number;
  balanceQuantity?: number;
  uom: string;
  hsnCode?: string;
  unitPrice: number;
  lineTotal?: number;
}

export interface PurchaseOrder {
  _id?: string;
  id?: string;
  poNumber: string;
  idempotencyKey?: string;
  supplierId?: string;
  supplierName: string;
  supplierCode?: string;
  supplierContact?: string;
  contactEmail?: string;
  contactPhone?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  items: POItem[];
  totalOrderedQuantity?: number;
  totalReceivedQuantity?: number;
  currency?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  subtotalAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceivedItem {
  poItemId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  particulars?: string;
  materialGrade: string;
  recipeId: string;
  recipeCode: string;
  recipeRevision?: number;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  millTestCertificateNumber: string;
  mtrNumber?: string;
  challanQuantity?: number;
  receivedQuantity: number;
  acceptedQuantity?: number;
  packagesCount?: number;
  uom: string;
  rate?: number;
  unitPrice?: number;
  hsnCode?: string;
  conditionRemarks?: string;
}

export interface MaterialReceipt {
  _id?: string;
  id?: string;
  receiptNumber: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierChallanNumber: string;
  supplierChallanDate?: string;
  supplierInvoiceNumber?: string;
  vehicleNumber?: string;
  carrierVehicle?: string;
  warehouseId?: string;
  warehouseCode?: string;
  storageLocationCode?: string;
  status: 'RECEIVED' | 'PARTIALLY_STORED' | 'STORED' | 'GRN_CREATED';
  storageLocation?: {
    warehouseId: string;
    warehouseName: string;
    locationBay: string;
    locationBin: string;
    storedAt?: string;
  };
  items?: any[];
  receivedItems?: ReceivedItem[];
  totalReceivedQuantity?: number;
  totalStoredQuantity?: number;
  remainingQuantityToStore?: number;
  movementHistory?: any[];
  storedAt?: string;
  storedBy?: string;
  createdAt?: string;
}

export interface GRN {
  _id?: string;
  id?: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  receiptId?: string;
  receiptNumber?: string;
  supplierName: string;
  supplierCode?: string;
  supplierChallanNumber?: string;
  supplierChallanDate?: string;
  carrierVehicle?: string;
  warehouseId?: string;
  warehouseCode?: string;
  storageLocationCode?: string;
  inspectionRemarks?: string;
  packagingCondition?: string;
  acceptanceStatus: 'ACCEPTED' | 'ACCEPTED_WITH_DEVIATION' | 'REJECTED';
  status?: string;
  receivedBy?: string;
  inspectedBy?: string;
  approvedBy?: string;
  printCount?: number;
  totalUnitsGenerated?: number;
  items: ReceivedItem[];
  units?: GRNUnit[];
  parentPO?: any;
  createdAt?: string;
}

export interface GRNUnit {
  _id?: string;
  id?: string;
  unitIdentifier: string;
  poId: string;
  poNumber: string;
  supplierName?: string;
  grnId: string;
  grnNumber: string;
  receiptId: string;
  receiptNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  recipeId: string;
  recipeCode: string;
  recipeRevision?: number;
  supplierHeatNumber: string;
  millTestCertificateNumber: string;
  quantity: number;
  uom: string;
  warehouseName: string;
  locationBay: string;
  locationBin: string;
  status: 'AVAILABLE_FOR_PLANNING' | 'ALLOCATED_TO_PLAN' | 'IN_PRODUCTION' | 'CONSUMED' | 'QUARANTINED';
  allocatedPlanNumber?: string;
  createdAt?: string;
}

// --- DEFAULT SEED / OFFLINE FALLBACK DATA ---

const DEFAULT_ITEMS: Item[] = [
  { id: 'itm_01', itemCode: 'MAT-4140-RND-50', name: 'AISI 4140 Alloy Round Bar Ø50mm', category: 'RAW_MATERIAL', materialGrade: 'AISI 4140', uom: 'KG', currentStock: 4800, safetyStock: 1500, unitCost: 4.8 },
  { id: 'itm_02', itemCode: 'MAT-8620-RND-75', name: 'AISI 8620 Carburizing Steel Bar Ø75mm', category: 'RAW_MATERIAL', materialGrade: 'AISI 8620', uom: 'KG', currentStock: 8200, safetyStock: 2000, unitCost: 3.6 },
  { id: 'itm_03', itemCode: 'MAT-718-ROD-25', name: 'Inconel 718 Aerospace High-Temp Rod Ø25mm', category: 'RAW_MATERIAL', materialGrade: 'INCONEL 718', uom: 'KG', currentStock: 1400, safetyStock: 500, unitCost: 38.5 },
  { id: 'itm_04', itemCode: 'PART-SHAFT-4340', name: 'Finished Turbine Rotor Shafts 4340', category: 'FINISHED_TREATED_GOODS', materialGrade: 'AISI 4340', uom: 'PCS', currentStock: 220, safetyStock: 50, unitCost: 108.75 }
];

const DEFAULT_RECIPES: Recipe[] = [
  { id: 'rec_01', recipeCode: 'REC-CARB-4140-01', revision: 1, recipeName: 'Deep Case Gas Carburizing 930°C', processFamily: 'CARBURIZING', applicableMaterialGrades: ['AISI 4140', 'EN19', 'SCM440'], status: 'ACTIVE' },
  { id: 'rec_02', recipeCode: 'REC-CARB-8620-01', revision: 1, recipeName: 'Automotive Pinion Carburize & Oil Quench', processFamily: 'CARBURIZING', applicableMaterialGrades: ['AISI 8620', '20MnCr5'], status: 'ACTIVE' },
  { id: 'rec_03', recipeCode: 'REC-VAC-718-01', revision: 1, recipeName: 'Vacuum Solution Anneal & Age Harden', processFamily: 'VACUUM_HEAT_TREATMENT', applicableMaterialGrades: ['INCONEL 718'], status: 'ACTIVE' }
];

const DEFAULT_POS: PurchaseOrder[] = [
  {
    id: 'po_01',
    poNumber: 'PO-202609-0001',
    supplierId: 'SUPP-TIMKEN-01',
    supplierName: 'TimkenSteel Specialty Metals',
    supplierContact: 'procurement@timkensteel.com',
    status: 'ISSUED',
    expectedDeliveryDate: '2026-09-15',
    notes: 'Certified aerospace heat melt with Nadcap MTR required.',
    items: [
      {
        poItemId: 'poi_01',
        itemId: 'itm_01',
        itemCode: 'MAT-4140-RND-50',
        itemName: 'AISI 4140 Alloy Round Bar Ø50mm',
        materialGrade: 'AISI 4140',
        recipeId: 'rec_01',
        recipeCode: 'REC-CARB-4140-01',
        recipeRevision: 1,
        orderedQuantity: 5000,
        receivedQuantity: 5000,
        uom: 'KG',
        unitPrice: 4.85
      }
    ],
    createdAt: '2026-09-01T08:30:00Z'
  },
  {
    id: 'po_02',
    poNumber: 'PO-202609-0002',
    supplierId: 'SUPP-AM-01',
    supplierName: 'ArcelorMittal Dofasco',
    supplierContact: 'sales@arcelormittal.com',
    status: 'ISSUED',
    expectedDeliveryDate: '2026-09-20',
    notes: 'Standard automotive carburizing grade bars.',
    items: [
      {
        poItemId: 'poi_02',
        itemId: 'itm_02',
        itemCode: 'MAT-8620-RND-75',
        itemName: 'AISI 8620 Carburizing Steel Bar Ø75mm',
        materialGrade: 'AISI 8620',
        recipeId: 'rec_02',
        recipeCode: 'REC-CARB-8620-01',
        recipeRevision: 1,
        orderedQuantity: 8000,
        receivedQuantity: 0,
        uom: 'KG',
        unitPrice: 3.65
      }
    ],
    createdAt: '2026-09-02T10:15:00Z'
  }
];

const DEFAULT_RECEIPTS: MaterialReceipt[] = [
  {
    id: 'rcpt_01',
    receiptNumber: 'MR-202609-0001',
    poId: 'po_01',
    poNumber: 'PO-202609-0001',
    supplierName: 'TimkenSteel Specialty Metals',
    supplierChallanNumber: 'DC-TK-90211',
    supplierInvoiceNumber: 'INV-TK-88912',
    vehicleNumber: 'MH-12-RN-9941',
    status: 'STORED',
    storageLocation: {
      warehouseId: 'WH-MAIN-01',
      warehouseName: 'Main Plant Thermal Processing Warehouse',
      locationBay: 'Bay 1 - Inward Raw Bar Stock Bay',
      locationBin: 'BIN-A1-04',
      storedAt: '2026-09-03T11:00:00Z'
    },
    receivedItems: [
      {
        poItemId: 'poi_01',
        itemId: 'itm_01',
        itemCode: 'MAT-4140-RND-50',
        itemName: 'AISI 4140 Alloy Round Bar Ø50mm',
        materialGrade: 'AISI 4140',
        recipeId: 'rec_01',
        recipeCode: 'REC-CARB-4140-01',
        recipeRevision: 1,
        supplierHeatNumber: 'HEAT-TK-4140-889',
        millTestCertificateNumber: 'MTR-TK-2026-9941',
        receivedQuantity: 5000,
        packagesCount: 10,
        uom: 'KG',
        conditionRemarks: 'Clean bundled bars, ends color coded yellow/black, zero rust.'
      }
    ],
    createdAt: '2026-09-03T09:45:00Z'
  }
];

const DEFAULT_GRNS: GRN[] = [
  {
    id: 'grn_01',
    grnNumber: 'GRN-202609-0001',
    poId: 'po_01',
    poNumber: 'PO-202609-0001',
    receiptId: 'rcpt_01',
    receiptNumber: 'MR-202609-0001',
    supplierName: 'TimkenSteel Specialty Metals',
    inspectionRemarks: 'Physical verification matched MTR chemistry and dimensional tolerances. Certified prime alloy.',
    packagingCondition: 'INTACT',
    acceptanceStatus: 'ACCEPTED',
    totalUnitsGenerated: 10,
    items: [
      {
        poItemId: 'poi_01',
        itemId: 'itm_01',
        itemCode: 'MAT-4140-RND-50',
        itemName: 'AISI 4140 Alloy Round Bar Ø50mm',
        materialGrade: 'AISI 4140',
        recipeId: 'rec_01',
        recipeCode: 'REC-CARB-4140-01',
        recipeRevision: 1,
        supplierHeatNumber: 'HEAT-TK-4140-889',
        millTestCertificateNumber: 'MTR-TK-2026-9941',
        receivedQuantity: 5000,
        packagesCount: 10,
        uom: 'KG'
      }
    ],
    createdAt: '2026-09-03T14:20:00Z'
  }
];

const DEFAULT_UNITS: GRNUnit[] = Array.from({ length: 10 }).map((_, idx) => ({
  id: `unit_${idx + 1}`,
  unitIdentifier: `UNIT-GRN-202609-0001-${String(idx + 1).padStart(3, '0')}`,
  poId: 'po_01',
  poNumber: 'PO-202609-0001',
  supplierName: 'TimkenSteel Specialty Metals',
  grnId: 'grn_01',
  grnNumber: 'GRN-202609-0001',
  receiptId: 'rcpt_01',
  receiptNumber: 'MR-202609-0001',
  itemId: 'itm_01',
  itemCode: 'MAT-4140-RND-50',
  itemName: 'AISI 4140 Alloy Round Bar Ø50mm',
  materialGrade: 'AISI 4140',
  recipeId: 'rec_01',
  recipeCode: 'REC-CARB-4140-01',
  recipeRevision: 1,
  supplierHeatNumber: 'HEAT-TK-4140-889',
  millTestCertificateNumber: 'MTR-TK-2026-9941',
  quantity: 500,
  uom: 'KG',
  warehouseName: 'Main Plant Thermal Processing Warehouse',
  locationBay: 'Bay 1 - Inward Raw Bar Stock Bay',
  locationBin: 'BIN-A1-04',
  status: 'AVAILABLE_FOR_PLANNING',
  createdAt: '2026-09-03T14:20:00Z'
}));

export const InventoryPage: React.FC = () => {
  // Navigation tabs following strict Creation Phase
  const [activeTab, setActiveTab] = useState<'POS' | 'RECEIPTS' | 'GRNS' | 'UNITS' | 'ITEMS'>('POS');
  
  // Data Collections
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(DEFAULT_POS);
  const [materialReceipts, setMaterialReceipts] = useState<MaterialReceipt[]>(DEFAULT_RECEIPTS);
  const [grns, setGrns] = useState<GRN[]>(DEFAULT_GRNS);
  const [grnUnits, setGrnUnits] = useState<GRNUnit[]>(DEFAULT_UNITS);
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [recipes, setRecipes] = useState<Recipe[]>(DEFAULT_RECIPES);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dialog & Modal Triggers
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [isRecordReceiptModalOpen, setIsRecordReceiptModalOpen] = useState(false);
  const [isAssignStorageModalOpen, setIsAssignStorageModalOpen] = useState(false);
  const [isCreateGrnModalOpen, setIsCreateGrnModalOpen] = useState(false);
  const [isViewGrnModalOpen, setIsViewGrnModalOpen] = useState(false);
  const [activeGrnForView, setActiveGrnForView] = useState<GRN | null>(null);
  const [isPrintGrnModalOpen, setIsPrintGrnModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Authorization Permission Gate (Dynamic RBAC check)
  const { hasPermission } = usePermission();
  const canCreatePo = hasPermission('purchase_order:order:create');
  const canRecordStorage = hasPermission('inventory:storage:record');
  const canCreateGrn = hasPermission('inventory:grn:create');
  const canViewGrn = hasPermission('inventory:grn:view');
  const canPrintGrn = hasPermission('inventory:grn:print');

  // Form states - Create PO
  const [poSupplierName, setPoSupplierName] = useState('TimkenSteel Specialty Metals');
  const [poSupplierContact, setPoSupplierContact] = useState('procurement@timkensteel.com');
  const [poItemId, setPoItemId] = useState('itm_01');
  const [poRecipeId, setPoRecipeId] = useState('rec_01');
  const [poProcessingRequirement, setPoProcessingRequirement] = useState('Carburize per AMS 2759/7 to 1.0-1.2mm ECD and oil quench');
  const [poOrderedQty, setPoOrderedQty] = useState(5000);
  const [poUnitPrice, setPoUnitPrice] = useState(4.85);
  const [poCurrency, setPoCurrency] = useState('USD');
  const [poPaymentTerms, setPoPaymentTerms] = useState('NET_30');
  const [poDeliveryTerms, setPoDeliveryTerms] = useState('FOB Destination');
  const [poUom, setPoUom] = useState('KG');
  const [poDeliveryDate, setPoDeliveryDate] = useState('2026-09-30');
  const [poNotes, setPoNotes] = useState('Nadcap compliant heat melt certificate required.');

  // Form states - Record Receipt
  const [rcptPoId, setRcptPoId] = useState('');
  const [rcptChallanNumber, setRcptChallanNumber] = useState('DC-2026-8819');
  const [rcptChallanDate, setRcptChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [rcptInvoiceNumber, setRcptInvoiceNumber] = useState('INV-2026-4402');
  const [rcptVehicleNumber, setRcptVehicleNumber] = useState('MH-12-PQ-4410');
  const [rcptSupplierHeatNumber, setRcptSupplierHeatNumber] = useState('TK-HEAT-4140-901');
  const [rcptMtrNumber, setRcptMtrNumber] = useState('MTR-TK-2026-8812');
  const [rcptReceivedQty, setRcptReceivedQty] = useState(5000);
  const [rcptPackagesCount, setRcptPackagesCount] = useState(10);
  const [rcptConditionRemarks, setRcptConditionRemarks] = useState('Bundled steel bars in prime condition, clean ends.');

  // Form states - Warehouse Storage Putaway (Creation Step 3)
  const [availableWarehouses, setAvailableWarehouses] = useState<any[]>([
    { id: 'wh_main_01', code: 'WH-MAIN-01', name: 'Main Plant Thermal Processing Warehouse', status: 'ACTIVE' },
    { id: 'wh_aero_01', code: 'WH-AERO-01', name: 'Aerospace Raw Bar Storage Facility', status: 'ACTIVE' }
  ]);
  const [availableLocations, setAvailableLocations] = useState<any[]>([
    { id: 'loc_01', warehouseId: 'wh_main_01', warehouseCode: 'WH-MAIN-01', locationCode: 'BAY-01-A', zone: 'Raw Material Yard', bay: 'Bay 1', status: 'ACTIVE' },
    { id: 'loc_02', warehouseId: 'wh_main_01', warehouseCode: 'WH-MAIN-01', locationCode: 'BAY-02-B', zone: 'WIP Stage', bay: 'Bay 2', status: 'ACTIVE' },
    { id: 'loc_03', warehouseId: 'wh_aero_01', warehouseCode: 'WH-AERO-01', locationCode: 'BAY-AERO-01', zone: 'Aerospace Raw Bay', bay: 'Bay 1', status: 'ACTIVE' }
  ]);
  const [selectedReceiptForStorage, setSelectedReceiptForStorage] = useState<MaterialReceipt | null>(null);
  const [storageWarehouseId, setStorageWarehouseId] = useState<string>('wh_main_01');
  const [storageLocationCode, setStorageLocationCode] = useState<string>('BAY-01-A');
  const [storagePutawayQty, setStoragePutawayQty] = useState<number>(5000);
  const [storagePutawayNotes, setStoragePutawayNotes] = useState<string>('');

  const openStorageModalForReceipt = (r: MaterialReceipt) => {
    setSelectedReceiptForStorage(r);
    const totalRec = r.totalReceivedQuantity ?? (r.items || r.receivedItems)?.reduce((s: number, i: any) => s + (i.receivedQuantity || 0), 0) ?? 0;
    const totalSt = r.totalStoredQuantity ?? (r.items || r.receivedItems)?.reduce((s: number, i: any) => s + (i.storedQuantity || 0), 0) ?? 0;
    const remaining = r.remainingQuantityToStore !== undefined ? r.remainingQuantityToStore : Math.max(0, totalRec - totalSt);
    setStoragePutawayQty(remaining > 0 ? remaining : totalRec);
    setStoragePutawayNotes('');

    if (availableWarehouses.length > 0) {
      const firstWh = availableWarehouses[0];
      const whId = firstWh.id || firstWh._id || 'wh_main_01';
      setStorageWarehouseId(whId);
      const matchedLocs = availableLocations.filter((l) => (l.warehouseId === whId || l.warehouseCode === firstWh.code));
      if (matchedLocs.length > 0) {
        setStorageLocationCode(matchedLocs[0].locationCode || matchedLocs[0].code || 'BAY-01-A');
      }
    }
    setIsAssignStorageModalOpen(true);
  };

  // Form states - Create GRN (PO -> GRN Authoritative Workflow)
  const [selectedPoIdForGrn, setSelectedPoIdForGrn] = useState<string>('po_01');
  const [selectedReceiptForGrn, setSelectedReceiptForGrn] = useState<MaterialReceipt | null>(null);
  const [grnSupplierChallanNumber, setGrnSupplierChallanNumber] = useState('DC-2026-8819');
  const [grnSupplierChallanDate, setGrnSupplierChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnItemEntries, setGrnItemEntries] = useState<
    Record<
      string,
      {
        selected: boolean;
        challanQty: number;
        receivedQty: number;
        supplierHeatNumber: string;
        mtrNumber: string;
      }
    >
  >({
    itm_01: {
      selected: true,
      challanQty: 5000,
      receivedQty: 5000,
      supplierHeatNumber: 'HEAT-TK-4140-889',
      mtrNumber: 'MTR-TK-2026-9941'
    }
  });
  const [grnInspectionRemarks, setGrnInspectionRemarks] = useState('Metallurgical chemistry and dimension specs fully verified against MTR.');
  const [grnPackagingCondition, setGrnPackagingCondition] = useState('INTACT');
  const [grnAcceptanceStatus, setGrnAcceptanceStatus] = useState<'ACCEPTED' | 'ACCEPTED_WITH_DEVIATION' | 'REJECTED'>('ACCEPTED');

  const populateGrnItemsForPo = (po: PurchaseOrder, receipt?: MaterialReceipt | null) => {
    const entries: Record<string, { selected: boolean; challanQty: number; receivedQty: number; supplierHeatNumber: string; mtrNumber: string }> = {};
    po.items?.forEach((item, idx) => {
      const key = item.itemId || item.itemCode || String(idx);
      const remQty = item.balanceQuantity ?? (item.orderedQuantity - (item.receivedQuantity || 0));
      const defaultQty = remQty > 0 ? remQty : item.orderedQuantity;
      entries[key] = {
        selected: true,
        challanQty: defaultQty,
        receivedQty: defaultQty,
        supplierHeatNumber: receipt?.receivedItems?.[0]?.supplierHeatNumber || 'TK-HEAT-4140-901',
        mtrNumber: receipt?.receivedItems?.[0]?.millTestCertificateNumber || 'MTR-TK-2026-8812'
      };
    });
    setGrnItemEntries(entries);
  };

  const openCreateGrnModal = (po?: PurchaseOrder, receipt?: MaterialReceipt) => {
    let targetPo: PurchaseOrder | undefined = po;
    if (!targetPo && receipt) {
      targetPo = purchaseOrders.find((p) => (p.id || p._id) === receipt.poId || p.poNumber === receipt.poNumber);
    }
    if (!targetPo) {
      targetPo = purchaseOrders.find((p) => p.status === 'ISSUED' || p.status === 'PARTIALLY_RECEIVED') || purchaseOrders[0];
    }

    const poId = targetPo ? (targetPo.id || targetPo._id || '') : '';
    setSelectedPoIdForGrn(poId);
    setSelectedReceiptForGrn(receipt || null);
    setGrnSupplierChallanNumber(receipt?.supplierChallanNumber || 'DC-2026-8819');
    setGrnSupplierChallanDate(receipt?.supplierChallanDate ? receipt.supplierChallanDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setGrnInspectionRemarks('Metallurgical chemistry and dimension specs fully verified against MTR.');
    setGrnPackagingCondition('INTACT');
    setGrnAcceptanceStatus('ACCEPTED');

    if (targetPo) {
      populateGrnItemsForPo(targetPo, receipt);
    }
    setIsCreateGrnModalOpen(true);
  };

  // Drawer & Print selected entities
  const [activeGrnForPrint, setActiveGrnForPrint] = useState<GRN | null>(DEFAULT_GRNS[0]);
  const [drawerDetails, setDrawerDetails] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- API DATA FETCHING ---

  const fetchCreationPhaseData = async () => {
    setIsLoading(true);
    try {
      const [resPO, resReceipt, resGRN, resUnits, resItems, resRecipes, resWarehouses, resLocations] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/purchase-orders`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/grn/material-receipts`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/grn`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/grn/units/traceable`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/items`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/recipes`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/warehouses?status=ACTIVE`).catch(() => null),
        authenticatedFetch(`${env.API_BASE_URL}/warehouses/locations?status=ACTIVE`).catch(() => null)
      ]);

      if (resPO && resPO.ok) {
        const json = await resPO.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setPurchaseOrders(json.data);
      }
      if (resReceipt && resReceipt.ok) {
        const json = await resReceipt.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setMaterialReceipts(json.data);
      }
      if (resGRN && resGRN.ok) {
        const json = await resGRN.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setGrns(json.data);
      }
      if (resUnits && resUnits.ok) {
        const json = await resUnits.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setGrnUnits(json.data);
      }
      if (resItems && resItems.ok) {
        const json = await resItems.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setItems(json.data);
      }
      if (resRecipes && resRecipes.ok) {
        const json = await resRecipes.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setRecipes(json.data);
      }
      if (resWarehouses && resWarehouses.ok) {
        const json = await resWarehouses.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setAvailableWarehouses(json.data);
      }
      if (resLocations && resLocations.ok) {
        const json = await resLocations.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setAvailableLocations(json.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreationPhaseData();
  }, []);

  // Set default PO for receipt recording when POs load
  useEffect(() => {
    if (purchaseOrders.length > 0 && !rcptPoId) {
      setRcptPoId(purchaseOrders[0].id || purchaseOrders[0]._id || '');
    }
  }, [purchaseOrders]);

  // --- ACTIONS & HANDLERS ---

  // 1. Create Purchase Order
  const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreatePo) {
      setFeedback({
        type: 'error',
        message: 'Access Denied: You do not possess the PURCHASE_ORDER_CREATE permission required to create Purchase Orders.'
      });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const selectedItem = items.find((i) => (i.id || i._id) === poItemId) || items[0];
      const selectedRecipe = recipes.find((r) => (r.id || r._id) === poRecipeId) || recipes[0];

      // Client-side Metallurgical Recipe Grade compatibility check
      if (
        selectedItem &&
        selectedRecipe &&
        selectedRecipe.applicableMaterialGrades &&
        !selectedRecipe.applicableMaterialGrades.includes(selectedItem.materialGrade)
      ) {
        throw new Error(
          `Metallurgical Grade Incompatibility: Selected Recipe '${selectedRecipe.recipeCode}' only supports [${selectedRecipe.applicableMaterialGrades.join(
            ', '
          )}], but item '${selectedItem.itemCode}' has grade '${selectedItem.materialGrade}'.`
        );
      }

      if (poOrderedQty <= 0) {
        throw new Error('Ordered quantity must be greater than zero.');
      }
      if (poUnitPrice < 0) {
        throw new Error('Unit price cannot be negative.');
      }

      const calculatedLineTotal = Number((Number(poOrderedQty) * Number(poUnitPrice)).toFixed(2));

      const payload = {
        supplierName: poSupplierName.trim(),
        contactEmail: poSupplierContact.trim(),
        expectedDeliveryDate: poDeliveryDate,
        currency: poCurrency,
        paymentTerms: poPaymentTerms,
        deliveryTerms: poDeliveryTerms,
        notes: poNotes.trim(),
        idempotencyKey: `po_ui_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        items: [
          {
            itemId: selectedItem.id || selectedItem._id || poItemId,
            recipeId: selectedRecipe.id || selectedRecipe._id || poRecipeId,
            orderedQuantity: Number(poOrderedQty),
            unitPrice: Number(poUnitPrice),
            processingRequirement: poProcessingRequirement.trim()
          }
        ]
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create PO (Status ${res.status})`);
      }

      const created = await res.json();
      const poRecord: PurchaseOrder = created.data || {
        ...payload,
        id: `po_${Date.now()}`,
        poNumber: `PO-${new Date().getFullYear()}09-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
        status: 'ISSUED',
        subtotalAmount: calculatedLineTotal,
        totalAmount: calculatedLineTotal,
        items: [
          {
            itemId: selectedItem.id || selectedItem._id || poItemId,
            itemCode: selectedItem.itemCode,
            itemName: selectedItem.name,
            materialGrade: selectedItem.materialGrade,
            recipeId: selectedRecipe.id || selectedRecipe._id || poRecipeId,
            recipeCode: selectedRecipe.recipeCode,
            recipeRevision: selectedRecipe.revision || 1,
            orderedQuantity: Number(poOrderedQty),
            unitPrice: Number(poUnitPrice),
            lineTotal: calculatedLineTotal,
            uom: poUom,
            processingRequirement: poProcessingRequirement.trim()
          }
        ],
        createdAt: new Date().toISOString()
      };

      setPurchaseOrders((prev) => [poRecord, ...prev]);
      setFeedback({
        type: 'success',
        message: `Purchase Order ${poRecord.poNumber} created successfully for item ${selectedItem.itemCode} bound to recipe ${selectedRecipe.recipeCode} (Rev ${selectedRecipe.revision || 1}).`
      });
      setIsCreatePoModalOpen(false);
      fetchCreationPhaseData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error creating Purchase Order' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Record Material Receipt tied to PO
  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const activePo = purchaseOrders.find((p) => (p.id || p._id) === rcptPoId) || purchaseOrders[0];
      if (!activePo) {
        throw new Error('Valid Purchase Order reference is required to record material receipt.');
      }

      const poItem = activePo.items[0];
      const payload = {
        poId: activePo.id || activePo._id,
        idempotencyKey: `rcpt-key-${activePo.id || activePo._id}-${rcptChallanNumber}-${Date.now()}`,
        supplierChallanNumber: rcptChallanNumber,
        supplierChallanDate: rcptChallanDate,
        supplierInvoiceNumber: rcptInvoiceNumber,
        carrierVehicle: rcptVehicleNumber,
        items: [
          {
            poLineItemId: (poItem as any)?.poLineItemId || (poItem as any)?.lineItemId || poItem?.poItemId || 'poi_01',
            itemId: poItem?.itemId || 'itm_01',
            receivedQuantity: Number(rcptReceivedQty),
            supplierHeatNumber: rcptSupplierHeatNumber,
            mtrNumber: rcptMtrNumber,
            lineNotes: rcptConditionRemarks
          }
        ],
        receivedItems: [
          {
            poItemId: poItem?.poItemId || poItem?.lineItemId || 'poi_01',
            itemId: poItem?.itemId || 'itm_01',
            itemCode: poItem?.itemCode || 'MAT-4140-RND-50',
            itemName: poItem?.itemName || 'AISI 4140 Alloy Round Bar',
            materialGrade: poItem?.materialGrade || 'AISI 4140',
            recipeId: poItem?.recipeId || 'rec_01',
            recipeCode: poItem?.recipeCode || 'REC-CARB-4140-01',
            recipeRevision: poItem?.recipeRevision || 1,
            supplierHeatNumber: rcptSupplierHeatNumber,
            millTestCertificateNumber: rcptMtrNumber,
            receivedQuantity: Number(rcptReceivedQty),
            packagesCount: Number(rcptPackagesCount),
            uom: poItem?.uom || 'KG',
            conditionRemarks: rcptConditionRemarks
          }
        ]
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/grn/material-receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to record material receipt (Status ${res.status})`);
      }

      const created = await res.json();
      const receiptRecord: MaterialReceipt = created.data || {
        ...payload,
        id: `rcpt_${Date.now()}`,
        receiptNumber: `MR-${new Date().getFullYear()}09-${String(materialReceipts.length + 1).padStart(4, '0')}`,
        poNumber: activePo.poNumber,
        supplierName: activePo.supplierName,
        status: 'RECEIVED',
        createdAt: new Date().toISOString()
      };

      setMaterialReceipts((prev) => [receiptRecord, ...prev]);
      setFeedback({
        type: 'success',
        message: `Material Receipt ${receiptRecord.receiptNumber} recorded against ${activePo.poNumber}. Proceed to assign warehouse storage.`
      });
      setIsRecordReceiptModalOpen(false);
      fetchCreationPhaseData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error recording material receipt' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Assign Warehouse Storage
  const handleAssignStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptForStorage) return;
    if (!canRecordStorage) {
      setFeedback({
        type: 'error',
        message: 'Access Denied: You do not possess the INVENTORY_STORAGE_RECORD permission required to store material.'
      });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const receiptId = selectedReceiptForStorage.id || selectedReceiptForStorage._id;
      const payload = {
        warehouseId: storageWarehouseId,
        storageLocationCode: storageLocationCode.trim().toUpperCase(),
        quantity: Number(storagePutawayQty),
        storageNotes: storagePutawayNotes.trim() || undefined
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/grn/receipts/${receiptId}/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to assign storage location (Status ${res.status})`);
      }

      const updated = await res.json();
      const updatedReceipt = updated.data || updated;

      setMaterialReceipts((prev) =>
        prev.map((r) =>
          (r.id || r._id) === receiptId
            ? { ...r, ...updatedReceipt }
            : r
        )
      );

      setFeedback({
        type: 'success',
        message: `Receipt ${selectedReceiptForStorage.receiptNumber} (${storagePutawayQty} units) stored in ${storageLocationCode}. ${updatedReceipt.status === 'STORED' ? 'Ready for GRN creation!' : 'Partial putaway saved.'}`
      });
      setIsAssignStorageModalOpen(false);
      fetchCreationPhaseData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error assigning storage location' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Create GRN (Authoritative PO -> GRN workflow)
  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    const po = purchaseOrders.find((p) => (p.id || p._id) === selectedPoIdForGrn);
    if (!po) {
      setFeedback({ type: 'error', message: 'Authoritative PO selection is required. Independent GRN creation is prohibited.' });
      return;
    }

    const selectedKeys = Object.keys(grnItemEntries).filter((k) => grnItemEntries[k]?.selected);
    if (selectedKeys.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one item belonging to the PO for this GRN.' });
      return;
    }

    // Build payload items from authoritative PO items
    const itemsPayload = selectedKeys.map((key) => {
      const poItem = po.items.find((i, idx) => (i.itemId || i.itemCode || String(idx)) === key) || po.items[0];
      const entry = grnItemEntries[key];
      const itemMaster = items.find((itm) => (itm.id || itm._id) === poItem.itemId || itm.itemCode === poItem.itemCode);

      return {
        poItemId: poItem.poItemId || poItem.lineItemId,
        itemId: poItem.itemId,
        itemCode: poItem.itemCode,
        particulars: poItem.itemName,
        uom: poItem.uom,
        hsnCode: itemMaster?.hsnCode || poItem.hsnCode || '7228.30.29',
        rate: poItem.unitPrice,
        unitPrice: poItem.unitPrice,
        challanQuantity: Number(entry.challanQty),
        receivedQuantity: Number(entry.receivedQty),
        supplierHeatNumber: entry.supplierHeatNumber,
        mtrNumber: entry.mtrNumber
      };
    });

    for (const item of itemsPayload) {
      if (item.challanQuantity <= 0 || item.receivedQuantity <= 0) {
        setFeedback({ type: 'error', message: `Challan and received quantities must be greater than zero for item ${item.itemCode}.` });
        return;
      }
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const idempotencyKey = `grn-sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload: any = {
        poId: po.id || po._id,
        supplierChallanNumber: grnSupplierChallanNumber,
        supplierChallanDate: grnSupplierChallanDate,
        items: itemsPayload,
        inspectionRemarks: grnInspectionRemarks,
        packagingCondition: grnPackagingCondition,
        acceptanceStatus: grnAcceptanceStatus,
        idempotencyKey
      };

      if (selectedReceiptForGrn) {
        payload.materialReceiptId = selectedReceiptForGrn.id || selectedReceiptForGrn._id;
      }

      const res = await authenticatedFetch(`${env.API_BASE_URL}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create GRN (Status ${res.status})`);
      }

      const created = await res.json();
      const grnRecord: GRN = created.data?.grn || {
        ...payload,
        id: `grn_${Date.now()}`,
        grnNumber: `GRN-${new Date().getFullYear()}09-${String(grns.length + 1).padStart(4, '0')}`,
        poNumber: po.poNumber,
        receiptNumber: selectedReceiptForGrn?.receiptNumber || 'DIRECT-PO',
        supplierName: po.supplierName,
        totalUnitsGenerated: itemsPayload.length * 10,
        items: itemsPayload.map((p) => ({
          ...p,
          itemName: p.particulars,
          supplierHeatNumber: p.supplierHeatNumber,
          millTestCertificateNumber: p.mtrNumber,
          materialGrade: po.items[0]?.materialGrade || '4140 Alloy Steel',
          recipeId: po.items[0]?.recipeId || 'rec_01',
          recipeCode: po.items[0]?.recipeCode || 'HT-CARB-4140'
        })),
        createdAt: new Date().toISOString()
      };

      setGrns((prev) => [grnRecord, ...prev]);
      setFeedback({
        type: 'success',
        message: `Goods Receipt Note ${grnRecord.grnNumber} generated! Traceable part units are now certified and AVAILABLE FOR PLANNING.`
      });
      setIsCreateGrnModalOpen(false);
      setActiveGrnForPrint(grnRecord);
      fetchCreationPhaseData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error creating GRN' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewGrn = async (grn: GRN) => {
    const searchId = grn.id || grn._id || grn.grnNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/grn/${searchId}`);
      if (res.ok) {
        const json = await res.json();
        setActiveGrnForView(json.data || grn);
      } else {
        setActiveGrnForView(grn);
      }
    } catch {
      setActiveGrnForView(grn);
    }
    setIsViewGrnModalOpen(true);
  };

  const handleOpenPrintGrn = async (grn: GRN) => {
    const searchId = grn.id || grn._id || grn.grnNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/grn/${searchId}`);
      if (res.ok) {
        const json = await res.json();
        setActiveGrnForPrint(json.data || grn);
      } else {
        setActiveGrnForPrint(grn);
      }
    } catch {
      setActiveGrnForPrint(grn);
    }
    setIsPrintGrnModalOpen(true);
  };

  const handleExecutePrint = async () => {
    if (!activeGrnForPrint) return;
    const searchId = activeGrnForPrint.id || activeGrnForPrint._id || activeGrnForPrint.grnNumber;
    try {
      await authenticatedFetch(`${env.API_BASE_URL}/grn/${searchId}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setFeedback({
        type: 'success',
        message: `Goods Receipt Note '${activeGrnForPrint.grnNumber}' printed — server audit log recorded.`
      });
    } catch {
      // Allow browser print even if network glitch
    }
    window.print();
  };

  // Filtered Lists
  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.items.some(
        (i) =>
          i.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.materialGrade.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const filteredReceipts = materialReceipts.filter(
    (r) =>
      r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.receivedItems && r.receivedItems.some((i) => i.supplierHeatNumber?.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (r.items && r.items.some((i) => (i.supplierHeatNumber || i.heatNumber)?.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const filteredGrns = grns.filter(
    (g) =>
      g.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.receiptNumber ? g.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
      g.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnits = grnUnits.filter(
    (u) =>
      u.unitIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.supplierName && u.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.supplierHeatNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.materialGrade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredItems = items.filter(
    (i) =>
      i.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.materialGrade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quick KPI metrics
  const availablePlanningUnits = grnUnits.filter((u) => u.status === 'AVAILABLE_FOR_PLANNING').length;
  const pendingStorageReceipts = materialReceipts.filter((r) => r.status === 'RECEIVED').length;
  const activePOsCount = purchaseOrders.filter((p) => p.status === 'ISSUED' || p.status === 'PARTIALLY_RECEIVED').length;

  const tabs: TabItem[] = [
    { id: 'POS', label: '1. Purchase Orders (PO)', icon: <FileText size={16} />, count: purchaseOrders.length },
    { id: 'RECEIPTS', label: '2. Material Receipts & Storage', icon: <Truck size={16} />, count: materialReceipts.length },
    { id: 'GRNS', label: '3. Goods Receipt Notes (GRN)', icon: <PackageCheck size={16} />, count: grns.length },
    { id: 'UNITS', label: '4. Traceable Units (Planning Ready)', icon: <Boxes size={16} />, count: grnUnits.length },
    { id: 'ITEMS', label: 'Alloy & Item Master', icon: <Tag size={16} />, count: items.length }
  ];

  const selectedItemForPo = items.find((i) => (i.id || i._id) === poItemId) || items[0];
  const selectedRecipeForPo = recipes.find((r) => (r.id || r._id) === poRecipeId) || recipes[0];
  const isRecipeCompatible = Boolean(
    selectedItemForPo &&
    selectedRecipeForPo &&
    selectedRecipeForPo.applicableMaterialGrades &&
    selectedRecipeForPo.applicableMaterialGrades.includes(selectedItemForPo.materialGrade)
  );
  const poLineTotal = Number(((poOrderedQty || 0) * (poUnitPrice || 0)).toFixed(2));

  return (
    <PageContainer>
      <PageHeader
        title="Creation Phase: Material Inwarding & Lineage Workbench"
        subtitle="PO Creation → Material Receipt → Warehouse Storage → GRN Creation → Traceable Part Units → GRN Printing → Available for Planning"
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <AppButton variant="secondary" onClick={fetchCreationPhaseData} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton
              variant="secondary"
              leftIcon={<Truck size={14} />}
              onClick={() => {
                if (purchaseOrders.length > 0) {
                  setRcptPoId(purchaseOrders[0].id || purchaseOrders[0]._id || '');
                }
                setIsRecordReceiptModalOpen(true);
              }}
            >
              Record Material Receipt
            </AppButton>
            {canCreatePo ? (
              <AppButton variant="primary" leftIcon={<Plus size={14} />} onClick={() => setIsCreatePoModalOpen(true)}>
                Create Purchase Order
              </AppButton>
            ) : (
              <div title="Permission 'purchase_order:order:create' required to create Purchase Orders">
                <AppButton variant="primary" disabled leftIcon={<Lock size={14} />}>
                  Create Purchase Order (Restricted)
                </AppButton>
              </div>
            )}
          </div>
        }
      />

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title={feedback.type === 'success' ? 'Workflow Action Completed' : 'Operation Blocked'}>
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* Creation Phase Metric Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                ACTIVE PURCHASE ORDERS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                {activePOsCount} POs
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <FileText size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                PENDING WAREHOUSE STORAGE
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: pendingStorageReceipts > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)', marginTop: '4px' }}>
                {pendingStorageReceipts} Receipts
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
              <Warehouse size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                CERTIFIED GRNS ISSUED
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                {grns.length} GRNs
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
              <PackageCheck size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                AVAILABLE FOR PLANNING
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                {availablePlanningUnits} Units
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Creation Phase Workflow Flowchart Header */}
      <AppCard style={{ marginBottom: '20px', padding: '12px 20px', background: 'var(--material-thin)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: activeTab === 'POS' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>PO Creation</span>
            <ArrowRight size={14} color="var(--color-text-tertiary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: activeTab === 'RECEIPTS' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>Material Receipt</span>
            <ArrowRight size={14} color="var(--color-text-tertiary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: activeTab === 'RECEIPTS' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>Warehouse Storage</span>
            <ArrowRight size={14} color="var(--color-text-tertiary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: activeTab === 'GRNS' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>GRN Creation</span>
            <ArrowRight size={14} color="var(--color-text-tertiary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: activeTab === 'UNITS' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>GRN Material/Part Units</span>
            <ArrowRight size={14} color="var(--color-text-tertiary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>Available for Planning</span>
          </div>
        </div>
      </AppCard>

      {/* Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <AppTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />
        <div style={{ width: '320px' }}>
          <AppInput
            placeholder="Search POs, GRNs, units, melts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'POS' && (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Purchase Orders (Creation Step 1)</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Every physical receipt must originate from a verified Purchase Order binding Item and metallurgical Recipe.
              </p>
            </div>
            <AppButton variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsCreatePoModalOpen(true)}>
              New PO
            </AppButton>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>PO NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>SUPPLIER</th>
                  <th style={{ padding: '12px 16px' }}>PART / ITEM</th>
                  <th style={{ padding: '12px 16px' }}>BOUND RECIPE</th>
                  <th style={{ padding: '12px 16px' }}>ORDERED QTY</th>
                  <th style={{ padding: '12px 16px' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      No Purchase Orders found. Click "Create Purchase Order" to begin the Creation Phase.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const item = po.items[0];
                    return (
                      <tr key={po.id || po._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {po.poNumber}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{po.supplierName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{po.supplierContact}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{item?.itemCode}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            Grade: <span style={{ fontWeight: 700 }}>{item?.materialGrade}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge
                            variant="info"
                            status={item?.recipeCode ? `${item.recipeCode} (Rev ${item.recipeRevision ?? 1})` : 'NONE'}
                          />
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {item?.orderedQuantity?.toLocaleString()} {item?.uom}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge
                            variant={
                              po.status === 'ISSUED'
                                ? 'success'
                                : po.status === 'PARTIALLY_RECEIVED'
                                ? 'warning'
                                : po.status === 'RECEIVED'
                                ? 'info'
                                : 'neutral'
                            }
                            status={po.status}
                          />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              disabled={!canRecordStorage || po.status === 'CLOSED' || po.status === 'CANCELLED'}
                              leftIcon={<Truck size={14} />}
                              onClick={() => {
                                setRcptPoId(po.id || po._id || '');
                                setRcptReceivedQty(item?.orderedQuantity || 5000);
                                setIsRecordReceiptModalOpen(true);
                              }}
                            >
                              Receive
                            </ActionButton>
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              disabled={!canCreateGrn || po.status === 'CLOSED' || po.status === 'CANCELLED' || po.status === 'DRAFT'}
                              leftIcon={<PackageCheck size={14} />}
                              onClick={() => openCreateGrnModal(po)}
                            >
                              Create GRN
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              size="sm"
                              leftIcon={<Eye size={14} />}
                              onClick={() => {
                                setDrawerDetails({
                                  title: `Purchase Order Lineage: ${po.poNumber}`,
                                  content: (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      <AppAlert variant="info" title="Authoritative PO Lineage Record">
                                        This Purchase Order is the origin anchor for all subsequent Material Receipts, Storage Putaways, GRNs, and Production Planning Units.
                                      </AppAlert>
                                      <div>
                                        <strong>Supplier:</strong> {po.supplierName} ({po.supplierContact})
                                      </div>
                                      <div>
                                        <strong>Expected Delivery:</strong> {po.expectedDeliveryDate || 'N/A'}
                                      </div>
                                      <div>
                                        <strong>Ordered Part:</strong> {item?.itemName} ({item?.itemCode})
                                      </div>
                                      <div>
                                        <strong>Metallurgical Grade:</strong> {item?.materialGrade}
                                      </div>
                                      <div>
                                        <strong>Bound Recipe:</strong> {item?.recipeCode} (Rev {item?.recipeRevision ?? 1})
                                      </div>
                                      <div>
                                        <strong>Quantity:</strong> {item?.orderedQuantity} {item?.uom} @ ${item?.unitPrice}/unit
                                      </div>
                                      <div>
                                        <strong>Notes:</strong> {po.notes || 'None'}
                                      </div>
                                    </div>
                                  )
                                });
                                setIsDrawerOpen(true);
                              }}
                            >
                              View
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* TAB 2: MATERIAL RECEIPTS & STORAGE */}
      {activeTab === 'RECEIPTS' && (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Material Receipts & Warehouse Storage (Steps 2 & 3)</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Material received against POs must be placed into designated warehouse bays before GRN creation can proceed.
              </p>
            </div>
            <AppButton
              variant="primary"
              size="sm"
              disabled={!canRecordStorage}
              leftIcon={<Truck size={14} />}
              onClick={() => {
                if (purchaseOrders.length > 0) {
                  setRcptPoId(purchaseOrders[0].id || purchaseOrders[0]._id || '');
                }
                setIsRecordReceiptModalOpen(true);
              }}
            >
              Record Material Receipt
            </AppButton>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>RECEIPT #</th>
                  <th style={{ padding: '12px 16px' }}>PO NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>CHALLAN / VEHICLE</th>
                  <th style={{ padding: '12px 16px' }}>SUPPLIER HEAT # & MTR</th>
                  <th style={{ padding: '12px 16px' }}>RECEIVED QTY</th>
                  <th style={{ padding: '12px 16px' }}>STORAGE LOCATION</th>
                  <th style={{ padding: '12px 16px' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      No Material Receipts recorded yet. Click "Record Material Receipt" against an active PO.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => {
                    const item = (r.items || r.receivedItems || [])[0];
                    return (
                      <tr key={r.id || r._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {r.receiptNumber}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {r.poNumber}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div>Challan: <strong>{r.supplierChallanNumber}</strong></div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Vehicle: {r.vehicleNumber || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{item?.supplierHeatNumber}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>MTR: {item?.millTestCertificateNumber}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {item?.receivedQuantity?.toLocaleString()} {item?.uom}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {r.storageLocationCode ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                {r.warehouseCode ? `${r.warehouseCode} / ` : ''}{r.storageLocationCode}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {r.remainingQuantityToStore !== undefined && r.remainingQuantityToStore > 0
                                  ? `Stored: ${r.totalStoredQuantity || 0} | Pending: ${r.remainingQuantityToStore}`
                                  : 'Authoritative Location'}
                              </div>
                            </div>
                          ) : r.storageLocation ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{r.storageLocation.locationBay}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Bin: {r.storageLocation.locationBin}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Unassigned (Pending Putaway)</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge
                            variant={
                              r.status === 'STORED'
                                ? 'success'
                                : r.status === 'PARTIALLY_STORED'
                                ? 'warning'
                                : r.status === 'GRN_CREATED'
                                ? 'info'
                                : 'neutral'
                            }
                            status={r.status}
                          />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {r.status === 'RECEIVED' || r.status === 'PARTIALLY_STORED' ? (
                              <ActionButton
                                variant="primary"
                                size="sm"
                                leftIcon={<Warehouse size={14} />}
                                onClick={() => openStorageModalForReceipt(r)}
                              >
                                {r.status === 'PARTIALLY_STORED' ? 'Continue Putaway' : 'Store'}
                              </ActionButton>
                            ) : r.status === 'STORED' ? (
                              <ActionButton
                                variant="primary"
                                size="sm"
                                disabled={!canCreateGrn}
                                leftIcon={<PackageCheck size={14} />}
                                onClick={() => openCreateGrnModal(undefined, r)}
                              >
                                Create GRN
                              </ActionButton>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>GRN Issued</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* TAB 3: GOODS RECEIPT NOTES (GRN) & PRINTING */}
      {activeTab === 'GRNS' && (
        !canViewGrn ? (
          <AppCard>
            <AppAlert variant="warning" title="Access Denied (Prompt 9: GRN Permission)">
              You lack the required permission (inventory:grn:view) to view Goods Receipt Notes. Server-side authorization is active.
            </AppAlert>
          </AppCard>
        ) : (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Goods Receipt Notes (Creation Step 4 & Printing)</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Every GRN belongs to exactly one PO and automatically generates individually identifiable part units.
              </p>
            </div>
            <AppButton
              variant="primary"
              size="sm"
              disabled={!canCreateGrn}
              leftIcon={<PackageCheck size={16} />}
              onClick={() => openCreateGrnModal()}
            >
              Generate GRN
            </AppButton>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>GRN NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>PO NUMBER</th>
                  <th style={{ padding: '12px 16px' }}>MATERIAL RECEIPT</th>
                  <th style={{ padding: '12px 16px' }}>SUPPLIER</th>
                  <th style={{ padding: '12px 16px' }}>UNITS GENERATED</th>
                  <th style={{ padding: '12px 16px' }}>ACCEPTANCE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      No GRNs created yet. Stored material receipts can be converted into GRNs with traceable units.
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map((g) => (
                    <tr key={g.id || g._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {g.grnNumber}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {g.poNumber}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {g.receiptNumber || 'DIRECT-PO'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {g.supplierName}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-success)' }}>
                        {g.totalUnitsGenerated || 10} Units Traceable
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge
                          variant={g.acceptanceStatus === 'ACCEPTED' ? 'success' : g.acceptanceStatus === 'ACCEPTED_WITH_DEVIATION' ? 'warning' : 'danger'}
                          status={g.acceptanceStatus}
                        />
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            leftIcon={<Eye size={14} />}
                            onClick={() => handleViewGrn(g)}
                            title="View authoritative GRN record"
                          >
                            View GRN
                          </ActionButton>
                          <ActionButton
                            variant="primary"
                            size="sm"
                            disabled={!canPrintGrn}
                            leftIcon={<Printer size={14} />}
                            onClick={() => handleOpenPrintGrn(g)}
                            title={!canPrintGrn ? 'Permission required: inventory:grn:print' : 'Print official GRN document'}
                          >
                            Print GRN
                          </ActionButton>
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            leftIcon={<Boxes size={14} />}
                            onClick={() => setActiveTab('UNITS')}
                            title="View traceable units in planning gate"
                          >
                            View Units
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
        )
      )}

      {/* TAB 4: TRACEABLE PART UNITS (AVAILABLE FOR PLANNING) */}
      {activeTab === 'UNITS' && (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Individually Traceable Material / Part Units (Planning Gate)
              </h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Every unit maintains full authoritative lineage: PO → Receipt → Storage → GRN → Item → Heat Melt → Bound Recipe.
              </p>
            </div>
            <StatusBadge variant="success" status={`${availablePlanningUnits} Ready for Planning`} />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>UNIT IDENTIFIER</th>
                  <th style={{ padding: '12px 16px' }}>PO & GRN LINEAGE</th>
                  <th style={{ padding: '12px 16px' }}>ITEM & GRADE</th>
                  <th style={{ padding: '12px 16px' }}>BOUND RECIPE</th>
                  <th style={{ padding: '12px 16px' }}>HEAT # & MTR</th>
                  <th style={{ padding: '12px 16px' }}>LOCATION</th>
                  <th style={{ padding: '12px 16px' }}>QTY</th>
                  <th style={{ padding: '12px 16px' }}>PLANNING READINESS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      No traceable part units found. Create GRNs to generate serialized units.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((u) => (
                    <tr key={u.id || u._id || u.unitIdentifier} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {u.unitIdentifier}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{u.poNumber}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{u.grnNumber}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{u.itemCode}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Grade: {u.materialGrade}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge
                          variant="info"
                          status={u.recipeCode ? `${u.recipeCode} (Rev ${u.recipeRevision ?? 1})` : 'NONE'}
                        />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div>{u.supplierHeatNumber}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{u.millTestCertificateNumber}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{u.locationBay}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Bin: {u.locationBin}</div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {u.quantity} {u.uom}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge
                          variant={
                            u.status === 'AVAILABLE_FOR_PLANNING'
                              ? 'success'
                              : u.status === 'ALLOCATED_TO_PLAN'
                              ? 'warning'
                              : u.status === 'IN_PRODUCTION'
                              ? 'info'
                              : 'neutral'
                          }
                          status={u.status}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* TAB 5: ITEM & ALLOY MASTER */}
      {activeTab === 'ITEMS' && (
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Alloy & Material Grade Master</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Item definitions with metallurgical specifications required for Purchase Orders.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>ITEM CODE</th>
                  <th style={{ padding: '12px 16px' }}>NAME & SPECIFICATION</th>
                  <th style={{ padding: '12px 16px' }}>METALLURGICAL GRADE</th>
                  <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px' }}>CURRENT STOCK</th>
                  <th style={{ padding: '12px 16px' }}>UOM</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i) => (
                  <tr key={i.id || i._id || i.itemCode} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {i.itemCode}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{i.name}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge variant="info" status={i.materialGrade} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge variant="neutral" status={i.category} />
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                      {i.currentStock?.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {i.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* --- MODAL 1: CREATE PURCHASE ORDER --- */}
      <AppDialog
        isOpen={isCreatePoModalOpen}
        onClose={() => setIsCreatePoModalOpen(false)}
        title="Create Purchase Order (Step 1 of Creation Phase)"
        size="lg"
      >
        <form onSubmit={handleCreatePurchaseOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!canCreatePo && (
            <AppAlert variant="error" title="Access Denied: Missing Permission">
              You lack the <code>purchase_order:order:create</code> permission required by the ERP administrator to create Purchase Orders.
            </AppAlert>
          )}

          <AppAlert variant="info" title="System Auto-Generated PO Identifier">
            Authoritative PO Number (e.g. <code>PO-{new Date().toISOString().slice(0, 7).replace('-', '')}-XXXX</code>) is generated automatically and immutably upon server submission. Manual editing is prohibited.
          </AppAlert>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Authoritative Supplier Name"
              required
              disabled={!canCreatePo}
              value={poSupplierName}
              onChange={(e) => setPoSupplierName(e.target.value)}
              placeholder="e.g. TimkenSteel Specialty Metals"
            />
            <AppInput
              label="Supplier Contact / Email"
              disabled={!canCreatePo}
              value={poSupplierContact}
              onChange={(e) => setPoSupplierContact(e.target.value)}
              placeholder="e.g. sales@timkensteel.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppSelect
              label="Purchased Item / Part (From Item Master)"
              required
              disabled={!canCreatePo}
              value={poItemId}
              onChange={(e) => {
                const newId = e.target.value;
                setPoItemId(newId);
                const selectedItem = items.find((i) => (i.id || i._id) === newId);
                if (selectedItem) {
                  const matchingRecipe = recipes.find((r) =>
                    r.applicableMaterialGrades && r.applicableMaterialGrades.includes(selectedItem.materialGrade)
                  );
                  if (matchingRecipe) {
                    setPoRecipeId(matchingRecipe.id || matchingRecipe._id || '');
                  }
                }
              }}
              options={items.map((i) => ({
                value: i.id || i._id || i.itemCode,
                label: `${i.itemCode} - ${i.name} [${i.materialGrade}]`
              }))}
            />

            <AppSelect
              label="Bound Manufacturing Recipe (Recipe Master)"
              required
              disabled={!canCreatePo}
              value={poRecipeId}
              onChange={(e) => setPoRecipeId(e.target.value)}
              options={recipes.map((r) => ({
                value: r.id || r._id || r.recipeCode,
                label: `${r.recipeCode} - ${r.processFamily} [${r.applicableMaterialGrades?.join(', ')}]`
              }))}
            />
          </div>

          {/* Metallurgical Compatibility Real-time Check */}
          {selectedItemForPo && selectedRecipeForPo && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: isRecipeCompatible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${isRecipeCompatible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13px'
              }}
            >
              {isRecipeCompatible ? (
                <CheckCircle2 size={20} color="#10b981" />
              ) : (
                <AlertTriangle size={20} color="#ef4444" />
              )}
              <div>
                <div style={{ fontWeight: 700, color: isRecipeCompatible ? '#10b981' : '#ef4444' }}>
                  {isRecipeCompatible ? 'Metallurgical Recipe Compatibility Validated' : 'Metallurgical Grade Mismatch Detected'}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {isRecipeCompatible ? (
                    <span>
                      Item Grade <strong>{selectedItemForPo.materialGrade}</strong> is supported by Recipe <strong>{selectedRecipeForPo.recipeCode}</strong> ({selectedRecipeForPo.processFamily}).
                    </span>
                  ) : (
                    <span>
                      Item Grade <strong>{selectedItemForPo.materialGrade}</strong> is NOT compatible with Recipe <strong>{selectedRecipeForPo.recipeCode}</strong> (Permitted grades: [{selectedRecipeForPo.applicableMaterialGrades?.join(', ')}]). Submission blocked.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <AppInput
            label="Required Processing Requirement (Thermal & Metallurgical Spec)"
            required
            disabled={!canCreatePo}
            value={poProcessingRequirement}
            onChange={(e) => setPoProcessingRequirement(e.target.value)}
            placeholder="e.g. Carburize per AMS 2759/7 to 1.0-1.2mm ECD and oil quench"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Ordered Quantity"
              type="number"
              required
              disabled={!canCreatePo}
              value={poOrderedQty}
              onChange={(e) => setPoOrderedQty(Number(e.target.value))}
            />
            <AppSelect
              label="Unit of Measure"
              disabled={!canCreatePo}
              value={poUom}
              onChange={(e) => setPoUom(e.target.value)}
              options={[
                { value: 'KG', label: 'KG - Kilograms' },
                { value: 'PCS', label: 'PCS - Pieces' },
                { value: 'TON', label: 'TON - Metric Ton' },
                { value: 'MTR', label: 'MTR - Meters' }
              ]}
            />
            <AppInput
              label="Unit Price"
              type="number"
              step="0.01"
              required
              disabled={!canCreatePo}
              value={poUnitPrice}
              onChange={(e) => setPoUnitPrice(Number(e.target.value))}
            />
            <AppSelect
              label="Currency"
              disabled={!canCreatePo}
              value={poCurrency}
              onChange={(e) => setPoCurrency(e.target.value)}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' },
                { value: 'INR', label: 'INR (₹)' }
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px' }}>
            <AppSelect
              label="Payment Terms"
              disabled={!canCreatePo}
              value={poPaymentTerms}
              onChange={(e) => setPoPaymentTerms(e.target.value)}
              options={[
                { value: 'NET_30', label: 'NET 30 Days' },
                { value: 'NET_60', label: 'NET 60 Days' },
                { value: 'IMMEDIATE', label: 'Immediate / Advance' },
                { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit (LC)' }
              ]}
            />
            <AppInput
              label="Delivery Terms"
              disabled={!canCreatePo}
              value={poDeliveryTerms}
              onChange={(e) => setPoDeliveryTerms(e.target.value)}
              placeholder="e.g. FOB Destination"
            />
            <AppInput
              label="Expected Delivery Date"
              type="date"
              required
              disabled={!canCreatePo}
              value={poDeliveryDate}
              onChange={(e) => setPoDeliveryDate(e.target.value)}
            />
          </div>

          <AppInput
            label="Procurement, Traceability & Quality Notes"
            disabled={!canCreatePo}
            value={poNotes}
            onChange={(e) => setPoNotes(e.target.value)}
            placeholder="e.g. Nadcap MTR, chemical certificate & full ladle heat traceability required."
          />

          {/* Subtotal & Line Total Live Preview */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--color-surface-hover, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                CALCULATED LINE SUBTOTAL (EXCL. TAX)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
                {poCurrency} {poLineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
              <div>{poOrderedQty.toLocaleString()} {poUom} @ {poCurrency} {poUnitPrice}/unit</div>
              <div style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: '2px' }}>Server-Validated Commercial Total</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsCreatePoModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              disabled={!canCreatePo || !isRecipeCompatible || poOrderedQty <= 0 || poUnitPrice < 0 || !poSupplierName.trim() || !poDeliveryDate}
              leftIcon={<CheckCircle2 size={16} />}
            >
              Issue Purchase Order
            </AppButton>
          </div>
        </form>
      </AppDialog>

      {/* --- MODAL 2: RECORD MATERIAL RECEIPT --- */}
      <AppDialog
        isOpen={isRecordReceiptModalOpen}
        onClose={() => setIsRecordReceiptModalOpen(false)}
        title="Record Physical Material Receipt (Step 2 of Creation Phase)"
        size="lg"
      >
        <form onSubmit={handleRecordReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!canRecordStorage && (
            <AppAlert variant="warning" title="Storage Permission Required">
              You lack the authoritative <strong>inventory:storage:record</strong> permission. Receiving incoming material and warehouse storage actions are disabled.
            </AppAlert>
          )}

          <AppSelect
            label="Target Purchase Order (Strict 1:1 Lineage)"
            required
            disabled={!canRecordStorage}
            value={rcptPoId}
            onChange={(e) => setRcptPoId(e.target.value)}
            options={purchaseOrders.map((p) => ({
              value: p.id || p._id || '',
              label: `${p.poNumber} — ${p.supplierName} (${p.items[0]?.itemCode} ${p.items[0]?.orderedQuantity} ${p.items[0]?.uom})`
            }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Supplier Challan / Delivery Note #"
              required
              disabled={!canRecordStorage}
              value={rcptChallanNumber}
              onChange={(e) => setRcptChallanNumber(e.target.value)}
              placeholder="e.g. DC-2026-8819"
            />
            <AppInput
              label="Supplier Challan Date"
              type="date"
              required
              disabled={!canRecordStorage}
              value={rcptChallanDate}
              onChange={(e) => setRcptChallanDate(e.target.value)}
            />
            <AppInput
              label="Supplier Invoice Number"
              disabled={!canRecordStorage}
              value={rcptInvoiceNumber}
              onChange={(e) => setRcptInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-4402"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Delivery Vehicle Number"
              disabled={!canRecordStorage}
              value={rcptVehicleNumber}
              onChange={(e) => setRcptVehicleNumber(e.target.value)}
              placeholder="e.g. MH-12-PQ-4410"
            />
            <AppInput
              label="Supplier Heat Lot / Melt #"
              required
              disabled={!canRecordStorage}
              value={rcptSupplierHeatNumber}
              onChange={(e) => setRcptSupplierHeatNumber(e.target.value)}
              placeholder="e.g. TK-HEAT-4140-901"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Mill Test Certificate (MTR) #"
              required
              disabled={!canRecordStorage}
              value={rcptMtrNumber}
              onChange={(e) => setRcptMtrNumber(e.target.value)}
              placeholder="e.g. MTR-TK-2026-8812"
            />
            <AppInput
              label="Received Quantity"
              type="number"
              required
              disabled={!canRecordStorage}
              value={rcptReceivedQty}
              onChange={(e) => setRcptReceivedQty(Number(e.target.value))}
            />
            <AppInput
              label="Packages / Bundles Count"
              type="number"
              disabled={!canRecordStorage}
              value={rcptPackagesCount}
              onChange={(e) => setRcptPackagesCount(Number(e.target.value))}
            />
          </div>

          <AppInput
            label="Inward Inspection & Physical Condition Remarks"
            disabled={!canRecordStorage}
            value={rcptConditionRemarks}
            onChange={(e) => setRcptConditionRemarks(e.target.value)}
            placeholder="e.g. Prime bundled bars, end tags matched MTR."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsRecordReceiptModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              disabled={!canRecordStorage}
              isLoading={isSubmitting}
              leftIcon={<Truck size={16} />}
            >
              Save Material Receipt
            </AppButton>
          </div>
        </form>
      </AppDialog>

      {/* --- MODAL 3: WAREHOUSE STORAGE ASSIGNMENT & PUTAWAY --- */}
      <AppDialog
        isOpen={isAssignStorageModalOpen}
        onClose={() => setIsAssignStorageModalOpen(false)}
        title="Authoritative Warehouse Storage Putaway (Step 3 of Creation Phase)"
        size="lg"
      >
        {selectedReceiptForStorage && (() => {
          const item = (selectedReceiptForStorage.items || selectedReceiptForStorage.receivedItems || [])[0];
          const totalRec = selectedReceiptForStorage.totalReceivedQuantity ?? (selectedReceiptForStorage.items || selectedReceiptForStorage.receivedItems)?.reduce((s: number, i: any) => s + (i.receivedQuantity || 0), 0) ?? 0;
          const totalSt = selectedReceiptForStorage.totalStoredQuantity ?? (selectedReceiptForStorage.items || selectedReceiptForStorage.receivedItems)?.reduce((s: number, i: any) => s + (i.storedQuantity || 0), 0) ?? 0;
          const remainingQty = selectedReceiptForStorage.remainingQuantityToStore !== undefined
            ? selectedReceiptForStorage.remainingQuantityToStore
            : Math.max(0, totalRec - totalSt);

          const currentWh = availableWarehouses.find((w) => (w.id === storageWarehouseId || w._id === storageWarehouseId || w.code === storageWarehouseId));
          const whIdForFilter = currentWh ? (currentWh.id || currentWh._id) : storageWarehouseId;
          const filteredLocations = availableLocations.filter(
            (l) => l.warehouseId === whIdForFilter || (currentWh && l.warehouseCode === currentWh.code)
          );

          const isFullPutaway = storagePutawayQty >= remainingQty;

          return (
            <form onSubmit={handleAssignStorage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AppAlert variant="info" title="Physical Warehouse Putaway & Authoritative Traceability">
                Received raw material must be verified and put away into an authorized active warehouse location before a Goods Receipt Note (GRN) can be issued.
              </AppAlert>

              {/* 1. Incoming Material & PO Authoritative Identification (Read-Only) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--color-surface-subtle, #f8fafc)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '14px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Receipt Number
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {selectedReceiptForStorage.receiptNumber}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Purchase Order
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {selectedReceiptForStorage.poNumber}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {selectedReceiptForStorage.supplierName}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Supplier Challan
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {selectedReceiptForStorage.supplierChallanNumber}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {selectedReceiptForStorage.carrierVehicle || selectedReceiptForStorage.vehicleNumber ? `Vehicle: ${selectedReceiptForStorage.carrierVehicle || selectedReceiptForStorage.vehicleNumber}` : 'Direct Delivery'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Item / Heat Lot Lineage
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {item?.itemCode || 'RAW-ALLOY'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Heat #{item?.supplierHeatNumber || 'N/A'} {item?.mtrNumber || item?.millTestCertificateNumber ? `| MTR: ${item?.mtrNumber || item?.millTestCertificateNumber}` : ''}
                  </div>
                </div>
              </div>

              {/* 2. Authoritative Quantity Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Received</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    {totalRec.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400 }}>{item?.uom || 'units'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Already Put Away</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: totalSt > 0 ? 'var(--color-success)' : 'inherit' }}>
                    {totalSt.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400 }}>{item?.uom || 'units'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Remaining to Put Away</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-warning)' }}>
                    {remainingQty.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400 }}>{item?.uom || 'units'}</span>
                  </div>
                </div>
              </div>

              {/* 3. Warehouse & Location Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <AppSelect
                  label="Target Warehouse Facility"
                  required
                  disabled={!canRecordStorage}
                  value={storageWarehouseId}
                  onChange={(e) => {
                    const newWhId = e.target.value;
                    setStorageWarehouseId(newWhId);
                    const matchingWh = availableWarehouses.find((w) => (w.id === newWhId || w._id === newWhId || w.code === newWhId));
                    const locs = availableLocations.filter((l) => l.warehouseId === newWhId || (matchingWh && l.warehouseCode === matchingWh.code));
                    if (locs.length > 0) {
                      setStorageLocationCode(locs[0].locationCode || locs[0].code || '');
                    }
                  }}
                  options={availableWarehouses.map((w) => ({
                    value: w.id || w._id,
                    label: `${w.code} — ${w.name}`
                  }))}
                />

                {filteredLocations.length > 0 ? (
                  <AppSelect
                    label="Authoritative Storage Bay / Bin"
                    required
                    disabled={!canRecordStorage}
                    value={storageLocationCode}
                    onChange={(e) => setStorageLocationCode(e.target.value)}
                    options={filteredLocations.map((l) => ({
                      value: l.locationCode || l.code,
                      label: `${l.locationCode || l.code} — ${l.zone} (${l.bay || 'General'})`
                    }))}
                  />
                ) : (
                  <AppInput
                    label="Storage Location Code (Bay / Bin)"
                    required
                    disabled={!canRecordStorage}
                    value={storageLocationCode}
                    onChange={(e) => setStorageLocationCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BAY-01-A"
                  />
                )}
              </div>

              {/* 4. Storage Quantity & Confirmation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <AppInput
                  label={`Putaway Quantity (${item?.uom || 'units'})`}
                  type="number"
                  required
                  disabled={!canRecordStorage}
                  min={0.0001}
                  max={remainingQty}
                  step="any"
                  value={storagePutawayQty}
                  onChange={(e) => setStoragePutawayQty(Number(e.target.value))}
                />

                <div style={{ paddingTop: '8px' }}>
                  {isFullPutaway ? (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: '12px', fontWeight: 600 }}>
                      ✓ Complete Putaway: Status will become <strong>STORED</strong> (ready for GRN)
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontSize: '12px', fontWeight: 600 }}>
                      ⚠️ Partial Putaway: Status will become <strong>PARTIALLY_STORED</strong> (Remaining: {(remainingQty - storagePutawayQty).toLocaleString()} {item?.uom})
                    </div>
                  )}
                </div>
              </div>

              <AppInput
                label="Putaway Movement Notes & Inspection Remarks"
                disabled={!canRecordStorage}
                value={storagePutawayNotes}
                onChange={(e) => setStoragePutawayNotes(e.target.value)}
                placeholder="e.g. Stored in Bay 1 Rack A2, bundle tags verified, fork lift operator sign-off."
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <AppButton variant="secondary" onClick={() => setIsAssignStorageModalOpen(false)}>
                  Cancel
                </AppButton>
                <AppButton
                  variant="primary"
                  type="submit"
                  disabled={!canRecordStorage || storagePutawayQty <= 0 || storagePutawayQty > remainingQty}
                  isLoading={isSubmitting}
                  leftIcon={<Warehouse size={16} />}
                >
                  Confirm Authoritative Putaway
                </AppButton>
              </div>
            </form>
          );
        })()}
      </AppDialog>

      {/* --- MODAL 4: CREATE GOODS RECEIPT NOTE (GRN) --- */}
      <AppDialog
        isOpen={isCreateGrnModalOpen}
        onClose={() => setIsCreateGrnModalOpen(false)}
        title="Generate Goods Receipt Note (PO → GRN Authoritative Workflow)"
        size="xl"
      >
        {(() => {
          const eligiblePOs = purchaseOrders.filter((p) => p.status === 'ISSUED' || p.status === 'PARTIALLY_RECEIVED');
          const currentPo = purchaseOrders.find((p) => (p.id || p._id) === selectedPoIdForGrn) || eligiblePOs[0] || purchaseOrders[0];

          return (
            <form onSubmit={handleCreateGrn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AppAlert variant="info" title="PO → GRN Authoritative Relationship">
                Every Goods Receipt Note (GRN) is strictly a child transaction of exactly one Purchase Order. The Supplier and selectable items are authoritatively retrieved from the PO.
              </AppAlert>

              {/* 1. SELECT AUTHORITATIVE PURCHASE ORDER */}
              <div>
                <AppSelect
                  label="Select Authoritative Purchase Order (Mandatory Parent PO)"
                  required
                  disabled={!canCreateGrn || isSubmitting}
                  value={selectedPoIdForGrn}
                  onChange={(e) => {
                    const poId = e.target.value;
                    setSelectedPoIdForGrn(poId);
                    const po = purchaseOrders.find((p) => (p.id || p._id) === poId);
                    if (po) {
                      populateGrnItemsForPo(po, selectedReceiptForGrn);
                    }
                  }}
                  options={(eligiblePOs.length > 0 ? eligiblePOs : purchaseOrders).map((p) => ({
                    value: p.id || p._id || '',
                    label: `${p.poNumber} — ${p.supplierName} (${p.status})`
                  }))}
                />
                {eligiblePOs.length === 0 && (
                  <p style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px', marginTop: '4px' }}>
                    ⚠️ No open or partially received Purchase Orders available. An eligible PO is strictly required.
                  </p>
                )}
              </div>

              {/* 2. AUTHORITATIVE SUPPLIER (DERIVED FROM PO - READ ONLY) */}
              {currentPo && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    backgroundColor: 'var(--color-surface-subtle, #f8fafc)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Authoritative Supplier (PO Derived)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {currentPo.supplierName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Contact: {currentPo.supplierContact || currentPo.contactEmail || 'Procurement Office'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      PO Status & Commercial Terms
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      <StatusBadge variant="info" status={currentPo.status} /> {currentPo.currency || 'USD'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Terms: {currentPo.paymentTerms || 'NET_30'} • {currentPo.deliveryTerms || 'FOB'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Traceability Protocol
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                      🔒 PO → Supplier → GRN
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Supplier is strictly derived by server from PO.
                    </div>
                  </div>
                </div>
              )}

              {/* 3. USER-ENTERED RECEIPT INFORMATION */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <AppInput
                  label="Supplier Challan Number"
                  required
                  disabled={!canCreateGrn || isSubmitting}
                  value={grnSupplierChallanNumber}
                  onChange={(e) => setGrnSupplierChallanNumber(e.target.value)}
                  placeholder="e.g. DC-2026-8819"
                />
                <AppInput
                  label="Supplier Challan Date"
                  type="date"
                  required
                  disabled={!canCreateGrn || isSubmitting}
                  value={grnSupplierChallanDate}
                  onChange={(e) => setGrnSupplierChallanDate(e.target.value)}
                />
              </div>

              {/* 4. PO ITEMS SELECTION & AUTHORITATIVE DATA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>
                    PO Line Items (Select Items to Receive in this GRN)
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Particulars, HSN code, rate, UOM, and bound recipe originate authoritatively from PO.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentPo?.items?.map((item, idx) => {
                    const key = item.itemId || item.itemCode || String(idx);
                    const entry = grnItemEntries[key] || {
                      selected: true,
                      challanQty: item.orderedQuantity,
                      receivedQty: item.orderedQuantity,
                      supplierHeatNumber: 'TK-HEAT-4140-901',
                      mtrNumber: 'MTR-TK-2026-8812'
                    };
                    const itemMaster = items.find((itm) => (itm.id || itm._id) === item.itemId || itm.itemCode === item.itemCode);
                    const hsn = itemMaster?.hsnCode || item.hsnCode || '7228.30.29';
                    const rate = item.unitPrice;

                    return (
                      <div
                        key={key}
                        style={{
                          border: entry.selected ? '2px solid var(--color-primary, #0284c7)' : '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '14px',
                          backgroundColor: entry.selected ? 'rgba(2, 132, 199, 0.02)' : 'var(--color-surface-subtle, #f8fafc)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={entry.selected}
                              disabled={!canCreateGrn || isSubmitting}
                              onChange={(e) => {
                                setGrnItemEntries((prev) => ({
                                  ...prev,
                                  [key]: { ...entry, selected: e.target.checked }
                                }));
                              }}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                            />
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>
                              {item.itemCode} — {item.itemName}
                            </span>
                          </label>
                          <StatusBadge variant="info" status={`Recipe: ${item.recipeCode || 'HT-CARB-4140'} (Rev ${item.recipeRevision ?? 1})`} />
                        </div>

                        {/* Authoritative Information (Read-Only) */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: '8px',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            padding: '10px',
                            marginBottom: '10px',
                            fontSize: '12px'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>HSN / SAC Code</div>
                            <div style={{ fontWeight: 600 }}>{hsn}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Contract Rate</div>
                            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{rate} {currentPo.currency || 'USD'} / {item.uom}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Ordered Qty</div>
                            <div style={{ fontWeight: 600 }}>{item.orderedQuantity.toLocaleString()} {item.uom}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Balance Qty</div>
                            <div style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
                              {(item.balanceQuantity ?? (item.orderedQuantity - (item.receivedQuantity || 0))).toLocaleString()} {item.uom}
                            </div>
                          </div>
                        </div>

                        {/* Receipt-Specific User Inputs */}
                        {entry.selected && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                            <AppInput
                              label={`Challan Qty (${item.uom})`}
                              type="number"
                              required
                              min={0.0001}
                              step="any"
                              disabled={!canCreateGrn || isSubmitting}
                              value={entry.challanQty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setGrnItemEntries((prev) => ({
                                  ...prev,
                                  [key]: { ...entry, challanQty: val }
                                }));
                              }}
                            />
                            <AppInput
                              label={`Received Qty (${item.uom})`}
                              type="number"
                              required
                              min={0.0001}
                              step="any"
                              disabled={!canCreateGrn || isSubmitting}
                              value={entry.receivedQty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setGrnItemEntries((prev) => ({
                                  ...prev,
                                  [key]: { ...entry, receivedQty: val }
                                }));
                              }}
                            />
                            <AppInput
                              label="Supplier Heat #"
                              disabled={!canCreateGrn || isSubmitting}
                              value={entry.supplierHeatNumber}
                              onChange={(e) => {
                                setGrnItemEntries((prev) => ({
                                  ...prev,
                                  [key]: { ...entry, supplierHeatNumber: e.target.value }
                                }));
                              }}
                              placeholder="e.g. TK-HEAT-4140-901"
                            />
                            <AppInput
                              label="Mill Test Certificate (MTR) #"
                              disabled={!canCreateGrn || isSubmitting}
                              value={entry.mtrNumber}
                              onChange={(e) => {
                                setGrnItemEntries((prev) => ({
                                  ...prev,
                                  [key]: { ...entry, mtrNumber: e.target.value }
                                }));
                              }}
                              placeholder="e.g. MTR-TK-2026-8812"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. QUALITY INSPECTION & REMARKS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <AppSelect
                  label="Acceptance Decision"
                  required
                  disabled={!canCreateGrn || isSubmitting}
                  value={grnAcceptanceStatus}
                  onChange={(e) => setGrnAcceptanceStatus(e.target.value as any)}
                  options={[
                    { value: 'ACCEPTED', label: 'ACCEPTED — Meets all metallurgical and physical specifications' },
                    { value: 'ACCEPTED_WITH_DEVIATION', label: 'ACCEPTED WITH DEVIATION — Conditional acceptance' },
                    { value: 'REJECTED', label: 'REJECTED — Quarantine and return to vendor' }
                  ]}
                />

                <AppSelect
                  label="Packaging & Physical Condition"
                  disabled={!canCreateGrn || isSubmitting}
                  value={grnPackagingCondition}
                  onChange={(e) => setGrnPackagingCondition(e.target.value)}
                  options={[
                    { value: 'INTACT', label: 'INTACT — Sealed, verified bar ends, no corrosion' },
                    { value: 'ACCEPTABLE', label: 'ACCEPTABLE — Minor bundle banding wear' },
                    { value: 'DAMAGED_REJECTED', label: 'DAMAGED / DEVIANT — Moisture or handling marks' }
                  ]}
                />
              </div>

              <AppInput
                label="QC Inspection Remarks"
                required
                disabled={!canCreateGrn || isSubmitting}
                value={grnInspectionRemarks}
                onChange={(e) => setGrnInspectionRemarks(e.target.value)}
                placeholder="e.g. Chemistry verified against spectrometer standard and MTR."
              />

              {!canCreateGrn && (
                <AppAlert variant="warning" title="Permission Required">
                  You lack the required permission (<code>inventory:grn:create</code>) to generate Goods Receipt Notes.
                </AppAlert>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <AppButton variant="secondary" onClick={() => setIsCreateGrnModalOpen(false)}>
                  Cancel
                </AppButton>
                <AppButton
                  variant="primary"
                  type="submit"
                  disabled={!canCreateGrn || !currentPo || isSubmitting || Object.values(grnItemEntries).filter((e) => e.selected).length === 0}
                  isLoading={isSubmitting}
                  leftIcon={<PackageCheck size={16} />}
                >
                  Issue Authoritative GRN & Generate Traceable Units
                </AppButton>
              </div>
            </form>
          );
        })()}
      </AppDialog>

      {/* --- MODAL 4B: AUTHORITATIVE GRN RECORD VIEW (PROMPT 9) --- */}
      <AppDialog
        isOpen={isViewGrnModalOpen}
        onClose={() => setIsViewGrnModalOpen(false)}
        title={`Goods Receipt Note Record: ${activeGrnForView?.grnNumber || ''}`}
        size="xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Authoritative Lineage Alert */}
          <AppAlert
            type="info"
            title="AUTHORITATIVE CREATION LINEAGE: PURCHASE ORDER &rarr; GRN &rarr; PART UNITS"
          >
            {`Child Goods Receipt Note generated from Purchase Order ${activeGrnForView?.poNumber}. Authoritative Supplier: ${activeGrnForView?.supplierName}. Distinct part units are independently tracked with bound recipes.`}
          </AppAlert>

          {/* Metadata Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--color-bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Purchase Order & Supplier Traceability
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Parent PO:</strong> <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{activeGrnForView?.poNumber}</span></div>
                <div><strong>Authoritative Supplier:</strong> {activeGrnForView?.supplierName} {activeGrnForView?.supplierCode ? `(${activeGrnForView.supplierCode})` : ''}</div>
                <div><strong>Delivery Challan:</strong> {activeGrnForView?.supplierChallanNumber || 'N/A'}</div>
                <div><strong>Challan Date:</strong> {activeGrnForView?.supplierChallanDate ? new Date(activeGrnForView.supplierChallanDate).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Carrier Vehicle:</strong> {activeGrnForView?.carrierVehicle || 'N/A'}</div>
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                GRN Identity & Storage Allocation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>GRN Number:</strong> <span style={{ fontWeight: 700 }}>{activeGrnForView?.grnNumber}</span></div>
                <div><strong>Date Created:</strong> {new Date(activeGrnForView?.createdAt || Date.now()).toLocaleDateString()}</div>
                <div><strong>Warehouse:</strong> {activeGrnForView?.warehouseCode || 'WH-MAIN'}</div>
                <div><strong>Bay / Bin:</strong> {activeGrnForView?.storageLocationCode || 'BAY-01-A'}</div>
                {activeGrnForView?.receiptNumber && <div><strong>Gate Receipt Ref:</strong> {activeGrnForView.receiptNumber}</div>}
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Quality Acceptance & Sign-off
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Status:</strong> <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{activeGrnForView?.status || 'AVAILABLE_FOR_PLANNING'}</span></div>
                <div><strong>Acceptance:</strong> {activeGrnForView?.acceptanceStatus || 'ACCEPTED'}</div>
                <div><strong>Received By:</strong> {activeGrnForView?.receivedBy || 'Store In-Charge'}</div>
                <div><strong>Print Count:</strong> {activeGrnForView?.printCount || 0} times</div>
                {activeGrnForView?.inspectionRemarks && <div><strong>Remarks:</strong> {activeGrnForView.inspectionRemarks}</div>}
              </div>
            </div>
          </div>

          {/* Received Items Table */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>
              Received Items & Bound Process Recipes
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Item Code</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Particulars / Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Grade</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Bound Recipe</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Heat # / MTR</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rec Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Acc Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGrnForView?.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.itemCode}</td>
                      <td style={{ padding: '10px 12px' }}>{item.particulars || item.itemName}</td>
                      <td style={{ padding: '10px 12px' }}>{item.materialGrade}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-accent-blue)' }}>
                        {item.recipeCode} {item.recipeRevision ? `(Rev ${item.recipeRevision})` : ''}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{item.supplierHeatNumber}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>MTR: {item.millTestCertificateNumber || item.mtrNumber || 'VERIFIED'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.receivedQuantity} {item.uom}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                        {item.acceptedQuantity ?? item.receivedQuantity} {item.uom}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {item.rate ? `₹${item.rate.toLocaleString()}` : item.unitPrice ? `₹${item.unitPrice.toLocaleString()}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Units Breakdown */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>
              Individual Traceable Material/Part Units ({activeGrnForView?.units?.length || activeGrnForView?.totalUnitsGenerated || grnUnits.filter(u => u.grnNumber === activeGrnForView?.grnNumber).length} Units)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
              {(activeGrnForView?.units && activeGrnForView.units.length > 0
                ? activeGrnForView.units
                : grnUnits.filter((u) => u.grnNumber === activeGrnForView?.grnNumber)
              ).map((u: any) => (
                <div key={u.unitIdentifier} style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>{u.unitIdentifier}</span>
                    <StatusBadge
                      variant={u.status === 'ALLOCATED_TO_PLAN' ? 'info' : u.status === 'AVAILABLE_FOR_PLANNING' ? 'success' : 'neutral'}
                      status={u.status || 'AVAILABLE_FOR_PLANNING'}
                    />
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                    <div><strong>Recipe:</strong> {u.recipeCode} {u.recipeRevision ? `(Rev ${u.recipeRevision})` : ''}</div>
                    <div><strong>Location:</strong> {u.warehouseCode || u.warehouseName || 'WH-MAIN'} / {u.storageLocationCode || u.locationBay || 'BAY-01-A'}</div>
                    <div><strong>Heat #:</strong> {u.supplierHeatNumber} • {u.quantity} {u.uom}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <AppButton variant="secondary" onClick={() => setIsViewGrnModalOpen(false)}>
              Close
            </AppButton>
            <AppButton
              variant="primary"
              disabled={!canPrintGrn}
              leftIcon={<Printer size={16} />}
              onClick={() => {
                setIsViewGrnModalOpen(false);
                if (activeGrnForView) handleOpenPrintGrn(activeGrnForView);
              }}
              title={!canPrintGrn ? 'Permission required: inventory:grn:print' : 'Open print preview'}
            >
              Print Document
            </AppButton>
          </div>
        </div>
      </AppDialog>

      {/* --- MODAL 5: PRINTABLE OFFICIAL GRN DOCUMENT --- */}
      <AppDialog
        isOpen={isPrintGrnModalOpen}
        onClose={() => setIsPrintGrnModalOpen(false)}
        title={`Official Goods Receipt Note: ${activeGrnForPrint?.grnNumber || ''}`}
        size="xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Printable Layout Container */}
          <div
            id="printable-grn-container"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Celestium Advanced Heat Treatment Works
                </h2>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Aerospace, Defense & Automotive Thermal Processing Facility • IATF 16949 / AS9100D Certified
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0369a1' }}>GOODS RECEIPT NOTE (GRN)</div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>{activeGrnForPrint?.grnNumber}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Date: {new Date(activeGrnForPrint?.createdAt || Date.now()).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Authoritative PO Lineage Banner */}
            <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>Authoritative Lineage:</span>
                <span style={{ fontWeight: 700, color: '#0c4a6e', fontSize: '12px', marginLeft: '6px' }}>Purchase Order &rarr; GRN &rarr; Traceable Part Units</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7' }}>
                Parent PO Reference: <strong>{activeGrnForPrint?.poNumber}</strong>
              </div>
            </div>

            {/* PO & Supplier Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>PO & SUPPLIER DETAILS (AUTHORITATIVE)</div>
                <div><strong>Purchase Order:</strong> {activeGrnForPrint?.poNumber}</div>
                <div><strong>Supplier:</strong> {activeGrnForPrint?.supplierName}</div>
                <div><strong>Supplier Challan:</strong> {activeGrnForPrint?.supplierChallanNumber || 'DC-2026-8819'} {activeGrnForPrint?.supplierChallanDate ? `(Dated: ${new Date(activeGrnForPrint.supplierChallanDate).toLocaleDateString()})` : ''}</div>
                {activeGrnForPrint?.receiptNumber && <div><strong>Material Receipt:</strong> {activeGrnForPrint?.receiptNumber}</div>}
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>QUALITY & ACCEPTANCE</div>
                <div><strong>Acceptance Status:</strong> <span style={{ color: '#15803d', fontWeight: 700 }}>{activeGrnForPrint?.acceptanceStatus || 'ACCEPTED'}</span></div>
                <div><strong>Packaging:</strong> {activeGrnForPrint?.packagingCondition || 'INTACT'}</div>
                <div><strong>Inspection Remarks:</strong> {activeGrnForPrint?.inspectionRemarks || 'All material parameters and MTR mill test certificates verified'}</div>
              </div>
            </div>

            {/* Received Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>ITEM CODE</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>PARTICULARS & GRADE</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>HSN/SAC</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>RATE</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>BOUND RECIPE</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>HEAT # / MTR</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>CHALLAN QTY</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>RECEIVED QTY</th>
                </tr>
              </thead>
              <tbody>
                {activeGrnForPrint?.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{item.itemCode}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 600 }}>{item.particulars || item.itemName}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Grade: {item.materialGrade}</div>
                    </td>
                    <td style={{ padding: '8px' }}>{item.hsnCode || '7228.30.29'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                      {item.rate ?? item.unitPrice ?? 4.85}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0369a1' }}>
                      {item.recipeCode} (Rev {item.recipeRevision ?? 1})
                    </td>
                    <td style={{ padding: '8px', fontSize: '10px' }}>
                      <div>Heat: {item.supplierHeatNumber || 'N/A'}</div>
                      <div>MTR: {item.millTestCertificateNumber || item.mtrNumber || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{item.challanQuantity ?? item.receivedQuantity} {item.uom}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{item.receivedQuantity} {item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Serialized Units Preview */}
            <div style={{ fontSize: '12px', marginBottom: '24px' }}>
              <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>
                GENERATED SERIALIZED TRACEABLE UNITS (AVAILABLE FOR PLANNING)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {grnUnits
                  .filter((u) => u.grnNumber === activeGrnForPrint?.grnNumber)
                  .map((u) => (
                    <div key={u.unitIdentifier} style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.unitIdentifier}</div>
                      <div style={{ color: '#64748b' }}>{u.quantity} {u.uom} • {u.locationBay}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', borderTop: '1px solid #cbd5e1', paddingTop: '24px', textAlign: 'center', fontSize: '11px' }}>
              <div>
                <div style={{ borderBottom: '1px solid #94a3b8', height: '32px', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 700 }}>WAREHOUSE RECEIVING OFFICER</div>
                <div style={{ color: '#64748b' }}>Store Putaway Verified</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #94a3b8', height: '32px', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 700 }}>METALLURGICAL QC INSPECTOR</div>
                <div style={{ color: '#64748b' }}>MTR & Chemical Conformity</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #94a3b8', height: '32px', marginBottom: '8px' }}></div>
                <div style={{ fontWeight: 700 }}>PLANT OPERATIONS MANAGER</div>
                <div style={{ color: '#64748b' }}>Released for Production Planning</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <AppButton variant="secondary" onClick={() => setIsPrintGrnModalOpen(false)}>
              Close
            </AppButton>
            <AppButton
              variant="primary"
              disabled={!canPrintGrn}
              leftIcon={<Printer size={16} />}
              onClick={handleExecutePrint}
              title={!canPrintGrn ? 'Permission required: inventory:grn:print' : 'Print official GRN document'}
            >
              Print GRN Document
            </AppButton>
          </div>
        </div>
      </AppDialog>

      {/* --- DRAWER FOR LINEAGE DETAILS --- */}
      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={drawerDetails?.title || 'Details'}
        position="right"
        width="520px"
      >
        {drawerDetails?.content}
      </AppDrawer>
    </PageContainer>
  );
};
export default InventoryPage;
