import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export const MainLayout: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, backgroundColor: 'var(--color-bg-base)', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
