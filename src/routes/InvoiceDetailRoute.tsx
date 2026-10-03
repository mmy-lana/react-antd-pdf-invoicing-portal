import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Descriptions, Result, Skeleton, Table, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';
import type { TableColumnsType } from 'antd';
import type { PaymentRecord } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { formatDate, formatTimestamp } from '@/utils/formatters';
import { daysPastDue } from '@/utils/calculations';
import { cancelInvoiceTransactional, deleteDraftInvoice, duplicateInvoice, markInvoiceSentTransactional } from '@/services/invoiceService';
import { voidPaymentTransactional } from '@/services/paymentService';
import { logInvoiceEvent } from '@/services/auditService';
import { useInvoiceDetail } from '@/hooks/useInvoiceDetail';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { EmptyStateDisplay } from '@/components/primitives/EmptyStateDisplay';
import { InvoiceSummaryCard } from '@/components/features/invoice/InvoiceSummaryCard';
import { InvoiceActionsBar } from '@/components/features/invoice/InvoiceActionsBar';
import { PaymentModal } from '@/components/molecules/PaymentModal';
import { AuditTimeline } from '@/components/molecules/AuditTimeline';
import { PDFPreviewModal } from '@/components/features/pdf/PDFPreviewModal';
import { downloadInvoicePdf, PDFDownloadButton } from '@/components/features/pdf/PDFDownloadButton';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 0,
  overflowX: 'clip',
};

const METHOD_LABEL: Record<PaymentRecord['paymentMethod'], string> = {
  bank_transfer: 'Bank transfer',
  credit_card: 'Credit card',
  cash: 'Cash',
  stripe: 'Card processor',
  ach: 'ACH debit',
  other: 'Other',
};

