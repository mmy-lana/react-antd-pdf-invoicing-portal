import React from 'react';
import { Select } from 'antd';
import { Link, useNavigate } from 'react-router';
import { MenuOutlined } from '@ant-design/icons';
import { useInvoices } from '@/hooks/useInvoices';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

export interface CorporateHeaderProps {
  title: string;
  subtitle?: string;
  /** Tablet only: opens the navigation drawer. */
  onOpenNavigation?: () => void;
}

/**
 * Top utility bar. On tablets it carries the drawer trigger; on phones it is a
 * fixed 56px strip holding the screen title and the portal switcher, which is
 * how an operator moves between "billing console" and "what the client sees"
 * without a separate sign-in.
 */
export const CorporateHeader: React.FC<CorporateHeaderProps> = ({ title, subtitle, onOpenNavigation }) => {
  const navigate = useNavigate();
  const { isTablet, isMobile } = useResponsiveBreakpoints();
  const { settings } = useOrganizationSettings();
  const { invoices } = useInvoices();

  const portalCandidates = invoices.filter(
    (invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled'
  );

  const openPortalFor = (chosenInvoiceId: string): void => {
    const chosenInvoice = portalCandidates.find((invoice) => invoice.id === chosenInvoiceId);
    if (chosenInvoice) {
      navigate(`/portal/${chosenInvoice.portalToken}`);
    }
  };

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 'var(--layout-header-height, 56px)',
        paddingInline: 12,
        paddingTop: 'var(--safe-area-top)',
        paddingBottom: isTablet || isMobile ? 6 : 0,
        backgroundColor: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
        minWidth: 0,
      }}
    >
      {isTablet ? (
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 'var(--touch-target-min, 44px)',
            height: 'var(--touch-target-min, 44px)',
            flex: '0 0 auto',
            border: 'none',
            borderRadius: 'var(--radius-md, 4px)',
            background: 'transparent',
            color: 'var(--color-text-main)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          <MenuOutlined />
        </button>
      ) : null}

      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 15 : 17,
            fontWeight: 700,
            lineHeight: 1.2,
            color: 'var(--color-text-main)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        {subtitle && !isMobile ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {settings?.companyName && !isMobile && !isTablet ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 260,
          }}
        >
          {settings.companyName}
        </span>
      ) : null}

      {portalCandidates.length > 0 ? (
        <Select
          showSearch
          optionFilterProp="label"
          aria-label="Switch to client portal"
          placeholder="Client portal"
          value={null}
          onChange={openPortalFor}
          style={{ flex: '0 1 220px', minWidth: 0, maxWidth: 220 }}
          options={portalCandidates.slice(0, 60).map((invoice) => ({
            value: invoice.id,
            label: `${invoice.invoiceNumber} · ${invoice.clientSnapshot.companyName}`,
          }))}
          notFoundContent="No issued invoices to preview"
        />
      ) : (
        <Link to="/invoices" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Client portal
        </Link>
      )}
    </header>
  );
};
