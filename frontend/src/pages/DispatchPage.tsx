import React, { useState, useEffect } from 'react';
import {
  Truck,
  FileCheck,
  RefreshCw,
  ChevronRight,
  X,
  Send
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';
import { getAuthHeaders } from '../utils/apiAuth.js';

interface DispatchConsignment {
  _id?: string;
  id?: string;
  dispatchNumber: string;
  deliveryChallanNumber: string;
  status: 'DRAFT' | 'PACKED' | 'SCHEDULED' | 'GATE_PASS_ISSUED' | 'IN_TRANSIT' | 'DELIVERED';
  customer: {
    customerCode: string;
    customerName: string;
    destinationAddress?: string;
  };
  lines?: {
    itemCode: string;
    itemName: string;
    dispatchedQuantity: number;
    uom: string;
    heatLotNumber: string;
    qualityVerification?: {
      isQualityApproved: boolean;
      cocNumber: string;
    };
  }[];
  carrier?: {
    carrierName: string;
    transportMode: string;
    trackingNumber: string;
  };
  gatePass?: {
    gatePassNumber: string;
    securityOfficerName: string;
    issuedAt: string;
  };
  totalQuantity?: number;
  totalGrossWeightKg?: number;
}

const DEFAULT_DISPATCHES: DispatchConsignment[] = [
  {
    id: 'dsp_01',
    dispatchNumber: 'DSP-202608-0001',
    deliveryChallanNumber: 'DC-2026-0881',
    status: 'IN_TRANSIT',
    customer: {
      customerCode: 'CUST-APEX-03',
      customerName: 'Apex Automotive Drivetrains',
      destinationAddress: '400 Industrial Way, Detroit, MI 48201'
    },
    lines: [
      {
        itemCode: 'PART-GEAR-8620',
        itemName: 'Case-Hardened Pinion Gears',
        dispatchedQuantity: 300,
        uom: 'PCS',
        heatLotNumber: 'HL-8620-2026B',
        qualityVerification: { isQualityApproved: true, cocNumber: 'COC-2026-0045' }
      }
    ],
    carrier: { carrierName: 'Swift Heavy Haul Logistics', transportMode: 'ROAD', trackingNumber: 'TRK-SWIFT-994821' },
    gatePass: { gatePassNumber: 'GP-2026-0881', securityOfficerName: 'James Wilson', issuedAt: new Date(Date.now() - 5 * 3600000).toISOString() },
    totalQuantity: 300,
    totalGrossWeightKg: 1820
  },
  {
    id: 'dsp_02',
    dispatchNumber: 'DSP-202608-0002',
    deliveryChallanNumber: 'DC-2026-0882',
    status: 'SCHEDULED',
    customer: {
      customerCode: 'CUST-AERO-01',
      customerName: 'AeroDynamics Propulsion Inc.',
      destinationAddress: '100 Aerospace Blvd, Seattle, WA 98101'
    },
    lines: [
      {
        itemCode: 'PART-SHAFT-4340',
        itemName: 'Turbine Rotor Shafts 4340',
        dispatchedQuantity: 120,
        uom: 'PCS',
        heatLotNumber: 'HL-4340-2026A',
        qualityVerification: { isQualityApproved: true, cocNumber: 'COC-2026-0046' }
      }
    ],
    carrier: { carrierName: 'Aero Freight Express', transportMode: 'AIR', trackingNumber: 'TRK-AFE-881290' },
    totalQuantity: 120,
    totalGrossWeightKg: 1040
  }
];

export const DispatchPage: React.FC = () => {
  const [dispatches, setDispatches] = useState<DispatchConsignment[]>(DEFAULT_DISPATCHES);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchConsignment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${env.API_BASE_URL}/dispatches`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) setDispatches(json.data);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Outbound Dispatch & Gate Pass Logistics"
        subtitle="Delivery challans, CoC attachments, carrier tracking, and security gate passes"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchDispatches} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<Truck size={14} />}>
              Create Consignment
            </AppButton>
          </div>
        }
      />

      {/* Dispatches Table */}
      <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DISPATCH #</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DELIVERY CHALLAN</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CUSTOMER DESTINATION</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ITEMS & LOTS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CARRIER & TRACKING</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>GATE PASS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => (
                <tr
                  key={d.dispatchNumber}
                  onClick={() => setSelectedDispatch(d)}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={15} />
                      {d.dispatchNumber}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#e2e8f0', fontWeight: 600 }}>{d.deliveryChallanNumber}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>{d.customer.customerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{d.customer.destinationAddress}</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ color: '#ffffff', fontWeight: 600 }}>{d.lines?.[0]?.itemName}</div>
                    <div style={{ fontSize: '11px', color: '#38bdf8' }}>{d.lines?.[0]?.dispatchedQuantity} {d.lines?.[0]?.uom} (Heat: {d.lines?.[0]?.heatLotNumber})</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ color: '#ffffff' }}>{d.carrier?.carrierName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{d.carrier?.trackingNumber}</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {d.gatePass ? (
                      <span style={{ color: '#34d399', fontWeight: 600, fontSize: '12px' }}>{d.gatePass.gatePassNumber}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: '12px' }}>Pending</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <AppButton variant="secondary" size="sm" rightIcon={<ChevronRight size={14} />}>
                      Details
                    </AppButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Selected Dispatch Drawer */}
      {selectedDispatch && (
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
          onClick={() => setSelectedDispatch(null)}
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
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>{selectedDispatch.dispatchNumber}</span>
                  <StatusBadge status={selectedDispatch.status} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Challan: {selectedDispatch.deliveryChallanNumber} | Customer: {selectedDispatch.customer.customerName}
                </div>
              </div>
              <button
                onClick={() => setSelectedDispatch(null)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: 'var(--radius-md)', color: '#ffffff', padding: '8px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Consignment Lines & CoC */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> QUALITY CONFORMANCE & DISPATCH LOTS
              </div>
              {selectedDispatch.lines?.map((line, idx) => (
                <div key={idx} style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffffff', fontWeight: 600 }}>
                    <span>{line.itemName}</span>
                    <span>{line.dispatchedQuantity} {line.uom}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    <span>Heat Lot: {line.heatLotNumber}</span>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>CoC: {line.qualityVerification?.cocNumber || 'Attached'}</span>
                  </div>
                </div>
              ))}
            </AppCard>

            {/* Carrier Logistics */}
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> CARRIER & GATE PASS STATUS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Carrier Name</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedDispatch.carrier?.carrierName}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Tracking Code</div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>{selectedDispatch.carrier?.trackingNumber}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Gate Pass Number</div>
                  <div style={{ color: '#34d399', fontWeight: 700 }}>{selectedDispatch.gatePass?.gatePassNumber || 'Awaiting Gate Clearance'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)' }}>Security Officer</div>
                  <div style={{ color: '#ffffff' }}>{selectedDispatch.gatePass?.securityOfficerName || 'Plant Security Gate 1'}</div>
                </div>
              </div>
            </AppCard>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <AppButton variant="primary" style={{ flex: 1 }} leftIcon={<Send size={16} />}>
                Print Gate Pass & Delivery Challan
              </AppButton>
              <AppButton variant="secondary" onClick={() => setSelectedDispatch(null)}>
                Close
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