/** Single invoice: frozen parties, line items, settlement history and audit trail. */
export default function InvoiceDetailRoute(): React.ReactElement {
  // The route is declared as invoices/:id, so the param name is `id`.
  const { id: invoiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { isMobile } = useResponsiveBreakpoints();

  const { invoice, payments, auditLogs, isLoading } = useInvoiceDetail(invoiceId);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // One "opened" event per invoice visit, not one per render.
  const hasLoggedThisVisit = useRef<string | null>(null);
  useEffect(() => {
    if (!invoiceId || hasLoggedThisVisit.current === invoiceId) return;
    hasLoggedThisVisit.current = invoiceId;
    void logInvoiceEvent(invoiceId, 'view', ACTOR_LOCAL_ADMIN, 'Opened invoice detail').catch(
      (auditFailure: unknown) => {
        // DATA-03: a failed telemetry write must not block the screen, but it
        // must be visible to whoever is diagnosing the audit trail.
        const cause = auditFailure instanceof Error ? auditFailure.message : String(auditFailure);
        console.warn(`[invoicing] Could not record the invoice view event for ${invoiceId}: ${cause}`);
      }
    );
  }, [invoiceId]);

  const paymentColumns = useMemo<TableColumnsType<PaymentRecord>>(
    () => [
      {
        title: 'Date',
        dataIndex: 'paymentDate',
        key: 'paymentDate',
        width: 120,
        render: (paymentDate: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(paymentDate)}</span>,
      },
      {
        title: 'Rail',
        dataIndex: 'paymentMethod',
        key: 'paymentMethod',
        width: 140,
        render: (paymentMethod: PaymentRecord['paymentMethod']) => METHOD_LABEL[paymentMethod],
      },
      {
        title: 'Reference',
        dataIndex: 'transactionReference',
        key: 'transactionReference',
        render: (transactionReference: string, payment) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {transactionReference}
            {payment.voidedAt ? (
              <span style={{ color: 'var(--color-status-overdue)', fontWeight: 700 }}> · voided</span>
            ) : null}
          </span>
        ),
      },
      {
        title: 'Amount',
        dataIndex: 'amountMinor',
        key: 'amountMinor',
        align: 'right',
        width: 130,
        render: (amountMinor: number) =>
          invoice ? <CurrencyDisplay amountMinor={amountMinor} currency={invoice.currency} /> : null,
      },
      ...(invoice
        ? [
            {
              title: '',
              key: 'void',
              width: 96,
              render: (_columnValue: unknown, payment: PaymentRecord) =>
                payment.voidedAt ? null : (
                  <Button
                    danger
                    onClick={() => {
                      let reversalReason = '';
                      modal.confirm({
                        title: 'Void this payment?',
                        content: (
                          <div style={{ minWidth: 0 }}>
                            <Typography.Paragraph style={{ marginTop: 0 }}>
                              The payment record is retained and stamped as voided, and the invoice balance
                              returns to its unsettled state.
                            </Typography.Paragraph>
                            <textarea
                              aria-label="Reversal reason"
                              placeholder="Reason for reversal"
                              onChange={(changeEvent) => {
                                reversalReason = changeEvent.target.value;
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
                        okText: 'Void payment',
                        okButtonProps: { danger: true },
                        cancelText: 'Keep payment',
                        onOk: async () => {
                          if (!reversalReason.trim()) {
                            message.warning('A reason is required to void a payment.');
                            throw new Error('Reversal reason is required.');
                          }
                          try {
                            await voidPaymentTransactional(payment.id, ACTOR_LOCAL_ADMIN, reversalReason.trim());
                            message.success('Payment voided and the invoice balance restored.');
                          } catch (voidError) {
                            message.error(voidError instanceof Error ? voidError.message : 'The payment could not be voided.');
                            throw voidError;
                          }
                        },
                      });
                    }}
                    style={{ minHeight: 'var(--touch-target-min, 44px)' }}
                  >
                    Void
                  </Button>
                ),
            },
          ]
        : []),
    ],
    [invoice, message, modal]
  );

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={pageStyle}>
        <Result
          status="404"
          title="Invoice not found"
          subTitle="It may have been deleted while it was still a draft, or the link is out of date."
          extra={
            <Button type="primary" onClick={() => navigate('/invoices')}>
              Back to the ledger
            </Button>
          }
        />
      </div>
    );
  }

  const isDraft = invoice.status === 'draft';
  const isCancelled = invoice.status === 'cancelled';
  const isPaid = invoice.status === 'paid';
  const lateBy = invoice.balanceDueMinor > 0 ? daysPastDue(invoice.dueDate) : 0;

  const handleMarkSent = async (): Promise<void> => {
    try {
      await markInvoiceSentTransactional(invoice.id, ACTOR_LOCAL_ADMIN);
      message.success(`${invoice.invoiceNumber} marked as sent.`);
    } catch (sendError) {
      message.error(sendError instanceof Error ? sendError.message : 'The invoice could not be marked as sent.');
    }
  };

  const handleCancel = (): void => {
    let cancellationReason = '';
    modal.confirm({
      title: `Cancel ${invoice.invoiceNumber}?`,
      content: (
        <div style={{ minWidth: 0 }}>
          <Typography.Paragraph style={{ marginTop: 0 }}>
            The invoice stays on file and its number stays retired. Record why for the audit trail.
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
        try {
          await cancelInvoiceTransactional(invoice.id, ACTOR_LOCAL_ADMIN, cancellationReason.trim());
          message.success(`${invoice.invoiceNumber} cancelled.`);
        } catch (cancelError) {
          message.error(cancelError instanceof Error ? cancelError.message : 'The invoice could not be cancelled.');
          throw cancelError;
        }
      },
    });
  };

  const handleDelete = (): void => {
    modal.confirm({
      title: `Delete draft ${invoice.invoiceNumber}?`,
      content: 'The number stays retired and is never reused.',
      okText: 'Delete permanently',
      okButtonProps: { danger: true },
      cancelText: 'Keep draft',
      onOk: async () => {
        try {
          await deleteDraftInvoice(invoice.id, ACTOR_LOCAL_ADMIN);
          message.success(`${invoice.invoiceNumber} deleted.`);
          navigate('/invoices');
        } catch (deleteError) {
          message.error(deleteError instanceof Error ? deleteError.message : 'The draft could not be deleted.');
          throw deleteError;
        }
      },
    });
  };

  const handleDuplicate = async (): Promise<void> => {
    try {
      const duplicatedInvoice = await duplicateInvoice(invoice.id, ACTOR_LOCAL_ADMIN);
      message.success(`${duplicatedInvoice.invoiceNumber} created as a draft.`);
      navigate(`/invoices/${duplicatedInvoice.id}/edit`);
    } catch (duplicationError) {
      message.error(duplicationError instanceof Error ? duplicationError.message : 'The invoice could not be duplicated.');
    }
  };

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {invoice.invoiceNumber}
            </span>
            <StatusBadge status={invoice.status} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {invoice.clientSnapshot.companyName} · issued {formatDate(invoice.issueDate)} · due{' '}
            {formatDate(invoice.dueDate)}
            {lateBy > 0 && !isPaid && !isCancelled ? ` · ${lateBy} days late` : ''}
          </p>
        </div>

        <InvoiceActionsBar
          invoice={invoice}
          onEdit={() => navigate(`/invoices/${invoice.id}/edit`)}
          onPreviewPdf={() => setIsPreviewOpen(true)}
          onDownloadPdf={() => {
            void downloadInvoicePdf(invoice, ACTOR_LOCAL_ADMIN)
              .then(() => message.success(`${invoice.invoiceNumber} downloaded.`))
              .catch((exportError: unknown) =>
                message.error(exportError instanceof Error ? exportError.message : 'The PDF could not be generated.')
              );
          }}
          onRecordPayment={() => setIsPaymentOpen(true)}
          onMarkSent={() => void handleMarkSent()}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onDuplicate={() => void handleDuplicate()}
          canEdit={isDraft || (!isPaid && !isCancelled)}
          canSettle={!isDraft && !isCancelled && invoice.balanceDueMinor > 0}
          canSend={isDraft}
          canCancel={!isDraft && !isCancelled && !isPaid}
          canDelete={isDraft}
          canDuplicate={!isDraft}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section
            style={{
              padding: 16,
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md, 4px)',
              minWidth: 0,
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Line items
            </h2>

            {invoice.items.length === 0 ? (
              <EmptyStateDisplay
                variant="no-invoices"
                title="This invoice has no line items"
                description="A draft with no billable lines cannot be issued until at least one line is priced."
                compact
              />
            ) : (
              <div style={{ minWidth: 0, overflowX: 'auto' }}>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={invoice.items}
                  columns={[
                    { title: 'Description', dataIndex: 'description', key: 'description', render: (value: string) => value },
                    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90 },
                    {
                      title: 'Qty',
                      dataIndex: 'quantity',
                      key: 'quantity',
                      width: 72,
                      align: 'right',
                      render: (value: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>,
                    },
                    {
                      title: 'Rate',
                      dataIndex: 'unitPriceMinor',
                      key: 'unitPriceMinor',
                      width: 120,
                      align: 'right',
                      render: (value: number) => <CurrencyDisplay amountMinor={value} currency={invoice.currency} />,
                    },
                    {
                      title: 'Tax',
                      dataIndex: 'taxRate',
                      key: 'taxRate',
                      width: 80,
                      align: 'right',
                      render: (value: number) => `${value}%`,
                    },
                    {
                      title: 'Line total',
                      dataIndex: 'totalMinor',
                      key: 'totalMinor',
                      width: 130,
                      align: 'right',
                      render: (value: number) => (
                        <CurrencyDisplay amountMinor={value} currency={invoice.currency} tone="strong" />
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </section>

          <section
            style={{
              padding: 16,
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md, 4px)',
              minWidth: 0,
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Settlement history
            </h2>

            {payments.length === 0 ? (
              <Typography.Paragraph style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                Nothing has been settled against this invoice yet.
              </Typography.Paragraph>
            ) : (
              <div style={{ minWidth: 0, overflowX: 'auto' }}>
                <Table<PaymentRecord>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={payments}
                  columns={paymentColumns}
                />
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <InvoiceSummaryCard totals={invoice} />

          <section
            style={{
              padding: 16,
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md, 4px)',
              minWidth: 0,
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Parties and delivery
            </h2>

            <Descriptions
              size="small"
              column={1}
              colon={false}
              labelStyle={{ color: 'var(--color-text-muted)', fontSize: 12, width: 120 }}
              contentStyle={{ fontSize: 12.5, wordBreak: 'break-word' }}
              items={[
                {
                  key: 'issuer',
                  label: 'Issuer',
                  children: invoice.organizationSnapshot.companyName,
                },
                {
                  key: 'billed-to',
                  label: 'Billed to',
                  children: (
                    <span>
                      {invoice.clientSnapshot.companyName}
                      <br />
                      {invoice.clientSnapshot.name}
                      <br />
                      {invoice.clientSnapshot.email}
                    </span>
                  ),
                },
                {
                  key: 'address',
                  label: 'Billing address',
                  children: (
                    <span>
                      {invoice.clientSnapshot.billingAddress.street1}
                      {invoice.clientSnapshot.billingAddress.street2
                        ? `, ${invoice.clientSnapshot.billingAddress.street2}`
                        : ''}
                      <br />
                      {invoice.clientSnapshot.billingAddress.city}, {invoice.clientSnapshot.billingAddress.state}{' '}
                      {invoice.clientSnapshot.billingAddress.postalCode}
                      <br />
                      {invoice.clientSnapshot.billingAddress.country}
                    </span>
                  ),
                },
                { key: 'terms', label: 'Terms', children: `Net ${invoice.clientSnapshot.paymentTermsDays} days` },
                { key: 'tax-id', label: 'Client tax ID', children: invoice.clientSnapshot.taxId || '—' },
                {
                  key: 'sent',
                  label: 'Sent',
                  children: invoice.sentAt ? formatTimestamp(invoice.sentAt) : 'Not yet transmitted',
                },
                {
                  key: 'paid',
                  label: 'Settled',
                  children: invoice.paidAt ? formatTimestamp(invoice.paidAt) : 'Outstanding',
                },
                {
                  key: 'portal',
                  label: 'Portal link',
                  children: (
                    /*
                     * UI-01: a link-styled button still needs the full tap
                     * target. `minHeight: auto` here would have made this the
                     * one interactive control on the screen under 44px.
                     */
                    <Button
                      type="link"
                      style={{ paddingInline: 0, minHeight: 'var(--touch-target-min, 44px)' }}
                      onClick={() => navigate(`/portal/${invoice.portalToken}`)}
                    >
                      View as the client
                    </Button>
                  ),
                },
              ]}
            />
          </section>

          <section
            style={{
              padding: 16,
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md, 4px)',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <PDFDownloadButton invoice={invoice} actor={ACTOR_LOCAL_ADMIN} label="Download PDF" />
              {!isMobile ? (
                <Button onClick={() => setIsPreviewOpen(true)} style={{ minHeight: 'var(--touch-target-min, 44px)' }}>
                  Preview
                </Button>
              ) : null}
            </div>

            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Audit trail
            </h2>
            <AuditTimeline entries={auditLogs} />
          </section>
        </div>
      </div>

      <PaymentModal
        open={isPaymentOpen}
        invoice={invoice}
        onClose={() => setIsPaymentOpen(false)}
        onRecorded={() => setIsPaymentOpen(false)}
      />

      <PDFPreviewModal
        open={isPreviewOpen}
        invoice={invoice}
        actor={ACTOR_LOCAL_ADMIN}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
