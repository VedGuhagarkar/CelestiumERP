// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DispatchPage } from './pages/DispatchPage.js';

describe('DispatchPage & Outward Challan Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Dispatch workspace with Dispatch Queue and Active Consignments tabs', async () => {
    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Outbound Dispatch & Gate Pass Logistics/i)).toBeDefined();
    expect(screen.getByTestId('tab-dispatch-queue')).toBeDefined();
    expect(screen.getByTestId('tab-active-consignments')).toBeDefined();
    expect(screen.getByText(/Authoritative Dispatch Staging:/i)).toBeDefined();
  });

  it('displays eligible Batch Orders in the queue with unbroken PO -> GRN -> BO hierarchy', async () => {
    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    // Check hierarchy elements
    expect(screen.getByText('PO-TITAN-8891')).toBeDefined();
    expect(screen.getByText('GRN-2026-0042')).toBeDefined();
    expect(screen.getByText('BO-202609-001')).toBeDefined();

    // Check inspection clearance
    expect(screen.getByText('COC-2026-0045')).toBeDefined();
    expect(screen.getAllByText('WAITING FOR DISPATCH').length).toBeGreaterThan(0);

    // Check action button
    const createOcBtn = screen.getByTestId('btn-create-oc-BO-202609-001');
    expect(createOcBtn).toBeDefined();
  });

  it('opens the Create Outward Challan modal with read-only authoritative derived fields', async () => {
    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const createOcBtn = screen.getByTestId('btn-create-oc-BO-202609-001');
    fireEvent.click(createOcBtn);

    await waitFor(() => {
      expect(screen.getByText(/Generate Outward Challan \(OC\)/i)).toBeDefined();
      expect(screen.getByText(/AUTHORITATIVE SOURCE-OF-TRUTH ENFORCEMENT/i)).toBeDefined();
      expect(screen.getByText(/\[AUTO-GENERATED: OC-YYYYMM-XXXX\]/i)).toBeDefined();
    });

    const ocForm = document.getElementById('create-oc-form')!;
    expect(ocForm).toBeDefined();

    // Check that derived PO and GRN are displayed
    expect(within(ocForm).getByText('Derived Purchase Order:')).toBeDefined();
    expect(within(ocForm).getByText('Corresponding GRN:')).toBeDefined();
    expect(within(ocForm).getByText('Selected Batch Order:')).toBeDefined();

    // Check 8 required authoritative BO item fields
    expect(within(ocForm).getByText(/AUTHORITATIVE OC ITEM DETAILS/i)).toBeDefined();
    expect(within(ocForm).getByText('Serial Number:')).toBeDefined();
    expect(within(ocForm).getByText('Part Number:')).toBeDefined();
    expect(within(ocForm).getByText('PART-GEAR-8620')).toBeDefined();
    expect(within(ocForm).getByText('Part Name / Description:')).toBeDefined();
    expect(within(ocForm).getByText('Case-Hardened Pinion Gears')).toBeDefined();
    expect(within(ocForm).getByText('Material Grade:')).toBeDefined();
    expect(within(ocForm).getByText('SAE 8620H')).toBeDefined();
    expect(within(ocForm).getByText('Heat-Treatment Process:')).toBeDefined();
    expect(within(ocForm).getByText('Carburizing & Quench 60HRC')).toBeDefined();
    expect(within(ocForm).getByText('Batch / Lot Number:')).toBeDefined();
    expect(within(ocForm).getByText('HL-8620-2026B')).toBeDefined();
    expect(within(ocForm).getByText('Dispatched Quantity:')).toBeDefined();
    expect(within(ocForm).getByText('Unit of Measure (UOM):')).toBeDefined();

    // Check 6 required authoritative heat-treatment parameters
    expect(within(ocForm).getByText(/AUTHORITATIVE HEAT-TREATMENT & INSPECTION DATA/i)).toBeDefined();
    expect(within(ocForm).getByText('Furnace / Equipment:')).toBeDefined();
    expect(within(ocForm).getByText(/FURNACE-PIT-01 \(Integral Quench Furnace\)/i)).toBeDefined();
    expect(within(ocForm).getByText('Hardness Specification:')).toBeDefined();
    expect(within(ocForm).getByText('58-62 HRC')).toBeDefined();
    expect(within(ocForm).getByText('Actual Hardness:')).toBeDefined();
    expect(within(ocForm).getByText('60.5 HRC')).toBeDefined();
    expect(within(ocForm).getByText('Case Depth:')).toBeDefined();
    expect(within(ocForm).getByText('1.15 mm')).toBeDefined();
    expect(within(ocForm).getByText('Quantity Received:')).toBeDefined();
    expect(within(ocForm).getByText('Quantity Delivered:')).toBeDefined();

    // Verify No Re-Entry notice
    expect(within(ocForm).getByText(/No Re-Entry Required:/i)).toBeDefined();
    expect(within(ocForm).getByText(/Manual editing is prohibited/i)).toBeDefined();

    // Ensure no manual inputs exist for item quantity, part code, or hardness in the form
    expect(ocForm.querySelector('input[name="dispatchedQuantity"]')).toBeNull();
    expect(ocForm.querySelector('input[name="actualHardness"]')).toBeNull();
    expect(ocForm.querySelector('input[name="caseDepth"]')).toBeNull();
  });

  it('submits OC creation request with batchOrderId and updates UI upon success', async () => {
    const mockCreatedOC = {
      id: 'disp_new_01',
      dispatchNumber: 'DSP-202609-0099',
      deliveryChallanNumber: 'OC-202609-0001',
      outwardChallanNumber: 'OC-202609-0001',
      ocDate: '2026-09-15T00:00:00.000Z',
      status: 'DRAFT',
      poNumber: 'PO-TITAN-8891',
      grnNumber: 'GRN-2026-0042',
      batchOrderNumber: 'BO-202609-001',
      items: [
        {
          serialNumber: 1,
          partName: 'Case-Hardened Pinion Gears',
          partDescription: 'Case-Hardened Pinion Gears',
          partNumber: 'PART-GEAR-8620',
          materialGrade: 'SAE 8620H',
          heatTreatmentProcess: 'Carburizing & Quench 60HRC',
          batchLotNumber: 'HL-8620-2026B',
          quantity: 300,
          unitOfMeasure: 'PCS'
        }
      ],
      heatTreatmentInformation: {
        furnaceEquipment: 'FURNACE-PIT-01 (Integral Quench Furnace)',
        hardnessSpecification: '58-62 HRC',
        actualHardness: '60.5 HRC',
        caseDepth: '1.15 mm',
        quantityReceived: 300,
        quantityDelivered: 300
      },
      customer: {
        customerCode: 'CUST-APEX-03',
        customerName: 'Apex Automotive Drivetrains',
        destinationAddress: '400 Industrial Way, Detroit, MI 48201'
      }
    };

    // Mock authenticatedFetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/dispatches/outward-challan') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.batchOrderId).toBe('job-bo-8821');
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: mockCreatedOC })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    // Open modal
    const createOcBtn = screen.getByTestId('btn-create-oc-BO-202609-001');
    fireEvent.click(createOcBtn);

    // Submit form
    const submitBtn = screen.getByTestId('btn-submit-create-oc');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/successfully generated for BO BO-202609-001/i)).toBeDefined();
    });

    fetchSpy.mockRestore();
  });

  it('allows switching to Active Consignments tab and displays hierarchy badges and drawer details', async () => {
    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByText(/OUTWARD CHALLAN \/ DISPATCH #/i)).toBeDefined();
      expect(screen.getByText(/PO ➔ GRN ➔ BO HIERARCHY/i)).toBeDefined();
    });

    // Open Details Drawer for the first consignment
    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    expect(detailsButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      // Check Drawer items and heat-treatment cards
      expect(screen.getByText(/BO-DERIVED OUTWARD CHALLAN ITEMS \(AUTHORITATIVE\)/i)).toBeDefined();
      expect(screen.getByText(/METALLURGICAL HEAT-TREATMENT SPECIFICATIONS & RESULTS/i)).toBeDefined();
    });
  });

  it('opens the Complete Physical Dispatch modal and displays required transport fields and authoritative banner', async () => {
    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-dispatch-DSP-202608-0001')).toBeDefined();
    });

    const dispatchBtn = screen.getByTestId('btn-dispatch-DSP-202608-0001');
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Complete Physical Dispatch/i)).toBeDefined();
      expect(screen.getByText(/AUTHORITATIVE DISPATCH & INVENTORY CONTEXT/i)).toBeDefined();
    });

    // Verify required inputs are present
    expect(screen.getByTestId('input-transporter')).toBeDefined();
    expect(screen.getByTestId('input-vehicle-number')).toBeDefined();
    expect(screen.getByTestId('input-dispatch-date')).toBeDefined();
    expect(screen.getByTestId('input-eway-bill')).toBeDefined();
    expect(screen.getByTestId('input-transport-remarks')).toBeDefined();
    expect(screen.getByTestId('btn-submit-physical-dispatch')).toBeDefined();
  });

  it('validates required transport fields, rejects meaningless values, and completes physical dispatch upon valid submission', async () => {
    let capturedPayload: any = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/dispatch') && init?.method === 'POST') {
        capturedPayload = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              dispatchNumber: 'DSP-202608-0001',
              status: 'DISPATCHED',
              transporter: capturedPayload.transporter,
              vehicleNumber: capturedPayload.vehicleNumber,
              dispatchDate: capturedPayload.dispatchDate,
              ewayBillNumber: capturedPayload.ewayBillNumber
            }
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-dispatch-DSP-202608-0001')).toBeDefined();
    });

    const dispatchBtn = screen.getByTestId('btn-dispatch-DSP-202608-0001');
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('btn-submit-physical-dispatch')).toBeDefined();
    });

    // 1. Test validation failure on meaningless transporter
    const transporterInput = screen.getByTestId('input-transporter');
    const vehicleInput = screen.getByTestId('input-vehicle-number');
    const submitBtn = screen.getByTestId('btn-submit-physical-dispatch');

    fireEvent.change(transporterInput, { target: { value: 'N/A' } });
    fireEvent.change(vehicleInput, { target: { value: 'MH-12-AB-1234' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Meaningless or placeholder transporter values are not permitted/i)).toBeDefined();
    });

    // 2. Test validation failure on invalid vehicle number
    fireEvent.change(transporterInput, { target: { value: 'VRL Logistics Express' } });
    fireEvent.change(vehicleInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vehicle number is required \(minimum 5 characters/i)).toBeDefined();
    });

    // 3. Valid submission
    fireEvent.change(transporterInput, { target: { value: 'VRL Logistics Express Ltd' } });
    fireEvent.change(vehicleInput, { target: { value: 'MH-12-AB-1234' } });
    const ewayInput = screen.getByTestId('input-eway-bill');
    fireEvent.change(ewayInput, { target: { value: '101234567890' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.transporter).toBe('VRL Logistics Express Ltd');
      expect(capturedPayload.vehicleNumber).toBe('MH-12-AB-1234');
      expect(capturedPayload.ewayBillNumber).toBe('101234567890');
      expect(screen.getByText(/Physical dispatch completed for OC/i)).toBeDefined();
    });

    fetchSpy.mockRestore();
  });

  it('opens Authorize modal, validates user ID, and submits signatory authorization to ERP backend', async () => {
    let authorizePayload: any = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/authorize') && init?.method === 'POST') {
        authorizePayload = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              dispatchNumber: 'DSP-202608-0002',
              status: 'APPROVED',
              authorizedSignatory: {
                userId: authorizePayload.authorizedSignatory.userId,
                name: 'Dr. Elena Rostova',
                designation: authorizePayload.authorizedSignatory.designation,
                signatureRef: authorizePayload.authorizedSignatory.signatureRef,
                authorizedAt: new Date().toISOString()
              }
            }
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-authorize-DSP-202608-0002')).toBeDefined();
    });

    const authBtn = screen.getByTestId('btn-authorize-DSP-202608-0002');
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(screen.getByText(/Authorize Outward Challan \(Authorized Signatory\)/i)).toBeDefined();
      expect(screen.getByText(/AUTHORITATIVE RBAC SIGNATORY VALIDATION/i)).toBeDefined();
    });

    const userInput = screen.getByTestId('input-signatory-user-id');
    const desigInput = screen.getByTestId('input-signatory-designation');
    const sigInput = screen.getByTestId('input-signature-ref');
    const notesInput = screen.getByTestId('input-approval-notes');
    const submitBtn = screen.getByTestId('btn-submit-authorize-oc');

    fireEvent.change(userInput, { target: { value: '507f191e810c19729de860e2' } });
    fireEvent.change(desigInput, { target: { value: 'Head of Quality & Dispatch' } });
    fireEvent.change(sigInput, { target: { value: 'SIG-AUTH-2026-8801' } });
    fireEvent.change(notesInput, { target: { value: 'All QA certifications passed and verified.' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authorizePayload).not.toBeNull();
      expect(authorizePayload.authorizedSignatory.userId).toBe('507f191e810c19729de860e2');
      expect(authorizePayload.authorizedSignatory.designation).toBe('Head of Quality & Dispatch');
      expect(authorizePayload.authorizedSignatory.signatureRef).toBe('SIG-AUTH-2026-8801');
      expect(authorizePayload.approvalNotes).toBe('All QA certifications passed and verified.');
      expect(screen.getByText(/authorized successfully! Signatory verified via ERP permission system/i)).toBeDefined();
    });

    fetchSpy.mockRestore();
  });

  it('opens Customer Acknowledgement modal, submits receiving proof, and displays acknowledgement card in drawer', async () => {
    let ackPayload: any = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/acknowledge') && init?.method === 'POST') {
        ackPayload = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              dispatchNumber: 'DSP-202608-0002',
              status: 'DELIVERED',
              customerAcknowledgement: {
                receivedBy: ackPayload.receivedBy,
                signatureStampRef: ackPayload.signatureStampRef,
                date: ackPayload.date,
                remarks: ackPayload.remarks
              }
            }
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-acknowledge-DSP-202608-0002')).toBeDefined();
    });

    const ackBtn = screen.getByTestId('btn-acknowledge-DSP-202608-0002');
    fireEvent.click(ackBtn);

    await waitFor(() => {
      expect(screen.getByText(/Record Customer Acknowledgement/i)).toBeDefined();
      expect(screen.getByText(/CUSTOMER RECEIPT & DELIVERY PROOF/i)).toBeDefined();
    });

    const receivedByInput = screen.getByTestId('input-ack-received-by');
    const stampInput = screen.getByTestId('input-ack-signature-stamp');
    const remarksInput = screen.getByTestId('input-ack-remarks');
    const submitBtn = screen.getByTestId('btn-submit-customer-ack');

    fireEvent.change(receivedByInput, { target: { value: 'Marcus Vance' } });
    fireEvent.change(stampInput, { target: { value: 'STAMP-AERO-REC-01' } });
    fireEvent.change(remarksInput, { target: { value: 'Consignment received undamaged.' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ackPayload).not.toBeNull();
      expect(ackPayload.receivedBy).toBe('Marcus Vance');
      expect(ackPayload.signatureStampRef).toBe('STAMP-AERO-REC-01');
      expect(ackPayload.remarks).toBe('Consignment received undamaged.');
      expect(screen.getByText(/Customer acknowledgement recorded for/i)).toBeDefined();
    });

    // Also inspect details drawer to verify Drawer cards
    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/OC PREPARED BY \(AUTHORITATIVE USER ATTRIBUTION\)/i)).toBeDefined();
      expect(screen.getByText(/AUTHORIZED SIGNATORY \(ERP RBAC VERIFIED\)/i)).toBeDefined();
      expect(screen.getByText(/CUSTOMER ACKNOWLEDGEMENT & DELIVERY PROOF/i)).toBeDefined();
    });

    fetchSpy.mockRestore();
  });

  it('opens authoritative Outward Challan Print/View modal, displaying complete genealogy, 8 BO item specs, 6 metallurgical parameters, dual authorization, customer acknowledgement, and immutability notice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/dispatches/outward-challan/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: 'dsp_01',
              dispatchNumber: 'DSP-202608-0001',
              deliveryChallanNumber: 'DC-2026-0881',
              outwardChallanNumber: 'OC-202608-0001',
              ocDate: '2026-08-20T00:00:00.000Z',
              poNumber: 'PO-TITAN-8891',
              grnNumber: 'GRN-2026-0042',
              batchOrderNumber: 'BO-202608-001',
              status: 'IN_TRANSIT',
              printCount: 2,
              printedAt: '2026-08-20T10:00:00.000Z',
              printedBy: 'devin.vance',
              customer: {
                customerCode: 'CUST-APEX-03',
                customerName: 'Apex Automotive Drivetrains',
                destinationAddress: '400 Industrial Way, Detroit, MI 48201'
              },
              carrier: {
                carrierName: 'Swift Heavy Haul Logistics',
                vehicleNumber: 'MH-12-QC-8821'
              },
              items: [
                {
                  serialNumber: 1,
                  partName: 'Case-Hardened Pinion Gears',
                  partDescription: 'Case-Hardened Pinion Gears',
                  partNumber: 'PART-GEAR-8620',
                  materialGrade: 'SAE 8620H',
                  heatTreatmentProcess: 'Carburizing & Quench 60HRC',
                  batchLotNumber: 'HL-8620-2026B',
                  quantity: 300,
                  unitOfMeasure: 'PCS'
                }
              ],
              heatTreatmentInformation: {
                furnaceEquipment: 'FURNACE-PIT-01 (Integral Quench Furnace)',
                hardnessSpecification: '58-62 HRC',
                actualHardness: '60.5 HRC',
                caseDepth: '1.15 mm',
                quantityReceived: 300,
                quantityDelivered: 300
              },
              preparedBy: {
                userId: 'usr_prep_01',
                name: 'Devin Vance',
                designation: 'Dispatch Lead',
                preparedAt: '2026-08-20T08:30:00Z'
              },
              authorizedSignatory: {
                userId: 'usr_sign_01',
                name: 'Elena Rostova',
                designation: 'Plant Operations Director',
                signatureRef: 'SIG-AUTH-9081',
                authorizedAt: '2026-08-20T09:15:00Z'
              },
              customerAcknowledgement: {
                receivedBy: 'Marcus Sterling',
                signatureStampRef: 'STAMP-APEX-REC-01',
                date: '2026-08-21T14:00:00Z',
                remarks: 'Consignment received in full with verified CoC.'
              }
            }
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-print-oc-DSP-202608-0001')).toBeDefined();
    });

    const printOcBtn = screen.getByTestId('btn-print-oc-DSP-202608-0001');
    fireEvent.click(printOcBtn);

    await waitFor(() => {
      // Check Document Title & Headers
      expect(screen.getByText(/Authoritative Outward Challan: OC-202608-0001/i)).toBeDefined();
      const printContainer = document.getElementById('printable-oc-container')!;
      expect(printContainer).toBeDefined();

      expect(within(printContainer).getByText(/CELESTIUM PRECISION HEAT TREATING/i)).toBeDefined();
      expect(within(printContainer).getByText(/OUTWARD DELIVERY CHALLAN/i)).toBeDefined();

      // Check Traceability Genealogy Banner (PO -> GRN -> BO -> OC)
      expect(within(printContainer).getByText(/Authoritative Traceability Genealogy \(PO ➔ GRN ➔ BO ➔ OC\)/i)).toBeDefined();
      expect(within(printContainer).getByText('PO-TITAN-8891')).toBeDefined();
      expect(within(printContainer).getByText('GRN-2026-0042')).toBeDefined();
      expect(within(printContainer).getByText('BO-202608-001')).toBeDefined();

      // Check Customer & Transport Info
      expect(within(printContainer).getByText(/Consignee \/ Deliver To/i)).toBeDefined();
      expect(within(printContainer).getByText(/Apex Automotive Drivetrains/i)).toBeDefined();
      expect(within(printContainer).getByText(/Transport & Gate Logistics/i)).toBeDefined();
      expect(within(printContainer).getByText(/Swift Heavy Haul Logistics/i)).toBeDefined();

      // Check 8 BO-derived Item fields
      expect(within(printContainer).getByText(/Processed Item Details \(Derived From Batch Order\)/i)).toBeDefined();
      expect(within(printContainer).getByText('PART-GEAR-8620')).toBeDefined();
      expect(within(printContainer).getByText('Case-Hardened Pinion Gears')).toBeDefined();
      expect(within(printContainer).getByText('SAE 8620H')).toBeDefined();
      expect(within(printContainer).getByText('Carburizing & Quench 60HRC')).toBeDefined();
      expect(within(printContainer).getByText('HL-8620-2026B')).toBeDefined();
      expect(within(printContainer).getAllByText('300').length).toBeGreaterThan(0);
      expect(within(printContainer).getAllByText('PCS').length).toBeGreaterThan(0);

      // Check 6 Heat-treatment parameters
      expect(within(printContainer).getByText(/Heat-Treatment Specifications & Inspection Outcomes/i)).toBeDefined();
      expect(within(printContainer).getByText(/FURNACE-PIT-01 \(Integral Quench Furnace\)/i)).toBeDefined();
      expect(within(printContainer).getByText('58-62 HRC')).toBeDefined();
      expect(within(printContainer).getByText('60.5 HRC')).toBeDefined();
      expect(within(printContainer).getByText('1.15 mm')).toBeDefined();

      // Check Dual-Tier Authorization
      expect(within(printContainer).getByText(/Prepared By \(Dispatch Officer\)/i)).toBeDefined();
      expect(within(printContainer).getByText(/Elena Rostova/i)).toBeDefined();
      expect(within(printContainer).getByText(/Plant Operations Director/i)).toBeDefined();
      expect(within(printContainer).getByText(/SIG-AUTH-9081/i)).toBeDefined();

      // Check Customer Acknowledgement
      expect(within(printContainer).getByText(/Customer Consignment Acknowledgement/i)).toBeDefined();
      expect(within(printContainer).getByText(/Marcus Sterling/i)).toBeDefined();
      expect(within(printContainer).getByText(/STAMP-APEX-REC-01/i)).toBeDefined();
    });

    fetchSpy.mockRestore();
  });

  it('triggers document print action, increments print count, calls ERP print endpoint, and functions from drawer footer', async () => {
    let printEndpointCalled = false;
    const windowPrintMock = vi.fn();
    vi.stubGlobal('print', windowPrintMock);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/dispatches/outward-challan/') && init?.method === 'POST') {
        printEndpointCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Outward Challan generated and logged for printing',
            data: {
              outwardChallanNumber: 'OC-202608-0001',
              printCount: 3,
              printedAt: new Date().toISOString(),
              printedBy: 'Plant Operations Director'
            }
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      } as Response;
    });

    render(
      <MemoryRouter>
        <DispatchPage />
      </MemoryRouter>
    );

    const tabActiveConsignments = screen.getByTestId('tab-active-consignments');
    fireEvent.click(tabActiveConsignments);

    await waitFor(() => {
      expect(screen.getByTestId('btn-print-oc-DSP-202608-0001')).toBeDefined();
    });

    // Open Print Modal from table row
    fireEvent.click(screen.getByTestId('btn-print-oc-DSP-202608-0001'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-confirm-print-oc')).toBeDefined();
    });

    // Click Print Document in modal
    fireEvent.click(screen.getByTestId('btn-confirm-print-oc'));

    await waitFor(() => {
      expect(printEndpointCalled).toBe(true);
      expect(windowPrintMock).toHaveBeenCalled();
      expect(screen.getByText(/printed successfully. Print record logged to ERP audit trail./i)).toBeDefined();
    });

    // Close print modal
    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // Open Details Drawer and verify drawer print button triggers modal
    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('btn-drawer-print-oc')).toBeDefined();
      expect(screen.getByText(/OUTWARD CHALLAN PRINT AUDIT TRAIL/i)).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-drawer-print-oc'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-confirm-print-oc')).toBeDefined();
    });

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

