import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Client } from '@/types';

export interface UseClientsResult {
  clients: Client[];
  isLoading: boolean;
}

const NO_CLIENTS: Client[] = [];

/**
 * Client directory, alphabetical by contact name. Archived records are hidden
 * unless explicitly requested, because a directory that still offers billable
 * clients for selection would let an operator raise invoices against a party
 * they can no longer settle.
 */
export const useClients = (options?: { includeArchived?: boolean }): UseClientsResult => {
  const includeArchived = options?.includeArchived ?? false;

  const directoryEntries = useLiveQuery(
    async () => {
      const allClients = await db.clients.orderBy('name').toArray();
      if (includeArchived) return allClients;
      return allClients.filter((client) => !client.archivedAt);
    },
    [includeArchived]
  );

  return {
    clients: directoryEntries ?? NO_CLIENTS,
    isLoading: directoryEntries === undefined,
  };
};
