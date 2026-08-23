import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { MainLayout } from './layouts/MainLayout.js';
import { AuthLayout } from './layouts/AuthLayout.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { JobsPage } from './pages/JobsPage.js';
import { QualityPage } from './pages/QualityPage.js';
import { MachinesPage } from './pages/MachinesPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { WarehousePage } from './pages/WarehousePage.js';
import { WorkforcePage } from './pages/WorkforcePage.js';
import { DispatchPage } from './pages/DispatchPage.js';
import { FinancePage } from './pages/FinancePage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { UnauthorizedPage } from './pages/UnauthorizedPage.js';

export const App: React.FC = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {/* Auth Shell Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Main Shell Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Manufacturing & Operations Domains */}
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/production-jobs" element={<JobsPage />} />
              <Route path="/production-jobs/:id" element={<JobsPage />} />

              <Route path="/quality" element={<QualityPage />} />
              <Route path="/quality/inspections" element={<QualityPage />} />
              <Route path="/quality/inspections/:id" element={<QualityPage />} />
              <Route path="/quality/ncrs" element={<QualityPage />} />
              <Route path="/quality/ncrs/:id" element={<QualityPage />} />
              <Route path="/ncrs" element={<QualityPage />} />

              <Route path="/machines" element={<MachinesPage />} />
              <Route path="/machines/:id" element={<MachinesPage />} />
              <Route path="/furnaces" element={<MachinesPage />} />
              <Route path="/maintenance" element={<MachinesPage />} />

              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/items/:id" element={<InventoryPage />} />
              <Route path="/heat-lots" element={<InventoryPage />} />
              <Route path="/heat-lots/:id" element={<InventoryPage />} />

              <Route path="/warehouse" element={<WarehousePage />} />
              <Route path="/warehouses" element={<WarehousePage />} />
              <Route path="/finished-goods" element={<WarehousePage />} />

              <Route path="/workforce" element={<WorkforcePage />} />
              <Route path="/attendance" element={<WorkforcePage />} />

              <Route path="/dispatch" element={<DispatchPage />} />
              <Route path="/dispatches" element={<DispatchPage />} />
              <Route path="/dispatches/:id" element={<DispatchPage />} />

              <Route path="/finance" element={<FinancePage />} />
              <Route path="/billing" element={<FinancePage />} />
              <Route path="/billing/invoices/:id" element={<FinancePage />} />
              <Route path="/costing" element={<FinancePage />} />

              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reporting" element={<ReportsPage />} />

              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit" element={<SettingsPage />} />

              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/404" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* Catch-all redirect to 404 */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
};

export default App;
