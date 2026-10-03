import type { ThemeConfig } from 'antd';

export const getCorporateTheme = (isTouch: boolean): ThemeConfig => ({
  token: {
    colorPrimary: '#1e3a8a',
    colorInfo: '#1e3a8a',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    borderRadius: 4,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    controlHeight: isTouch ? 44 : 36,
    fontSize: isTouch ? 16 : 14,
  },
});
