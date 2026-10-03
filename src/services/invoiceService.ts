import { db } from '@/db/database';
import type { Client, ClientSnapshot, CurrencyCode, Invoice, InvoiceItem, OrganizationSettings, OrganizationSnapshot } from '@/types';
import { formatInvoiceSequence } from '@/utils/formatters';
import {
  addCalendarDays,
  calculateInvoiceBreakdownMinor,
  calculateItemTotalsMinor,
  determineInvoiceStatus,
  todayLocalISO,
} from '@/utils/calculations';
import { validateInvoiceDates, validateLineItems } from '@/utils/validators';
import { newId, newPortalToken } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export interface CreateInvoiceParams {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: CurrencyCode;
  status?: 'draft' | 'pending';
  items: InvoiceItem[];
  notes?: string;
  paymentInstructions?: string;
  termsAndConditions?: string;
}

export type InvoicePatch = Partial<CreateInvoiceParams>;

const snapshotClientForIssue = (client: Client): ClientSnapshot => ({
  id: client.id,
  name: client.name,
  companyName: client.companyName,
  email: client.email,
  phone: client.phone,
  taxId: client.taxId,
  billingAddress: client.billingAddress,
  currency: client.currency,
  paymentTermsDays: client.paymentTermsDays,
});

const snapshotOrganizationForIssue = (settings: OrganizationSettings): OrganizationSnapshot => ({
  companyName: settings.companyName,
  companyEmail: settings.companyEmail,
  companyPhone: settings.companyPhone,
  companyAddress: settings.companyAddress,
  companyTaxId: settings.companyTaxId,
  companyLogoDataUrl: settings.companyLogoDataUrl,
  bankDetails: settings.bankDetails,
  defaultPaymentInstructions: settings.defaultPaymentInstructions,
  defaultTermsAndConditions: settings.defaultTermsAndConditions,
});

/**
 * Re-derives every persisted line figure from the operator's inputs. Client
 * totals are never trusted as submitted; only the primitive quantity, rate and
 * percentage fields survive a round trip through the form.
 */
const recalculateLineItems = (submittedItems: InvoiceItem[]): InvoiceItem[] => {
  return submittedItems.map((submittedItem, position) => {
    const derivedTotals = calculateItemTotalsMinor(
      submittedItem.quantity,
      submittedItem.unitPriceMinor,
      submittedItem.taxRate,
      submittedItem.discountRate
    );

    return {
      ...submittedItem,
      id: submittedItem.id || newId('item'),
      sortOrder: position + 1,
      subtotalMinor: derivedTotals.subtotalMinor,
      discountAmountMinor: derivedTotals.discountAmountMinor,
      taxAmountMinor: derivedTotals.taxAmountMinor,
      totalMinor: derivedTotals.totalMinor,
    };
  });
};

/**
 * Numbering is allocated inside the same transaction that persists the invoice.
 * Concurrent callers queue on the settings table, so the read-increment-write
 * of `nextInvoiceSequence` cannot interleave and hand out a duplicate number.
 */
