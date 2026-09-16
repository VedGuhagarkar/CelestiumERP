// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { setCredentials, logout } from './store/slices/authSlice.js';
import { authenticatedFetch, apiClient } from './services/apiClient.js';
import { AppButton } from './design-system/buttons/AppButton.js';
import { AppDialog } from './design-system/feedback/AppDialog.js';
import { MainLayout } from './layouts/MainLayout.js';
import { MachinesPage } from './pages/MachinesPage.js';
import { FinancePage } from './pages/FinancePage.js';

// Mock localStorage in memory
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  })
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('PROMPT 5: Frontend Interaction & State-Management Regression Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock.clear();
    store.dispatch(logout());
  });

  afterEach(() => {
    cleanup();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. URL DEDUPLICATION & SANITIZATION                                       */
  /* -------------------------------------------------------------------------- */
  describe('1. API URL Normalization & Deduplication', () => {
    it('strips redundant /api/v1/api/v1/ prefixes to ensure single API route prefix', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
        requestedUrl = typeof input === 'string' ? input : input.url;
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      await authenticatedFetch('http://localhost:5000/api/v1/api/v1/production-jobs/waiting-for-production');

      expect(requestedUrl).toBe('http://localhost:5000/api/v1/production-jobs/waiting-for-production');
      expect(requestedUrl).not.toContain('/api/v1/api/v1/');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. APICLIENT HTTP VERB METHODS                                             */
  /* -------------------------------------------------------------------------- */
  describe('2. apiClient HTTP Methods (GET, POST, PUT, PATCH, DELETE)', () => {
    it('dispatches apiClient.patch with PATCH method and stringified body', async () => {
      let capturedMethod = '';
      let capturedBody = '';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        capturedMethod = init?.method || 'GET';
        capturedBody = init?.body || '';
        return new Response(JSON.stringify({ success: true, data: { patched: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const res = await apiClient.patch('http://localhost:5000/api/v1/orders/123', {
        status: 'DISPATCHED'
      });

      expect(capturedMethod).toBe('PATCH');
      expect(JSON.parse(capturedBody)).toEqual({ status: 'DISPATCHED' });
      expect(res.status).toBe(200);
    });

    it('dispatches apiClient.delete with DELETE method', async () => {
      let capturedMethod = '';

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        capturedMethod = init?.method || 'GET';
        return new Response(JSON.stringify({ success: true, message: 'Deleted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const res = await apiClient.delete('http://localhost:5000/api/v1/items/part-1');
      expect(capturedMethod).toBe('DELETE');
      expect(res.status).toBe(200);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. DOUBLE-SUBMISSION MUTEXING                                              */
  /* -------------------------------------------------------------------------- */
  describe('3. Form Double-Submission Prevention & Button Disabling', () => {
    it('prevents duplicate submissions on rapid double-clicking via isSubmitting mutex', async () => {
      let callCount = 0;
      let resolveFetch: (val: any) => void = () => {};

      globalThis.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            callCount++;
            resolveFetch = resolve;
          })
      );

      // Simple form component simulating a submit handler with mutex protection
      const TestSubmitComponent = () => {
        const [isSubmitting, setIsSubmitting] = useState(false);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (isSubmitting) return; // Mutex protection
          setIsSubmitting(true);
          try {
            await globalThis.fetch('http://localhost:5000/api/v1/submit');
          } finally {
            setIsSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <AppButton type="submit" isLoading={isSubmitting}>
              Submit Lot
            </AppButton>
          </form>
        );
      };

      render(<TestSubmitComponent />);
      const btn = screen.getByRole('button', { name: /submit lot/i });

      // Simulate rapid double click
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);

      // Verify the fetch was only invoked ONCE
      expect(callCount).toBe(1);

      // Resolve the request and verify button returns to ready state
      resolveFetch(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit lot/i })).not.toBeNull();
      });
    });

    it('FinancePage create invoice ignores rapid repeated submit clicks when isSubmitting is active', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (init?.method === 'POST' && url.includes('/billing/invoices')) {
          callCount++;
          // simulate slow response
          await new Promise((r) => setTimeout(r, 100));
          return new Response(JSON.stringify({ success: true, data: { invoiceNumber: 'INV-TEST-01' } }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      render(
        <MemoryRouter>
          <FinancePage />
        </MemoryRouter>
      );

      // Open modal
      const openBtn = screen.getByRole('button', { name: /create invoice/i });
      fireEvent.click(openBtn);

      // Get submit button in dialog
      const submitBtn = screen.getByRole('button', { name: /issue invoice/i });

      // Click rapidly twice
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(callCount).toBe(1);
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. BACKEND ERROR MASKING DEFECT FIX VERIFICATION                           */
  /* -------------------------------------------------------------------------- */
  describe('4. Backend Failure Error Handling (No Masked Errors)', () => {
    it('MachinesPage displays red error alert when calibration survey fails on backend with 400', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (init?.method === 'POST' && url.includes('/pyrometry/sat-logs')) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Pyrometry Standard Violation: thermocouple calibration date is expired.'
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                machineCode: 'FURNACE-VAC-01',
                name: 'Vacuum Furnace Unit 1',
                type: 'VACUUM',
                status: 'IDLE',
                currentTemperatureC: 25,
                temperatureUniformityClass: 'CLASS_2',
                instrumentationType: 'TYPE_B'
              }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      });

      render(
        <MemoryRouter>
          <MachinesPage />
        </MemoryRouter>
      );

      // Wait for furnace card to render
      await waitFor(() => {
        expect(screen.getByText('FURNACE-VAC-01')).toBeDefined();
      });

      // Click "Configure / Calibrate" to open the furnace telemetry drawer
      const configBtns = screen.getAllByRole('button', { name: /configure \/ calibrate/i });
      fireEvent.click(configBtns[0]);

      // In drawer, find "Log SAT / TUS Survey" button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log sat/i })).toBeDefined();
      });

      const satBtn = screen.getByRole('button', { name: /log sat/i });
      fireEvent.click(satBtn);

      // Confirm that the UI displayed the red error alert with the backend message, NOT success!
      await waitFor(() => {
        expect(
          screen.getByText(/thermocouple calibration date is expired/i)
        ).toBeDefined();
        // Crucial: check that it didn't display "Operation Success" or the old mock text
        expect(screen.queryByText(/SAT Survey simulated/i)).toBeNull();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. MODAL & DIALOG LIFECYCLE & DISMISSAL                                    */
  /* -------------------------------------------------------------------------- */
  describe('5. Modal & Dialog Dismissal Actions', () => {
    it('closes modal on backdrop click, escape key, and close button', () => {
      const handleClose = vi.fn();

      const { rerender } = render(
        <AppDialog isOpen={true} onClose={handleClose} title="Inspection Quarantine Modal">
          <p>Quarantine Reason Input</p>
        </AppDialog>
      );

      // 1. Close via close button
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // 2. Close via Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);

      // 3. Close via clicking backdrop (which is the dialog container element itself)
      const dialogBackdrop = screen.getByRole('dialog');
      fireEvent.click(dialogBackdrop);
      expect(handleClose).toHaveBeenCalledTimes(3);

      // 4. Closed modal does not render in DOM
      rerender(
        <AppDialog isOpen={false} onClose={handleClose} title="Inspection Quarantine Modal">
          <p>Quarantine Reason Input</p>
        </AppDialog>
      );

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. ROUTE NAVIGATION AUTO-DISMISSAL                                         */
  /* -------------------------------------------------------------------------- */
  describe('6. Navigation & Route Change State Reset', () => {
    it('MainLayout automatically dismisses search command palette when route changes', async () => {
      const NavigationTrigger = () => {
        const navigate = useNavigate();
        return (
          <div>
            <button onClick={() => navigate('/machines')}>Go to Machines</button>
            <button onClick={() => navigate('/quality')}>Go to Quality</button>
          </div>
        );
      };

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<NavigationTrigger />} />
                <Route path="/machines" element={<div>Machines Page Content</div>} />
                <Route path="/quality" element={<div>Quality Page Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      // Open command palette by clicking the "Quick search..." button in Header
      const searchTriggerBtn = screen.getByRole('button', { name: /quick search/i });
      fireEvent.click(searchTriggerBtn);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/search jobs, furnaces, heat lots, materials, qc records/i)
        ).toBeDefined();
      });

      // Now click navigation link to go to /machines
      const navBtn = screen.getByRole('button', { name: /go to machines/i });
      fireEvent.click(navBtn);

      // Command palette must be automatically closed!
      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(/search jobs, furnaces, heat lots, materials, qc records/i)
        ).toBeNull();
        expect(screen.getByText('Machines Page Content')).toBeDefined();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. CONCURRENT TOKEN REFRESH SINGLE-FLIGHT MUTEX                            */
  /* -------------------------------------------------------------------------- */
  describe('7. Concurrent Token Refresh Single-Flight Mutex Under 401s', () => {
    it('queues concurrent 401 requests and only executes token refresh endpoint once', async () => {
      store.dispatch(
        setCredentials({
          user: { id: 'u1', email: 'test@factory.com', firstName: 'John', lastName: 'Doe', roles: ['OPERATOR'], tenantId: 'tenant_1' },
          token: 'expired_jwt_abc',
          refreshToken: 'refresh_jwt_xyz',
          tenantId: 'tenant_1'
        })
      );

      let refreshEndpointCalls = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;

        // Handle refresh endpoint
        if (url.includes('/auth/refresh-token')) {
          refreshEndpointCalls++;
          // Simulate refresh latency
          await new Promise((r) => setTimeout(r, 50));
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                accessToken: 'freshly_minted_jwt_token_999',
                refreshToken: 'freshly_minted_refresh_token_888'
              }
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        // For original requests: extract Authorization header safely
        let authHeader = '';
        if (init?.headers && typeof init.headers.get === 'function') {
          authHeader = init.headers.get('Authorization') || init.headers.get('authorization') || '';
        } else if (init?.headers) {
          authHeader = init.headers.Authorization || init.headers.authorization || '';
        }

        // If using expired token, return 401
        if (authHeader.includes('expired_jwt_abc')) {
          return new Response(JSON.stringify({ message: 'Token expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // If using fresh token, return 200 success
        if (authHeader.includes('freshly_minted_jwt_token_999')) {
          return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: false, message: `Unexpected auth header: ${authHeader}` }), { status: 500 });
      });

      // Launch 5 concurrent calls simultaneously
      const [res1, res2, res3, res4, res5] = await Promise.all([
        authenticatedFetch('http://localhost:5000/api/v1/jobs'),
        authenticatedFetch('http://localhost:5000/api/v1/warehouses'),
        authenticatedFetch('http://localhost:5000/api/v1/pyrometry/fleets'),
        authenticatedFetch('http://localhost:5000/api/v1/dispatches'),
        authenticatedFetch('http://localhost:5000/api/v1/costing/summary')
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
      expect(res4.status).toBe(200);
      expect(res5.status).toBe(200);

      // Crucial: Single-flight mutex guarantees refresh-token endpoint was hit EXACTLY ONCE
      expect(refreshEndpointCalls).toBe(1);
    });
  });
});
