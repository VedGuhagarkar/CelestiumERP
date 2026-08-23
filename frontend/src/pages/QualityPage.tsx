import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Microscope,
  FileText,
  ChevronRight,
  X,
  Layers,
  Award
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';
import { authenticatedFetch } from '../utils/apiAuth.js';

interface QualityInspection {
  _id?: string;
  id?: string;
  inspectionNumber: string;
  jobNumber: string;
  status: 'PENDING_SAMPLE' | 'IN_TESTING' | 'APPROVED' | 'REJECTED' | 'DISPOSITIONED';
  disposition: 'CONFORMING' | 'NON_CONFORMING' | 'REWORK_REQUIRED' | 'CONCESSION_USE';
  customer: {
    customerCode: string;
    customerName: string;
  };
  item: {
    itemCode: string;
    itemName: string;
    materialGrade: string;
  };
  inspectionQuantity: {
    sampleSize: number;
    totalLotQuantity: number;
    unitOfMeasure: string;
  };
  testResults?: {
    hardnessTests?: {
      pointIdentifier: string;
      location: string;
      measuredValue: number;
      scale: string;
      targetMin?: number;
      targetMax?: number;
      passed: boolean;
    }[];
    caseDepth?: {
      effectiveCaseDepthMm: number;
      targetMinMm: number;
      targetMaxMm: number;
      passed: boolean;
    };
    microstructure?: {
      observedStructure: string;
      passed: boolean;
    };
    overallTestPassed?: boolean;
  };
  approvedBy?: {
    email: string;
    role: string;
    remarks?: string;
  };
}

interface NCRReport {
  _id?: string;
  id?: string;
  ncrNumber: string;
  jobNumber: string;
  status: 'OPEN' | 'CONTAINED' | 'DISPOSITIONED' | 'CAPA_PENDING' | 'CLOSED';
  customer: {
    customerCode: string;
    customerName: string;
  };
  defectType: string;
  defectSeverity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  defectDescription: string;
  affectedQuantity: {
    totalDefectivePieces: number;
    quarantinedBay: string;
  };
}

