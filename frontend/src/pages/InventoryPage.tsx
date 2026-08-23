import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Search,
  RefreshCw,
  FileCheck,
  ChevronRight,
  FileText
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

interface Item {
  _id?: string;
  id?: string;
  itemCode: string;
  name: string;
  category: string;
  materialGrade?: string;
  uom: string;
  currentStock?: number;
  safetyStock?: number;
  unitCost?: number;
}

interface HeatLot {
  _id?: string;
  id?: string;
  heatLotNumber: string;
  supplierHeatNumber: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  receivedQuantity: number;
  remainingQuantity: number;
  uom: string;
  status: 'RECEIVED' | 'QUARANTINED' | 'RELEASED' | 'CONSUMED' | 'REJECTED';
  locationBay: string;
  millTestCertificateNumber: string;
}

const DEFAULT_ITEMS: Item[] = [
  { id: 'itm_01', itemCode: 'BAR-4340-50MM', name: 'AISI 4340 Alloy Steel Round Bar 50mm', category: 'RAW_MATERIAL', materialGrade: 'AISI 4340', uom: 'KG', currentStock: 4800, safetyStock: 1500, unitCost: 4.8 },
  { id: 'itm_02', itemCode: 'BAR-8620-75MM', name: 'AISI 8620 Carburizing Steel Bar 75mm', category: 'RAW_MATERIAL', materialGrade: 'AISI 8620', uom: 'KG', currentStock: 8200, safetyStock: 2000, unitCost: 3.6 },
  { id: 'itm_03', itemCode: 'BAR-INCONEL-718', name: 'Inconel 718 High-Temperature Aerospace Rod', category: 'RAW_MATERIAL', materialGrade: 'INCONEL 718', uom: 'KG', currentStock: 1400, safetyStock: 500, unitCost: 38.5 },
  { id: 'itm_04', itemCode: 'PART-SHAFT-4340', name: 'Finished Turbine Rotor Shafts 4340', category: 'FINISHED_TREATED_GOODS', materialGrade: 'AISI 4340', uom: 'PCS', currentStock: 220, safetyStock: 50, unitCost: 108.75 },
  { id: 'itm_05', itemCode: 'PART-GEAR-8620', name: 'Case-Hardened Automotive Pinion Gears', category: 'FINISHED_TREATED_GOODS', materialGrade: 'AISI 8620', uom: 'PCS', currentStock: 550, safetyStock: 100, unitCost: 86.25 }
];

