// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { JobsPage } from './pages/JobsPage.js';
import { MachinesPage } from './pages/MachinesPage.js';
import { QualityPage } from './pages/QualityPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { WarehousePage } from './pages/WarehousePage.js';
import { WorkforcePage } from './pages/WorkforcePage.js';
import { DispatchPage } from './pages/DispatchPage.js';
import { FinancePage } from './pages/FinancePage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { UnauthorizedPage } from './pages/UnauthorizedPage.js';
import { Header } from './layouts/Header.js';
import { Sidebar } from './layouts/Sidebar.js';
import { CommandPalette } from './components/navigation/CommandPalette.js';

// Helper to render with Provider & Router
const renderWithProviders = (ui: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </Provider>
  );
};

describe('End-to-End Manufacturing ERP Interaction Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default fetch mock
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] })
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Authentication & Session Interactions', () => {
    it('selects quick demo personas and populates login inputs', () => {
      renderWithProviders(<LoginPage />);

      const supervisorBtn = screen.getByRole('button', { name: /production supervisor/i });
      fireEvent.click(supervisorBtn);

      const emailInput = screen.getByPlaceholderText(/admin@astralis.internal/i) as HTMLInputElement;
      expect(emailInput.value).toBe('supervisor@astralis.internal');
    });

    it('submits login form and stores token on success', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              user: {
                id: 'usr_01',
                email: 'admin@astralis.internal',
                firstName: 'Alice',
                lastName: 'Admin',
                roles: ['SUPERADMIN'],
                permissions: ['ALL'],
                tenantId: 'tenant_default_001',
                status: 'ACTIVE'
              },
              tokens: {
                accessToken: 'mock_jwt_access_token',
                refreshToken: 'mock_jwt_refresh_token'
              }
            }
          })
        })
      );

      renderWithProviders(<LoginPage />);

      const submitBtn = screen.getByRole('button', { name: /authenticate & enter/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(localStorage.getItem('astralis_access_token')).toBe('mock_jwt_access_token');
      });
    });

    it('displays error alert when login fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ success: false, message: 'Invalid credentials' })
        })
      );

      renderWithProviders(<LoginPage />);

      const submitBtn = screen.getByRole('button', { name: /authenticate & enter/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeDefined();
      });
    });
  });

  describe('2. Navigation, Sidebar, & Header Controls', () => {
    it('renders all manufacturing module navigation items in Sidebar', () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText('Command Center')).toBeDefined();
      expect(screen.getByText('Production Jobs')).toBeDefined();
      expect(screen.getByText('Quality & Lab')).toBeDefined();
      expect(screen.getByText('Furnaces & Pyrometry')).toBeDefined();
      expect(screen.getByText('Inventory & Heat Lots')).toBeDefined();
      expect(screen.getByText('Warehouse & FG')).toBeDefined();
      expect(screen.getByText('Workforce & Shifts')).toBeDefined();
      expect(screen.getByText('Outbound Dispatch')).toBeDefined();
      expect(screen.getByText('Costing & Finance')).toBeDefined();
      expect(screen.getByText('Executive Analytics')).toBeDefined();
      expect(screen.getByText('Platform Settings')).toBeDefined();
    });

    it('toggles notification popover on header bell click', () => {
      renderWithProviders(<Header />);

      const bellBtn = screen.getByLabelText(/view notifications/i);
      fireEvent.click(bellBtn);

      expect(screen.getByText(/live plant alerts/i)).toBeDefined();
      expect(screen.getByText(/furnace f-01 tus passed/i)).toBeDefined();

      // Close notifications popover
      const closeBtn = screen.getByRole('button', { name: '' });
      fireEvent.click(closeBtn);
    });
  });

  describe('3. Production Jobs & Thermal Cycles', () => {
    it('opens New Thermal Job dialog and creates a new batch', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: { id: 'job_new_01', jobNumber: 'JOB-202608-9999' }
          })
        })
      );

      renderWithProviders(<JobsPage />);

      const newJobBtn = screen.getByRole('button', { name: /new thermal job/i });
      fireEvent.click(newJobBtn);

      expect(screen.getByText(/create direct thermal processing job/i)).toBeDefined();

      const scheduleBtn = screen.getByRole('button', { name: /schedule production job/i });
      fireEvent.click(scheduleBtn);

      await waitFor(() => {
        expect(screen.getByText(/thermal job successfully scheduled/i)).toBeDefined();
      });
    });

    it('filters production jobs by status tabs', () => {
      renderWithProviders(<JobsPage />);

      const inProgressBtn = screen.getByRole('button', { name: /in progress/i });
      fireEvent.click(inProgressBtn);

      expect(screen.getByText('JOB-202608-0010')).toBeDefined();
    });

    it('opens job details drawer and advances thermal cycle stage', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { status: 'IN_PROGRESS' } })
        })
      );

      renderWithProviders(<JobsPage />);

      const detailsBtns = screen.getAllByRole('button', { name: /details/i });
      fireEvent.click(detailsBtns[0]);

      expect(screen.getByText(/metallurgical thermal recipe/i)).toBeDefined();

      const advanceBtn = screen.getByRole('button', { name: /advance thermal cycle/i });
      fireEvent.click(advanceBtn);

      await waitFor(() => {
        expect(screen.getByText(/cycle stage successfully advanced/i)).toBeDefined();
      });
    });
  });

  describe('4. Furnace Fleet & Pyrometry Telemetry', () => {
    it('switches between fleet view and maintenance work orders', () => {
      renderWithProviders(<MachinesPage />);

      const maintBtn = screen.getByRole('button', { name: /maintenance & calibrations/i });
      fireEvent.click(maintBtn);

      expect(screen.getByText('WO-2026-0012')).toBeDefined();

      const fleetBtn = screen.getByRole('button', { name: /furnace fleet & pyrometry/i });
      fireEvent.click(fleetBtn);

      expect(screen.getByText('FURNACE-VAC-01')).toBeDefined();
    });

    it('opens Configure Furnace dialog and registers new unit', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { id: 'mach_new_01' } })
        })
      );

      renderWithProviders(<MachinesPage />);

      const configBtn = screen.getByRole('button', { name: /configure furnace/i });
      fireEvent.click(configBtn);

      expect(screen.getByText(/configure new thermal processing unit/i)).toBeDefined();

      const saveBtn = screen.getByRole('button', { name: /save furnace asset/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/successfully configured and registered/i)).toBeDefined();
      });
    });
  });

  describe('5. Quality & Metallurgical Laboratory', () => {
    it('opens New Inspection modal and records conforming hardness test', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { id: 'qc_new_01' } })
        })
      );

      renderWithProviders(<QualityPage />);

      const newInspBtn = screen.getByRole('button', { name: /new inspection/i });
      fireEvent.click(newInspBtn);

      expect(screen.getByText(/record metallurgical inspection/i)).toBeDefined();

      const approveBtn = screen.getByRole('button', { name: /approve inspection record/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(screen.getByText(/quality inspection recorded/i)).toBeDefined();
      });
    });

    it('opens inspection drawer and generates Certificate of Conformance (CoC)', async () => {
      renderWithProviders(<QualityPage />);

      const viewCocBtns = screen.getAllByRole('button', { name: /view coc/i });
      fireEvent.click(viewCocBtns[0]);

      expect(screen.getByText(/rockwell c & micro-hardness test results/i)).toBeDefined();

      const genCocBtn = screen.getByRole('button', { name: /generate certificate of conformance/i });
      fireEvent.click(genCocBtn);

      await waitFor(() => {
        expect(screen.getByText(/certificate of conformance \(coc\) generated/i)).toBeDefined();
      });
    });
  });

  describe('6. Creation Phase & Metallurgical Material Inwarding Lineage', () => {
    it('switches between Creation Phase tabs (POs, Receipts, GRNs, Traceable Units) with active search filtering', () => {
      renderWithProviders(<InventoryPage />);

      // Search filters active POs
      const searchInput = screen.getByPlaceholderText(/search pos, grns, units, melts/i);
      fireEvent.change(searchInput, { target: { value: 'Timken' } });
      expect(screen.getByText('PO-202609-0001')).toBeDefined();

      // Switch to Traceable Units tab
      const unitsTabBtn = screen.getByRole('tab', { name: /traceable units/i });
      fireEvent.click(unitsTabBtn);
      expect(screen.getByText('UNIT-GRN-202609-0001-001')).toBeDefined();
    });

    it('opens Create Purchase Order dialog and issues PO with bound Recipe', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              id: 'po_test_01',
              poNumber: 'PO-202609-0099',
              supplierName: 'TimkenSteel Specialty Metals',
              status: 'ISSUED',
              items: [
                {
                  itemId: 'itm_01',
                  itemCode: 'MAT-4140-RND-50',
                  materialGrade: 'AISI 4140',
                  recipeId: 'rec_01',
                  recipeCode: 'REC-CARB-4140-01',
                  orderedQuantity: 5000,
                  uom: 'KG',
                  unitPrice: 4.85
                }
              ]
            }
          })
        })
      );

      renderWithProviders(<InventoryPage />);

      const createPoBtn = screen.getByRole('button', { name: /create purchase order/i });
      fireEvent.click(createPoBtn);

      expect(screen.getByText(/create purchase order \(step 1 of creation phase\)/i)).toBeDefined();

      const submitPoBtn = screen.getByRole('button', { name: /issue purchase order/i });
      fireEvent.click(submitPoBtn);

      await waitFor(() => {
        expect(screen.getByText(/created successfully/i)).toBeDefined();
      });
    });

    it('opens Record Material Receipt dialog and records delivery against PO', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              id: 'rcpt_test_01',
              receiptNumber: 'MR-202609-0099',
              poNumber: 'PO-202609-0001',
              status: 'RECEIVED'
            }
          })
        })
      );

      renderWithProviders(<InventoryPage />);

      const recordRcptBtn = screen.getByRole('button', { name: /record material receipt/i });
      fireEvent.click(recordRcptBtn);

      expect(screen.getByText(/record physical material receipt/i)).toBeDefined();

      const saveRcptBtn = screen.getByRole('button', { name: /save material receipt/i });
      fireEvent.click(saveRcptBtn);

      await waitFor(() => {
        expect(screen.getByText(/recorded against/i)).toBeDefined();
      });
    });

    it('opens and previews official Goods Receipt Note (GRN) with signature blocks for printing', () => {
      renderWithProviders(<InventoryPage />);

      // Switch to GRNs tab
      const grnTabBtn = screen.getByRole('tab', { name: /goods receipt notes/i });
      fireEvent.click(grnTabBtn);

      expect(screen.getByText('GRN-202609-0001')).toBeDefined();

      const printBtn = screen.getByRole('button', { name: /print grn/i });
      fireEvent.click(printBtn);

      expect(screen.getByText(/celestium advanced heat treatment works/i)).toBeDefined();
      expect(screen.getByText(/metallurgical qc inspector/i)).toBeDefined();
    });
  });

  describe('7. Warehouse & Storage Bay Management', () => {
    it('opens Add Storage Bay dialog and provisions new warehouse location', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { id: 'wh_new_01' } })
        })
      );

      renderWithProviders(<WarehousePage />);

      const addBayBtn = screen.getByRole('button', { name: /add storage bay/i });
      fireEvent.click(addBayBtn);

      expect(screen.getByText(/add storage facility \/ bay/i)).toBeDefined();

      const saveBtn = screen.getByRole('button', { name: /save storage bay/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/successfully provisioned/i)).toBeDefined();
      });
    });
  });

  describe('8. Workforce & Shift Attendance', () => {
    it('opens Clock In dialog and submits operator duty record', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'att_01' } })
        })
      );

      renderWithProviders(<WorkforcePage />);

      const clockInBtn = screen.getByRole('button', { name: /clock in \/ log attendance/i });
      fireEvent.click(clockInBtn);

      expect(screen.getByText(/record operator shift attendance/i)).toBeDefined();

      const confirmBtn = screen.getByRole('button', { name: /confirm clock in/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/attendance recorded for operator/i)).toBeDefined();
      });
    });
  });

  describe('9. Outbound Dispatch & Gate Pass Logistics', () => {
    it('opens Create Consignment modal and generates shipping challan', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { id: 'dsp_new_01' } })
        })
      );

      renderWithProviders(<DispatchPage />);

      const createBtn = screen.getByRole('button', { name: /create consignment/i });
      fireEvent.click(createBtn);

      expect(screen.getByText(/create outbound shipping consignment/i)).toBeDefined();

      const submitBtn = screen.getByRole('button', { name: /generate delivery challan/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/outbound consignment successfully booked/i)).toBeDefined();
      });
    });

    it('prints gate pass & delivery challan from dispatch drawer', async () => {
      renderWithProviders(<DispatchPage />);

      const detailsBtns = screen.getAllByRole('button', { name: /details/i });
      fireEvent.click(detailsBtns[0]);

      expect(screen.getByText(/security gate pass & quality release/i)).toBeDefined();

      const printBtn = screen.getByRole('button', { name: /print gate pass & challan/i });
      fireEvent.click(printBtn);

      await waitFor(() => {
        expect(screen.getByText(/sent to factory gate printer/i)).toBeDefined();
      });
    });
  });

  describe('10. Finance, Billing & Job Costing', () => {
    it('switches between commercial invoices and job costing tabs', () => {
      renderWithProviders(<FinancePage />);

      const costingBtn = screen.getByRole('button', { name: /job costing & profitability/i });
      fireEvent.click(costingBtn);

      expect(screen.getByText('COST-202608-0008')).toBeDefined();

      const invoicesBtn = screen.getByRole('button', { name: /commercial invoices/i });
      fireEvent.click(invoicesBtn);

      expect(screen.getByText('INV-2026-0089')).toBeDefined();
    });

    it('opens Create Invoice modal and issues customer billing', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { id: 'inv_new_01' } })
        })
      );

      renderWithProviders(<FinancePage />);

      const createInvoiceBtn = screen.getByRole('button', { name: /create invoice/i });
      fireEvent.click(createInvoiceBtn);

      expect(screen.getByText(/issue commercial invoice/i)).toBeDefined();

      const submitBtn = screen.getByRole('button', { name: /issue invoice/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/generated and issued/i)).toBeDefined();
      });
    });
  });

  describe('11. Command Center & Real-Time Telemetry Controls', () => {
    it('switches shop floor tabs between Floor, Alerts, and Activity', () => {
      renderWithProviders(<DashboardPage />);

      const alertsTab = screen.getByRole('button', { name: /approvals & quality alerts/i });
      fireEvent.click(alertsTab);

      expect(screen.getByText(/case depth shallow after tempering/i)).toBeDefined();

      const activityTab = screen.getByRole('button', { name: /workforce & live activity/i });
      fireEvent.click(activityTab);

      expect(screen.getByText(/qc inspector verified test specimen/i)).toBeDefined();

      const floorTab = screen.getByRole('button', { name: /shop floor operations/i });
      fireEvent.click(floorTab);

      expect(screen.getByText(/furnace fleet telemetry/i)).toBeDefined();
    });

    it('toggles time filter buttons (Today, Last 7 Days, This Month)', () => {
      renderWithProviders(<DashboardPage />);

      const weekBtn = screen.getByRole('button', { name: /last 7 days/i });
      fireEvent.click(weekBtn);

      const monthBtn = screen.getByRole('button', { name: /this month/i });
      fireEvent.click(monthBtn);

      const todayBtn = screen.getByRole('button', { name: /today/i });
      fireEvent.click(todayBtn);
    });
  });

  describe('12. Executive Analytics, Reports & Settings Workflows', () => {
    it('renders ReportsPage, changes time periods, and triggers report export', () => {
      renderWithProviders(<ReportsPage />);

      const quarterBtn = screen.getByRole('button', { name: /this quarter/i });
      fireEvent.click(quarterBtn);

      const exportBtn = screen.getByRole('button', { name: /export report/i });
      fireEvent.click(exportBtn);

      expect(screen.getByText(/executive manufacturing report \(quarter\) generated/i)).toBeDefined();
    });

    it('renders SettingsPage and switches between plant config and regulatory audit logs', () => {
      renderWithProviders(<SettingsPage />);

      expect(screen.getByText('Organization & Tenant Context')).toBeDefined();

      const auditTab = screen.getByRole('button', { name: /regulatory audit logs/i });
      fireEvent.click(auditTab);

      expect(screen.getByText('PRODUCTION_JOB_SOAK_STAGE_STARTED')).toBeDefined();
    });

    it('renders NotFoundPage and handles return to dashboard navigation', () => {
      renderWithProviders(<NotFoundPage />);

      expect(screen.getByText('404')).toBeDefined();
      const returnBtn = screen.getByRole('button', { name: /return to command center/i });
      fireEvent.click(returnBtn);
    });

    it('renders UnauthorizedPage and handles safety navigation', () => {
      renderWithProviders(<UnauthorizedPage />);

      expect(screen.getByText('Access Restricted')).toBeDefined();
      const backBtn = screen.getByRole('button', { name: /back to safety/i });
      fireEvent.click(backBtn);
    });

    it('renders CommandPalette when open and filters manufacturing search results', () => {
      const handleClose = vi.fn();
      renderWithProviders(<CommandPalette isOpen={true} onClose={handleClose} />);

      const searchInput = screen.getByPlaceholderText(/search jobs, furnaces/i);
      expect(searchInput).toBeDefined();

      fireEvent.change(searchInput, { target: { value: 'Jobs' } });
      expect(screen.getByText('All Domains')).toBeDefined();
    });
  });
});
