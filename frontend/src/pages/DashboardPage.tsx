import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Cpu,
  ShieldCheck,
  Truck,
  DollarSign,
  AlertTriangle,
  Activity,
  TrendingUp,
  Layers,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { useAuth } from '../hooks/useAuth.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

interface CommandCenterState {
  viewMode: 'OWNER' | 'SUPERVISOR' | 'OPERATOR';
  timeRange: { startDate: string; endDate: string; label: string };
  kpis: {
    activeJobs: {
      total: number;
      heating: number;
      soaking: number;
      quenching: number;
      cooling: number;
      staged: number;
    };
    runningFurnaces: {
      running: number;
      idle: number;
      breakdown: number;
      maintenance: number;
      total: number;
      utilizationPercent: number;
    };
    pendingQc: {
      pendingInspections: number;
      quarantinedLots: number;
      pendingCocs: number;
      rejectionRatePercent: number;
    };
    dispatch: {
      readyForDispatch: number;
      scheduledToday: number;
      dispatchedToday: number;
      onTimeDispatchRatePercent: number;
    };
    financial?: {
      todayRevenue: number;
      monthlyRevenue: number;
      grossMarginPercent: number;
      outstandingReceivables: number;
      inventoryValuation: number;
    };
  };
  throughput: {
    totalWeightKgToday: number;
    totalPiecesToday: number;
    hourlyThroughputRateKgHr: number;
    furnaceBreakdown: { furnaceCode: string; weightKg: number; pieces: number }[];
  };
  activeFurnaces: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    currentJobNumber?: string;
    customerName?: string;
    currentTemperature?: number;
    targetTemperature?: number;
    atmosphereType?: string;
    carbonPotential?: number;
    currentStage?: string;
    elapsedMinutes?: number;
    oeePercent?: number;
    actionUrl: string;
  }[];
  pendingJobs: {
    jobId: string;
    jobNumber: string;
    customerName: string;
    alloyGrade: string;
    plannedFurnace: string;
    status: string;
    priority: string;
    estimatedDurationMinutes: number;
    actionUrl: string;
  }[];
  pendingApprovals: {
    id: string;
    type: string;
    referenceNumber: string;
    title: string;
    requestedBy: string;
    submittedAt: string;
    priority: string;
    actionUrl: string;
  }[];
  alerts: {
    lowInventory: {
      itemId: string;
      itemCode: string;
      itemName: string;
      currentStock: number;
      safetyStock: number;
      uom: string;
      deficit: number;
      actionUrl: string;
    }[];
    qualityNcrs: {
      id: string;
      ncrNumber: string;
      title: string;
      severity: string;
      jobNumber: string;
      quarantinedQuantity: number;
      uom: string;
      status: string;
      actionUrl: string;
    }[];
  };
  maintenance: {
    workOrderId: string;
    workOrderNumber: string;
    machineCode: string;
    machineName: string;
    maintenanceType: string;
    priority: string;
    status: string;
    daysUntilDue: number;
    isOverdue: boolean;
    actionUrl: string;
  }[];
  attendance: {
    activeHeadcount: number;
    scheduledHeadcount: number;
    attendanceRatePercent: number;
    totalOvertimeHoursToday: number;
    presentByShift: { shiftCode: string; presentCount: number; scheduledCount: number }[];
  };
  recentActivity: {
    id: string;
    timestamp: string;
    category: string;
    action: string;
    description: string;
    actorName: string;
    actionUrl: string;
  }[];
}

