import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, Outlet } from 'react-router';
import { Spin } from 'antd';
import { ResponsiveShell } from '@/components/layout/ResponsiveShell';

const InvoicesRoute = lazy(() => import('@/routes/InvoicesRoute'));
const InvoiceCreateEditRoute = lazy(() => import('@/routes/InvoiceCreateEditRoute'));
const InvoiceDetailRoute = lazy(() => import('@/routes/InvoiceDetailRoute'));
const ClientsRoute = lazy(() => import('@/routes/ClientsRoute'));
const SettingsRoute = lazy(() => import('@/routes/SettingsRoute'));
const ClientPortalRoute = lazy(() => import('@/routes/ClientPortalRoute'));

const RouteSuspenseFallback = () => (
  <div style={{ display: 'flex', height: '100%', minHeight: '300px', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

export const router = createHashRouter([
  {
    path: '/',
    element: (
      <ResponsiveShell>
        <Suspense fallback={<RouteSuspenseFallback />}>
          <Outlet />
        </Suspense>
      </ResponsiveShell>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoicesRoute /> },
      { path: 'invoices/new', element: <InvoiceCreateEditRoute /> },
      { path: 'invoices/:id', element: <InvoiceDetailRoute /> },
      { path: 'invoices/:id/edit', element: <InvoiceCreateEditRoute /> },
      { path: 'clients', element: <ClientsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
    ],
  },
  {
    path: '/portal/:token',
    element: (
      <Suspense fallback={<RouteSuspenseFallback />}>
        <ClientPortalRoute />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/invoices" replace />,
  },
]);
