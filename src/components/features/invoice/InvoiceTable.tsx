import React, { useMemo } from 'react';
import { Button, Dropdown, Table } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { MenuProps, TableColumnsType } from 'antd';
import type { Invoice } from '@/types';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { formatDate } from '@/utils/formatters';
import { daysPastDue } from '@/utils/calculations';

export interface InvoiceTableActionSet {
  onOpen: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onPreviewPdf: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onCancel: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
}

export interface InvoiceTableProps {
  invoices: Invoice[];
  actions: InvoiceTableActionSet;
}

const menuEntriesFor = (invoice: Invoice): MenuProps['items'] => {
  const entries: MenuProps['items'] = [
    { key: 'open', label: 'Open invoice' },
    { key: 'preview', label: 'Preview PDF' },
    { key: 'download', label: 'Download PDF' },
    { type: 'divider' },
    { key: 'duplicate', label: 'Duplicate as draft' },
  ];

  if (invoice.status === 'draft') {
    entries.push(
      { key: 'edit', label: 'Edit' },
      { key: 'mark-sent', label: 'Mark as sent' },
      { type: 'divider' },
      { key: 'delete', label: 'Delete draft', danger: true }
    );
  } else if (invoice.balanceDueMinor > 0 && invoice.status !== 'cancelled') {
    entries.push({ key: 'payment', label: 'Record payment' });
  }

  if (invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'paid') {
    entries.push({ key: 'cancel', label: 'Cancel invoice', danger: true });
  }

  return entries;
};

const dispatchMenuAction = (
  selectedKey: string,
  invoice: Invoice,
  actions: InvoiceTableActionSet
): void => {
  switch (selectedKey) {
    case 'open':
      actions.onOpen(invoice);
      break;
    case 'edit':
      actions.onEdit(invoice);
      break;
    case 'preview':
      actions.onPreviewPdf(invoice);
      break;
    case 'download':
      actions.onDownloadPdf(invoice);
      break;
    case 'payment':
      actions.onRecordPayment(invoice);
      break;
    case 'mark-sent':
      actions.onMarkSent(invoice);
      break;
    case 'cancel':
      actions.onCancel(invoice);
      break;
    case 'delete':
      actions.onDelete(invoice);
      break;
    case 'duplicate':
      actions.onDuplicate(invoice);
      break;
  }
};

/**
 * Dense desktop ledger view. Amount columns are right-aligned and tabular so the
 * minor-unit digits line up, and each row is clickable as well as offering an
 * overflow menu for pointer users.
 */
export const InvoiceTable: React.FC<InvoiceTableProps> = ({ invoices, actions }) => {
  const columns = useMemo<TableColumnsType<Invoice>>(
    () => [
      {
        title: 'Invoice',
        dataIndex: 'invoiceNumber',
        key: 'invoiceNumber',
        sorter: (earlier, later) => earlier.invoiceNumber.localeCompare(later.invoiceNumber),
        defaultSortOrder: 'descend',
        width: 140,
        render: (invoiceNumber: string) => (
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{invoiceNumber}</span>
        ),
      },
      {
        title: 'Client',
        key: 'client',
        sorter: (earlier, later) =>
          earlier.clientSnapshot.companyName.localeCompare(later.clientSnapshot.companyName),
        render: (_columnValue, invoice) => (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 240,
              }}
            >
              {invoice.clientSnapshot.companyName}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{invoice.clientSnapshot.name}</div>
          </div>
        ),
      },
      {
        title: 'Issued',
        dataIndex: 'issueDate',
        key: 'issueDate',
        sorter: (earlier, later) => earlier.issueDate.localeCompare(later.issueDate),
        width: 116,
        render: (issueDate: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(issueDate)}</span>,
      },
      {
        title: 'Due',
        dataIndex: 'dueDate',
        key: 'dueDate',
        sorter: (earlier, later) => earlier.dueDate.localeCompare(later.dueDate),
        width: 132,
        render: (dueDate: string, invoice) => {
          const daysLate = daysPastDue(dueDate);
          const isLate = invoice.balanceDueMinor > 0 && daysLate > 0 && invoice.status !== 'cancelled';
          return (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(dueDate)}</div>
              {isLate ? (
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-status-overdue)' }}>
                  {daysLate} day{daysLate === 1 ? '' : 's'} late
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: (status: Invoice['status']) => <StatusBadge status={status} size="compact" />,
      },
      {
        title: 'Total',
        dataIndex: 'totalAmountMinor',
        key: 'totalAmountMinor',
        align: 'right',
        width: 130,
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
        width: 130,
        sorter: (earlier, later) => earlier.balanceDueMinor - later.balanceDueMinor,
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
        key: 'actions',
        width: 56,
        align: 'right',
        render: (_columnValue, invoice) => (
          <Dropdown
            trigger={['click']}
            menu={{
              items: menuEntriesFor(invoice),
              onClick: ({ key }) => dispatchMenuAction(String(key), invoice, actions),
            }}
          >
            <Button
              type="text"
              aria-label={`Actions for invoice ${invoice.invoiceNumber}`}
              icon={<MoreOutlined aria-hidden="true" />}
              style={{ minWidth: 'var(--touch-target-min, 44px)', minHeight: 'var(--touch-target-min, 44px)' }}
            />
          </Dropdown>
        ),
      },
    ],
    [actions]
  );

  return (
    <div style={{ minWidth: 0 }}>
      <Table<Invoice>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={invoices}
        scroll={{ x: 'max-content' }}
        pagination={{
          pageSize: 12,
          showSizeChanger: false,
          hideOnSinglePage: true,
          style: { paddingInline: 8 },
        }}
        onRow={(invoice) => ({
          onClick: () => actions.onOpen(invoice),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
};
