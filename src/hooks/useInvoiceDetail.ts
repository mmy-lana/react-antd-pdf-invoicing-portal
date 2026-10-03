import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { AuditLog, Invoice, PaymentRecord } from '@/types';

export interface UseInvoiceDetailResult {
  invoice: Invoice | undefined;
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  isLoading: boolean;
}

const NO_PAYMENTS: PaymentRecord[] = [];
const NO_AUDIT_LOGS: AuditLog[] = [];

/**
 * Invoice detail plus its settlement history and audit trail.
 *
 * The trail is gathered for the invoice *and* every payment attached to it,
 * because a status change driven by a settlement is filed against the payment
 * record. Querying only the invoice would silently drop those transitions.
 */
export const useInvoiceDetail = (invoiceId: string | undefined): UseInvoiceDetailResult => {
  const assembledDetail = useLiveQuery(
    async () => {
      if (!invoiceId) return null;

      const invoice = await db.invoices.get(invoiceId);
      if (!invoice) return null;

      const payments = await db.payments.where('invoiceId').equals(invoiceId).reverse().sortBy('paymentDate');
      const trailEntityIds = [invoiceId, ...payments.map((payment) => payment.id)];
      const auditLogs = (await db.auditLogs.where('entityId').anyOf(trailEntityIds).toArray()).sort((earlier, later) =>
        later.performedAt.localeCompare(earlier.performedAt)
      );

      return { invoice, payments, auditLogs };
    },
    [invoiceId]
  );

  return {
    invoice: assembledDetail?.invoice,
    payments: assembledDetail?.payments ?? NO_PAYMENTS,
    auditLogs: assembledDetail?.auditLogs ?? NO_AUDIT_LOGS,
    isLoading: assembledDetail === undefined,
  };
};
