import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { AuditLog, Client, Invoice, OrganizationSettings, PaymentRecord } from '@/types';

/**
 * Local-first ledger. Every money-bearing mutation runs inside a Dexie
 * transaction so a sequence bump, an invoice row and its audit trail can only
 * ever commit or roll back together.
 *
 * Compound indices are deliberate: `[clientId+status]` backs the per-client
 * statement rollup and `[status+dueDate]` backs overdue sweeps.
 */
export class InvoicingDatabase extends Dexie {
  clients!: Table<Client, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<PaymentRecord, string>;
  settings!: Table<OrganizationSettings, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('CorporateInvoicingDB');

    this.version(1).stores({
      clients: 'id, name, companyName, email, createdAt, archivedAt',
      invoices:
        'id, &invoiceNumber, clientId, status, issueDate, dueDate, totalAmountMinor, balanceDueMinor, portalToken, [clientId+status], [status+dueDate], createdAt',
      payments: 'id, invoiceId, paymentDate, paymentMethod, createdAt, voidedAt',
      settings: 'id',
      auditLogs: 'id, entityId, entityType, action, performedAt',
    });

    this.version(2).stores({
      invoices:
        'id, &invoiceNumber, clientId, status, issueDate, dueDate, totalAmountMinor, balanceDueMinor, portalToken, [clientId+status], [status+dueDate], createdAt, version',
    });
  }
}

export const db = new InvoicingDatabase();
