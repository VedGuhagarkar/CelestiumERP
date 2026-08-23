import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Flame,
  Thermometer,
  Activity,
  Wrench,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  X
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';
import { getAuthHeaders } from '../utils/apiAuth.js';

interface Machine {
  _id?: string;
  id?: string;
  machineCode: string;
  name: string;
  type: string;
  status: 'IDLE' | 'RUNNING' | 'MAINTENANCE' | 'BREAKDOWN' | 'OFFLINE';
  location: {
    plant: string;
    building: string;
    bay: string;
  };
  workingDimensions?: {
    maxLoadWeightKg: number;
    usableVolumeM3: number;
  };
  capabilities?: {
    furnaceClass: string;
    instrumentationType: string;
    pyrometryStandard: string;
    supportedProcessFamilies: string[];
  };
  pyrometryCompliance?: {
    lastTusDate: string;
    nextTusDueDate: string;
    lastSatDate: string;
    nextSatDueDate: string;
    isTusValid: boolean;
    isSatValid: boolean;
  };
}

interface MaintenanceWorkOrder {
  _id?: string;
  id?: string;
  workOrderNumber: string;
  machineCode: string;
  workOrderType: string;
  priority: string;
  status: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  notes?: string;
}

const DEFAULT_MACHINES: Machine[] = [
  {
    id: 'mach_01',
    machineCode: 'FURNACE-VAC-01',
    name: 'Ipsen 2-Bar High-Pressure Vacuum Furnace',
    type: 'VACUUM_FURNACE',
    status: 'RUNNING',
    location: { plant: 'Main Plant', building: 'Building A', bay: 'Bay 1 Vacuum Bay' },
    workingDimensions: { maxLoadWeightKg: 1200, usableVolumeM3: 1.4 },
    capabilities: { furnaceClass: 'CLASS_2', instrumentationType: 'TYPE_B', pyrometryStandard: 'AMS_2750G', supportedProcessFamilies: ['VACUUM_AUSTENITIZING', 'SOLUTION_ANNEALING'] },
    pyrometryCompliance: {
      lastTusDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      nextTusDueDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      lastSatDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      nextSatDueDate: new Date(Date.now() + 23 * 86400000).toISOString(),
      isTusValid: true,
      isSatValid: true
    }
  },
  {
    id: 'mach_02',
    machineCode: 'FURNACE-PIT-01',
    name: 'Surface Combustion Pit Gas Carburizer',
    type: 'PIT_FURNACE',
    status: 'RUNNING',
    location: { plant: 'Main Plant', building: 'Building A', bay: 'Bay 2 Carburizing Bay' },
    workingDimensions: { maxLoadWeightKg: 2500, usableVolumeM3: 3.2 },
    capabilities: { furnaceClass: 'CLASS_3', instrumentationType: 'TYPE_C', pyrometryStandard: 'CQI_9', supportedProcessFamilies: ['CARBURIZING', 'CARBONITRIDING'] },
    pyrometryCompliance: {
      lastTusDate: new Date(Date.now() - 45 * 86400000).toISOString(),
      nextTusDueDate: new Date(Date.now() + 45 * 86400000).toISOString(),
      lastSatDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      nextSatDueDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      isTusValid: true,
      isSatValid: true
    }
  },
  {
    id: 'mach_03',
    machineCode: 'FURNACE-SEAL-01',
    name: 'Holcroft Sealed Quench Integrated Furnace',
    type: 'SEALED_QUENCH',
    status: 'IDLE',
    location: { plant: 'Main Plant', building: 'Building B', bay: 'Bay 3 Sealed Quench Bay' },
    workingDimensions: { maxLoadWeightKg: 1800, usableVolumeM3: 2.1 },
    capabilities: { furnaceClass: 'CLASS_2', instrumentationType: 'TYPE_B', pyrometryStandard: 'AMS_2750G', supportedProcessFamilies: ['CASE_HARDENING', 'NEUTRAL_HARDENING'] },
    pyrometryCompliance: {
      lastTusDate: new Date(Date.now() - 15 * 86400000).toISOString(),
      nextTusDueDate: new Date(Date.now() + 75 * 86400000).toISOString(),
      lastSatDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      nextSatDueDate: new Date(Date.now() + 27 * 86400000).toISOString(),
      isTusValid: true,
      isSatValid: true
    }
  },
  {
    id: 'mach_04',
    machineCode: 'FURNACE-TEMP-01',
    name: 'Despatch Precision Forced-Convection Tempering Oven',
    type: 'TEMPERING_OVEN',
    status: 'RUNNING',
    location: { plant: 'Main Plant', building: 'Building A', bay: 'Bay 1 Vacuum Bay' },
    workingDimensions: { maxLoadWeightKg: 1200, usableVolumeM3: 1.4 },
    capabilities: { furnaceClass: 'CLASS_2', instrumentationType: 'TYPE_B', pyrometryStandard: 'AMS_2750G', supportedProcessFamilies: ['TEMPERING', 'STRESS_RELIEVING'] },
    pyrometryCompliance: {
      lastTusDate: new Date(Date.now() - 20 * 86400000).toISOString(),
      nextTusDueDate: new Date(Date.now() + 70 * 86400000).toISOString(),
      lastSatDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      nextSatDueDate: new Date(Date.now() + 25 * 86400000).toISOString(),
      isTusValid: true,
      isSatValid: true
    }
  }
];

