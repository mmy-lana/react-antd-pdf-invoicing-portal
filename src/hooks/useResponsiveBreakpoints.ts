import { useSyncExternalStore, useMemo } from 'react';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isCoarsePointer: boolean;
}

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
const COARSE_QUERY = '(pointer: coarse)';

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const mqls = [
    window.matchMedia(MOBILE_QUERY),
    window.matchMedia(TABLET_QUERY),
    window.matchMedia(COARSE_QUERY),
  ];
  mqls.forEach((mql) => mql.addEventListener('change', callback));
  return () => mqls.forEach((mql) => mql.removeEventListener('change', callback));
};

const getSnapshot = (): string => {
  if (typeof window === 'undefined') {
    return 'desktop|0';
  }
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const isTablet = !isMobile && window.matchMedia(TABLET_QUERY).matches;
  const tier = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const coarse = window.matchMedia(COARSE_QUERY).matches ? '1' : '0';
  return `${tier}|${coarse}`;
};

const getServerSnapshot = (): string => 'desktop|0';

export const useResponsiveBreakpoints = (): ResponsiveState => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const [tier, coarse] = snapshot.split('|');
    return {
      isMobile: tier === 'mobile',
      isTablet: tier === 'tablet',
      isDesktop: tier === 'desktop',
      isCoarsePointer: coarse === '1',
    };
  }, [snapshot]);
};
