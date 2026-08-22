import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { CommandPalette } from '../components/navigation/CommandPalette.js';

export const MainLayout: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onOpenSearch={() => setIsSearchOpen(true)} />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, backgroundColor: 'var(--color-bg-base)', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};
