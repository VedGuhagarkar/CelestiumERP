import React from 'react';
import { Flame, Bell, Search, Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '../store/slices/uiSlice.js';
import { useAuth } from '../hooks/useAuth.js';
import type { RootState } from '../store/store.js';

interface HeaderProps {
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { isSidebarCollapsed } = useSelector((state: RootState) => state.ui);

  return (
    <header
      style={{
        height: '60px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--material-thick)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Brand & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => dispatch(toggleSidebar())}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-md)'
          }}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-primary), #b45309)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            <Flame size={20} color="#ffffff" />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', color: '#ffffff' }}>
              ASTRALIS
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ERP
            </span>
          </div>
        </div>
      </div>

      {/* Global Search & User Profile Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Search Bar Shortcut */}
        <div
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--material-thin)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '6px 14px',
            color: 'var(--color-text-muted)',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease'
          }}
        >
          <Search size={15} />
          <span>Quick search...</span>
          <kbd
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--color-text-secondary)'
            }}
          >
            Ctrl+K
          </kbd>
        </div>

        {/* Notifications Icon */}
        <button
          style={{
            position: 'relative',
            background: 'var(--material-thin)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer'
          }}
          title="Notifications"
        >
          <Bell size={18} />
          <span
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)'
            }}
          />
        </button>

        {/* User Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px', borderLeft: '1px solid var(--color-border-subtle)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--material-thin)',
              border: '1px solid var(--color-border-regular)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)'
            }}
          >
            <UserIcon size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Plant Operator'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {user?.roles?.[0] || 'Metallurgy Team'}
            </span>
          </div>

          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              marginLeft: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
