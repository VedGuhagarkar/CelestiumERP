// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

    // Check that derived PO and GRN are displayed
    expect(screen.getByText('Derived Purchase Order:')).toBeDefined();
    expect(screen.getByText('Corresponding GRN:')).toBeDefined();
    expect(screen.getByText('Selected Batch Order:')).toBeDefined();
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

  it('allows switching to Active Consignments tab and displays hierarchy badges', async () => {
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
  });
});
