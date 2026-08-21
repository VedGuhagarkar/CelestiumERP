import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store.js';
import { MainLayout } from './layouts/MainLayout.js';
import { AuthLayout } from './layouts/AuthLayout.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
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
