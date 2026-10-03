import React, { useCallback, useMemo, useState } from 'react';
import { App, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { PlusOutlined } from '@ant-design/icons';
import type { Invoice, InvoiceFilters } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { accumulateByCurrency, toCurrencyFigureList } from '@/utils/calculations';
import { cancelInvoiceTransactional, deleteDraftInvoice, duplicateInvoice, markInvoiceSentTransactional } from '@/services/invoiceService';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';
import { MetricCard } from '@/components/primitives/MetricCard';
import { EmptyStateDisplay } from '@/components/primitives/EmptyStateDisplay';
import { InvoiceTable, type InvoiceTableActionSet } from '@/components/features/invoice/InvoiceTable';
import { InvoiceCardList } from '@/components/features/invoice/InvoiceCardList';
import { InvoiceTableToolbar } from '@/components/molecules/InvoiceTableToolbar';
import { downloadInvoicePdf } from '@/components/features/pdf/PDFDownloadButton';
import { PDFPreviewModal } from '@/components/features/pdf/PDFPreviewModal';
import { PaymentModal } from '@/components/molecules/PaymentModal';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 0,
  overflowX: 'clip',
};

const noFilters: InvoiceFilters = { searchQuery: '', statuses: [] };

/**
 * Invoice ledger dashboard.
 *
 * Headline figures are grouped by currency. Adding a EUR balance to a USD one
 * would produce a number that means nothing, so each currency gets its own
 * figure and no total is ever blended.
 */
