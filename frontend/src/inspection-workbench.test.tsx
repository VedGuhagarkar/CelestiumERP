// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { InspectionWorkbench } from './components/inspection/InspectionWorkbench.js';

const MOCK_ACTIVE_WORKBENCH_DATA = {
  headerContext: {
    id: 'bo_test_99',
    boNumber: 'BO-202609-0099',
    jobNumber: 'BO-202609-0099',
    poNumber: 'PO-2026-00888',
    grnNumber: 'GRN-202609-0777',
    customer: {
      customerName: 'AeroJet Propulsion Systems',
      customerCode: 'CUST-AEROJET'
    },
    part: {
      itemCode: 'ITM-TURB-718',
      itemName: 'Inconel 718 Turbine Rotor',
      materialGrade: 'Inconel 718',
      drawingNumber: 'DWG-AERO-718-X',
      uom: 'PCS'
    },
    quantity: {
      loadedQuantity: 100,
      completedQuantity: 100,
      scrappedQuantity: 0,
      targetQuantity: 100
    },
    weightKg: 450.5,
    dueDate: '2026-09-30T12:00:00.000Z',
    recipe: {
      recipeCode: 'REC-INCO-AEROSPACE',
      name: 'Vacuum Solution & Precipitation Ageing',
      recipeName: 'Vacuum Solution & Precipitation Ageing',
      revision: 3,
      recipeRevision: 3,
      processFamily: 'VACUUM_HEAT_TREATMENT'
    },
    recipeRevision: 3,
    currentWorkflowState: 'IN_INSPECTION',
    equipment: {
      furnaceCode: 'FURNACE-VAC-02',
      furnaceId: 'furnace_vac_02'
    }
  },
  workflowState: {
    status: 'IN_INSPECTION',
    waitingForProduction: false,
    inProduction: false,
    waitingForInspection: false,
    inInspection: true,
    waitingForDispatch: false,
    inspection: false,
    dispatched: false
  },
  executionSummary: {
    isProductionDataLocked: true,
    furnaceUsed: 'FURNACE-VAC-02',
    furnaceCode: 'FURNACE-VAC-02',
    chargeNumber: 'CHG-202609-88',
    operatorName: 'Marcus Vance',
    shiftId: 'SHIFT-ALPHA',
    loadedPieces: 100,
    loadedWeightKg: 450.5,
    totalStagesExecuted: 3,
    stagesCompleted: 3,
    concessionApproved: false,
    concessionReason: undefined
  },
  recipeAuthority: {
    recipeCode: 'REC-INCO-AEROSPACE',
    recipeName: 'Vacuum Solution & Precipitation Ageing',
    revision: 3,
    recipeRevision: 3,
    materialGrade: 'Inconel 718',
    surfaceHardnessTarget: {
      min: 58,
      max: 62,
      scale: 'HRC'
    },
    caseDepthTarget: {
      minMm: 0.8,
      maxMm: 1.2
    }
  },
  inspectionData: {
    furnaceCode: 'FURNACE-VAC-02',
    furnaceId: 'furnace_vac_02',
    minHardness: 58,
    maxHardness: 62,
    scale: 'HRC',
    actualHardness: {
      measuredAverage: 60.5,
      isHardnessCompliant: true,
      testPoints: [
        { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true },
        { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 61.0, scale: 'HRC', passed: true }
      ]
    },
    caseDepth: {
      effectiveCaseDepthMm: 0.95,
      caseDepthMethod: 'Microhardness Traverse (HV0.5 to 50 HRC)',
      isCaseDepthCompliant: true
    },
    quantityReceived: 100,
    quantityDelivered: 100,
    quantityRejected: 0,
    microstructureNotes: 'Fine tempered martensite, CQI-9 compliant.',
    remarks: 'Precipitation hardening cycle verified.'
  },
  processDetails: Array.from({ length: 15 }, (_, i) => ({
    serialNumber: i + 1,
    processNumber: i + 1,
    partCode: 'ITM-TURB-718',
    partName: 'Inconel 718 Turbine Rotor',
    process: i === 0 ? 'Preheat Ramp' : i === 1 ? 'Vacuum Solution Soak' : i === 2 ? 'Gas Quench' : `Stage ${i + 1}`,
    targetTemp: 650 + i * 20,
    targetDurationMinutes: 60,
    quenchMedium: 'High-Purity N2 (6 bar)',
    atmosphere: 'Vacuum 10^-4 mbar',
    status: i < 3 ? 'COMPLETED' : 'BLANK',
    isCompliant: true
  })),
  processTable: Array.from({ length: 15 }, (_, i) => ({
    serialNumber: i + 1,
    processNumber: i + 1,
    partCode: 'ITM-TURB-718',
    partName: 'Inconel 718 Turbine Rotor',
    process: i === 0 ? 'Preheat Ramp' : i === 1 ? 'Vacuum Solution Soak' : i === 2 ? 'Gas Quench' : `Stage ${i + 1}`,
    targetTemp: 650 + i * 20,
    targetDurationMinutes: 60,
    quenchMedium: 'High-Purity N2 (6 bar)',
    atmosphere: 'Vacuum 10^-4 mbar',
    status: i < 3 ? 'COMPLETED' : 'BLANK',
    isCompliant: true
  }))
};

