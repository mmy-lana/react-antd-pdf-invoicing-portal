import React from 'react';
import { NavLink } from 'react-router';
import {
  AppstoreOutlined,
  SettingOutlined,
  TeamOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

export interface NavigationDestination {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const PRIMARY_DESTINATIONS: NavigationDestination[] = [
  { path: '/invoices', label: 'Invoices', icon: <FileTextOutlined aria-hidden="true" /> },
  { path: '/clients', label: 'Clients', icon: <TeamOutlined aria-hidden="true" /> },
  { path: '/settings', label: 'Settings', icon: <SettingOutlined aria-hidden="true" /> },
];

export interface CorporateSidebarProps {
  /** Rendered inside the tablet drawer as well, where the width is fluid. */
  width?: number | string;
  onNavigate?: () => void;
}

/**
 * Desktop navigation rail. Fixed at 240px from the left on wide viewports; the
 * same markup backs the tablet drawer, where it simply fills the panel.
 */
export const CorporateSidebar: React.FC<CorporateSidebarProps> = ({ width = 'var(--layout-sidebar-width, 240px)', onNavigate }) => {
  const { settings } = useOrganizationSettings();

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 'var(--touch-target-min, 44px)',
    padding: '0 14px',
    borderRadius: 'var(--radius-md, 4px)',
    fontSize: 14,
    fontWeight: isActive ? 700 : 500,
    color: isActive ? '#ffffff' : 'rgba(226, 232, 240, 0.82)',
    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
    textDecoration: 'none',
    minWidth: 0,
  });

  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width,
        minWidth: 0,
        height: '100%',
        padding: 16,
        backgroundColor: 'var(--color-bg-header)',
        color: 'var(--color-text-inverse)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 18px', minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            flex: '0 0 auto',
            borderRadius: 'var(--radius-md, 4px)',
            backgroundColor: 'var(--color-primary-hover)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          <AppstoreOutlined />
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: 1.25,
              color: '#ffffff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {settings?.companyName ?? 'Billing operations'}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'rgba(226, 232, 240, 0.68)' }}>Invoicing console</span>
        </span>
      </div>

      {PRIMARY_DESTINATIONS.map((destination) => (
        <NavLink
          key={destination.path}
          to={destination.path}
          onClick={onNavigate}
          style={({ isActive }) => itemStyle(isActive)}
        >
          <span style={{ fontSize: 16, flex: '0 0 auto', display: 'inline-flex' }}>{destination.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {destination.label}
          </span>
        </NavLink>
      ))}

      <div style={{ marginTop: 'auto', padding: '14px 14px 0', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(226, 232, 240, 0.6)' }}>
          Ledger stored locally in this browser. Issued invoices carry frozen client and issuer snapshots.
        </p>
      </div>
    </nav>
  );
};
