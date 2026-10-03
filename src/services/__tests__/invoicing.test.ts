import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import type { Client, InvoiceItem, OrganizationSettings } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { addCalendarDays, todayLocalISO } from '@/utils/calculations';
import { newId } from '@/utils/id';
import { archiveClient, createClient } from '@/services/clientService';
import {
  cancelInvoiceTransactional,
  createInvoiceTransactional,
  type CreateInvoiceParams,
  updateInvoiceTransactional,
} from '@/services/invoiceService';
import { recordPaymentTransactional, voidPaymentTransactional } from '@/services/paymentService';

const seedOrganizationLedger = async (): Promise<void> => {
  const settings: OrganizationSettings = {
    id: 'org',
    companyName: 'Acro Corporate Solutions Inc.',
    companyEmail: 'billing@acrosolutions.com',
    companyPhone: '+1 (555) 019-2834',
    companyAddress: {
      street1: '100 Enterprise Boulevard',
      street2: 'Suite 400',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'United States',
    },
    companyTaxId: 'US-948201948',
    defaultCurrency: 'USD',
    defaultPaymentTermsDays: 30,
    defaultTaxRate: 8.875,
    invoicePrefix: 'INV',
    nextInvoiceSequence: 1001,
    bankDetails: {
      bankName: 'JPMorgan Chase Bank, N.A.',
      accountName: 'Acro Corporate Solutions Operating',
      accountNumber: '987654321098',
      routingNumber: '021000021',
      swiftCode: 'CHASUS33',
      iban: 'US33CHAS021000021987654321',
    },
    defaultPaymentInstructions: 'Wire transfers only. Please reference invoice number in remittance memo.',
    defaultTermsAndConditions: 'Payment is due within designated net terms.',
    updatedAt: new Date().toISOString(),
  };

  await db.settings.put(settings);
};

const onboardClient = async (overrides: Partial<Client> = {}): Promise<Client> =>
  createClient(
    {
      name: 'Sarah Jenkins',
      companyName: 'Apex Logistics Global',
      email: `s.jenkins+${newId().slice(0, 8)}@apexlogistics.com`,
      phone: '+1 (555) 349-1120',
      taxId: 'US-443920192',
      billingAddress: {
        street1: '450 Harbor Way',
        street2: 'Dock 4',
        city: 'Long Beach',
        state: 'CA',
        postalCode: '90802',
        country: 'United States',
      },
      currency: 'USD',
      paymentTermsDays: 30,
      ...overrides,
    },
    ACTOR_LOCAL_ADMIN
  );

const billableLine = (description: string, unitPriceMinor: number, quantity = 1): InvoiceItem => ({
  id: newId('item'),
  sortOrder: 1,
  description,
  unit: 'each',
  quantity,
  unitPriceMinor,
  taxRate: 0,
  discountRate: 0,
  subtotalMinor: 0,
  taxAmountMinor: 0,
  discountAmountMinor: 0,
  totalMinor: 0,
});

const issueInvoice = (clientId: string, overrides: Partial<CreateInvoiceParams> = {}) =>
  createInvoiceTransactional(
    {
      clientId,
      issueDate: todayLocalISO(),
      dueDate: addCalendarDays(todayLocalISO(), 30),
      currency: 'USD',
      status: 'pending',
      items: [billableLine('Managed platform retainer', 240_000)],
      ...overrides,
    },
    ACTOR_LOCAL_ADMIN
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedOrganizationLedger();
});

describe('invoice numbering under concurrent issuance', () => {
  it('hands out five sequential, collision-free numbers from parallel create calls', async () => {
    const client = await onboardClient();

    const concurrentlyIssued = await Promise.all(
      Array.from({ length: 5 }, (_unused, position) =>
        issueInvoice(client.id, { items: [billableLine(`Engagement tranche ${position + 1}`, 100_000)] })
      )
    );

    const issuedNumbers = concurrentlyIssued.map((invoice) => invoice.invoiceNumber);

    expect(new Set(issuedNumbers).size).toBe(5);
    expect([...issuedNumbers].sort()).toEqual([
      'INV-01001',
      'INV-01002',
      'INV-01003',
      'INV-01004',
      'INV-01005',
    ]);

    const settings = await db.settings.get('org');
    expect(settings?.nextInvoiceSequence).toBe(1006);
    expect(await db.invoices.count()).toBe(5);
  });

  it('burns the sequence number of a deleted draft so issued numbers stay gapless to auditors', async () => {
    const client = await onboardClient();
    const draft = await issueInvoice(client.id, { status: 'draft' });

    await db.invoices.delete(draft.id);

    const reissued = await issueInvoice(client.id);

    expect(reissued.invoiceNumber).toBe('INV-01002');
  });
});