const renderWorkbench = (props: { jobId: string; readOnlyOverride?: boolean }) => {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <InspectionWorkbench {...props} />
      </MemoryRouter>
    </Provider>
  );
};

describe('Inspection Phase — Prompt 8: Inspection Workbench and Record View Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/inspection-workbench')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: MOCK_ACTIVE_WORKBENCH_DATA
          })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: 'Operation successful' })
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Displays authoritative BO Context Header with all 10 required context metrics', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText('BO-202609-0099')).toBeDefined();
    });

    // Verify all 10 context properties
    expect(screen.getByText(/PO-2026-00888/i)).toBeDefined();
    expect(screen.getByText(/GRN-202609-0777/i)).toBeDefined();
    expect(screen.getByText(/Inconel 718 Turbine Rotor/i)).toBeDefined();
    expect(screen.getByText(/AeroJet Propulsion Systems/i)).toBeDefined();
    expect(screen.getAllByText(/100\s+PCS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/450.5\s+kg/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/REC-INCO-AEROSPACE/i)).toBeDefined();
    expect(screen.getByText(/\(REV 3\)/i)).toBeDefined();
    expect(screen.getAllByText(/IN INSPECTION/i).length).toBeGreaterThan(0);
  });

  it('2. Displays relevant Production Information in read-only mode with permanent historical lock', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText(/Production Execution Results \(Read-Only\)/i)).toBeDefined();
    });

    // Verify Read-Only Production Information
    expect(screen.getByText(/CHG-202609-88/i)).toBeDefined();
    expect(screen.getByText(/Marcus Vance/i)).toBeDefined();
    expect(screen.getByText(/SHIFT-ALPHA/i)).toBeDefined();
    expect(screen.getByText(/LOCKED HISTORY/i)).toBeDefined();

    // Verify Inspector CANNOT edit production history (furnace charge, shift, operator are read-only text)
    expect(screen.queryByLabelText(/edit production operator/i)).toBeNull();
    expect(screen.queryByLabelText(/rewrite charge/i)).toBeNull();
  });

  it('3. Distinguishes governing Recipe requirements from actual Inspection results', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText(/Governing Recipe Requirements/i)).toBeDefined();
    });

    // Required specification
    expect(screen.getByText(/58 - 62 HRC/i)).toBeDefined();
    expect(screen.getByText(/0.8 - 1.2 mm/i)).toBeDefined();

    // Actual Inspection results
    expect(screen.getByText(/Actual Hardness & Test Points Traverse/i)).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText(/60.75/i).length).toBeGreaterThan(0);
    });
  });

  it('4. Provides the Six Mandatory Heat-Treatment Fields and validates completeness', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText(/Six Mandatory Heat-Treatment Inspection Fields/i)).toBeDefined();
    });

    // 1. Furnace / Equipment Assignment
    expect(screen.getByDisplayValue('FURNACE-VAC-02')).toBeDefined();

    // 2. Hardness Specification
    expect(screen.getByDisplayValue('58')).toBeDefined();
    expect(screen.getByDisplayValue('62')).toBeDefined();

    // 3. Actual Hardness Test Points
    expect(screen.getByDisplayValue('P1-SURFACE')).toBeDefined();
    expect(screen.getByDisplayValue('P2-SURFACE')).toBeDefined();

    // 4. Case Depth
    expect(screen.getByDisplayValue('0.95')).toBeDefined();

    // 5 & 6. Quantity Received and Delivered (both 100 PCS)
    expect(screen.getAllByDisplayValue('100').length).toBeGreaterThanOrEqual(2);

    // Checklist indicates all criteria satisfied
    expect(screen.getByText(/Equipment Identified/i)).toBeDefined();
    expect(screen.getByText(/Hardness Spec Defined/i)).toBeDefined();
    expect(screen.getByText(/Hardness In-Spec/i)).toBeDefined();
    expect(screen.getAllByText(/Case Depth Compliant/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Qty Received Valid/i)).toBeDefined();
    expect(screen.getByText(/Qty Delivered Balanced/i)).toBeDefined();
    expect(screen.getByText(/Process Table Clean/i)).toBeDefined();
  });

  it('5. Displays the 15-position BO Process Details Table and supports row-level verification', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText(/Authoritative 15-Position Process Details Verification/i)).toBeDefined();
    });

    // Verify positions exist
    expect(screen.getByText('Preheat Ramp')).toBeDefined();
    expect(screen.getByText('Vacuum Solution Soak')).toBeDefined();
    expect(screen.getByText('Gas Quench')).toBeDefined();

    // Click "Verify Row" on Row 1
    const verifyButtons = screen.getAllByRole('button', { name: /verify/i });
    expect(verifyButtons.length).toBeGreaterThan(0);
    fireEvent.click(verifyButtons[0]);

    // Modal opens for row verification
    expect(screen.getByText(/Verify Process Position #1/i)).toBeDefined();

    // Submit Row Verification
    const confirmVerifyBtn = screen.getByRole('button', { name: /confirm position verification/i });
    fireEvent.click(confirmVerifyBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/verify-process-row'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('6. Detects out-of-range results and invalid bounds with disabled approval gating', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByText(/Six Mandatory Heat-Treatment Inspection Fields/i)).toBeDefined();
    });

    // Make Hardness Specification invalid: Min (65) > Max (62)
    const minInput = screen.getByDisplayValue('58');
    fireEvent.change(minInput, { target: { value: '65' } });

    // Approve for Dispatch button is disabled
    const approveBtn = screen.getByRole('button', { name: /approve for dispatch/i });
    expect(approveBtn.hasAttribute('disabled')).toBe(true);
  });

  it('7. Provides a separate explicit action: Approve for Dispatch staging into WAITING_FOR_DISPATCH', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve for dispatch/i })).toBeDefined();
    });

    const approveBtn = screen.getByRole('button', { name: /approve for dispatch/i });
    expect(approveBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(approveBtn);

    // Explicit Confirmation Modal opens
    expect(screen.getByText(/Authoritative Quality Release: Approve for Dispatch/i)).toBeDefined();

    // Confirm Approval
    const confirmApproveBtn = screen.getByRole('button', { name: /confirm release to dispatch staging/i });
    fireEvent.click(confirmApproveBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve-inspection'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('8. Provides the authoritative Inspection Failure operation staging into INSPECTION', async () => {
    renderWorkbench({ jobId: 'bo_test_99' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fail inspection \/ quarantine/i })).toBeDefined();
    });

    const failBtn = screen.getByRole('button', { name: /fail inspection \/ quarantine/i });
    fireEvent.click(failBtn);

    // Authoritative Quarantine Modal opens
    expect(screen.getByText(/Fail Quality Inspection & Quarantine Batch Order/i)).toBeDefined();

    // Select Defect Category and reason
    const reasonInput = screen.getByPlaceholderText(/detail hardness traverse excursions/i);
    fireEvent.change(reasonInput, { target: { value: 'Surface hardness below minimum specification (54 HRC)' } });

    // Confirm Failure
    const confirmFailBtn = screen.getByRole('button', { name: /confirm quarantine failure/i });
    fireEvent.click(confirmFailBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/fail-inspection'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('9. Enforces State Awareness: disables mutation controls and displays banner when BO is not in active inspection', async () => {
    // Mock response where BO is already in WAITING_FOR_DISPATCH
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/inspection-workbench')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...MOCK_ACTIVE_WORKBENCH_DATA,
              headerContext: {
                ...MOCK_ACTIVE_WORKBENCH_DATA.headerContext,
                currentWorkflowState: 'WAITING_FOR_DISPATCH'
              },
              workflowState: {
                status: 'WAITING_FOR_DISPATCH',
                inInspection: false,
                waitingForDispatch: true
              }
            }
          })
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
    });

    renderWorkbench({ jobId: 'bo_test_dispatched' });

    await waitFor(() => {
      expect(screen.getByText(/Read-Only Inspection Record View — Status: WAITING_FOR_DISPATCH/i)).toBeDefined();
    });

    // State awareness text is visible
    expect(screen.getByText(/State Awareness Protection/i)).toBeDefined();

    // Mutation buttons (Approve, Fail) must be disabled
    const approveBtn = screen.getByRole('button', { name: /approve for dispatch/i });
    expect(approveBtn.hasAttribute('disabled')).toBe(true);
    const failBtn = screen.getByRole('button', { name: /fail inspection \/ quarantine/i });
    expect(failBtn.hasAttribute('disabled')).toBe(true);
  });

  it('10. Enforces readOnlyOverride prop for historical inspection audits', async () => {
    renderWorkbench({ jobId: 'bo_test_99', readOnlyOverride: true });

    await waitFor(() => {
      expect(screen.getByText(/Read-Only Inspection Record View/i)).toBeDefined();
    });

    // Mutation buttons are disabled
    const approveBtn = screen.getByRole('button', { name: /approve for dispatch/i });
    expect(approveBtn.hasAttribute('disabled')).toBe(true);
    const failBtn = screen.getByRole('button', { name: /fail inspection \/ quarantine/i });
    expect(failBtn.hasAttribute('disabled')).toBe(true);
  });
});
