import { db } from '@/db/database';
import type { OrganizationSettings } from '@/types';
import { isAlphanumericSequenceToken } from '@/utils/validators';
import { writeAuditLog } from '@/services/auditService';

export type OrganizationSettingsWrite = Omit<OrganizationSettings, 'id' | 'updatedAt'>;

const escapeForLiteralMatch = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Issuer settings guard.
 *
 * Invoice numbers are permanent, so the sequence may only ever move forward
 * past the highest number already issued under a prefix. Lowering it would
 * re-issue a number that already exists on a client's copy of a document.
 */
export const updateSettingsTransactional = async (
  proposedSettings: OrganizationSettingsWrite,
  actor: string
): Promise<OrganizationSettings> => {
  if (!isAlphanumericSequenceToken(proposedSettings.invoicePrefix)) {
    throw new Error('Invoice prefix must be non-empty and alphanumeric (dashes and underscores allowed).');
  }

  if (!Number.isInteger(proposedSettings.nextInvoiceSequence) || proposedSettings.nextInvoiceSequence <= 0) {
    throw new Error('Next invoice sequence must be a positive integer.');
  }

  if (!proposedSettings.companyName.trim()) {
    throw new Error('Company name is required on every issued document.');
  }

  return await db.transaction('rw', [db.settings, db.invoices, db.auditLogs], async () => {
    const currentSettings = await db.settings.get('org');
    if (!currentSettings) throw new Error('Settings not initialized.');

    const prefixPattern = new RegExp(`^${escapeForLiteralMatch(proposedSettings.invoicePrefix)}-(\\d+)$`);
    const issuedNumbers = (await db.invoices.toArray())
      .map((invoice) => invoice.invoiceNumber.match(prefixPattern)?.[1])
      .filter((digits): digits is string => Boolean(digits))
      .map((digits) => Number(digits));

    const highestIssued = issuedNumbers.length > 0 ? Math.max(...issuedNumbers) : 0;
    if (proposedSettings.nextInvoiceSequence <= highestIssued) {
      throw new Error(
        `Next invoice sequence must exceed the highest number already issued (${highestIssued}) for prefix "${proposedSettings.invoicePrefix}".`
      );
    }

    const savedSettings: OrganizationSettings = {
      ...proposedSettings,
      id: 'org',
      updatedAt: new Date().toISOString(),
    };

    await db.settings.put(savedSettings);
    await writeAuditLog({
      entityId: 'org',
      entityType: 'settings',
      action: 'update',
      actor,
      details: 'Updated organization profile and billing settings',
      diff: {
        invoicePrefix: { before: currentSettings.invoicePrefix, after: savedSettings.invoicePrefix },
        nextInvoiceSequence: {
          before: currentSettings.nextInvoiceSequence,
          after: savedSettings.nextInvoiceSequence,
        },
        defaultCurrency: { before: currentSettings.defaultCurrency, after: savedSettings.defaultCurrency },
      },
    });

    return savedSettings;
  });
};

/** Highest number already issued under a prefix, for the settings screen hint. */
export const highestIssuedSequenceForPrefix = async (prefix: string): Promise<number> => {
  if (!isAlphanumericSequenceToken(prefix)) return 0;

  const prefixPattern = new RegExp(`^${escapeForLiteralMatch(prefix)}-(\\d+)$`);
  const issuedNumbers = (await db.invoices.toArray())
    .map((invoice) => invoice.invoiceNumber.match(prefixPattern)?.[1])
    .filter((digits): digits is string => Boolean(digits))
    .map((digits) => Number(digits));

  return issuedNumbers.length > 0 ? Math.max(...issuedNumbers) : 0;
};
