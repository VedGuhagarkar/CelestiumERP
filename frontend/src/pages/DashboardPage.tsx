import React from 'react';
import { Flame, Cpu, ShieldCheck, Truck, Plus } from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';

export const DashboardPage: React.FC = () => {
  const kpis = [
    { title: 'Active Thermal Jobs', value: '14', change: '+3 today', icon: <Flame size={20} color="var(--color-primary)" /> },
    { title: 'Running Furnaces', value: '8 / 10', change: '80% OEE', icon: <Cpu size={20} color="var(--color-info)" /> },
    { title: 'Pending QC Surveys', value: '6', change: '2 urgent CoC', icon: <ShieldCheck size={20} color="var(--color-warning)" /> },
    { title: "Today's Dispatches", value: '4 Consignments', change: '100% On-Time', icon: <Truck size={20} color="var(--color-success)" /> }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Manufacturing Command Center"
        subtitle="Real-time shop-floor thermal processing, furnace status, and pyrometry telemetry"
        actions={
          <AppButton variant="primary" leftIcon={<Plus size={16} />}>
            New Work Order
          </AppButton>
        }
      />

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {kpis.map((kpi, idx) => (
          <AppCard key={idx} variant="glass" padding="md">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {kpi.title}
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {kpi.icon}
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {kpi.change}
            </div>
          </AppCard>
        ))}
      </div>

      {/* Live Furnace Fleet & Job Queue Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Active Furnaces */}
        <AppCard variant="glass" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Active Furnace Fleet (AMS 2750G)</h3>
            <StatusBadge status="TELEMETRY LIVE" variant="success" size="sm" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { name: 'Furnace #01 (Pit Carburizer)', temp: '930°C', carbon: '0.85% C', status: 'RUNNING', job: 'JOB-00102' },
              { name: 'Furnace #02 (Vacuum Sealed)', temp: '1050°C', carbon: 'N/A', status: 'RUNNING', job: 'JOB-00105' },
              { name: 'Furnace #03 (Continuous Belt)', temp: '860°C', carbon: '0.40% C', status: 'IDLE', job: 'Awaiting Load' },
              { name: 'Quench Tank #01 (Polymer)', temp: '45°C', carbon: 'Agitator 600 RPM', status: 'RUNNING', job: 'JOB-00102' }
            ].map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--material-ultra-thin)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{f.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Target: {f.temp} • {f.carbon} • {f.job}
                  </div>
                </div>
                <StatusBadge status={f.status} variant={f.status === 'RUNNING' ? 'primary' : 'neutral'} size="sm" />
              </div>
            ))}
          </div>
        </AppCard>

        {/* Priority Job Queue */}
        <AppCard variant="glass" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Priority Production Queue</h3>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Auto-Scheduled</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 'JOB-00102', customer: 'AeroDynamics Corp', alloy: '8620 Alloy', stage: 'SOAK (930°C)', spec: '58-62 HRC' },
              { id: 'JOB-00105', customer: 'Titanium Precision LLC', alloy: 'Inconel 718', stage: 'SOLUTION TREAT', spec: 'AMS 2750G' },
              { id: 'JOB-00108', customer: 'Apex Automotive', alloy: '4140 Steel', stage: 'QUALITY_CHECK', spec: 'Traverse ECD' },
              { id: 'JOB-00111', customer: 'Skyline Turbine Works', alloy: '300M Steel', stage: 'SCHEDULED', spec: 'Vacuum Quench' }
            ].map((j, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--material-ultra-thin)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-primary)' }}>{j.id} — {j.customer}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Material: {j.alloy} • Spec: {j.spec}
                  </div>
                </div>
                <StatusBadge status={j.stage} variant="info" size="sm" />
              </div>
            ))}
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
};
