import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { AppDialog } from '../design-system/feedback/AppDialog.js';
import { AppInput } from '../design-system/forms/AppInput.js';
import { AppSelect } from '../design-system/forms/AppSelect.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

interface WarehouseEntity {
  _id?: string;
  id?: string;
  warehouseCode: string;
  name: string;
  warehouseType: string;
  totalStorageCapacityKg?: number;
  currentUtilizationPercent?: number;
  bays?: {
    bayCode: string;
    name: string;
    bayType: string;
    currentOccupancyKg: number;
    capacityKg: number;
  }[];
}

const DEFAULT_WAREHOUSES: WarehouseEntity[] = [
  {
    id: 'wh_01',
    warehouseCode: 'WH-MAIN-01',
    name: 'Main Plant Thermal Processing Warehouse',
    warehouseType: 'MAIN_PLANT',
    totalStorageCapacityKg: 50000,
    currentUtilizationPercent: 62.5,
    bays: [
      { bayCode: 'BAY-01', name: 'Vacuum Raw Bar Stock Bay', bayType: 'RAW_MATERIAL_BAY', currentOccupancyKg: 6200, capacityKg: 15000 },
      { bayCode: 'BAY-02', name: 'Pit Carburizing Material Bay', bayType: 'RAW_MATERIAL_BAY', currentOccupancyKg: 8200, capacityKg: 20000 },
      { bayCode: 'BAY-03', name: 'Sealed Quench Staging Bay', bayType: 'WIP_STAGING_BAY', currentOccupancyKg: 4500, capacityKg: 10000 },
      { bayCode: 'BAY-04', name: 'Metallurgical Quarantine Bay', bayType: 'QUARANTINE_BAY', currentOccupancyKg: 450, capacityKg: 5000 }
    ]
  },
  {
    id: 'wh_02',
    warehouseCode: 'WH-FG-01',
    name: 'Finished Treated Goods & Outbound Shipping Warehouse',
    warehouseType: 'FINISHED_STORE',
    totalStorageCapacityKg: 30000,
    currentUtilizationPercent: 38.0,
    bays: [
      { bayCode: 'BAY-FG-A', name: 'Aerospace Inspected Staging Bay', bayType: 'FINISHED_GOODS_BAY', currentOccupancyKg: 2400, capacityKg: 12000 },
      { bayCode: 'BAY-FG-B', name: 'Automotive Bulk Packing Bay', bayType: 'FINISHED_GOODS_BAY', currentOccupancyKg: 4800, capacityKg: 18000 }
    ]
  }
];

export const WarehousePage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseEntity[]>(DEFAULT_WAREHOUSES);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Warehouse Bay Form State
  const [code, setCode] = useState('WH-RAW-02');
  const [name, setName] = useState('Secondary Alloy Raw Stock Yard');
  const [type, setType] = useState('RAW_MATERIAL_YARD');
  const [plantArea, setPlantArea] = useState('North Plant Yard');

  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/warehouses`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setWarehouses(
            json.data.map((w: any) => ({
              warehouseCode: w.code || w.warehouseCode || 'WH-01',
              name: w.name,
              warehouseType: w.type || w.warehouseType || 'MAIN_PLANT',
              totalStorageCapacityKg: w.totalStorageCapacityKg || 40000,
              currentUtilizationPercent: w.currentUtilizationPercent || 45,
              bays: w.bays || [
                { bayCode: `${w.code || 'BAY'}-01`, name: 'Standard Staging Bay', bayType: 'WIP_STAGING_BAY', currentOccupancyKg: 2000, capacityKg: 10000 }
              ]
            }))
          );
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        code,
        name,
        type,
        plantArea,
        description: 'Designated metallurgical staging and raw material storage location.'
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to add warehouse storage bay (status ${res.status})`);
      }

      setFeedback({ type: 'success', message: `Warehouse / Bay ${code} (${name}) successfully provisioned.` });
      setIsAddModalOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create warehouse bay' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Warehouse & Storage Bay Management"
        subtitle="Raw bar storage, WIP staging bays, Finished Goods (FG), and quarantine containment zones"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchWarehouses} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Warehouse size={14} />} onClick={() => setIsAddModalOpen(true)}>
              Add Storage Bay
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

      {/* Warehouses Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {warehouses.map((wh) => (
          <AppCard key={wh.warehouseCode} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Warehouse size={22} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{wh.warehouseCode}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                    {wh.warehouseType.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{wh.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Capacity: {(wh.totalStorageCapacityKg || 50000).toLocaleString()} KG</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>{wh.currentUtilizationPercent || 50}% Occupied</div>
              </div>
            </div>

            {/* Storage Bays Sub-Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {wh.bays?.map((bay) => {
                const occupancyPercent = Math.round((bay.currentOccupancyKg / (bay.capacityKg || 1)) * 100);
                const isQuarantine = bay.bayType === 'QUARANTINE_BAY';

                return (
                  <div
                    key={bay.bayCode}
                    style={{
                      background: isQuarantine ? 'rgba(239, 68, 68, 0.05)' : 'rgba(0, 0, 0, 0.25)',
                      border: isQuarantine ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isQuarantine ? '#ef4444' : '#ffffff' }}>
                        {bay.bayCode} - {bay.name}
                      </span>
                      {isQuarantine && <ShieldAlert size={16} style={{ color: '#ef4444' }} />}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{bay.bayType.replace('_', ' ')}</div>

                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        <span>Occupancy</span>
                        <span>{bay.currentOccupancyKg.toLocaleString()} / {(bay.capacityKg || 10000).toLocaleString()} KG ({occupancyPercent}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${occupancyPercent}%`,
                            height: '100%',
                            background: isQuarantine ? '#ef4444' : occupancyPercent > 80 ? '#f59e0b' : 'var(--color-primary)',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </AppCard>
        ))}
      </div>

      {/* Add Storage Bay Dialog */}
      <AppDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Storage Facility / Bay"
        description="Register a new storage bay, raw yard, or quarantine containment zone."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="add-warehouse-form"
              isLoading={isSubmitting}
              leftIcon={<Warehouse size={16} />}
            >
              Save Storage Bay
            </AppButton>
          </>
        }
      >
        <form id="add-warehouse-form" onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Warehouse Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <AppInput
              label="Facility Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppSelect
              label="Facility Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'RAW_MATERIAL_YARD', label: 'Raw Material Storage Yard' },
                { value: 'MAIN_PLANT', label: 'Main Heat Treatment Plant' },
                { value: 'FINISHED_STORE', label: 'Finished Treated Goods Store' },
                { value: 'GAS_YARD', label: 'Process Gas & Bulk N2 Yard' }
              ]}
            />
            <AppInput
              label="Plant Area / Bay"
              value={plantArea}
              onChange={(e) => setPlantArea(e.target.value)}
              required
            />
          </div>
        </form>
      </AppDialog>
    </PageContainer>
  );
};
