import React, { useState, useRef, useEffect } from 'react';
import { Flame, Bell, Search, Menu, LogOut, User as UserIcon, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '../store/slices/uiSlice.js';
import { useAuth } from '../hooks/useAuth.js';
import { IconButton } from '../design-system/buttons/IconButton.js';
import type { RootState } from '../store/store.js';

interface HeaderProps {
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { isSidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  const sampleNotifications = [
    {
      id: '1',
      title: 'Furnace F-01 TUS Passed',
      desc: 'Annual temperature uniformity survey conforms to AMS 2750G Class 2.',
      time: '10m ago',
      type: 'success'
    },
    {
      id: '2',
      title: 'Batch BATCH-202608-001 In Soak',
      desc: 'Carburizing cycle reached 930°C soak stage. Carbon potential steady at 0.95%.',
      time: '35m ago',
      type: 'info'
    },
    {
      id: '3',
      title: 'Quarantine Lot Inspected',
      desc: 'Heat lot HL-4140-001 passed spectrometer chemical verification.',
      time: '2h ago',
      type: 'warning'
    }
  ];

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
        <IconButton
          icon={<Menu size={20} />}
          aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          onClick={() => dispatch(toggleSidebar())}
          variant="ghost"
          size="md"
        />

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
        <button
          type="button"
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
            transition: 'border-color 0.15s ease',
            outline: 'none'
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
        </button>

        {/* Notifications Icon with Popover */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-label="View notifications"
            style={{
              position: 'relative',
              background: isNotificationsOpen ? 'var(--color-primary-subtle)' : 'var(--material-thin)',
              border: isNotificationsOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isNotificationsOpen ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all var(--duration-fast) var(--ease-spring)'
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

          {isNotificationsOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '360px',
                backgroundColor: 'var(--material-thick)',
                border: '1px solid var(--color-border-regular)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
                zIndex: 100
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>Live Plant Alerts</div>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '320px', overflowY: 'auto' }}>
                {sampleNotifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {n.type === 'success' ? (
                        <CheckCircle2 size={16} color="#34d399" />
                      ) : n.type === 'warning' ? (
                        <AlertTriangle size={16} color="#f59e0b" />
                      ) : (
                        <Info size={16} color="#38bdf8" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{n.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                        {n.desc}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                        {n.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

          <IconButton
            icon={<LogOut size={16} />}
            aria-label="Sign out"
            onClick={logout}
            variant="ghost"
            size="sm"
            tooltip="Sign out"
          />
        </div>
      </div>
    </header>
  );
};
