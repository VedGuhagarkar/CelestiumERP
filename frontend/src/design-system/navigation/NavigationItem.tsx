import React from 'react';
import { NavLink } from 'react-router-dom';

export interface NavigationItemProps {
  label: string;
  path?: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  badge?: string | number;
  collapsed?: boolean;
  className?: string;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({
  label,
  path,
  icon,
  isActive: forcedActive,
  onClick,
  badge,
  collapsed = false,
  className = ''
}) => {
  const getStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: collapsed ? '10px' : '10px 14px',
    borderRadius: 'var(--radius-lg)',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    backgroundColor: active ? 'var(--color-primary-subtle)' : 'transparent',
    border: active ? '1px solid rgba(249, 115, 22, 0.25)' : '1px solid transparent',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: active ? 600 : 500,
    transition: 'all var(--duration-fast) var(--ease-spring)',
    justifyContent: collapsed ? 'center' : 'flex-start',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    userSelect: 'none'
  });

  if (path) {
    return (
      <NavLink
        to={path}
        end={path === '/'}
        onClick={onClick}
        className={className}
        title={collapsed ? label : undefined}
        style={({ isActive }) => getStyle(forcedActive !== undefined ? forcedActive : isActive)}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
        {!collapsed && (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {label}
          </span>
        )}
        {!collapsed && badge !== undefined && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary)',
              color: '#ffffff'
            }}
          >
            {badge}
          </span>
        )}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      title={collapsed ? label : undefined}
      style={getStyle(!!forcedActive)}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      {!collapsed && (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
          {label}
        </span>
      )}
      {!collapsed && badge !== undefined && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary)',
            color: '#ffffff'
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