describe('payment settlement and reversal', () => {
  it('walks a ledger from pending to partial to paid as settlement lands, and back on void', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);
    const firstTranche = Math.floor(invoice.totalAmountMinor / 4);
    const remainingBalance = invoice.totalAmountMinor - firstTranche;

    const firstSettlement = await recordPaymentTransactional({
      invoiceId: invoice.id,
      amountMinor: firstTranche,
      paymentDate: todayLocalISO(),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0928',
      actor: ACTOR_LOCAL_ADMIN,
    });
    expect(firstSettlement.invoice.status).toBe('partial');
    expect(firstSettlement.invoice.balanceDueMinor).toBe(remainingBalance);

    const finalSettlement = await recordPaymentTransactional({
      invoiceId: invoice.id,
      amountMinor: remainingBalance,
      paymentDate: todayLocalISO(),
      paymentMethod: 'ach',
      transactionReference: 'ACH-APEX-0929',
      actor: ACTOR_LOCAL_ADMIN,
    });
    expect(finalSettlement.invoice.status).toBe('paid');
    expect(finalSettlement.invoice.balanceDueMinor).toBe(0);
    expect(finalSettlement.invoice.paidAt).toBeTruthy();

    const reversedFinal = await voidPaymentTransactional(finalSettlement.payment.id, ACTOR_LOCAL_ADMIN, 'Wire recalled by remitter');
    expect(reversedFinal.status).toBe('partial');
    expect(reversedFinal.amountPaidMinor).toBe(firstTranche);
    expect(reversedFinal.paidAt).toBeUndefined();

    const reversedFirst = await voidPaymentTransactional(firstSettlement.payment.id, ACTOR_LOCAL_ADMIN, 'Duplicate posting');
    expect(reversedFirst.status).toBe('pending');
    expect(reversedFirst.amountPaidMinor).toBe(0);
    expect(reversedFirst.balanceDueMinor).toBe(invoice.totalAmountMinor);

    const retainedRecord = await db.payments.get(firstSettlement.payment.id);
    expect(retainedRecord?.voidedAt).toBeTruthy();
  });

  it('refuses settlement against an invoice that was never transmitted', async () => {
    const client = await onboardClient();
    const draft = await issueInvoice(client.id, { status: 'draft' });

    await expect(
      recordPaymentTransactional({
        invoiceId: draft.id,
        amountMinor: 100_000,
        paymentDate: todayLocalISO(),
        paymentMethod: 'cash',
        transactionReference: 'CASH-DRAWER-1',
        actor: ACTOR_LOCAL_ADMIN,
      })
    ).rejects.toThrow(/draft invoice/i);
  });

  it('refuses settlement against a cancelled invoice', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);
    await cancelInvoiceTransactional(invoice.id, ACTOR_LOCAL_ADMIN, 'Scope renegotiated');

    await expect(
      recordPaymentTransactional({
        invoiceId: invoice.id,
        amountMinor: 100_000,
        paymentDate: todayLocalISO(),
        paymentMethod: 'credit_card',
        transactionReference: 'TXN-STRIPE-44910',
        actor: ACTOR_LOCAL_ADMIN,
      })
    ).rejects.toThrow(/cancelled invoice/i);
  });

  it('refuses any settlement that exceeds the outstanding balance', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);

    await expect(
      recordPaymentTransactional({
        invoiceId: invoice.id,
        amountMinor: invoice.totalAmountMinor + 1,
        paymentDate: todayLocalISO(),
        paymentMethod: 'stripe',
        transactionReference: 'TXN-STRIPE-44911',
        actor: ACTOR_LOCAL_ADMIN,
      })
    ).rejects.toThrow(/exceed the remaining balance/i);
  });

  it('refuses a settlement dated before the invoice was issued', async () => {
    const client = await onboardClient();
    const issueDate = addCalendarDays(todayLocalISO(), -10);
    const invoice = await issueInvoice(client.id, {
      issueDate,
      dueDate: addCalendarDays(issueDate, 30),
    });

    await expect(
      recordPaymentTransactional({
        invoiceId: invoice.id,
        amountMinor: 1_000,
        paymentDate: addCalendarDays(issueDate, -1),
        paymentMethod: 'cash',
        transactionReference: 'CASH-DRAWER-2',
        actor: ACTOR_LOCAL_ADMIN,
      })
    ).rejects.toThrow(/prior to invoice issue date/i);
  });

  it('refuses to void the same settlement twice', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);
    const { payment } = await recordPaymentTransactional({
      invoiceId: invoice.id,
      amountMinor: invoice.totalAmountMinor,
      paymentDate: todayLocalISO(),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0930',
      actor: ACTOR_LOCAL_ADMIN,
    });

    await voidPaymentTransactional(payment.id, ACTOR_LOCAL_ADMIN, 'First reversal');

    await expect(voidPaymentTransactional(payment.id, ACTOR_LOCAL_ADMIN, 'Second reversal')).rejects.toThrow(
      /already voided/i
    );
  });
});

