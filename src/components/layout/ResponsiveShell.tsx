import React from 'react';

export const ResponsiveShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, overflowX: 'clip', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
};
