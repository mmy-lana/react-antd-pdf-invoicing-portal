import { db } from '@/db/database';
import type { Invoice, PaymentMethod, PaymentRecord } from '@/types';
import { determineInvoiceStatus } from '@/utils/calculations';
import { validatePaymentAllocation } from '@/utils/validators';
import { newId } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export interface RecordPaymentParams {
  invoiceId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes?: string;
  actor: string;
}

/**
 * Settlement and its ledger effect commit as one unit: the payment row, the
 * invoice's settled and outstanding figures, and the resulting status either
 * all land or none do. Overpayment is rejected outright rather than creating a
 * customer credit that downstream tax handling would have to unwind.
 */
export const recordPaymentTransactional = async (
  params: RecordPaymentParams
): Promise<{ payment: PaymentRecord; invoice: Invoice }> => {
  return await db.transaction('rw', [db.invoices, db.payments, db.auditLogs], async () => {
    const invoice = await db.invoices.get(params.invoiceId);
    if (!invoice) throw new Error('Invoice not found.');

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot record payments against a cancelled invoice.');
    }

    if (invoice.status === 'draft') {
      throw new Error('Cannot record payments against a draft invoice. Finalize or send the invoice first.');
    }

    /*
     * DATA-02: amount bounds and the issue/payment date ordering are decided in
     * one place, using strict `YYYY-MM-DD` parsing rather than comparing sliced
     * characters. The settlement modal calls the same validator, so what an
     * operator is told and what the transaction accepts cannot drift apart.
     */
    const allocationCheck = validatePaymentAllocation(
      params.amountMinor,
      invoice.balanceDueMinor,
      invoice.issueDate,
      params.paymentDate
    );
    if (!allocationCheck.valid) {
      throw new Error(allocationCheck.message ?? 'The payment could not be applied.');
    }

    if (!params.transactionReference.trim()) {
      throw new Error('A transaction reference is required for every recorded payment.');
    }

    const bookedAt = new Date().toISOString();
    const payment: PaymentRecord = {
      id: newId('pay'),
      invoiceId: invoice.id,
      amountMinor: params.amountMinor,
      paymentDate: params.paymentDate,
      paymentMethod: params.paymentMethod,
      transactionReference: params.transactionReference.trim(),
      notes: params.notes,
      createdAt: bookedAt,
    };

    const settledMinor = invoice.amountPaidMinor + params.amountMinor;
    const outstandingMinor = Math.max(0, invoice.totalAmountMinor - settledMinor);
    const resolvedStatus = determineInvoiceStatus(invoice.dueDate, invoice.totalAmountMinor, settledMinor, invoice.status);

    const updatedInvoice: Invoice = {
      ...invoice,
      amountPaidMinor: settledMinor,
      balanceDueMinor: outstandingMinor,
      status: resolvedStatus,
      paidAt: resolvedStatus === 'paid' ? bookedAt : invoice.paidAt,
      version: invoice.version + 1,
      updatedAt: bookedAt,
    };

    await db.payments.add(payment);
    await db.invoices.put(updatedInvoice);

    await writeAuditLog({
      entityId: payment.id,
      entityType: 'payment',
      action: 'create',
      actor: params.actor,
      details: `Recorded payment of minor units ${params.amountMinor} for ${invoice.invoiceNumber}`,
      diff: {
        amountPaidMinor: { before: invoice.amountPaidMinor, after: settledMinor },
        balanceDueMinor: { before: invoice.balanceDueMinor, after: outstandingMinor },
        status: { before: invoice.status, after: resolvedStatus },
      },
    });

    return { payment, invoice: updatedInvoice };
  });
};

/**
 * A void reverses the settlement without erasing its history: the payment row
 * is retained and stamped, so the invoice returns to whatever status its
 * remaining settled amount genuinely supports.
 */
export const voidPaymentTransactional = async (
  paymentId: string,
  actor: string,
  reason: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.payments, db.auditLogs], async () => {
    const payment = await db.payments.get(paymentId);
    if (!payment || payment.voidedAt) {
      throw new Error('Payment not found or already voided.');
    }

    const invoice = await db.invoices.get(payment.invoiceId);
    if (!invoice) throw new Error('Associated invoice not found.');

    const voidedAt = new Date().toISOString();
    payment.voidedAt = voidedAt;
    await db.payments.put(payment);

    const settledMinor = Math.max(0, invoice.amountPaidMinor - payment.amountMinor);
    const outstandingMinor = Math.max(0, invoice.totalAmountMinor - settledMinor);
    const resolvedStatus = determineInvoiceStatus(invoice.dueDate, invoice.totalAmountMinor, settledMinor, invoice.status);

    const updatedInvoice: Invoice = {
      ...invoice,
      amountPaidMinor: settledMinor,
      balanceDueMinor: outstandingMinor,
      status: resolvedStatus,
      paidAt: resolvedStatus === 'paid' ? invoice.paidAt : undefined,
      version: invoice.version + 1,
      updatedAt: voidedAt,
    };

    await db.invoices.put(updatedInvoice);
    await writeAuditLog({
      entityId: payment.id,
      entityType: 'payment',
      action: 'status_change',
      actor,
      details: `Voided payment ${payment.id}. Reason: ${reason}`,
      diff: {
        amountPaidMinor: { before: invoice.amountPaidMinor, after: settledMinor },
        balanceDueMinor: { before: invoice.balanceDueMinor, after: outstandingMinor },
        status: { before: invoice.status, after: resolvedStatus },
        voidedAt: { before: null, after: voidedAt },
      },
    });

    return updatedInvoice;
  });
};

export const listPaymentsForInvoice = async (invoiceId: string): Promise<PaymentRecord[]> => {
  return await db.payments.where('invoiceId').equals(invoiceId).reverse().sortBy('paymentDate');
};
