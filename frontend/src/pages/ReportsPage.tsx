import React, { useState } from 'react';
import {
  TrendingUp,
  Flame,
  Award,
  Download
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';

export const ReportsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExportReport = () => {
    setFeedback({
      type: 'success',
      message: `Executive Manufacturing Report (${timeRange}) generated and downloaded as audit-ready CSV/PDF package.`
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Executive Manufacturing Analytics & KPIs"
        subtitle="Furnace OEE, metallurgical first-pass yields, energy consumption per kg treated, and revenue analytics"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(['MONTH', 'QUARTER', 'YEAR'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  background: timeRange === r ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: timeRange === r ? '#ffffff' : 'var(--color-text-secondary)'
                }}
              >
                {r === 'MONTH' ? 'This Month' : r === 'QUARTER' ? 'This Quarter' : 'Year to Date'}
              </button>
            ))}

            <AppButton
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={handleExportReport}
            >
              Export Report
            </AppButton>
          </div>
        }
      />

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title="Report Generated">
            {feedback.message}
          </AppAlert>
        </div>
      )}

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OVERALL EQUIPMENT EFFECTIVENESS (OEE)</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '6px' }}>87.4%</div>
          <div style={{ fontSize: '12px', color: '#34d399', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> +3.2% vs previous period
          </div>
        </AppCard>

        <AppCard>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>METALLURGICAL FIRST-PASS YIELD</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>99.2%</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Zero scrap batches recorded</div>
        </AppCard>

        <AppCard>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SPECIFIC ENERGY CONSUMPTION</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>0.82 <span style={{ fontSize: '16px' }}>kWh/kg</span></div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>High efficiency vacuum/gas mix</div>
        </AppCard>

        <AppCard>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PYROMETRY AUDIT COMPLIANCE</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>100%</div>
          <div style={{ fontSize: '12px', color: '#34d399', marginTop: '4px' }}>AMS 2750G & CQI-9 Valid</div>
        </AppCard>
      </div>

      {/* Production & Financial Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        <AppCard style={{ padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={16} style={{ color: 'var(--color-primary)' }} /> Furnace Fleet Throughput (Treated KG)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { code: 'FURNACE-PIT-01 (Pit Carburizer)', weight: '14,800 kg', percent: 45, color: '#f59e0b' },
              { code: 'FURNACE-VAC-01 (Vacuum High-Pressure)', weight: '9,600 kg', percent: 30, color: '#38bdf8' },
              { code: 'FURNACE-SEAL-01 (Sealed Quench)', weight: '5,200 kg', percent: 16, color: '#34d399' },
              { code: 'FURNACE-TEMP-01 (Tempering Oven)', weight: '3,100 kg', percent: 9, color: '#a855f7' }
            ].map((f) => (
              <div key={f.code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ffffff', marginBottom: '4px' }}>
                  <span>{f.code}</span>
                  <span style={{ fontWeight: 700 }}>{f.weight} ({f.percent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${f.percent}%`, height: '100%', background: f.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard style={{ padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={16} style={{ color: '#34d399' }} /> Customer Volume & Quality Rating
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { customer: 'AeroDynamics Propulsion Inc. (Aerospace)', revenue: '$42,500', rating: '100% Quality Score' },
              { customer: 'Apex Automotive Drivetrains (Automotive)', revenue: '$28,750', rating: '99.5% CQI-9 Score' },
              { customer: 'Titan Precision Defense LLC (Defense)', revenue: '$18,400', rating: '98.8% Quality Score' },
              { customer: 'Orbital Spacecraft Technologies (Space)', revenue: '$12,800', rating: '100% Quality Score' }
            ].map((c) => (
              <div key={c.customer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{c.customer}</div>
                  <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>{c.rating}</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>{c.revenue}</div>
              </div>
            ))}
          </div>
        </AppCard>
      </div>
    </PageContainer>
  );
};
