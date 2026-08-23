import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Search,
  RefreshCw,
  FileCheck,
  ChevronRight,
  X,
  Package
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';

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

  const fetchInventoryData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [resI, resH] = await Promise.all([
        fetch(`${env.API_BASE_URL}/items`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${env.API_BASE_URL}/heat-lots`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
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
            <AppButton variant="primary" leftIcon={<Boxes size={14} />}>
              Receive Heat Lot
            </AppButton>
          </div>
        }
      />

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
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>MTR COMPLIANCE</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>100%</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <FileCheck size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CATALOG ITEMS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{items.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <Package size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Tabs and Search */}
      <AppCard style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search item code, grade, supplier melt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--color-border-subtle)',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('ITEMS')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'ITEMS' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'ITEMS' ? '#ffffff' : 'var(--color-text-secondary)'
              }}
            >
              Catalog & Stock ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('HEAT_LOTS')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'HEAT_LOTS' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'HEAT_LOTS' ? '#ffffff' : 'var(--color-text-secondary)'
              }}
            >
              Heat Lots & MTRs ({heatLots.length})
            </button>
          </div>
        </div>
      </AppCard>

      {/* Tab 1: Catalog Items */}
      {activeTab === 'ITEMS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEM CODE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEM NAME</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CATEGORY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ALLOY GRADE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CURRENT STOCK</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SAFETY STOCK</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>UNIT COST</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemCode} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{item.itemCode}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>{item.name}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)' }}>{item.category.replace('_', ' ')}</td>
                    <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 700 }}>{item.materialGrade || 'N/A'}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#34d399' }}>{item.currentStock?.toLocaleString()} {item.uom}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-tertiary)' }}>{item.safetyStock?.toLocaleString()} {item.uom}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff' }}>${item.unitCost?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Tab 2: Heat Lots */}
      {activeTab === 'HEAT_LOTS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>HEAT LOT #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUPPLIER MELT #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUPPLIER MILL</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ALLOY GRADE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>REMAINING QTY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>LOCATION BAY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeatLots.map((hl) => (
                  <tr
                    key={hl.heatLotNumber}
                    onClick={() => setSelectedHeatLot(hl)}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={15} />
                        {hl.heatLotNumber}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0', fontWeight: 600 }}>{hl.supplierHeatNumber}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff' }}>{hl.supplierName}</td>
                    <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 700 }}>{hl.materialGrade}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#34d399' }}>{hl.remainingQuantity.toLocaleString()} {hl.uom}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)' }}>{hl.locationBay}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={hl.status} />
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <AppButton variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}>
                        MTR
                      </AppButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Selected Heat Lot Drawer */}
      {selectedHeatLot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 100
          }}
          onClick={() => setSelectedHeatLot(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: '#0f172a',
              borderLeft: '1px solid var(--color-border-subtle)',
              padding: '28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedHeatLot.heatLotNumber}</span>
                  <StatusBadge status={selectedHeatLot.status} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {selectedHeatLot.itemName} ({selectedHeatLot.materialGrade})
                </div>
              </div>
              <button
                onClick={() => setSelectedHeatLot(null)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: 'var(--radius-md)', color: '#ffffff', padding: '8px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mill Test Report Details */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> MILL TEST REPORT (MTR / CERTIFICATE OF ANALYSIS)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Supplier Mill</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedHeatLot.supplierName}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>MTR Doc Number</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedHeatLot.millTestCertificateNumber}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Initial Received</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedHeatLot.receivedQuantity.toLocaleString()} {selectedHeatLot.uom}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Remaining Balance</div>
                  <div style={{ color: '#34d399', fontWeight: 700 }}>{selectedHeatLot.remainingQuantity.toLocaleString()} {selectedHeatLot.uom}</div>
                </div>
              </div>
            </AppCard>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <AppButton variant="primary" style={{ flex: 1 }} leftIcon={<FileCheck size={16} />}>
                View Certified MTR PDF
              </AppButton>
              <AppButton variant="secondary" onClick={() => setSelectedHeatLot(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
