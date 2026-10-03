import React, { useState, useEffect } from 'react';
import { ConfigProvider, App as AntdApp, Spin, Result } from 'antd';
import { RouterProvider } from 'react-router';
import { router } from '@/router';
import { initializeDatabase } from '@/db/seed';
import { startStatusReconciliationScheduler } from '@/services/statusReconciliationService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';
import { getCorporateTheme } from '@/styles/theme';

export const App: React.FC = () => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setDbState('ready');
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize local IndexedDB');
        setDbState('error');
      });

    const stopScheduler = startStatusReconciliationScheduler();
    return () => stopScheduler();
  }, []);

  if (dbState === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (dbState === 'error') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Result
          status="error"
          title="Database Initialization Error"
          subTitle={errorMessage}
        />
      </div>
    );
  }

  const useTouchHeight = isMobile || isCoarsePointer;

  return (
    <ConfigProvider theme={getCorporateTheme(useTouchHeight)}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
};
