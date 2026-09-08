import React from 'react';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard,
  Flame,
  ShieldCheck,
  Cpu,
  Boxes,
  Warehouse,
  Users,
  Truck,
  Receipt,
  BarChart3,
  Settings
} from 'lucide-react';
import { NavigationItem } from '../design-system/navigation/NavigationItem.js';
import type { RootState } from '../store/store.js';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const { isSidebarCollapsed } = useSelector((state: RootState) => state.ui);

  const navItems: NavItem[] = [
    { label: 'Command Center', path: '/', icon: <LayoutDashboard size={18} /> },
    { label: 'Planning & Batch Orders', path: '/jobs', icon: <Flame size={18} /> },
    { label: 'Quality & Lab', path: '/quality', icon: <ShieldCheck size={18} /> },
    { label: 'Furnaces & Pyrometry', path: '/machines', icon: <Cpu size={18} /> },
    { label: 'Inventory & Heat Lots', path: '/inventory', icon: <Boxes size={18} /> },
    { label: 'Warehouse & FG', path: '/warehouse', icon: <Warehouse size={18} /> },
    { label: 'Workforce & Shifts', path: '/workforce', icon: <Users size={18} /> },
    { label: 'Outbound Dispatch', path: '/dispatch', icon: <Truck size={18} /> },
    { label: 'Costing & Finance', path: '/finance', icon: <Receipt size={18} /> },
    { label: 'Executive Analytics', path: '/reports', icon: <BarChart3 size={18} /> },
    { label: 'Platform Settings', path: '/settings', icon: <Settings size={18} /> }
  ];

  return (
    <aside
      style={{
        width: isSidebarCollapsed ? '68px' : '240px',
        borderRight: '1px solid var(--color-border-subtle)',
        background: 'var(--material-thick)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--duration-normal) var(--ease-spring)',
        overflowY: 'auto',
        overflowX: 'hidden',
        height: 'calc(100vh - 60px)',
        position: 'sticky',
        top: '60px',
        zIndex: 40
      }}
    >
      <div style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => (
          <NavigationItem
            key={item.path}
            label={item.label}
            path={item.path}
            icon={item.icon}
            collapsed={isSidebarCollapsed}
          />
        ))}
      </div>
    </aside>
  );
};