export const createInvoiceTransactional = async (
  params: CreateInvoiceParams,
  actor: string
): Promise<Invoice> => {
  const dateCheck = validateInvoiceDates(params.issueDate, params.dueDate);
  if (!dateCheck.valid) throw new Error(dateCheck.message);

  const lineItemCheck = validateLineItems(params.items);
  if (!lineItemCheck.valid) throw new Error(lineItemCheck.message);

  return await db.transaction('rw', [db.settings, db.clients, db.invoices, db.auditLogs], async () => {
    const settings = await db.settings.get('org');
    if (!settings) throw new Error('Organization settings not found.');

    const client = await db.clients.get(params.clientId);
    if (!client || client.archivedAt) throw new Error('Active client must be selected.');

    let reservedSequence = settings.nextInvoiceSequence;
    let candidateNumber = formatInvoiceSequence(settings.invoicePrefix, reservedSequence);

    while (await db.invoices.where('invoiceNumber').equals(candidateNumber).first()) {
      reservedSequence += 1;
      candidateNumber = formatInvoiceSequence(settings.invoicePrefix, reservedSequence);
    }

    settings.nextInvoiceSequence = reservedSequence + 1;
    settings.updatedAt = new Date().toISOString();
    await db.settings.put(settings);

    const pricedItems = recalculateLineItems(params.items);
    const ledgerTotals = calculateInvoiceBreakdownMinor(pricedItems, 0);
    const requestedStatus = params.status || 'pending';

    if (requestedStatus !== 'draft' && ledgerTotals.totalAmountMinor === 0) {
      throw new Error('Invoices with zero total cannot be finalized or sent. Save as draft instead.');
    }

    const issuedStatus =
      requestedStatus === 'draft'
        ? 'draft'
        : determineInvoiceStatus(params.dueDate, ledgerTotals.totalAmountMinor, 0, 'pending');

    const issuedAt = new Date().toISOString();
    const newInvoice: Invoice = {
      id: newId('inv'),
      invoiceNumber: candidateNumber,
      clientId: client.id,
      clientSnapshot: snapshotClientForIssue(client),
      organizationSnapshot: snapshotOrganizationForIssue(settings),
      issueDate: params.issueDate,
      dueDate: params.dueDate,
      status: issuedStatus,
      currency: params.currency,
      items: pricedItems,
      subtotalMinor: ledgerTotals.subtotalMinor,
      taxTotalMinor: ledgerTotals.taxTotalMinor,
      discountTotalMinor: ledgerTotals.discountTotalMinor,
      totalAmountMinor: ledgerTotals.totalAmountMinor,
      amountPaidMinor: 0,
      balanceDueMinor: ledgerTotals.balanceDueMinor,
      portalToken: newPortalToken(),
      version: 1,
      notes: params.notes,
      paymentInstructions: params.paymentInstructions || settings.defaultPaymentInstructions,
      termsAndConditions: params.termsAndConditions || settings.defaultTermsAndConditions,
      createdAt: issuedAt,
      updatedAt: issuedAt,
      sentAt: requestedStatus !== 'draft' ? issuedAt : undefined,
    };

    await db.invoices.add(newInvoice);
    await writeAuditLog({
      entityId: newInvoice.id,
      entityType: 'invoice',
      action: 'create',
      actor,
      details: `Created invoice ${newInvoice.invoiceNumber}`,
      diff: {
        status: { before: null, after: newInvoice.status },
        totalAmountMinor: { before: null, after: newInvoice.totalAmountMinor },
      },
    });

    return newInvoice;
  });
};

/**
 * Optimistic concurrency guard. The caller submits the `version` it rendered;
 * a mismatch means another operator already saved, and the stale write is
 * rejected rather than silently clobbering the newer figures.
 */
export const updateInvoiceTransactional = async (
  invoiceId: string,
  params: InvoicePatch,
  expectedVersion: number,
  actor: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error(`Invoice ${invoiceId} not found.`);

    if (existing.version !== expectedVersion) {
      throw new Error('Concurrent modification detected. Refresh and review changes before saving.');
    }

    if (existing.status === 'cancelled') {
      throw new Error('Cancelled invoices cannot be modified.');
    }

    if (existing.status === 'paid') {
      throw new Error('Paid invoices cannot be modified.');
    }

    if (existing.status !== 'draft' && params.status === 'draft') {
      throw new Error('Cannot revert a finalized or sent invoice to draft.');
    }

    const issueDate = params.issueDate ?? existing.issueDate;
    const dueDate = params.dueDate ?? existing.dueDate;
    const dateCheck = validateInvoiceDates(issueDate, dueDate);
    if (!dateCheck.valid) throw new Error(dateCheck.message);

    let pricedItems = existing.items;
    if (params.items) {
      const lineItemCheck = validateLineItems(params.items);
      if (!lineItemCheck.valid) throw new Error(lineItemCheck.message);
      pricedItems = recalculateLineItems(params.items);
    }

    const ledgerTotals = calculateInvoiceBreakdownMinor(pricedItems, existing.amountPaidMinor);
    if (ledgerTotals.totalAmountMinor < existing.amountPaidMinor) {
      throw new Error('Invoice total cannot be reduced below the amount already paid.');
    }

    const requestedStatus = params.status ?? existing.status;
    if (requestedStatus !== 'draft' && ledgerTotals.totalAmountMinor === 0) {
      throw new Error('Invoices with zero total cannot be finalized or sent.');
    }

    const resolvedStatus =
      existing.status === 'draft' && !params.status
        ? 'draft'
        : determineInvoiceStatus(dueDate, ledgerTotals.totalAmountMinor, existing.amountPaidMinor, requestedStatus);

    const settledAt = new Date().toISOString();
    const updated: Invoice = {
      ...existing,
      issueDate,
      dueDate,
      status: resolvedStatus,
      items: pricedItems,
      subtotalMinor: ledgerTotals.subtotalMinor,
      taxTotalMinor: ledgerTotals.taxTotalMinor,
      discountTotalMinor: ledgerTotals.discountTotalMinor,
      totalAmountMinor: ledgerTotals.totalAmountMinor,
      balanceDueMinor: ledgerTotals.balanceDueMinor,
      notes: params.notes ?? existing.notes,
      paymentInstructions: params.paymentInstructions ?? existing.paymentInstructions,
      termsAndConditions: params.termsAndConditions ?? existing.termsAndConditions,
      sentAt: existing.sentAt ?? (existing.status === 'draft' && resolvedStatus !== 'draft' ? settledAt : undefined),
      paidAt: resolvedStatus === 'paid' ? (existing.paidAt ?? settledAt) : existing.paidAt,
      version: existing.version + 1,
      updatedAt: settledAt,
    };

    await db.invoices.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'update',
      actor,
      details: `Updated invoice ${updated.invoiceNumber} to version ${updated.version}`,
      diff: {
        totalAmountMinor: { before: existing.totalAmountMinor, after: updated.totalAmountMinor },
        status: { before: existing.status, after: updated.status },
        version: { before: existing.version, after: updated.version },
      },
    });

    return updated;
  });
};

