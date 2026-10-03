import React, { useState } from 'react';
import { Button } from 'antd';
import { MenuOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { HelpGuideDrawer } from '@/components/molecules/HelpGuideDrawer';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

export interface CorporateHeaderProps {
  title: string;
  subtitle?: string;
  /** Tablet only: opens the navigation drawer. */
  onOpenNavigation?: () => void;
}

/**
 * Top utility bar.
 *
 * On tablets it carries the drawer trigger; on phones it is a compact strip
 * holding the screen title and the guide trigger.
 *
 * Security note (SEC-02): this header deliberately exposes no index of portal
 * capability tokens. The previous global dropdown listed every issued invoice
 * alongside the client's own company name and handed out a working client-facing
 * URL for each one from a single control, which is an unnecessary disclosure
 * surface. The portal is now reached deliberately from the invoice being worked
 * on, or from the Portal entry in the mobile navigation.
 */
export const CorporateHeader: React.FC<CorporateHeaderProps> = ({ title, subtitle, onOpenNavigation }) => {
  const { isTablet, isMobile } = useResponsiveBreakpoints();
  const { settings } = useOrganizationSettings();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
            maxWidth: 220,
          }}
        >
          {settings.companyName}
        </span>
      ) : null}

      <Button
        icon={<QuestionCircleOutlined aria-hidden="true" />}
        onClick={() => setIsGuideOpen(true)}
        aria-label="Open the system guide and frequently asked questions"
        style={{ flex: '0 0 auto', minHeight: 'var(--touch-target-min, 44px)' }}
      >
        {isMobile ? 'Guide' : 'Guide & Q&A'}
      </Button>

      <HelpGuideDrawer open={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </header>
  );
};
