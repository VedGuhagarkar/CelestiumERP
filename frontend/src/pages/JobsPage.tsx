import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  Layers,
  Thermometer,
  ChevronRight,
  X,
  PlayCircle
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';
import { getAuthHeaders } from '../utils/apiAuth.js';

interface ProductionJob {
  _id?: string;
  id?: string;
  jobNumber: string;
  customer: {
    customerId?: string;
    customerCode: string;
    customerName: string;
  };
  item: {
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
  status: 'DRAFT' | 'PLANNED' | 'SCHEDULED' | 'STAGED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  recipeSnapshot?: {
    recipeCode: string;
    name: string;
    processFamily: string;
    stages?: {
      stageSequence: number;
      stageName: string;
      stageType: string;
      targetTemperatureC: number;
      targetDurationMinutes: number;
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
  };
  materialAllocations?: {
    heatLotNumber: string;
    allocatedQuantity: number;
    uom: string;
  }[];
}

const DEFAULT_JOBS: ProductionJob[] = [
  {
    id: 'job_01',
    jobNumber: 'JOB-202608-0010',
    customer: { customerCode: 'CUST-AERO-01', customerName: 'AeroDynamics Propulsion Inc.' },
    item: { itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shafts 4340', materialGrade: 'AISI 4340', uom: 'PCS' },
    quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    recipeSnapshot: {
      recipeCode: 'REC-VAC-4340',
      name: 'Vacuum Austenitize & 2-Bar N2 Quench',
      processFamily: 'VACUUM_HEAT_TREATMENT',
      stages: [
        { stageSequence: 1, stageName: 'Preheat Ramp', stageType: 'PREHEAT', targetTemperatureC: 650, targetDurationMinutes: 45 },
        { stageSequence: 2, stageName: 'Austenitizing Soak', stageType: 'SOAK', targetTemperatureC: 845, targetDurationMinutes: 90 },
        { stageSequence: 3, stageName: 'High Pressure N2 Quench', stageType: 'QUENCH', targetTemperatureC: 45, targetDurationMinutes: 20 }
      ]
    },
    equipmentAssignment: { furnaceCode: 'FURNACE-VAC-01', locationBay: 'Bay 1 Vacuum Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 4 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() + 4 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 3.5 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HL-4340-2026A', allocatedQuantity: 850, uom: 'KG' }]
  },
  {
    id: 'job_02',
    jobNumber: 'JOB-202608-0011',
    customer: { customerCode: 'CUST-TITAN-02', customerName: 'Titan Precision Defense LLC' },
    item: { itemCode: 'PART-GEAR-8620', itemName: 'Case-Hardened Pinion Gears', materialGrade: 'AISI 8620', uom: 'PCS' },
    quantity: { targetQuantity: 250, loadedQuantity: 250, completedQuantity: 0, scrappedQuantity: 0 },
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    recipeSnapshot: {
      recipeCode: 'REC-CARB-8620',
      name: 'Atmospheric Gas Carburizing & Oil Quench',
      processFamily: 'CARBURIZING',
      stages: [
        { stageSequence: 1, stageName: 'Equalize Ramp', stageType: 'PREHEAT', targetTemperatureC: 850, targetDurationMinutes: 60 },
        { stageSequence: 2, stageName: 'Carburizing Boost/Diffuse', stageType: 'SOAK', targetTemperatureC: 930, targetDurationMinutes: 240 },
        { stageSequence: 3, stageName: 'Direct Oil Quench', stageType: 'QUENCH', targetTemperatureC: 60, targetDurationMinutes: 25 }
      ]
    },
    equipmentAssignment: { furnaceCode: 'FURNACE-PIT-01', locationBay: 'Bay 2 Carburizing Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 6 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() + 6 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 5.5 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HL-8620-2026B', allocatedQuantity: 1420, uom: 'KG' }]
  },
  {
    id: 'job_03',
    jobNumber: 'JOB-202608-0008',
    customer: { customerCode: 'CUST-APEX-03', customerName: 'Apex Automotive Drivetrains' },
    item: { itemCode: 'PART-GEAR-8620', itemName: 'Case-Hardened Pinion Gears', materialGrade: 'AISI 8620', uom: 'PCS' },
    quantity: { targetQuantity: 300, loadedQuantity: 300, completedQuantity: 300, scrappedQuantity: 0 },
    status: 'COMPLETED',
    priority: 'NORMAL',
    recipeSnapshot: { recipeCode: 'REC-CARB-8620', name: 'Atmospheric Gas Carburizing & Oil Quench', processFamily: 'CARBURIZING' },
    equipmentAssignment: { furnaceCode: 'FURNACE-SEAL-01', locationBay: 'Bay 3 Sealed Quench Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 28 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() - 14 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 26 * 3600000).toISOString(), actualCompletionDate: new Date(Date.now() - 14 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HL-8620-2026B', allocatedQuantity: 1650, uom: 'KG' }]
  },
  {
    id: 'job_04',
    jobNumber: 'JOB-202608-0009',
    customer: { customerCode: 'CUST-AERO-01', customerName: 'AeroDynamics Propulsion Inc.' },
    item: { itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shafts 4340', materialGrade: 'AISI 4340', uom: 'PCS' },
    quantity: { targetQuantity: 120, loadedQuantity: 120, completedQuantity: 120, scrappedQuantity: 0 },
    status: 'COMPLETED',
    priority: 'NORMAL',
    recipeSnapshot: { recipeCode: 'REC-VAC-4340', name: 'Vacuum Austenitize & 2-Bar N2 Quench', processFamily: 'VACUUM_HEAT_TREATMENT' },
    equipmentAssignment: { furnaceCode: 'FURNACE-VAC-01', locationBay: 'Bay 1 Vacuum Bay' },
    timeline: { plannedStartDate: new Date(Date.now() - 20 * 3600000).toISOString(), targetCompletionDate: new Date(Date.now() - 8 * 3600000).toISOString(), actualStartDate: new Date(Date.now() - 18 * 3600000).toISOString(), actualCompletionDate: new Date(Date.now() - 8 * 3600000).toISOString() },
    materialAllocations: [{ heatLotNumber: 'HL-4340-2026A', allocatedQuantity: 980, uom: 'KG' }]
  }
];

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<ProductionJob[]>(DEFAULT_JOBS);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${env.API_BASE_URL}/production-jobs`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setJobs(json.data);
        }
      }
    } catch {
      // Keep defaults on network/auth fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    const matchesSearch =
      job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.item.materialGrade.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.equipmentAssignment?.furnaceCode && job.equipmentAssignment.furnaceCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const inProgressCount = jobs.filter((j) => j.status === 'IN_PROGRESS').length;
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;
  const scheduledCount = jobs.filter((j) => j.status === 'SCHEDULED' || j.status === 'PLANNED').length;

  return (
    <PageContainer>
      <PageHeader
        title="Production Jobs & Thermal Batches"
        subtitle="Live furnace work orders, metallurgical recipes, soak execution, and batch traceability"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchJobs} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Flame size={14} />}>
              New Thermal Job
            </AppButton>
          </div>
        }
      />

      {/* Summary KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACTIVE JOBS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{jobs.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Flame size={20} />
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
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SCHEDULED / STAGED</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{scheduledCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <Clock size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>COMPLETED BATCHES</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{completedCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Filter and Search Bar */}
      <AppCard style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search job#, customer, material grade, furnace..."
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

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {['ALL', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'ON_HOLD'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  background: statusFilter === tab ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: statusFilter === tab ? '#ffffff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </AppCard>

      {/* Jobs Data Table */}
      <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JOB NUMBER</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEM & ALLOY GRADE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ASSIGNED FURNACE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BATCH QTY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PRIORITY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No matching production jobs found for criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    key={job.jobNumber}
                    onClick={() => setSelectedJob(job)}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flame size={15} style={{ color: 'var(--color-primary)' }} />
                        {job.jobNumber}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{job.customer.customerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{job.customer.customerCode}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#ffffff', fontWeight: 500 }}>{job.item.itemName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{job.item.materialGrade}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#e2e8f0'
                        }}
                      >
                        {job.equipmentAssignment?.furnaceCode || 'UNASSIGNED'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>
                      {job.quantity.loadedQuantity || job.quantity.targetQuantity} {job.item.uom}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: job.priority === 'URGENT' || job.priority === 'CRITICAL' ? '#ef4444' : job.priority === 'HIGH' ? '#f59e0b' : '#94a3b8',
                          background: job.priority === 'URGENT' || job.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : job.priority === 'HIGH' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.1)'
                        }}
                      >
                        {job.priority}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={job.status} />
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <AppButton variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}>
                        Details
                      </AppButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Selected Job Drawer / Modal */}
      {selectedJob && (
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
          onClick={() => setSelectedJob(null)}
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
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedJob.jobNumber}</span>
                  <StatusBadge status={selectedJob.status} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {selectedJob.customer.customerName} ({selectedJob.customer.customerCode})
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
                  padding: '8px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Recipe Info */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={14} /> METALLURGICAL THERMAL RECIPE
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{selectedJob.recipeSnapshot?.name || 'Standard Thermal Recipe'}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Recipe Code: {selectedJob.recipeSnapshot?.recipeCode} | Family: {selectedJob.recipeSnapshot?.processFamily}
              </div>

              {selectedJob.recipeSnapshot?.stages && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedJob.recipeSnapshot.stages.map((stg) => (
                    <div
                      key={stg.stageSequence}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {stg.stageSequence}. {stg.stageName}
                      </span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        {stg.targetTemperatureC}°C ({stg.targetDurationMinutes} min)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AppCard>

            {/* Material Heat Lot Traceability */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> MATERIAL & HEAT LOT ALLOCATION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Part Code & Grade</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedJob.item.itemCode} ({selectedJob.item.materialGrade})</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>Allocated Heat Lot</div>
                  <div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                    {selectedJob.materialAllocations?.[0]?.heatLotNumber || 'HL-4340-2026A'}
                  </div>
                </div>
              </div>
            </AppCard>

            {/* Equipment & Timeline */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> EQUIPMENT & CYCLE SCHEDULE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Furnace Unit</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedJob.equipmentAssignment?.furnaceCode}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Bay Location</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedJob.equipmentAssignment?.locationBay || 'Main Plant'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Planned Start</div>
                  <div style={{ color: '#ffffff' }}>{new Date(selectedJob.timeline.plannedStartDate).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Target Completion</div>
                  <div style={{ color: '#ffffff' }}>{new Date(selectedJob.timeline.targetCompletionDate).toLocaleString()}</div>
                </div>
              </div>
            </AppCard>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <AppButton variant="primary" style={{ flex: 1 }} leftIcon={<PlayCircle size={16} />}>
                Advance Thermal Cycle
              </AppButton>
              <AppButton variant="secondary" onClick={() => setSelectedJob(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
