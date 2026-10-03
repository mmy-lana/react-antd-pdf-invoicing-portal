import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Invoice, InvoiceFilters } from '@/types';

export interface UseInvoicesResult {
  invoices: Invoice[];
  isLoading: boolean;
}

const NO_INVOICES: Invoice[] = [];

/**
 * Reactive read of the invoice ledger, newest first, narrowed by the supplied
 * filters. Re-subscribes whenever a filter actually changes (statuses are
 * joined and sorted so an equivalent set in a different order does not
 * re-query).
 */
export const useInvoices = (filters?: InvoiceFilters): UseInvoicesResult => {
  const statusFilterKey = filters?.statuses ? filters.statuses.slice().sort().join(',') : '';

  const matchedInvoices = useLiveQuery(
    async () => {
      const allInvoices = await db.invoices.orderBy('createdAt').reverse().toArray();
      if (!filters) return allInvoices;

      const searchTerm = filters.searchQuery ? filters.searchQuery.trim().toLowerCase() : '';
      const wantedStatuses = filters.statuses && filters.statuses.length > 0 ? new Set(filters.statuses) : null;

      return allInvoices.filter((invoice) => {
        if (searchTerm) {
          const matchesNumber = invoice.invoiceNumber.toLowerCase().includes(searchTerm);
          const matchesClient = invoice.clientSnapshot.companyName.toLowerCase().includes(searchTerm);
          const matchesContact = invoice.clientSnapshot.name.toLowerCase().includes(searchTerm);
          if (!matchesNumber && !matchesClient && !matchesContact) return false;
        }

        if (wantedStatuses && !wantedStatuses.has(invoice.status)) return false;
        if (filters.clientId && invoice.clientId !== filters.clientId) return false;

        const issueDay = invoice.issueDate.slice(0, 10);
        if (filters.startDate && issueDay < filters.startDate.slice(0, 10)) return false;
        if (filters.endDate && issueDay > filters.endDate.slice(0, 10)) return false;

        return true;
      });
    },
    [filters?.searchQuery, statusFilterKey, filters?.clientId, filters?.startDate, filters?.endDate]
  );

  return {
    invoices: matchedInvoices ?? NO_INVOICES,
    isLoading: matchedInvoices === undefined,
  };
};