export default function InvoicesRoute(): React.ReactElement {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { isMobile } = useResponsiveBreakpoints();

  const [filters, setFilters] = useState<InvoiceFilters>(noFilters);
  const { invoices, isLoading } = useInvoices(filters);
  const { clients } = useClients();

  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Invoice | null>(null);

  const outstandingFigures = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(
          invoices
            .filter((invoice) => invoice.status !== 'cancelled' && invoice.status !== 'draft')
            .map((invoice) => ({ currency: invoice.currency, amountMinor: invoice.balanceDueMinor }))
        )
      ),
    [invoices]
  );

  const overdueFigures = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(
          invoices
            .filter((invoice) => invoice.status === 'overdue')
            .map((invoice) => ({ currency: invoice.currency, amountMinor: invoice.balanceDueMinor }))
        )
      ),
    [invoices]
  );

  const settledFigures = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(
          invoices
            .filter((invoice) => invoice.status === 'paid')
            .map((invoice) => ({ currency: invoice.currency, amountMinor: invoice.totalAmountMinor }))
        )
      ),
    [invoices]
  );

  const draftCount = useMemo(() => invoices.filter((invoice) => invoice.status === 'draft').length, [invoices]);

  const runAction = useCallback(
    async (operation: () => Promise<unknown>, successMessage: string, failureFallback: string): Promise<void> => {
      try {
        await operation();
        message.success(successMessage);
      } catch (actionError) {
        message.error(actionError instanceof Error ? actionError.message : failureFallback);
      }
    },
    [message]
  );

  const handleDuplicate = useCallback(
    async (invoice: Invoice): Promise<void> => {
      try {
        const duplicatedInvoice = await duplicateInvoice(invoice.id, ACTOR_LOCAL_ADMIN);
        message.success(`${duplicatedInvoice.invoiceNumber} created as a draft.`);
        navigate(`/invoices/${duplicatedInvoice.id}/edit`);
      } catch (duplicationError) {
        message.error(duplicationError instanceof Error ? duplicationError.message : 'The invoice could not be duplicated.');
      }
    },
    [message, navigate]
  );

  const handleCancel = useCallback(
    (invoice: Invoice): void => {
      let cancellationReason = '';
      modal.confirm({
        title: `Cancel ${invoice.invoiceNumber}?`,
        content: (
          <div style={{ minWidth: 0 }}>
            <Typography.Paragraph style={{ marginTop: 0 }}>
              The number stays retired and the invoice stays on file. Record the reason for the audit trail.
            </Typography.Paragraph>
            <textarea
              aria-label="Cancellation reason"
              placeholder="Reason for cancellation"
              onChange={(changeEvent) => {
                cancellationReason = changeEvent.target.value;
              }}
              style={{
                width: '100%',
                minHeight: 64,
                padding: 8,
                font: 'inherit',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-sm, 3px)',
              }}
            />
          </div>
        ),
        okText: 'Cancel invoice',
        okButtonProps: { danger: true },
        cancelText: 'Keep invoice',
        onOk: async () => {
          if (!cancellationReason.trim()) {
            message.warning('A reason is required to cancel an invoice.');
            throw new Error('Cancellation reason is required.');
          }
          await runAction(
            () => cancelInvoiceTransactional(invoice.id, ACTOR_LOCAL_ADMIN, cancellationReason.trim()),
            `${invoice.invoiceNumber} cancelled.`,
            'The invoice could not be cancelled.'
          );
        },
      });
    },
    [message, modal, runAction]
  );

  const handleDelete = useCallback(
    (invoice: Invoice): void => {
      modal.confirm({
        title: `Delete draft ${invoice.invoiceNumber}?`,
        content:
          'The draft is removed permanently. Its number stays retired and is never reused, so the numbering sequence remains gapless for audit.',
        okText: 'Delete permanently',
        okButtonProps: { danger: true },
        cancelText: 'Keep draft',
        onOk: async () => {
          await runAction(
            () => deleteDraftInvoice(invoice.id, ACTOR_LOCAL_ADMIN),
            `${invoice.invoiceNumber} deleted.`,
            'The draft could not be deleted.'
          );
        },
      });
    },
    [modal, runAction]
  );

  const actions = useMemo<InvoiceTableActionSet>(
    () => ({
      onOpen: (invoice) => navigate(`/invoices/${invoice.id}`),
      onEdit: (invoice) => navigate(`/invoices/${invoice.id}/edit`),
      onPreviewPdf: (invoice) => setPreviewTarget(invoice),
      onDownloadPdf: (invoice) => {
        void downloadInvoicePdf(invoice, ACTOR_LOCAL_ADMIN)
          .then(() => message.success(`${invoice.invoiceNumber} downloaded.`))
          .catch((exportError: unknown) =>
            message.error(exportError instanceof Error ? exportError.message : 'The PDF could not be generated.')
          );
      },
      onRecordPayment: (invoice) => setPaymentTarget(invoice),
      onMarkSent: (invoice) => {
        void runAction(
          () => markInvoiceSentTransactional(invoice.id, ACTOR_LOCAL_ADMIN),
          `${invoice.invoiceNumber} marked as sent.`,
          'The invoice could not be marked as sent.'
        );
      },
      onCancel: handleCancel,
      onDelete: handleDelete,
      onDuplicate: (invoice) => void handleDuplicate(invoice),
    }),
    [handleCancel, handleDelete, handleDuplicate, message, navigate, runAction]
  );

  const hasAnyInvoice = invoices.length > 0;

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          minWidth: 0,
        }}
      >
        <MetricCard label="Outstanding" figures={outstandingFigures} tone="warning" hint="Awaiting settlement" />
        <MetricCard label="Overdue" figures={overdueFigures} tone="critical" hint="Past the due date" />
        <MetricCard label="Settled" figures={settledFigures} tone="positive" hint="Paid in full" />
        <MetricCard label="Drafts" figures={[]} hint={`${draftCount} awaiting issue`} />
      </div>

      <InvoiceTableToolbar
        filters={filters}
        onFiltersChange={setFilters}
        clients={clients}
        matchedCount={invoices.length}
        totalCount={invoices.length}
        onCreateInvoice={() => navigate('/invoices/new')}
      />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !hasAnyInvoice ? (
        <EmptyStateDisplay
          variant={filters.searchQuery || (filters.statuses?.length ?? 0) > 0 ? 'no-matches' : 'no-invoices'}
          title={
            filters.searchQuery || (filters.statuses?.length ?? 0) > 0
              ? 'No invoices match these filters'
              : 'No invoices issued yet'
          }
          description={
            filters.searchQuery || (filters.statuses?.length ?? 0) > 0
              ? 'Widen the date range, clear the status chips, or search a different invoice number.'
              : 'Create the first invoice to start tracking what your clients owe you.'
          }
          primaryAction={
            filters.searchQuery || (filters.statuses?.length ?? 0) > 0
              ? { label: 'Clear filters', onClick: () => setFilters(noFilters) }
              : { label: 'Create first invoice', icon: <PlusOutlined aria-hidden="true" />, onClick: () => navigate('/invoices/new') }
          }
        />
      ) : isMobile ? (
        <InvoiceCardList invoices={invoices} actions={actions} />
      ) : (
        <InvoiceTable invoices={invoices} actions={actions} />
      )}

      {paymentTarget ? (
        <PaymentModal
          open
          invoice={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onRecorded={() => setPaymentTarget(null)}
        />
      ) : null}

      {previewTarget ? (
        <PDFPreviewModal
          open
          invoice={previewTarget}
          actor={ACTOR_LOCAL_ADMIN}
          onClose={() => setPreviewTarget(null)}
        />
      ) : null}
    </div>
  );
}
