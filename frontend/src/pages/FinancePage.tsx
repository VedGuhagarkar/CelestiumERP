import React, { useState, useEffect } from 'react';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';

interface Invoice {
  _id?: string;
  id?: string;
  invoiceNumber: string;
  customerCode: string;
  customerName: string;
  totalAmount: number;
  taxAmount?: number;
  totalTaxAmount?: number;
  subtotal?: number;
  paidAmount: number;
  outstandingBalance: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  invoiceDate: string;
  dueDate: string;
}

interface JobCostRecord {
  _id?: string;
  id?: string;
  costingNumber: string;
  jobNumber: string;
  customerName?: string;
  itemCode?: string;
  totalStandardCost: number;
  totalActualCost: number;
  totalRevenueBilled?: number;
  grossProfit?: number;
  grossMarginPercentage?: number;
  profitabilityStatus: string;
  isFrozen: boolean;
}

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'inv_01',
    invoiceNumber: 'INV-2026-0089',
    customerCode: 'CUST-AERO-01',
    customerName: 'AeroDynamics Propulsion Inc.',
    subtotal: 13050.0,
    totalTaxAmount: 1450.0,
    totalAmount: 14500.0,
    paidAmount: 0,
    outstandingBalance: 14500.0,
    status: 'ISSUED',
    invoiceDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 28 * 86400000).toISOString()
  },
  {
    id: 'inv_02',
    invoiceNumber: 'INV-2026-0088',
    customerCode: 'CUST-APEX-03',
    customerName: 'Apex Automotive Drivetrains',
    subtotal: 25875.0,
    totalTaxAmount: 2875.0,
    totalAmount: 28750.0,
    paidAmount: 28750.0,
    outstandingBalance: 0,
    status: 'PAID',
    invoiceDate: new Date(Date.now() - 15 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString()
  }
];

const DEFAULT_JOB_COSTS: JobCostRecord[] = [
  {
    id: 'cost_01',
    costingNumber: 'COST-202608-0008',
    jobNumber: 'JOB-202608-0008',
    customerName: 'Apex Automotive Drivetrains',
    itemCode: 'PART-GEAR-8620',
    totalStandardCost: 15200.0,
    totalActualCost: 14550.0,
    totalRevenueBilled: 25875.0,
    grossProfit: 11325.0,
    grossMarginPercentage: 43.76,
    profitabilityStatus: 'HIGH_MARGIN',
    isFrozen: true
  },
  {
    id: 'cost_02',
    costingNumber: 'COST-202608-0009',
    jobNumber: 'JOB-202608-0009',
    customerName: 'AeroDynamics Propulsion Inc.',
    itemCode: 'PART-SHAFT-4340',
    totalStandardCost: 9600.0,
    totalActualCost: 9200.0,
    totalRevenueBilled: 13050.0,
    grossProfit: 3850.0,
    grossMarginPercentage: 29.5,
    profitabilityStatus: 'STANDARD_MARGIN',
    isFrozen: true
  }
];

export const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'COSTING'>('INVOICES');
  const [invoices, setInvoices] = useState<Invoice[]>(DEFAULT_INVOICES);
  const [jobCosts, setJobCosts] = useState<JobCostRecord[]>(DEFAULT_JOB_COSTS);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [resI, resC] = await Promise.all([
        fetch(`${env.API_BASE_URL}/billing/invoices`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        fetch(`${env.API_BASE_URL}/costing/jobs`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      ]);

      if (resI.ok) {
        const jsonI = await resI.json();
        if (jsonI.data && Array.isArray(jsonI.data) && jsonI.data.length > 0) setInvoices(jsonI.data);
      }
      if (resC.ok) {
        const jsonC = await resC.json();
        if (jsonC.data && Array.isArray(jsonC.data) && jsonC.data.length > 0) setJobCosts(jsonC.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + i.outstandingBalance, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Finance, Invoicing & Job Profitability"
        subtitle="Commercial invoices, frozen job costing margins, rate cards, and receivables"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchFinanceData} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Receipt size={14} />}>
              Create Invoice
            </AppButton>
          </div>
        }
      />

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TOTAL BILLED REVENUE</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>${totalBilled.toLocaleString()}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <DollarSign size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OUTSTANDING RECEIVABLES</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>${totalOutstanding.toLocaleString()}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <CreditCard size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>AVERAGE GROSS MARGIN</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>36.6%</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Percent size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FROZEN COSTINGS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{jobCosts.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('INVOICES')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'INVOICES' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'INVOICES' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Receipt size={16} /> Commercial Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('COSTING')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'COSTING' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'COSTING' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <TrendingUp size={16} /> Job Costing & Profitability ({jobCosts.length})
        </button>
      </div>

      {/* Invoices Table */}
      {activeTab === 'INVOICES' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>INVOICE #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>INVOICE DATE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUBTOTAL</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TAX</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>TOTAL AMOUNT</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OUTSTANDING</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{inv.customerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{inv.customerCode}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff' }}>${(inv.subtotal || inv.totalAmount * 0.9).toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)' }}>${(inv.totalTaxAmount || inv.taxAmount || inv.totalAmount * 0.1).toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#ffffff' }}>${inv.totalAmount.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: inv.outstandingBalance > 0 ? '#fbbf24' : '#34d399' }}>
                      ${inv.outstandingBalance.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Costing Table */}
      {activeTab === 'COSTING' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>COSTING #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JOB NUMBER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER & PART</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STANDARD COST</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACTUAL COST</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>BILLED REVENUE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GROSS MARGIN</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {jobCosts.map((c) => (
                  <tr key={c.costingNumber} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#38bdf8' }}>{c.costingNumber}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>{c.jobNumber}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#ffffff', fontWeight: 600 }}>{c.customerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{c.itemCode}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-secondary)' }}>${c.totalStandardCost.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff', fontWeight: 600 }}>${c.totalActualCost.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 700 }}>${c.totalRevenueBilled?.toLocaleString()}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {c.grossMarginPercentage?.toFixed(1)}% (${c.grossProfit?.toLocaleString()})
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={c.profitabilityStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}
    </PageContainer>
  );
};
