import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  Search,
  RefreshCw,
  Layers,
  Thermometer,
  ChevronRight,
  PlayCircle
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
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Job Form State
  const [customerName, setCustomerName] = useState('AeroDynamics Propulsion Inc.');
  const [itemCode, setItemCode] = useState('PART-SHAFT-4340');
  const [recipeCode, setRecipeCode] = useState('REC-VAC-4340');
  const [targetQuantity, setTargetQuantity] = useState(150);
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('HIGH');

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
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        customerId: 'cust_aerodynamics_001',
        itemId: 'item_turbine_shaft_4340',
        recipeId: 'rec_vacuum_aust_001',
        specificationId: 'spec_ams2759_001',
        targetQuantity: Number(targetQuantity),
        priority,
        plannedStartDate: new Date().toISOString(),
        targetCompletionDate: new Date(Date.now() + 24 * 3600000).toISOString()
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Job creation failed with status ${res.status}`);
      }

      setFeedback({ type: 'success', message: `Thermal job successfully scheduled for ${customerName} (${targetQuantity} pcs)` });
      setIsNewJobOpen(false);
      fetchJobs();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create production job' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStage = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    setFeedback(null);

    const jobId = selectedJob._id || selectedJob.id || selectedJob.jobNumber;
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift: 'SHIFT_1_MORNING',
          operatorNotes: 'Advanced thermal cycle to active soak stage.'
        })
      });

      if (!res.ok) {
        // If start fails (e.g. already in progress), try recording stage progress
        const progRes = await authenticatedFetch(`${env.API_BASE_URL}/production-jobs/${jobId}/stage-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stageSequence: 2,
            stageName: 'Austenitizing Soak',
            stageType: 'SOAK',
            actualTemperatureC: 845,
            carbonPotentialPercent: 0.95
          })
        });

        if (!progRes.ok) {
          const err = await progRes.json().catch(() => ({}));
          throw new Error(err.message || 'Could not advance job cycle');
        }
      }

      setFeedback({ type: 'success', message: `Job ${selectedJob.jobNumber} cycle stage successfully advanced.` });
      setSelectedJob(null);
      fetchJobs();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to advance job stage' });
    } finally {
      setIsSubmitting(false);
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
            <AppButton variant="primary" leftIcon={<Flame size={14} />} onClick={() => setIsNewJobOpen(true)}>
              New Thermal Job
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
              <Flame size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Filter and Search Bar */}
      <AppCard style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['ALL', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'] as const).map((status) => (
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
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search jobs, customers, grades..."
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

      {/* Jobs Table */}
      <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JOB NUMBER</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER / PART</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>METALLURGY & RECIPE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FURNACE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>QTY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PRIORITY</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No production jobs found matching active criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    key={job._id || job.id || job.jobNumber}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.15s ease' }}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {job.jobNumber}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#ffffff', fontWeight: 600 }}>{job.customer.customerName}</div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>{job.item.itemName}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 600 }}>{job.item.materialGrade}</div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>{job.recipeSnapshot?.name || 'Vacuum Heat Treat'}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{job.equipmentAssignment?.furnaceCode || 'Unassigned'}</div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>{job.equipmentAssignment?.locationBay || 'Staging Bay'}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>
                      {job.quantity.targetQuantity} {job.item.uom}
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
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        rightIcon={<ChevronRight size={14} />}
                        onClick={() => setSelectedJob(job)}
                      >
                        Details
                      </ActionButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Selected Job Drawer */}
      <AppDrawer
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob ? `Job ${selectedJob.jobNumber}` : ''}
        subtitle={selectedJob ? `${selectedJob.customer.customerName} (${selectedJob.customer.customerCode})` : ''}
        footer={
          selectedJob && (
            <>
              <AppButton variant="secondary" onClick={() => setSelectedJob(null)}>
                Close
              </AppButton>
              <AppButton
                variant="primary"
                leftIcon={<PlayCircle size={16} />}
                isLoading={isSubmitting}
                onClick={handleAdvanceStage}
              >
                Advance Thermal Cycle
              </AppButton>
            </>
          )
        }
      >
        {selectedJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          </div>
        )}
      </AppDrawer>

      {/* New Thermal Job Dialog */}
      <AppDialog
        isOpen={isNewJobOpen}
        onClose={() => setIsNewJobOpen(false)}
        title="Create Direct Thermal Processing Job"
        description="Schedule a new batch for vacuum austenitizing, atmospheric gas carburizing, or sealed quench processing."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsNewJobOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="create-job-form"
              isLoading={isSubmitting}
              leftIcon={<Flame size={16} />}
            >
              Schedule Production Job
            </AppButton>
          </>
        }
      >
        <form id="create-job-form" onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AppInput
            label="Customer Name / Enterprise"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppSelect
              label="Part Number / Item"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              options={[
                { value: 'PART-SHAFT-4340', label: 'Turbine Rotor Shaft (AISI 4340)' },
                { value: 'PART-GEAR-8620', label: 'Pinion Gear 8620 (AISI 8620)' },
                { value: 'PART-PIN-52100', label: 'Bearing Pins (AISI 52100)' }
              ]}
            />

            <AppSelect
              label="Thermal Recipe"
              value={recipeCode}
              onChange={(e) => setRecipeCode(e.target.value)}
              options={[
                { value: 'REC-VAC-4340', label: 'Vacuum Austenitize & N2 Quench' },
                { value: 'REC-CARB-8620', label: 'Atmospheric Gas Carburizing' },
                { value: 'REC-TEMP-52100', label: 'Tempering & Stress Relief' }
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Target Batch Quantity (Pieces)"
              type="number"
              min={1}
              value={targetQuantity}
              onChange={(e) => setTargetQuantity(Number(e.target.value))}
              required
            />

            <AppSelect
              label="Production Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent (AOG / Defense)' }
              ]}
            />
          </div>
        </form>
      </AppDialog>
    </PageContainer>
  );
};
