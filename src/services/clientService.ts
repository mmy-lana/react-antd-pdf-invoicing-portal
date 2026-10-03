import { db } from '@/db/database';
import type { Client } from '@/types';
import { newId } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export type ClientWritePayload = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>;
export type ClientPatch = Partial<ClientWritePayload>;

export const createClient = async (clientData: ClientWritePayload, actor: string): Promise<Client> => {
  return await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const duplicateEmail = await db.clients.where('email').equals(clientData.email).first();
    if (duplicateEmail) {
      throw new Error(`A client already exists for ${clientData.email}.`);
    }

    const issuedAt = new Date().toISOString();
    const newClient: Client = {
      ...clientData,
      id: newId('cli'),
      createdAt: issuedAt,
      updatedAt: issuedAt,
    };

    await db.clients.add(newClient);
    await writeAuditLog({
      entityId: newClient.id,
      entityType: 'client',
      action: 'create',
      actor,
      details: `Created client ${newClient.companyName}`,
      diff: {
        companyName: { before: null, after: newClient.companyName },
        email: { before: null, after: newClient.email },
      },
    });

    return newClient;
  });
};

export const updateClient = async (clientId: string, clientData: ClientPatch, actor: string): Promise<Client> => {
  return await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const existing = await db.clients.get(clientId);
    if (!existing) throw new Error('Client not found.');

    const updated: Client = {
      ...existing,
      ...clientData,
      updatedAt: new Date().toISOString(),
    };

    if (updated.email !== existing.email) {
      const duplicateEmail = await db.clients.where('email').equals(updated.email).first();
      if (duplicateEmail && duplicateEmail.id !== clientId) {
        throw new Error(`A client already exists for ${updated.email}.`);
      }
    }

    await db.clients.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'client',
      action: 'update',
      actor,
      details: `Updated client ${updated.companyName}`,
      diff: {
        companyName: { before: existing.companyName, after: updated.companyName },
        email: { before: existing.email, after: updated.email },
        paymentTermsDays: { before: existing.paymentTermsDays, after: updated.paymentTermsDays },
      },
    });

    return updated;
  });
};

/**
 * Archiving is refused while money is still outstanding: an unpaid draft-free
 * balance would become unreachable once the billing party leaves the directory.
 */
export const archiveClient = async (clientId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.clients, db.invoices, db.auditLogs], async () => {
    const client = await db.clients.get(clientId);
    if (!client) throw new Error('Client not found.');
    if (client.archivedAt) throw new Error('Client is already archived.');

    const outstandingInvoices = await db.invoices
      .where('clientId')
      .equals(clientId)
      .and((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled')
      .count();

    if (outstandingInvoices > 0) {
      throw new Error('Cannot archive client with unpaid or active invoices.');
    }

    const archivedAt = new Date().toISOString();
    client.archivedAt = archivedAt;
    client.updatedAt = archivedAt;
    await db.clients.put(client);

    await writeAuditLog({
      entityId: client.id,
      entityType: 'client',
      action: 'status_change',
      actor,
      details: `Archived client ${client.companyName}`,
      diff: {
        archivedAt: { before: null, after: archivedAt },
      },
    });
  });
};

export const unarchiveClient = async (clientId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const client = await db.clients.get(clientId);
    if (!client) throw new Error('Client not found.');

    const previousArchivedAt = client.archivedAt;
    client.archivedAt = undefined;
    client.updatedAt = new Date().toISOString();
    await db.clients.put(client);

    await writeAuditLog({
      entityId: client.id,
      entityType: 'client',
      action: 'status_change',
      actor,
      details: `Restored client ${client.companyName}`,
      diff: {
        archivedAt: { before: previousArchivedAt ?? null, after: null },
      },
    });
  });
};