export const markInvoiceSentTransactional = async (invoiceId: string, actor: string): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');

    if (existing.status !== 'draft') {
      throw new Error('Only draft invoices can be transitioned to sent.');
    }

    if (existing.totalAmountMinor === 0) {
      throw new Error('Cannot send an invoice with zero total.');
    }

    const transmittedAt = new Date().toISOString();
    const updated: Invoice = {
      ...existing,
      status: determineInvoiceStatus(existing.dueDate, existing.totalAmountMinor, existing.amountPaidMinor, 'pending'),
      sentAt: transmittedAt,
      version: existing.version + 1,
      updatedAt: transmittedAt,
    };

    await db.invoices.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'status_change',
      actor,
      details: `Marked invoice ${updated.invoiceNumber} as sent`,
      diff: {
        status: { before: existing.status, after: updated.status },
        sentAt: { before: existing.sentAt ?? null, after: updated.sentAt ?? null },
      },
    });

    return updated;
  });
};

export const cancelInvoiceTransactional = async (
  invoiceId: string,
  actor: string,
  reason: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');

    if (existing.status === 'cancelled') {
      throw new Error('Invoice is already cancelled.');
    }

    if (existing.amountPaidMinor > 0) {
      throw new Error('Cannot cancel an invoice with recorded payments. Void payments first.');
    }

    const cancelledAt = new Date().toISOString();
    const updated: Invoice = {
      ...existing,
      status: 'cancelled',
      version: existing.version + 1,
      updatedAt: cancelledAt,
    };

    await db.invoices.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'status_change',
      actor,
      details: `Cancelled invoice ${updated.invoiceNumber}. Reason: ${reason}`,
      diff: {
        status: { before: existing.status, after: 'cancelled' },
      },
    });

    return updated;
  });
};

export const deleteDraftInvoice = async (invoiceId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');

    if (existing.status !== 'draft') {
      throw new Error('Only draft invoices can be permanently deleted. Cancel finalized invoices instead.');
    }

    await db.invoices.delete(invoiceId);
    await writeAuditLog({
      entityId: invoiceId,
      entityType: 'invoice',
      action: 'delete',
      actor,
      details: `Deleted draft invoice ${existing.invoiceNumber}. Sequence number is retired per tax audit requirements.`,
    });
  });
};

/** Copy-on-duplicate always reissues against today's date and the live client terms. */
export const duplicateInvoice = async (invoiceId: string, actor: string): Promise<Invoice> => {
  const sourceInvoice = await db.invoices.get(invoiceId);
  if (!sourceInvoice) throw new Error('Source invoice not found.');

  const issueDate = todayLocalISO();
  const paymentTermsDays = sourceInvoice.clientSnapshot.paymentTermsDays || 30;

  return await createInvoiceTransactional(
    {
      clientId: sourceInvoice.clientId,
      issueDate,
      dueDate: addCalendarDays(issueDate, paymentTermsDays),
      currency: sourceInvoice.currency,
      status: 'draft',
      items: sourceInvoice.items.map((lineItem) => ({ ...lineItem, id: newId('item') })),
      notes: sourceInvoice.notes,
      paymentInstructions: sourceInvoice.paymentInstructions,
      termsAndConditions: sourceInvoice.termsAndConditions,
    },
    actor
  );
};

/**
 * Portal capability lookup. Drafts and cancelled invoices are indistinguishable
 * from a bad token, so a client cannot probe for their existence.
 */
export const getInvoiceByPortalToken = async (token: string): Promise<Invoice | null> => {
  if (!token) return null;
  const invoice = await db.invoices.where('portalToken').equals(token).first();
  if (!invoice || invoice.status === 'draft' || invoice.status === 'cancelled') return null;
  return invoice;
};
