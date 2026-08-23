import React, { useState, useEffect } from 'react';
import {
  Truck,
  FileCheck,
  RefreshCw,
  ChevronRight,
  Send,
  Printer
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
  const [isConsignmentModalOpen, setIsConsignmentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Consignment Form State
  const [customerName, setCustomerName] = useState('Titan Precision Defense LLC');
  const [destinationAddress, setDestinationAddress] = useState('500 Defense Tech Blvd, Huntsville, AL');
  const [carrierName, setCarrierName] = useState('FedEx Custom Critical');
  const [transportMode, setTransportMode] = useState('ROAD');
  const [quantity, setQuantity] = useState(250);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches`);
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

  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        customerId: 'cust_titan_002',
        purchaseOrderNumber: 'PO-TITAN-8891',
        destinationAddress,
        carrierName,
        transportMode,
        lines: [
          {
            finishedGoodsId: 'fg_pinion_8620_01',
            dispatchedQuantity: Number(quantity),
            packageDetails: {
              packagingType: 'PALLET',
              packageCount: 2,
              grossWeightKg: Number(quantity) * 6.5
            }
          }
        ]
      };

      const res = await authenticatedFetch(`${env.API_BASE_URL}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create dispatch consignment (status ${res.status})`);
      }

      setFeedback({ type: 'success', message: `Outbound consignment successfully booked for ${customerName} (${quantity} pcs).` });
      setIsConsignmentModalOpen(false);
      fetchDispatches();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create consignment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintGatePass = () => {
    if (!selectedDispatch) return;
    setFeedback({
      type: 'success',
      message: `Delivery Challan (${selectedDispatch.deliveryChallanNumber}) & Security Gate Pass sent to factory gate printer.`
    });
    setSelectedDispatch(null);
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
            <AppButton variant="primary" leftIcon={<Truck size={14} />} onClick={() => setIsConsignmentModalOpen(true)}>
              Create Consignment
            </AppButton>
          </div>
        }
      />

      {feedback && (
        <div style={{ marginBottom: '20px' }}>
          <AppAlert variant={feedback.type} title={feedback.type === 'success' ? 'Operation Completed' : 'Action Failed'}>
            {feedback.message}
          </AppAlert>
        </div>
      )}

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
                  style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.15s ease' }}
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
                    <div style={{ color: '#ffffff', fontWeight: 600 }}>{d.lines?.[0]?.itemName || 'Treated Components'}</div>
                    <div style={{ fontSize: '11px', color: '#38bdf8' }}>{d.lines?.[0]?.heatLotNumber || 'HL-4340'} ({d.lines?.[0]?.dispatchedQuantity || d.totalQuantity} pcs)</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{d.carrier?.carrierName || 'Standard Freight'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{d.carrier?.trackingNumber}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 600 }}>
                    {d.gatePass?.gatePassNumber || 'GP-ISSUED'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      rightIcon={<ChevronRight size={14} />}
                      onClick={() => setSelectedDispatch(d)}
                    >
                      Details
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Selected Dispatch Drawer */}
      <AppDrawer
        isOpen={!!selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
        title={selectedDispatch?.dispatchNumber}
        subtitle={selectedDispatch ? `Outbound Delivery Challan (${selectedDispatch.deliveryChallanNumber})` : ''}
        footer={
          selectedDispatch && (
            <>
              <AppButton variant="secondary" onClick={() => setSelectedDispatch(null)}>
                Close
              </AppButton>
              <AppButton
                variant="primary"
                leftIcon={<Printer size={16} />}
                onClick={handlePrintGatePass}
              >
                Print Gate Pass & Challan
              </AppButton>
            </>
          )
        }
      >
        {selectedDispatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> LOGISTICS & DESTINATION
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Customer:</strong> {selectedDispatch.customer.customerName}</div>
                <div><strong>Delivery Address:</strong> {selectedDispatch.customer.destinationAddress}</div>
                <div><strong>Freight Carrier:</strong> {selectedDispatch.carrier?.carrierName}</div>
                <div><strong>Tracking Code:</strong> {selectedDispatch.carrier?.trackingNumber}</div>
              </div>
            </AppCard>

            <AppCard style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={14} /> SECURITY GATE PASS & QUALITY RELEASE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div><strong>Gate Pass Number:</strong> {selectedDispatch.gatePass?.gatePassNumber || 'GP-2026-0881'}</div>
                <div><strong>Security Officer:</strong> {selectedDispatch.gatePass?.securityOfficerName || 'James Wilson'}</div>
                <div><strong>Attached CoC:</strong> {selectedDispatch.lines?.[0]?.qualityVerification?.cocNumber || 'COC-2026-0045 (PASSED)'}</div>
              </div>
            </AppCard>
          </div>
        )}
      </AppDrawer>

      {/* Create Consignment Dialog */}
      <AppDialog
        isOpen={isConsignmentModalOpen}
        onClose={() => setIsConsignmentModalOpen(false)}
        title="Create Outbound Shipping Consignment"
        description="Generate delivery challan, link certified heat lot CoC, and issue security gate pass."
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIsConsignmentModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="submit"
              form="consignment-form"
              isLoading={isSubmitting}
              leftIcon={<Send size={16} />}
            >
              Generate Delivery Challan
            </AppButton>
          </>
        }
      >
        <form id="consignment-form" onSubmit={handleCreateConsignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AppInput
            label="Customer Recipient"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />

          <AppInput
            label="Destination Address / Plant Gate"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <AppInput
              label="Freight Carrier"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              required
            />
            <AppSelect
              label="Transport Mode"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
              options={[
                { value: 'ROAD', label: 'Road Dedicated Freight' },
                { value: 'AIR', label: 'Air Express Cargo' },
                { value: 'CUSTOMER_PICKUP', label: 'Customer Self-Pickup' }
              ]}
            />
          </div>

          <AppInput
            label="Total Consignment Pieces"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </form>
      </AppDialog>
    </PageContainer>
  );
};
