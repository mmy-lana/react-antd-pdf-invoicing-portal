import React from 'react';
import { NavLink, useNavigate } from 'react-router';
import { FileTextOutlined, SettingOutlined, TeamOutlined, GlobalOutlined } from '@ant-design/icons';
import { useInvoices } from '@/hooks/useInvoices';

export interface MobileBottomNavigationProps {
  /** Hidden on the invoice editor so it cannot collide with the summary sheet. */
  isVisible: boolean;
}

const itemStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 'var(--touch-target-min, 44px)',
  padding: '6px 2px',
  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
  fontSize: 11,
  fontWeight: isActive ? 700 : 500,
  textDecoration: 'none',
});

/**
 * Phone navigation bar. Pinned to the bottom, padded by the device safe area,
 * with four destinations at 44px. The Portal entry jumps straight to the most
 * recently issued invoice the client is allowed to see.
 */
export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({ isVisible }) => {
  const navigate = useNavigate();
  const { invoices } = useInvoices();

  if (!isVisible) return null;

  const portalCandidates = invoices.filter(
    (invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled'
  );

  const hasPortalTarget = portalCandidates.length > 0;

  return (
    <nav
      aria-label="Primary"
      className="no-print"
      style={{
        position: 'fixed',
        bottom: 0,
        insetInline: 0,
        zIndex: 30,
        display: 'flex',
        backgroundColor: 'var(--color-bg-card)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'var(--safe-area-bottom)',
        paddingLeft: 'var(--safe-area-left)',
        paddingRight: 'var(--safe-area-right)',
        boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.06)',
      }}
    >
      <NavLink to="/invoices" style={({ isActive }) => itemStyle(isActive)}>
        <FileTextOutlined aria-hidden="true" style={{ fontSize: 19 }} />
        <span>Invoices</span>
      </NavLink>

      <NavLink to="/clients" style={({ isActive }) => itemStyle(isActive)}>
        <TeamOutlined aria-hidden="true" style={{ fontSize: 19 }} />
        <span>Clients</span>
      </NavLink>

      <NavLink to="/settings" style={({ isActive }) => itemStyle(isActive)}>
        <SettingOutlined aria-hidden="true" style={{ fontSize: 19 }} />
        <span>Settings</span>
      </NavLink>

      <button
        type="button"
        onClick={() => {
          const targetInvoice = portalCandidates[0];
          if (targetInvoice) {
            navigate(`/portal/${targetInvoice.portalToken}`);
          }
        }}
        disabled={!hasPortalTarget}
        style={{
          ...itemStyle(false),
          background: 'transparent',
          border: 'none',
          font: 'inherit',
          fontSize: 11,
          cursor: hasPortalTarget ? 'pointer' : 'not-allowed',
          opacity: hasPortalTarget ? 1 : 0.45,
        }}
      >
        <GlobalOutlined aria-hidden="true" style={{ fontSize: 19 }} />
        <span>Portal</span>
      </button>
    </nav>
  );
};
