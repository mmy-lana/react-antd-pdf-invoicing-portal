import React, { useState } from 'react';
import { Drawer } from 'antd';
import { useLocation } from 'react-router';
import { CorporateHeader } from '@/components/layout/CorporateHeader';
import { CorporateSidebar } from '@/components/layout/CorporateSidebar';
import { MobileBottomNavigation } from '@/components/layout/MobileBottomNavigation';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface ResponsiveShellProps {
  children: React.ReactNode;
}

/** Routes where the editor owns the bottom of the screen. */
const EDITOR_ROUTE_PATTERN = /^\/invoices\/(?:new|[^/]+\/edit)\/?$/;

const resolveScreenTitle = (pathname: string): string => {
  if (pathname === '/clients') return 'Client directory';
  if (pathname === '/settings') return 'Organization settings';
  if (/^\/invoices\/new\/?$/.test(pathname)) return 'New invoice';
  if (/^\/invoices\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit invoice';
  if (/^\/invoices\/[^/]+\/?$/.test(pathname)) return 'Invoice detail';
  if (/^\/invoices\/?$/.test(pathname)) return 'Invoice ledger';
  return 'Invoicing';
};

/**
 * Application chrome.
 *
 * Three mutually exclusive navigation treatments, never stacked: a fixed rail
 * on desktop, a drawer on tablet, a bottom bar on phones. The shell renders
 * whatever the router hands it through `children` and never renders its own
 * outlet, so the route table stays the single source of truth for the page body.
 */
export const ResponsiveShell: React.FC<ResponsiveShellProps> = ({ children }) => {
  const { isMobile, isTablet, isDesktop } = useResponsiveBreakpoints();
  const location = useLocation();
  const [isNavigationDrawerOpen, setIsNavigationDrawerOpen] = useState(false);

  const isEditorRoute = EDITOR_ROUTE_PATTERN.test(location.pathname);
  const showBottomNavigation = isMobile && !isEditorRoute;
  const screenTitle = resolveScreenTitle(location.pathname);

  const pageBody = (
    <div style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0 }}>{children}</div>
  );

  const headerColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0 }}>
      <CorporateHeader
        title={screenTitle}
        onOpenNavigation={isTablet ? () => setIsNavigationDrawerOpen(true) : undefined}
      />
      {pageBody}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100dvh', minWidth: 0, overflowX: 'clip' }}>
        <aside className="no-print" style={{ flex: '0 0 auto', height: '100dvh', position: 'sticky', top: 0 }}>
          <CorporateSidebar />
        </aside>
        <main style={{ flex: '1 1 auto', minWidth: 0, overflowX: 'clip', height: '100dvh', overflowY: 'auto' }}>
          {headerColumn}
        </main>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minWidth: 0, overflowX: 'clip' }}>
        <Drawer
          placement="left"
          open={isNavigationDrawerOpen}
          onClose={() => setIsNavigationDrawerOpen(false)}
          width={260}
          closable={false}
          className="no-print"
          styles={{ body: { padding: 0, backgroundColor: 'var(--color-bg-header)' } }}
        >
          <CorporateSidebar width="100%" onNavigate={() => setIsNavigationDrawerOpen(false)} />
        </Drawer>
        <main style={{ flex: '1 1 auto', minWidth: 0, overflowX: 'clip', overflowY: 'auto' }}>
          {headerColumn}
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        minWidth: 0,
        overflowX: 'clip',
      }}
    >
      <main
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          overflowX: 'clip',
          paddingBottom: showBottomNavigation
            ? 'calc(var(--layout-bottom-nav-height, 60px) + var(--safe-area-bottom))'
            : 'var(--safe-area-bottom)',
        }}
      >
        {headerColumn}
      </main>
      <MobileBottomNavigation isVisible={showBottomNavigation} />
    </div>
  );
};

export default ResponsiveShell;
