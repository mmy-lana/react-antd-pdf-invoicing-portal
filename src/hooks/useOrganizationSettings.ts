import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { OrganizationSettings } from '@/types';

export interface UseOrganizationSettingsResult {
  settings: OrganizationSettings | undefined;
  isLoading: boolean;
}

/** Live issuer profile: the single row every invoice snapshot is cut from. */
export const useOrganizationSettings = (): UseOrganizationSettingsResult => {
  const settings = useLiveQuery(() => db.settings.get('org'));

  return {
    settings,
    isLoading: settings === undefined,
  };
};