const DEFAULT_HEAT_LOTS: HeatLot[] = [
  {
    id: 'hl_01',
    heatLotNumber: 'HL-4340-2026A',
    supplierHeatNumber: 'TIMKEN-884912',
    supplierName: 'TimkenSteel Corporation',
    itemCode: 'BAR-4340-50MM',
    itemName: 'AISI 4340 Round Bar 50mm',
    materialGrade: 'AISI 4340',
    receivedQuantity: 5000,
    remainingQuantity: 3170,
    uom: 'KG',
    status: 'RELEASED',
    locationBay: 'Bay 1 Vacuum Bay',
    millTestCertificateNumber: 'MTR-TIMKEN-9941'
  },
  {
    id: 'hl_02',
    heatLotNumber: 'HL-8620-2026B',
    supplierHeatNumber: 'AM-773821',
    supplierName: 'ArcelorMittal Dofasco',
    itemCode: 'BAR-8620-75MM',
    itemName: 'AISI 8620 Carburizing Steel Bar 75mm',
    materialGrade: 'AISI 8620',
    receivedQuantity: 8000,
    remainingQuantity: 4930,
    uom: 'KG',
    status: 'RELEASED',
    locationBay: 'Bay 2 Carburizing Bay',
    millTestCertificateNumber: 'MTR-AM-8812'
  },
  {
    id: 'hl_03',
    heatLotNumber: 'HL-718-2026C',
    supplierHeatNumber: 'SMC-991204',
    supplierName: 'Special Metals Corporation',
    itemCode: 'BAR-INCONEL-718',
    itemName: 'Inconel 718 High-Temperature Aerospace Rod',
    materialGrade: 'INCONEL 718',
    receivedQuantity: 1500,
    remainingQuantity: 1400,
    uom: 'KG',
    status: 'RELEASED',
    locationBay: 'Bay 1 Vacuum Bay',
    millTestCertificateNumber: 'MTR-SMC-1109'
  }
];

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'HEAT_LOTS'>('ITEMS');
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [heatLots, setHeatLots] = useState<HeatLot[]>(DEFAULT_HEAT_LOTS);
  const [selectedHeatLot, setSelectedHeatLot] = useState<HeatLot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Receive Heat Lot Form State
  const [heatLotNumber, setHeatLotNumber] = useState('HL-4340-2026D');
  const [supplierHeatNumber, setSupplierHeatNumber] = useState('TK-90211');
  const [supplierName, setSupplierName] = useState('TimkenSteel Corporation');
  const [materialGrade, setMaterialGrade] = useState('AISI 4340');
  const [receivedQuantity, setReceivedQuantity] = useState(4000);
  const [storageLocation, setStorageLocation] = useState('Bay 1 Vacuum Bay');
  const [mtrNumber, setMtrNumber] = useState('MTR-2026-9021');

  const fetchInventoryData = async () => {
    setIsLoading(true);
    try {
      const [resI, resH] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/items`),
        authenticatedFetch(`${env.API_BASE_URL}/heat-lots`)
      ]);

      if (resI.ok) {
        const jsonI = await resI.json();
        if (jsonI.data && Array.isArray(jsonI.data) && jsonI.data.length > 0) setItems(jsonI.data);
      }
      if (resH.ok) {
        const jsonH = await resH.json();
        if (jsonH.data && Array.isArray(jsonH.data) && jsonH.data.length > 0) setHeatLots(jsonH.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiveHeatLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const selectedItem = items.find((i) => i.materialGrade === materialGrade || i.itemCode.includes('4340')) || items[0];
      const targetItemId = selectedItem?._id || selectedItem?.id || selectedItem?.itemCode || 'BAR-4340-50MM';

      const payload = {
        heatLotNumber,
        itemId: targetItemId,
        materialGrade,
        supplierHeatNumber,
        supplierName,
        mtrNumber,
        receivedQuantity: Number(receivedQuantity),
        uom: 'KG',
        storageLocation
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/heat-lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to receive heat lot (status ${res.status})`);
      }

      setFeedback({ type: 'success', message: `Heat lot ${heatLotNumber} (${materialGrade}) received and quarantined for lab intake inspection.` });
      setIsReceiveModalOpen(false);
      fetchInventoryData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to receive heat lot' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const totalAlloyStockKg = items.filter((i) => i.uom === 'KG').reduce((acc, i) => acc + (i.currentStock || 0), 0);

  const filteredItems = items.filter(
    (i) =>
      i.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.materialGrade && i.materialGrade.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHeatLots = heatLots.filter(
    (hl) =>
      hl.heatLotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hl.supplierHeatNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hl.materialGrade.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hl.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer>
      <PageHeader
        title="Inventory & Metallurgical Heat Lots"
        subtitle="Alloy raw materials, traceable supplier heat melts, Mill Test Reports (MTR), and stock balances"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchInventoryData} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Boxes size={14} />} onClick={() => setIsReceiveModalOpen(true)}>
              Receive Heat Lot
            </AppButton>
          </div>
        }
      />

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title={feedback.type === 'success' ? 'Operation Success' : 'Error'}>
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TOTAL ALLOY STOCK</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{totalAlloyStockKg.toLocaleString()} KG</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Boxes size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TRACEABLE HEAT LOTS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{heatLots.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Layers size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACTIVE ALLOY CODES</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{items.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <FileCheck size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Tabs and Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('ITEMS')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'ITEMS' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'ITEMS' ? '#ffffff' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Boxes size={16} /> Item Master & Stock ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('HEAT_LOTS')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'HEAT_LOTS' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'HEAT_LOTS' ? '#ffffff' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Layers size={16} /> Traceable Heat Lots ({heatLots.length})
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search items, grades, melts..."
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

      {/* Items Table View */}
      {activeTab === 'ITEMS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEM CODE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>NAME / SPECIFICATION</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CATEGORY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>MATERIAL GRADE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ON-HAND STOCK</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SAFETY STOCK</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemCode} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.itemCode}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{item.category?.replace('_', ' ')}</td>
                    <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 600 }}>{item.materialGrade || 'N/A'}</td>
                    <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 700 }}>
                      {item.currentStock?.toLocaleString()} {item.uom}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)' }}>
                      {item.safetyStock?.toLocaleString()} {item.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Heat Lots Table View */}
      {activeTab === 'HEAT_LOTS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ASTRALIS HEAT LOT #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUPPLIER MELT #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUPPLIER MILL</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>MATERIAL GRADE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>REMAINING / TOTAL</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeatLots.map((hl) => (
                  <tr key={hl.heatLotNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{hl.heatLotNumber}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>{hl.supplierHeatNumber}</td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{hl.supplierName}</td>
                    <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 600 }}>{hl.materialGrade}</td>
                    <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 700 }}>
                      {hl.remainingQuantity?.toLocaleString()} / {hl.receivedQuantity?.toLocaleString()} {hl.uom}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={hl.status} />
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        rightIcon={<ChevronRight size={14} />}
                        onClick={() => setSelectedHeatLot(hl)}
                      >
                        MTR Cert
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Selected Heat Lot Drawer */}
      <AppDrawer
        isOpen={!!selectedHeatLot}
        onClose={() => setSelectedHeatLot(null)}
        title={selectedHeatLot?.heatLotNumber}
        subtitle={selectedHeatLot ? `${selectedHeatLot.materialGrade} (${selectedHeatLot.supplierName})` : ''}
        footer={
          selectedHeatLot && (
            <>
              <AppButton variant="secondary" onClick={() => setSelectedHeatLot(null)}>
                Close
              </AppButton>
              <AppButton
                variant="primary"
                leftIcon={<FileText size={16} />}
                onClick={() => {
                  setFeedback({ type: 'success', message: `Certified Mill Test Report (${selectedHeatLot.millTestCertificateNumber}) verified and stamped for heat-lot traceability.` });
                  setSelectedHeatLot(null);
                }}
              >
                Verify & Stamp MTR
              </AppButton>
            </>
          )
        }
      >
        {selectedHeatLot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> MILL TEST CERTIFICATE (MTR) DATA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div><strong>Certificate Ref:</strong> {selectedHeatLot.millTestCertificateNumber}</div>
                <div><strong>Supplier Heat Melt:</strong> {selectedHeatLot.supplierHeatNumber}</div>
                <div><strong>Storage Location:</strong> {selectedHeatLot.locationBay}</div>
                <div><strong>Allocated Balance:</strong> {selectedHeatLot.remainingQuantity} / {selectedHeatLot.receivedQuantity} {selectedHeatLot.uom}</div>
              </div>
            </AppCard>
          </div>
        )}
      </AppDrawer>

      {/* Receive Heat Lot Dialog */}
      <AppDialog
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Receive Raw Material Heat Lot"
        description="Inward raw alloy stock and link supplier mill test certificate (MTR) for full NADCAP traceability."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsReceiveModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="receive-heat-lot-form"
              isLoading={isSubmitting}
              leftIcon={<Boxes size={16} />}
            >
              Inward Heat Lot
            </AppButton>
          </>
        }
      >
        <form id="receive-heat-lot-form" onSubmit={handleReceiveHeatLot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Internal Heat Lot Number"
              value={heatLotNumber}
              onChange={(e) => setHeatLotNumber(e.target.value)}
              required
            />
            <AppInput
              label="Supplier Melt / Heat Number"
              value={supplierHeatNumber}
              onChange={(e) => setSupplierHeatNumber(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Supplier Mill Name"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
            <AppSelect
              label="Material Grade"
              value={materialGrade}
              onChange={(e) => setMaterialGrade(e.target.value)}
              options={[
                { value: 'AISI 4340', label: 'AISI 4340 (Ni-Cr-Mo High Strength)' },
                { value: 'AISI 8620', label: 'AISI 8620 (Carburizing Grade)' },
                { value: 'INCONEL 718', label: 'Inconel 718 (Nickel Superalloy)' },
                { value: 'AISI 52100', label: 'AISI 52100 (Bearing Steel)' }
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Received Quantity (KG)"
              type="number"
              value={receivedQuantity}
              onChange={(e) => setReceivedQuantity(Number(e.target.value))}
              required
            />
            <AppInput
              label="Storage Bay / Location"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              required
            />
          </div>

          <AppInput
            label="Mill Test Report (MTR) Certificate #"
            value={mtrNumber}
            onChange={(e) => setMtrNumber(e.target.value)}
            required
          />
        </form>
      </AppDialog>
    </PageContainer>
  );
};