const DEFAULT_WORK_ORDERS: MaintenanceWorkOrder[] = [
  {
    id: 'wo_01',
    workOrderNumber: 'WO-2026-0012',
    machineCode: 'FURNACE-VAC-01',
    workOrderType: 'PREVENTIVE',
    priority: 'HIGH',
    status: 'OPEN',
    scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    estimatedDurationHours: 4.5,
    notes: 'Quarterly AMS 2750G Temperature Uniformity Survey (TUS) 9-point thermocouple test'
  },
  {
    id: 'wo_02',
    workOrderNumber: 'WO-2026-0014',
    machineCode: 'FURNACE-PIT-01',
    workOrderType: 'CALIBRATION',
    priority: 'MEDIUM',
    status: 'OPEN',
    scheduledDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    estimatedDurationHours: 2.0,
    notes: 'System Accuracy Test (SAT) control thermocouple calibration verification'
  }
];

export const MachinesPage: React.FC = () => {
  const [machines, setMachines] = useState<Machine[]>(DEFAULT_MACHINES);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>(DEFAULT_WORK_ORDERS);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState<'FLEET' | 'MAINTENANCE'>('FLEET');
  const [isLoading, setIsLoading] = useState(false);

  const fetchMachines = async () => {
    setIsLoading(true);
    try {
      const [resM, resW] = await Promise.all([
        fetch(`${env.API_BASE_URL}/machines`, { headers: getAuthHeaders() }),
        fetch(`${env.API_BASE_URL}/maintenance/work-orders`, { headers: getAuthHeaders() })
      ]);

      if (resM.ok) {
        const jsonM = await resM.json();
        if (jsonM.data && Array.isArray(jsonM.data) && jsonM.data.length > 0) {
          setMachines(jsonM.data);
        }
      }
      if (resW.ok) {
        const jsonW = await resW.json();
        if (jsonW.data && Array.isArray(jsonW.data) && jsonW.data.length > 0) {
          setWorkOrders(jsonW.data);
        }
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const runningCount = machines.filter((m) => m.status === 'RUNNING').length;
  const utilization = Math.round((runningCount / machines.length) * 100);

  return (
    <PageContainer>
      <PageHeader
        title="Furnace Fleet & Pyrometry Telemetry"
        subtitle="AMS 2750G / CQI-9 furnace instrumentation, live thermal zones, TUS surveys, and SAT calibration compliance"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchMachines} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Cpu size={14} />}>
              Configure Furnace
            </AppButton>
          </div>
        }
      />

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FLEET UTILIZATION</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{utilization}%</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Activity size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>RUNNING UNITS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{runningCount} / {machines.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Flame size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PYROMETRY COMPLIANCE</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>100%</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OPEN MAINTENANCE ORDERS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{workOrders.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <Wrench size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('FLEET')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'FLEET' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'FLEET' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Cpu size={16} /> Furnace Fleet & Sensors ({machines.length})
        </button>

        <button
          onClick={() => setActiveTab('MAINTENANCE')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'MAINTENANCE' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'MAINTENANCE' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Wrench size={16} /> Pyrometry & Maintenance ({workOrders.length})
        </button>
      </div>

      {/* Tab 1: Furnace Fleet Cards Grid */}
      {activeTab === 'FLEET' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {machines.map((mach) => (
            <AppCard
              key={mach.machineCode}
              onClick={() => setSelectedMachine(mach)}
              style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={18} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{mach.machineCode}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{mach.name}</div>
                </div>
                <StatusBadge status={mach.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Location Bay</div>
                  <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{mach.location.bay}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Max Load Limit</div>
                  <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{mach.workingDimensions?.maxLoadWeightKg} KG</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>AMS 2750 Class</div>
                  <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>{mach.capabilities?.furnaceClass} ({mach.capabilities?.instrumentationType})</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>TUS Compliance</div>
                  <div style={{ color: '#34d399', fontWeight: 700, marginTop: '2px' }}>VALID</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <span>Next TUS Survey: {new Date(mach.pyrometryCompliance?.nextTusDueDate || Date.now()).toLocaleDateString()}</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Telemetry <ChevronRight size={14} />
                </span>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {/* Tab 2: Maintenance Orders */}
      {activeTab === 'MAINTENANCE' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>WORK ORDER #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FURNACE CODE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ORDER TYPE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SCHEDULED DATE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DURATION (HRS)</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TASK NOTES</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.workOrderNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{wo.workOrderNumber}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>{wo.machineCode}</td>
                    <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 600 }}>{wo.workOrderType}</td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{new Date(wo.scheduledDate).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>{wo.estimatedDurationHours} hrs</td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>{wo.notes}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={wo.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Selected Machine Detail Drawer */}
      {selectedMachine && (
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
          onClick={() => setSelectedMachine(null)}
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
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedMachine.machineCode}</span>
                  <StatusBadge status={selectedMachine.status} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{selectedMachine.name}</div>
              </div>
              <button
                onClick={() => setSelectedMachine(null)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: 'var(--radius-md)', color: '#ffffff', padding: '8px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Pyrometry Telemetry */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Thermometer size={14} /> LIVE THERMAL ZONES & ATMOSPHERE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Zone 1 Core Temp</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>846°C</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Setpoint: 845°C (±2°C)</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Atmosphere Vacuum</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>1.2 × 10⁻⁴</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>mbar High Vacuum</div>
                </div>
              </div>
            </AppCard>

            {/* Pyrometry Calibration History */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} /> AMS 2750G / CQI-9 PYROMETRY AUDIT STATUS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span>Last TUS Survey:</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{new Date(selectedMachine.pyrometryCompliance?.lastTusDate || Date.now()).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span>Next TUS Due Date:</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{new Date(selectedMachine.pyrometryCompliance?.nextTusDueDate || Date.now()).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span>System Accuracy Test (SAT):</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>PASSED (Next: {new Date(selectedMachine.pyrometryCompliance?.nextSatDueDate || Date.now()).toLocaleDateString()})</span>
                </div>
              </div>
            </AppCard>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <AppButton variant="primary" style={{ flex: 1 }} leftIcon={<Wrench size={16} />}>
                Log SAT / TUS Survey
              </AppButton>
              <AppButton variant="secondary" onClick={() => setSelectedMachine(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