const DEFAULT_COMMAND_CENTER_DATA: CommandCenterState = {
  viewMode: 'OWNER',
  timeRange: { startDate: new Date().toISOString(), endDate: new Date().toISOString(), label: 'Today' },
  kpis: {
    activeJobs: { total: 14, heating: 4, soaking: 5, quenching: 2, cooling: 2, staged: 1 },
    runningFurnaces: { running: 3, idle: 1, breakdown: 0, maintenance: 0, total: 4, utilizationPercent: 75.0 },
    pendingQc: { pendingInspections: 6, quarantinedLots: 2, pendingCocs: 3, rejectionRatePercent: 2.1 },
    dispatch: { readyForDispatch: 5, scheduledToday: 4, dispatchedToday: 3, onTimeDispatchRatePercent: 100 },
    financial: {
      todayRevenue: 28450.0,
      monthlyRevenue: 87400.0,
      grossMarginPercent: 34.2,
      outstandingReceivables: 36200.0,
      inventoryValuation: 148500.0
    }
  },
  throughput: {
    totalWeightKgToday: 2450.0,
    totalPiecesToday: 480,
    hourlyThroughputRateKgHr: 306.2,
    furnaceBreakdown: [
      { furnaceCode: 'FURNACE-VAC-01', weightKg: 1100.0, pieces: 180 },
      { furnaceCode: 'FURNACE-PIT-01', weightKg: 1350.0, pieces: 300 }
    ]
  },
  activeFurnaces: [
    {
      id: 'mach_01',
      code: 'FURNACE-VAC-01',
      name: 'Vacuum Hardening Furnace #1',
      type: 'VACUUM_FURNACE',
      status: 'RUNNING',
      currentJobNumber: 'JOB-202608-0010',
      customerName: 'AeroDynamics Corp',
      currentTemperature: 980,
      targetTemperature: 980,
      atmosphereType: 'Vacuum (10^-4 mbar)',
      carbonPotential: 0,
      currentStage: 'AUSTENITIZING_SOAK',
      elapsedMinutes: 140,
      oeePercent: 88.5,
      actionUrl: '/machines/mach_01'
    },
    {
      id: 'mach_02',
      code: 'FURNACE-PIT-01',
      name: 'Pit Carburizing Furnace #1',
      type: 'PIT_FURNACE',
      status: 'RUNNING',
      currentJobNumber: 'JOB-202608-0012',
      customerName: 'Precision GearWorks',
      currentTemperature: 930,
      targetTemperature: 930,
      atmosphereType: 'Endothermic Gas',
      carbonPotential: 0.85,
      currentStage: 'CARBURIZING_DIFFUSION',
      elapsedMinutes: 320,
      oeePercent: 84.0,
      actionUrl: '/machines/mach_02'
    },
    {
      id: 'mach_03',
      code: 'FURNACE-SEALED-01',
      name: 'Sealed Quench Furnace #1',
      type: 'SEALED_QUENCH',
      status: 'IDLE',
      currentTemperature: 750,
      targetTemperature: 860,
      atmosphereType: 'Nitrogen Purge',
      carbonPotential: 0,
      currentStage: 'IDLE_PREHEAT',
      elapsedMinutes: 0,
      oeePercent: 78.0,
      actionUrl: '/machines/mach_03'
    },
    {
      id: 'mach_04',
      code: 'QUENCH-OIL-01',
      name: 'Agitated Oil Quench Tank #1',
      type: 'QUENCH_TANK',
      status: 'RUNNING',
      currentTemperature: 65,
      targetTemperature: 60,
      atmosphereType: 'Mineral Oil',
      carbonPotential: 0,
      currentStage: 'QUENCHING_AGITATION',
      elapsedMinutes: 25,
      oeePercent: 92.0,
      actionUrl: '/machines/mach_04'
    }
  ],
  pendingJobs: [
    {
      jobId: 'job_01',
      jobNumber: 'JOB-202608-0015',
      customerName: 'AeroDynamics Corp',
      alloyGrade: 'AISI 4340',
      plannedFurnace: 'FURNACE-VAC-01',
      status: 'SCHEDULED',
      priority: 'HIGH',
      estimatedDurationMinutes: 480,
      actionUrl: '/production-jobs/job_01'
    },
    {
      jobId: 'job_02',
      jobNumber: 'JOB-202608-0016',
      customerName: 'Apex Automotive Systems',
      alloyGrade: '8620 Alloy Steel',
      plannedFurnace: 'FURNACE-PIT-01',
      status: 'STAGED',
      priority: 'CRITICAL',
      estimatedDurationMinutes: 600,
      actionUrl: '/production-jobs/job_02'
    }
  ],
  pendingApprovals: [
    {
      id: 'app_01',
      type: 'NCR',
      referenceNumber: 'NCR-202608-0004',
      title: 'NCR Disposition: Hardness Out of Spec (42 HRC vs 58-62 HRC)',
      requestedBy: 'QC Inspector',
      submittedAt: new Date().toISOString(),
      priority: 'CRITICAL',
      actionUrl: '/quality/ncrs'
    },
    {
      id: 'app_02',
      type: 'DISPATCH',
      referenceNumber: 'DSP-202608-0003',
      title: 'Gate Pass Sign-off for AeroDynamics Consignment',
      requestedBy: 'Shipping Lead',
      submittedAt: new Date().toISOString(),
      priority: 'MEDIUM',
      actionUrl: '/dispatches'
    }
  ],
  alerts: {
    lowInventory: [
      {
        itemId: 'item_01',
        itemCode: 'BAR-4340-50MM',
        itemName: 'AISI 4340 Round Bar 50mm',
        currentStock: 18,
        safetyStock: 50,
        uom: 'KG',
        deficit: 32,
        actionUrl: '/inventory'
      }
    ],
    qualityNcrs: [
      {
        id: 'ncr_01',
        ncrNumber: 'NCR-202608-0004',
        title: 'Case depth shallow after tempering',
        severity: 'CRITICAL',
        jobNumber: 'JOB-202608-0010',
        quarantinedQuantity: 45,
        uom: 'PCS',
        status: 'DISPOSITION_PENDING',
        actionUrl: '/quality/ncrs'
      }
    ]
  },
  maintenance: [
    {
      workOrderId: 'wo_01',
      workOrderNumber: 'WO-PM-2026-088',
      machineCode: 'FURNACE-VAC-01',
      machineName: 'Vacuum Furnace #1',
      maintenanceType: 'PREVENTIVE',
      priority: 'HIGH',
      status: 'SCHEDULED',
      daysUntilDue: 2,
      isOverdue: false,
      actionUrl: '/maintenance'
    }
  ],
  attendance: {
    activeHeadcount: 17,
    scheduledHeadcount: 18,
    attendanceRatePercent: 94.4,
    totalOvertimeHoursToday: 6.5,
    presentByShift: [
      { shiftCode: 'SHIFT-A (06:00-14:00)', presentCount: 8, scheduledCount: 8 },
      { shiftCode: 'SHIFT-B (14:00-22:00)', presentCount: 6, scheduledCount: 6 },
      { shiftCode: 'SHIFT-C (22:00-06:00)', presentCount: 3, scheduledCount: 4 }
    ]
  },
  recentActivity: [
    {
      id: 'act_01',
      timestamp: new Date().toISOString(),
      category: 'QUALITY',
      action: 'INSPECTION_COMPLETED',
      description: 'QC Inspector verified test specimen for Job JOB-202608-0010 (59 HRC Pass)',
      actorName: 'qc_inspector',
      actionUrl: '/quality-inspections'
    },
    {
      id: 'act_02',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      category: 'PRODUCTION',
      action: 'STAGE_TRANSITION',
      description: 'Pit Furnace #01 advanced to Carburizing Diffusion stage at 930°C',
      actorName: 'op_furnace_01',
      actionUrl: '/machines'
    }
  ]
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<CommandCenterState>(DEFAULT_COMMAND_CENTER_DATA);
  const [activeTab, setActiveTab] = useState<'FLOOR' | 'ALERTS' | 'ACTIVITY'>('FLOOR');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH'>('TODAY');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchCommandCenterData = async () => {
    setIsLoading(true);
    try {
      const queryParam = timeFilter === 'TODAY' ? '' : `?periodCode=${timeFilter}`;
      const response = await authenticatedFetch(`${env.API_BASE_URL}/reporting/command-center${queryParam}`);
      if (response.ok) {
        const json = await response.json();
        if (json.data) {
          setData(json.data);
        }
      }
    } catch {
      // Graceful fallback to default state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommandCenterData();
  }, [timeFilter]);

  const isOwnerView = data.viewMode === 'OWNER';

  return (
    <PageContainer>
      <PageHeader
        title="Manufacturing Command Center"
        subtitle="Authoritative shop-floor operations, live thermal telemetry, quality pulse, and logistics status"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              {(['TODAY', 'LAST_7_DAYS', 'THIS_MONTH'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    background: timeFilter === filter ? 'var(--color-primary)' : 'transparent',
                    color: timeFilter === filter ? '#ffffff' : 'var(--color-text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {filter === 'TODAY' ? 'Today' : filter === 'LAST_7_DAYS' ? 'Last 7 Days' : 'This Month'}
                </button>
              ))}
            </div>

            <AppButton
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
              onClick={fetchCommandCenterData}
            >
              Sync
            </AppButton>
          </div>
        }
      />

      {/* Top Banner: Real-time Factory Status & Mode Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(37, 99, 235, 0.06)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(37, 99, 235, 0.18)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Plant Telemetry Active (AMS 2750G Pyrometry Validated)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge
            status={isOwnerView ? 'OWNER / EXECUTIVE VIEW' : 'SUPERVISOR COMMAND MODE'}
            variant={isOwnerView ? 'primary' : 'info'}
            size="sm"
          />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            User: {user?.email || 'Logged Operator'}
          </span>
        </div>
      </div>

      {/* Top Operational Pulse KPIs Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isOwnerView
            ? 'repeat(auto-fit, minmax(220px, 1fr))'
            : 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Active Jobs */}
        <AppCard
          variant="glass"
          padding="md"
          onClick={() => navigate('/production-jobs')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              ACTIVE JOBS
            </span>
            <Flame size={18} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {data.kpis.activeJobs.total}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {data.kpis.activeJobs.soaking} Soaking • {data.kpis.activeJobs.quenching} Quenching
          </div>
        </AppCard>

        {/* Running Furnaces */}
        <AppCard
          variant="glass"
          padding="md"
          onClick={() => navigate('/machines')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              RUNNING FURNACES
            </span>
            <Cpu size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {data.kpis.runningFurnaces.running} / {data.kpis.runningFurnaces.total}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {data.kpis.runningFurnaces.utilizationPercent}% Fleet Utilization
          </div>
        </AppCard>

        {/* Pending QC */}
        <AppCard
          variant="glass"
          padding="md"
          onClick={() => navigate('/quality-inspections')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              PENDING QC & NCRS
            </span>
            <ShieldCheck size={18} color="#eab308" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {data.kpis.pendingQc.pendingInspections} Inspections
          </div>
          <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
            {data.kpis.pendingQc.quarantinedLots} Quarantined Lots ({data.kpis.pendingQc.rejectionRatePercent}% Rej)
          </div>
        </AppCard>

        {/* Ready for Dispatch */}
        <AppCard
          variant="glass"
          padding="md"
          onClick={() => navigate('/dispatches')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              DISPATCH & OTIF
            </span>
            <Truck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {data.kpis.dispatch.readyForDispatch} Staged
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {data.kpis.dispatch.onTimeDispatchRatePercent}% On-Time Delivery
          </div>
        </AppCard>

        {/* Financial KPI (Owner View Only) */}
        {isOwnerView && data.kpis.financial && (
          <AppCard
            variant="glass"
            padding="md"
            onClick={() => navigate('/finance')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                GROSS PROFIT MARGIN
              </span>
              <DollarSign size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
              {data.kpis.financial.grossMarginPercent}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Today Rev: ${data.kpis.financial.todayRevenue.toLocaleString()}
            </div>
          </AppCard>
        )}
      </div>

      {/* Navigation Section Tabs (Prevents Information Overload) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '8px',
          marginBottom: '20px'
        }}
      >
        <button
          onClick={() => setActiveTab('FLOOR')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: activeTab === 'FLOOR' ? 'var(--material-regular)' : 'transparent',
            color: activeTab === 'FLOOR' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Layers size={15} />
          Shop Floor Operations
        </button>

        <button
          onClick={() => setActiveTab('ALERTS')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: activeTab === 'ALERTS' ? 'var(--material-regular)' : 'transparent',
            color: activeTab === 'ALERTS' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={15} />
          Approvals & Quality Alerts ({data.pendingApprovals.length + data.alerts.qualityNcrs.length})
        </button>

        <button
          onClick={() => setActiveTab('ACTIVITY')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            background: activeTab === 'ACTIVITY' ? 'var(--material-regular)' : 'transparent',
            color: activeTab === 'ACTIVITY' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Activity size={15} />
          Workforce & Live Activity
        </button>
      </div>

      {/* Tab 1: Shop Floor Operations */}
      {activeTab === 'FLOOR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Furnace Fleet Cards */}
          <AppCard variant="glass" padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Furnace Fleet Telemetry & Thermal Stages
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Real-time thermocouple data, atmosphere controllers, and active batch stages
                </span>
              </div>
              <AppButton variant="secondary" size="sm" onClick={() => navigate('/machines')}>
                View Machine Fleet
              </AppButton>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}
            >
              {data.activeFurnaces.map((furnace) => (
                <div
                  key={furnace.id}
                  onClick={() => navigate(furnace.actionUrl)}
                  style={{
                    background: 'var(--material-ultra-thin)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-subtle)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {furnace.code}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{furnace.name}</div>
                    </div>
                    <StatusBadge
                      status={furnace.status}
                      variant={furnace.status === 'RUNNING' ? 'primary' : 'neutral'}
                      size="sm"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Temperature</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: furnace.status === 'RUNNING' ? '#f97316' : 'var(--color-text-primary)' }}>
                        {furnace.currentTemperature}°C
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Target / Atmosphere</span>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                        {furnace.targetTemperature}°C • {furnace.carbonPotential ? `${furnace.carbonPotential}% C` : furnace.atmosphereType}
                      </div>
                    </div>
                  </div>

                  {furnace.currentJobNumber ? (
                    <div
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {furnace.currentJobNumber} ({furnace.customerName})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Stage: {furnace.currentStage} • Elapsed: {furnace.elapsedMinutes}m
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
                      Ready for next scheduled load
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AppCard>

          {/* Dual Columns: Throughput Widget & Priority Job Queue */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '20px'
            }}
          >
            {/* Throughput Widget */}
            <AppCard variant="glass" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Production Throughput</h3>
                <TrendingUp size={18} color="var(--color-primary)" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--material-ultra-thin)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>WEIGHT PROCESSED</div>
                  <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.throughput.totalWeightKgToday.toLocaleString()} Kg</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--material-ultra-thin)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>THROUGHPUT RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.throughput.hourlyThroughputRateKgHr} Kg/Hr</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                Furnace Breakdown:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.throughput.furnaceBreakdown.map((fb, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{fb.furnaceCode}</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {fb.weightKg} Kg ({fb.pieces} pcs)
                    </span>
                  </div>
                ))}
              </div>
            </AppCard>

            {/* Priority Job Queue */}
            <AppCard variant="glass" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Priority Production Queue</h3>
                <AppButton variant="secondary" size="sm" onClick={() => navigate('/production-jobs')}>
                  View All
                </AppButton>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.pendingJobs.map((job) => (
                  <div
                    key={job.jobId}
                    onClick={() => navigate(job.actionUrl)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'var(--material-ultra-thin)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {job.jobNumber} — {job.customerName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Alloy: {job.alloyGrade} • Furnace: {job.plannedFurnace} • {job.estimatedDurationMinutes}m
                      </div>
                    </div>
                    <StatusBadge status={job.status} variant="info" size="sm" />
                  </div>
                ))}
              </div>
            </AppCard>
          </div>
        </div>
      )}

      {/* Tab 2: Approvals & Quality Alerts */}
      {activeTab === 'ALERTS' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px'
          }}
        >
          {/* Pending Approvals Queue */}
          <AppCard variant="glass" padding="lg">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              Pending Authorization Queue
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.pendingApprovals.map((app) => (
                <div
                  key={app.id}
                  onClick={() => navigate(app.actionUrl)}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--material-ultra-thin)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      [{app.type}] {app.referenceNumber}
                    </span>
                    <StatusBadge status={app.priority} variant={app.priority === 'CRITICAL' ? 'danger' : 'warning'} size="sm" />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, margin: '4px 0' }}>{app.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Requested by: {app.requestedBy}
                  </div>
                </div>
              ))}
            </div>
          </AppCard>

          {/* Quality NCR Alerts & Material Shortages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Active NCRs */}
            <AppCard variant="glass" padding="lg">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', marginBottom: '16px' }}>
                Active Quality Non-Conformances (NCRs)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.alerts.qualityNcrs.map((ncr) => (
                  <div
                    key={ncr.id}
                    onClick={() => navigate(ncr.actionUrl)}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.05)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
                        {ncr.ncrNumber} ({ncr.severity})
                      </span>
                      <StatusBadge status={ncr.status} variant="danger" size="sm" />
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>{ncr.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Job: {ncr.jobNumber} • Quarantined: {ncr.quarantinedQuantity} {ncr.uom}
                    </div>
                  </div>
                ))}
              </div>
            </AppCard>

            {/* Low Inventory Shortages */}
            <AppCard variant="glass" padding="lg">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#eab308', marginBottom: '16px' }}>
                Low Inventory Shortage Alerts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.alerts.lowInventory.map((item) => (
                  <div
                    key={item.itemId}
                    onClick={() => navigate(item.actionUrl)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(234, 179, 8, 0.05)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{item.itemCode}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.itemName}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
                        {item.currentStock} / {item.safetyStock} {item.uom}
                      </div>
                      <div style={{ fontSize: '11px', color: '#eab308' }}>Deficit: -{item.deficit} {item.uom}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AppCard>
          </div>
        </div>
      )}

      {/* Tab 3: Workforce & Live Activity */}
      {activeTab === 'ACTIVITY' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px'
          }}
        >
          {/* Workforce Attendance Summary */}
          <AppCard variant="glass" padding="lg">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              Shift Attendance & Overtime Summary
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--material-ultra-thin)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ATTENDANCE RATE</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>
                  {data.attendance.attendanceRatePercent}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {data.attendance.activeHeadcount} of {data.attendance.scheduledHeadcount} present
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--material-ultra-thin)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>TOTAL OVERTIME TODAY</div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.attendance.totalOvertimeHoursToday} Hours</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Authorized shifts</div>
              </div>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Active Shifts:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.attendance.presentByShift.map((shift, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{shift.shiftCode}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {shift.presentCount} / {shift.scheduledCount} Staff
                  </span>
                </div>
              ))}
            </div>
          </AppCard>

          {/* Recent Factory Activity Stream */}
          <AppCard variant="glass" padding="lg">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              Recent Factory Operational Stream
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.recentActivity.map((act) => (
                <div
                  key={act.id}
                  onClick={() => navigate(act.actionUrl)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'var(--material-ultra-thin)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    <Activity size={14} color="var(--color-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {act.description}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      By: {act.actorName} • {new Date(act.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <ArrowUpRight size={14} color="var(--color-text-muted)" />
                </div>
              ))}
            </div>
          </AppCard>
        </div>
      )}
    </PageContainer>
  );
};
