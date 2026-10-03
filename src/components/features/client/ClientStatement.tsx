import React, { useMemo } from 'react';
import { Button, Drawer, Table } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import type { Client, Invoice } from '@/types';
import { ACTOR_CLIENT_PORTAL } from '@/types';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { accumulateByCurrency, toCurrencyFigureList } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { EmptyStateDisplay } from '@/components/primitives/EmptyStateDisplay';
import { PDFDownloadButton } from '@/components/features/pdf/PDFDownloadButton';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface ClientStatementProps {
  open: boolean;
  client: Client | null;
  invoices: Invoice[];
  onClose: () => void;
  onOpenInvoice: (invoice: Invoice) => void;
  onCreateInvoice: (client: Client) => void;
}

/**
 * Account statement for one client.
 *
 * Every figure is bucketed by currency. A client billed in both dollars and yen
 * gets two separate ledgers here rather than one number that would be
 * meaningless to add.
 */
export const ClientStatement: React.FC<ClientStatementProps> = ({
  open,
  client,
  invoices,
  onClose,
  onOpenInvoice,
  onCreateInvoice,
}) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;

  const clientInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.clientId === client?.id),
    [invoices, client?.id]
  );

  const reportableInvoices = useMemo(
    () => clientInvoices.filter((invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled'),
    [clientInvoices]
  );

  const invoicedTotals = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(reportableInvoices.map((invoice) => ({
          currency: invoice.currency,
          amountMinor: invoice.totalAmountMinor,
        })))
      ),
    [reportableInvoices]
  );

  const settledTotals = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(reportableInvoices.map((invoice) => ({
          currency: invoice.currency,
          amountMinor: invoice.amountPaidMinor,
        })))
      ),
    [reportableInvoices]
  );

  const outstandingTotals = useMemo(
    () =>
      toCurrencyFigureList(
        accumulateByCurrency(reportableInvoices.map((invoice) => ({
          currency: invoice.currency,
          amountMinor: invoice.balanceDueMinor,
        })))
      ),
    [reportableInvoices]
  );

  const columns = useMemo<TableColumnsType<Invoice>>(
    () => [
      {
        title: 'Invoice',
        dataIndex: 'invoiceNumber',
        key: 'invoiceNumber',
        width: 130,
        render: (invoiceNumber: string) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{invoiceNumber}</span>
        ),
      },
      {
        title: 'Issued',
        dataIndex: 'issueDate',
        key: 'issueDate',
        width: 112,
        sorter: (earlier, later) => earlier.issueDate.localeCompare(later.issueDate),
        defaultSortOrder: 'descend',
        render: (issueDate: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(issueDate)}</span>,
      },
      {
        title: 'Due',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 112,
        render: (dueDate: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(dueDate)}</span>,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 148,
        render: (status: Invoice['status']) => <StatusBadge status={status} size="compact" variant="wash" />,
      },
      {
        title: 'Total',
        dataIndex: 'totalAmountMinor',
        key: 'totalAmountMinor',
        align: 'right',
        width: 124,
        sorter: (earlier, later) => earlier.totalAmountMinor - later.totalAmountMinor,
        render: (totalAmountMinor: number, invoice) => (
          <CurrencyDisplay amountMinor={totalAmountMinor} currency={invoice.currency} />
        ),
      },
      {
        title: 'Balance',
        dataIndex: 'balanceDueMinor',
        key: 'balanceDueMinor',
        align: 'right',
        width: 124,
        render: (balanceDueMinor: number, invoice) => (
          <CurrencyDisplay
            amountMinor={balanceDueMinor}
            currency={invoice.currency}
            tone={balanceDueMinor > 0 ? 'strong' : 'positive'}
          />
        ),
      },
      {
        title: '',
        key: 'download',
        width: 56,
        align: 'right',
        render: (_columnValue, invoice) => (
          <Button
            type="text"
            icon={<FilePdfOutlined aria-hidden="true" />}
            aria-label={`Download ${invoice.invoiceNumber}`}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            style={{ minWidth: 'var(--touch-target-min, 44px)', minHeight: 'var(--touch-target-min, 44px)' }}
          />
        ),
      },
    ],
    []
  );

  const renderTotalRow = (
    caption: string,
    figures: Array<{ currency: Invoice['currency']; amountMinor: number }>,
    emphasise: boolean
  ): React.ReactNode => (
    <div
      key={caption}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderTop: emphasise ? '1.5px solid var(--color-text-main)' : 'none',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: emphasise ? 700 : 500, color: 'var(--color-text-secondary)' }}>
        {caption}
      </span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end', minWidth: 0 }}>
        {figures.length === 0 ? (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        ) : (
          figures.map((figure) => (
            <CurrencyDisplay
              key={figure.currency}
              amountMinor={figure.amountMinor}
              currency={figure.currency}
              tone={emphasise ? 'strong' : 'default'}
              showCode={figures.length > 1}
            />
          ))
        )}
      </span>
    </div>
  );

  return (
    <Drawer
      title={client ? `Statement — ${client.companyName}` : 'Statement'}
      placement={prefersTouchInput ? 'bottom' : 'right'}
      height={prefersTouchInput ? '92dvh' : undefined}
      width={prefersTouchInput ? undefined : 760}
      open={open}
      onClose={onClose}
      styles={{ body: { minWidth: 0 } }}
    >
      {client ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Billing contact</div>
            <div style={{ fontWeight: 600 }}>{client.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{client.email}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {client.billingAddress.street1}
              {client.billingAddress.street2 ? `, ${client.billingAddress.street2}` : ''}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {client.billingAddress.city}, {client.billingAddress.state} {client.billingAddress.postalCode},{' '}
              {client.billingAddress.country}
            </div>
          </div>

          <section
            style={{
              padding: 12,
              backgroundColor: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 3px)',
              minWidth: 0,
            }}
          >
            {renderTotalRow('Invoiced', invoicedTotals, false)}
            {renderTotalRow('Settled', settledTotals, false)}
            {renderTotalRow('Outstanding', outstandingTotals, true)}
          </section>

          {reportableInvoices.length === 0 ? (
            <EmptyStateDisplay
              variant="no-invoices"
              title="No issued invoices for this client"
              description="Drafts and cancelled invoices are excluded from the statement. Raise the first invoice to start the account history."
              primaryAction={{
                label: 'Create invoice',
                onClick: () => onCreateInvoice(client),
              }}
            />
          ) : (
            <Table<Invoice>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={reportableInvoices}
              pagination={false}
              scroll={{ x: 'max-content' }}
              onRow={(invoice) => ({
                onClick: () => onOpenInvoice(invoice),
                style: { cursor: 'pointer' },
              })}
            />
          )}

          {reportableInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                Client copies
              </span>
              {reportableInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {invoice.invoiceNumber}
                  </span>
                  <PDFDownloadButton
                    invoice={invoice}
                    actor={ACTOR_CLIENT_PORTAL}
                    label="PDF"
                    buttonProps={{ type: 'default' }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyStateDisplay variant="no-clients" title="No client selected" compact />
      )}
    </Drawer>
  );
};