const DEFAULT_INSPECTIONS: QualityInspection[] = [
  {
    id: 'qc_01',
    inspectionNumber: 'QC-202608-0001',
    jobNumber: 'JOB-202608-0008',
    status: 'APPROVED',
    disposition: 'CONFORMING',
    customer: { customerCode: 'CUST-APEX-03', customerName: 'Apex Automotive Drivetrains' },
    item: { itemCode: 'PART-GEAR-8620', itemName: 'Case-Hardened Pinion Gears', materialGrade: 'AISI 8620' },
    inspectionQuantity: { sampleSize: 10, totalLotQuantity: 300, unitOfMeasure: 'PCS' },
    testResults: {
      hardnessTests: [
        { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 61.2, scale: 'HRC', targetMin: 60, targetMax: 64, passed: true },
        { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.8, scale: 'HRC', targetMin: 60, targetMax: 64, passed: true },
        { pointIdentifier: 'P3-CORE', location: 'CORE', measuredValue: 36.5, scale: 'HRC', passed: true }
      ],
      caseDepth: { effectiveCaseDepthMm: 1.05, targetMinMm: 0.8, targetMaxMm: 1.2, passed: true },
      microstructure: { observedStructure: 'Tempered martensite matrix with uniform fine carbides. Pass CQI-9.', passed: true },
      overallTestPassed: true
    },
    approvedBy: { email: 'qc@astralis.internal', role: 'QUALITY_MANAGER', remarks: 'Meets automotive CQI-9 criteria.' }
  },
  {
    id: 'qc_02',
    inspectionNumber: 'QC-202608-0002',
    jobNumber: 'JOB-202608-0009',
    status: 'APPROVED',
    disposition: 'CONFORMING',
    customer: { customerCode: 'CUST-AERO-01', customerName: 'AeroDynamics Propulsion Inc.' },
    item: { itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shafts 4340', materialGrade: 'AISI 4340' },
    inspectionQuantity: { sampleSize: 8, totalLotQuantity: 120, unitOfMeasure: 'PCS' },
    testResults: {
      hardnessTests: [
        { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 59.8, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true },
        { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.1, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true }
      ],
      microstructure: { observedStructure: '100% fine tempered martensite structure. Pass AMS 2759/1.', passed: true },
      overallTestPassed: true
    },
    approvedBy: { email: 'lab@astralis.internal', role: 'METALLURGICAL_LAB_TECH', remarks: 'Aerospace hardness & structure approved.' }
  }
];

const DEFAULT_NCRS: NCRReport[] = [
  {
    id: 'ncr_01',
    ncrNumber: 'NCR-202608-0001',
    jobNumber: 'JOB-202608-0011',
    status: 'OPEN',
    customer: { customerCode: 'CUST-TITAN-02', customerName: 'Titan Precision Defense LLC' },
    defectType: 'EXCESSIVE_DECARBURIZATION',
    defectSeverity: 'MAJOR',
    defectDescription: 'Surface decarburization on pilot test coupons. Traverse revealed 0.05mm shallow hardness band.',
    affectedQuantity: { totalDefectivePieces: 25, quarantinedBay: 'Bay 4 Quarantine Bay' }
  }
];

export const QualityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INSPECTIONS' | 'NCRS'>('INSPECTIONS');
  const [inspections, setInspections] = useState<QualityInspection[]>(DEFAULT_INSPECTIONS);
  const [ncrs, setNcrs] = useState<NCRReport[]>(DEFAULT_NCRS);
  const [selectedInspection, setSelectedInspection] = useState<QualityInspection | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQualityData = async () => {
    setIsLoading(true);
    try {
      const [resQc, resNcr] = await Promise.all([
        authenticatedFetch(`${env.API_BASE_URL}/quality-inspections`),
        authenticatedFetch(`${env.API_BASE_URL}/ncrs`)
      ]);

      if (resQc.ok) {
        const jsonQc = await resQc.json();
        if (jsonQc.data && Array.isArray(jsonQc.data) && jsonQc.data.length > 0) {
          setInspections(jsonQc.data);
        }
      }
      if (resNcr.ok) {
        const jsonNcr = await resNcr.json();
        if (jsonNcr.data && Array.isArray(jsonNcr.data) && jsonNcr.data.length > 0) {
          setNcrs(jsonNcr.data);
        }
      }
    } catch {
      // Keep mock fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();
  }, []);

  const conformingCount = inspections.filter((i) => i.disposition === 'CONFORMING').length;
  const openNcrCount = ncrs.filter((n) => n.status === 'OPEN').length;

  return (
    <PageContainer>
      <PageHeader
        title="Quality & Metallurgical Laboratory"
        subtitle="AMS 2759 / CQI-9 conformance, micro-hardness traverses, case depth, and NCR quarantine workflows"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchQualityData} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<ShieldCheck size={14} />}>
              New Inspection
            </AppButton>
          </div>
        }
      />

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>FIRST-PASS YIELD</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>99.2%</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 211, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Award size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CONFORMING LOTS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{conformingCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>OPEN NCRs / QUARANTINE</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: openNcrCount > 0 ? '#ef4444' : '#94a3b8', marginTop: '4px' }}>{openNcrCount}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>LAB TRAVERSES TODAY</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{inspections.length}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Microscope size={20} />
            </div>
          </div>
        </AppCard>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('INSPECTIONS')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'INSPECTIONS' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'INSPECTIONS' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} /> Inspections & Hardness Tests ({inspections.length})
        </button>

        <button
          onClick={() => setActiveTab('NCRS')}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'NCRS' ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'NCRS' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} /> Non-Conformance Reports ({ncrs.length})
        </button>
      </div>

      {/* Tab 1: Inspections Table */}
      {activeTab === 'INSPECTIONS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>INSPECTION #</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JOB & CUSTOMER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEM & GRADE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SAMPLE QTY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>HARDNESS RESULT</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CASE DEPTH</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DISPOSITION</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((qc) => (
                  <tr
                    key={qc.inspectionNumber}
                    onClick={() => setSelectedInspection(qc)}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#38bdf8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={15} />
                        {qc.inspectionNumber}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{qc.jobNumber}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{qc.customer.customerName}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ color: '#ffffff', fontWeight: 500 }}>{qc.item.itemName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{qc.item.materialGrade}</div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>
                      {qc.inspectionQuantity.sampleSize} / {qc.inspectionQuantity.totalLotQuantity} {qc.inspectionQuantity.unitOfMeasure}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ color: '#34d399', fontWeight: 700 }}>
                        {qc.testResults?.hardnessTests?.[0]?.measuredValue || 61.2} {qc.testResults?.hardnessTests?.[0]?.scale || 'HRC'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>
                      {qc.testResults?.caseDepth ? `${qc.testResults.caseDepth.effectiveCaseDepthMm} mm` : 'N/A (Through Hardened)'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={qc.disposition} />
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <AppButton variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}>
                        Review
                      </AppButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Tab 2: NCRs Table */}
      {activeTab === 'NCRS' && (
        <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>NCR NUMBER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>JOB NUMBER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DEFECT TYPE</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SEVERITY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>QUARANTINE BAY</th>
                  <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {ncrs.map((ncr) => (
                  <tr
                    key={ncr.ncrNumber}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#ef4444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={15} />
                        {ncr.ncrNumber}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#ffffff' }}>{ncr.jobNumber}</td>
                    <td style={{ padding: '14px 18px', color: '#ffffff' }}>{ncr.customer.customerName}</td>
                    <td style={{ padding: '14px 18px', color: '#f59e0b', fontWeight: 600 }}>{ncr.defectType.replace('_', ' ')}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        {ncr.defectSeverity}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{ncr.affectedQuantity.quarantinedBay}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <StatusBadge status={ncr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {/* Selected Inspection Detail Drawer */}
      {selectedInspection && (
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
          onClick={() => setSelectedInspection(null)}
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
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>{selectedInspection.inspectionNumber}</span>
                  <StatusBadge status={selectedInspection.disposition} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Job: {selectedInspection.jobNumber} | Customer: {selectedInspection.customer.customerName}
                </div>
              </div>
              <button
                onClick={() => setSelectedInspection(null)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: 'var(--radius-md)', color: '#ffffff', padding: '8px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Hardness Readings */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Microscope size={14} /> ROCKWELL / VICKERS HARDNESS TRAVERSE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedInspection.testResults?.hardnessTests?.map((pt, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{pt.pointIdentifier} ({pt.location})</span>
                    <span style={{ color: '#34d399', fontWeight: 800 }}>{pt.measuredValue} {pt.scale}</span>
                  </div>
                ))}
              </div>
            </AppCard>

            {/* Microstructure */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> MICROSTRUCTURAL EVALUATION
              </div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                {selectedInspection.testResults?.microstructure?.observedStructure || 'Fine needle tempered martensite matrix. Zero retained austenite.'}
              </div>
            </AppCard>

            {/* Signoff */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> QUALITY SIGN-OFF & CERTIFICATE (CoC)
              </div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                <div><strong>Approved By:</strong> {selectedInspection.approvedBy?.email || 'qc@astralis.internal'}</div>
                <div style={{ marginTop: '4px' }}><strong>Remarks:</strong> {selectedInspection.approvedBy?.remarks || 'Meets AMS / CQI-9 specifications.'}</div>
              </div>
            </AppCard>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <AppButton variant="primary" style={{ flex: 1 }} leftIcon={<FileText size={16} />}>
                Generate Certificate of Conformance (CoC)
              </AppButton>
              <AppButton variant="secondary" onClick={() => setSelectedInspection(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