describe('client directory constraints', () => {
  it('refuses to archive a client while money is still outstanding', async () => {
    const client = await onboardClient();
    await issueInvoice(client.id);

    await expect(archiveClient(client.id, ACTOR_LOCAL_ADMIN)).rejects.toThrow(/unpaid or active invoices/i);

    const untouched = await db.clients.get(client.id);
    expect(untouched?.archivedAt).toBeUndefined();
  });

  it('archives a client whose invoices are all settled or cancelled', async () => {
    const client = await onboardClient();
    const settled = await issueInvoice(client.id);
    const cancelled = await issueInvoice(client.id);

    await recordPaymentTransactional({
      invoiceId: settled.id,
      amountMinor: settled.totalAmountMinor,
      paymentDate: todayLocalISO(),
      paymentMethod: 'ach',
      transactionReference: 'ACH-APEX-0931',
      actor: ACTOR_LOCAL_ADMIN,
    });
    await cancelInvoiceTransactional(cancelled.id, ACTOR_LOCAL_ADMIN, 'Duplicate billing raised in error');

    await archiveClient(client.id, ACTOR_LOCAL_ADMIN);

    const archived = await db.clients.get(client.id);
    expect(archived?.archivedAt).toBeTruthy();
  });

  it('refuses a second client registered against an email already on file', async () => {
    const client = await onboardClient();

    await expect(onboardClient({ email: client.email })).rejects.toThrow(/already exists/i);
  });
});

describe('optimistic concurrency on invoice edits', () => {
  it('rejects a save that was rendered against a stale version', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);

    await updateInvoiceTransactional(
      invoice.id,
      { notes: 'Revised scope confirmed by the account director.' },
      invoice.version,
      ACTOR_LOCAL_ADMIN
    );

    await expect(
      updateInvoiceTransactional(
        invoice.id,
        { notes: 'Stale overwrite from a second operator.' },
        invoice.version,
        ACTOR_LOCAL_ADMIN
      )
    ).rejects.toThrow(/concurrent modification/i);

    const survivor = await db.invoices.get(invoice.id);
    expect(survivor?.notes).toBe('Revised scope confirmed by the account director.');
    expect(survivor?.version).toBe(2);
  });

  it('reprices line items and re-derives the ledger totals on save', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id, { items: [billableLine('Discovery workshop', 100_000, 2)] });

    const repriced = await updateInvoiceTransactional(
      invoice.id,
      {
        items: [
          {
            ...billableLine('Discovery workshop', 150_000, 3),
            taxRate: 8.875,
            discountRate: 10,
          },
        ],
      },
      invoice.version,
      ACTOR_LOCAL_ADMIN
    );

    expect(repriced.items[0]?.subtotalMinor).toBe(450_000);
    expect(repriced.items[0]?.discountAmountMinor).toBe(45_000);
    expect(repriced.items[0]?.taxAmountMinor).toBe(35_944);
    expect(repriced.totalAmountMinor).toBe(440_944);
    expect(repriced.balanceDueMinor).toBe(440_944);
  });

  it('refuses to shrink an invoice below what has already been settled', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);
    const settlement = await recordPaymentTransactional({
      invoiceId: invoice.id,
      amountMinor: invoice.totalAmountMinor,
      paymentDate: todayLocalISO(),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0932',
      actor: ACTOR_LOCAL_ADMIN,
    });

    await expect(
      updateInvoiceTransactional(
        invoice.id,
        { items: [billableLine('Reduced scope', 1_000)] },
        settlement.invoice.version,
        ACTOR_LOCAL_ADMIN
      )
    ).rejects.toThrow(/paid invoices cannot be modified/i);

    await expect(
      updateInvoiceTransactional(
        invoice.id,
        { items: [billableLine('Reduced scope', 1_000)] },
        invoice.version,
        ACTOR_LOCAL_ADMIN
      )
    ).rejects.toThrow(/concurrent modification/i);
  });
});

describe('audit trail integrity', () => {
  it('files the settlement against its own payment record and leaves the invoice trail intact', async () => {
    const client = await onboardClient();
    const invoice = await issueInvoice(client.id);

    await recordPaymentTransactional({
      invoiceId: invoice.id,
      amountMinor: invoice.totalAmountMinor,
      paymentDate: todayLocalISO(),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0933',
      actor: ACTOR_LOCAL_ADMIN,
    });

    const invoiceTrail = await db.auditLogs.where('entityId').equals(invoice.id).toArray();
    expect(invoiceTrail.map((entry) => entry.action)).toEqual(['create']);

    const paymentTrail = await db.auditLogs.where('entityType').equals('payment').toArray();
    expect(paymentTrail).toHaveLength(1);
    expect(paymentTrail[0]?.diff?.amountPaidMinor?.after).toBe(invoice.totalAmountMinor);
    expect(paymentTrail[0]?.diff?.status).toEqual({ before: 'pending', after: 'paid' });
  });
});
