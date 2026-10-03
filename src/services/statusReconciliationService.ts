import { db } from '@/db/database';
import { determineInvoiceStatus } from '@/utils/calculations';

const RECONCILE_INTERVAL_MS = 1000 * 60 * 60;

/**
 * Status is stored, not computed on read, so an invoice that sat untouched
 * overnight would still show as "pending" the morning after its due date. This
 * sweep re-derives every derived status so the ledger self-corrects with the
 * calendar. Author-only states (draft, cancelled) and terminal settlements are
 * left exactly as they are.
 */
export const reconcileInvoiceStatuses = async (): Promise<number> => {
  return await db.transaction('rw', db.invoices, async () => {
    const candidatesForReview = await db.invoices
      .where('status')
      .anyOf(['pending', 'partial'])
      .toArray();

    let correctedCount = 0;
    for (const invoice of candidatesForReview) {
      const derivedStatus = determineInvoiceStatus(
        invoice.dueDate,
        invoice.totalAmountMinor,
        invoice.amountPaidMinor,
        invoice.status
      );

      if (derivedStatus !== invoice.status) {
        invoice.status = derivedStatus;
        invoice.updatedAt = new Date().toISOString();
        await db.invoices.put(invoice);
        correctedCount += 1;
      }
    }

    return correctedCount;
  });
};

/**
 * Runs on an interval and whenever the tab regains focus, so a laptop left open
 * overnight catches up the moment it is looked at again. Returns its own
 * teardown for the caller's effect cleanup.
 */
export const startStatusReconciliationScheduler = (): (() => void) => {
  const reconcileOnFocus = (): void => {
    if (document.visibilityState === 'visible') {
      void reconcileInvoiceStatuses().catch(() => undefined);
    }
  };

  document.addEventListener('visibilitychange', reconcileOnFocus);

  const intervalHandle = window.setInterval(() => {
    void reconcileInvoiceStatuses().catch(() => undefined);
  }, RECONCILE_INTERVAL_MS);

  return () => {
    document.removeEventListener('visibilitychange', reconcileOnFocus);
    window.clearInterval(intervalHandle);
  };
};
