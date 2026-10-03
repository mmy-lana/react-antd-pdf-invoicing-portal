import { db } from '@/db/database';
import type { AuditLog } from '@/types';
import { newId } from '@/utils/id';

/**
 * Append-only trail. Callers must already hold the surrounding Dexie
 * transaction so the entry lands or vanishes with the change it describes.
 */
export const writeAuditLog = async (entry: Omit<AuditLog, 'id' | 'performedAt'>): Promise<void> => {
  const auditEntry: AuditLog = {
    ...entry,
    id: newId('aud'),
    performedAt: new Date().toISOString(),
  };
  await db.auditLogs.add(auditEntry);
};

export const logInvoiceEvent = async (
  invoiceId: string,
  action: 'view' | 'pdf_download',
  actor: string,
  details: string
): Promise<void> => {
  await writeAuditLog({
    entityId: invoiceId,
    entityType: 'invoice',
    action,
    actor,
    details,
  });
};
