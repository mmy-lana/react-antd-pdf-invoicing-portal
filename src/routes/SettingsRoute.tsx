import React, { useCallback, useEffect, useState } from 'react';
import { App, Skeleton } from 'antd';
import type { OrganizationSettings } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { db } from '@/db/database';
import { highestIssuedSequenceForPrefix, updateSettingsTransactional } from '@/services/settingsService';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { CompanyInfoForm } from '@/components/features/settings/CompanyInfoForm';
import { BankDetailsForm } from '@/components/features/settings/BankDetailsForm';
import { InvoiceSequencingForm } from '@/components/features/settings/InvoiceSequencingForm';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 0,
  overflowX: 'clip',
};

/**
 * Issuer settings.
 *
 * Each section writes through the same guarded service call, so numbering rules
 * and prefix validation apply whichever section triggered the save. Patches are
 * merged onto the live record immediately before writing, because a save in one
 * section must not revert a concurrent save in another.
 */
export default function SettingsRoute(): React.ReactElement {
  const { message } = App.useApp();
  const { settings, isLoading } = useOrganizationSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [highestIssued, setHighestIssued] = useState(0);

  useEffect(() => {
    if (!settings) return;
    let isStale = false;

    void highestIssuedSequenceForPrefix(settings.invoicePrefix)
      .then((highest) => {
        if (!isStale) setHighestIssued(highest);
      })
      .catch((lookupFailure: unknown) => {
        // DATA-03: the hint is advisory, so a failure must not break the
        // screen, but it should not vanish silently either.
        const cause = lookupFailure instanceof Error ? lookupFailure.message : String(lookupFailure);
        console.warn(`[invoicing] Could not read the highest issued sequence for "${settings.invoicePrefix}": ${cause}`);
      });

    return () => {
      isStale = true;
    };
  }, [settings]);

  const persistPatch = useCallback(
    async (
      patch: Partial<Omit<OrganizationSettings, 'id' | 'updatedAt'>>,
      successMessage: string
    ): Promise<void> => {
      const currentSettings = await db.settings.get('org');
      if (!currentSettings) {
        message.error('Settings are not initialised.');
        return;
      }

      const { id: _ignoredId, updatedAt: _ignoredTimestamp, ...currentValues } = currentSettings;
      const nextSettings: Omit<OrganizationSettings, 'id' | 'updatedAt'> = { ...currentValues, ...patch };

      setIsSaving(true);
      try {
        await updateSettingsTransactional(nextSettings, ACTOR_LOCAL_ADMIN);
        message.success(successMessage);
        const refreshedHighest = await highestIssuedSequenceForPrefix(nextSettings.invoicePrefix);
        setHighestIssued(refreshedHighest);
      } catch (saveError) {
        message.error(saveError instanceof Error ? saveError.message : 'The settings could not be saved.');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [message]
  );

  /**
   * Bridges a form's void-returning handler to the rejecting persistence call.
   * `persistPatch` already surfaces the failure to the operator as a toast; this
   * keeps it observable in the console as well (DATA-03) without re-throwing
   * into React's event handler.
   */
  const submitSection = useCallback(
    (patch: Partial<Omit<OrganizationSettings, 'id' | 'updatedAt'>>, successMessage: string, section: string): void => {
      void persistPatch(patch, successMessage).catch((saveFailure: unknown) => {
        const cause = saveFailure instanceof Error ? saveFailure.message : String(saveFailure);
        console.warn(`[invoicing] Settings save rejected for section "${section}": ${cause}`);
      });
    },
    [persistPatch]
  );

  if (isLoading || !settings) {
    return (
      <div style={pageStyle}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <CompanyInfoForm
        settings={settings}
        isSaving={isSaving}
        onSubmit={(patch) => submitSection(patch, 'Issuer profile saved.', 'issuer-profile')}
      />

      <BankDetailsForm
        settings={settings}
        isSaving={isSaving}
        onSubmit={(patch) => submitSection(patch, 'Remittance details saved.', 'remittance-details')}
      />

      <InvoiceSequencingForm
        invoicePrefix={settings.invoicePrefix}
        nextInvoiceSequence={settings.nextInvoiceSequence}
        highestIssuedSequence={highestIssued}
        isSaving={isSaving}
        onSubmit={(patch) => {
          const sequencedPatch: Partial<Omit<OrganizationSettings, 'id' | 'updatedAt'>> = {
            invoicePrefix: patch.invoicePrefix,
            ...(patch.nextInvoiceSequence === undefined
              ? {}
              : { nextInvoiceSequence: patch.nextInvoiceSequence }),
          };
          submitSection(sequencedPatch, 'Invoice numbering saved.', 'invoice-numbering');
        }}
      />

      <section
        aria-label="Storage notice"
        style={{
          padding: 16,
          backgroundColor: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md, 4px)',
          minWidth: 0,
        }}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>Where this data lives</h2>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          Every invoice, client, payment and audit entry is stored in this browser's IndexedDB. Nothing is
          transmitted to a server. Clearing site data removes the ledger permanently, so export anything you need
          to keep before doing so.
        </p>
      </section>
    </div>
  );
}
