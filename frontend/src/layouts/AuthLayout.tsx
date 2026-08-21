import React from 'react';
import { Outlet } from 'react-router-dom';
import { Flame } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0b0f17 70%)',
        padding: '20px'
      }}
    >
      <div style={{ marginBottom: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, var(--color-primary), #b45309)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          <Flame size={28} color="#ffffff" />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
          ASTRALIS ERP
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Precision Thermal Processing & Metallurgical Manufacturing
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '420px' }} className="animate-page-enter">
        <Outlet />
      </div>
    </div>
  );
};
