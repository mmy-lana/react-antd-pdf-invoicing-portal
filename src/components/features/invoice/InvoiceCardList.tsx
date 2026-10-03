import React from 'react';
import { Button, Dropdown } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Invoice } from '@/types';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { formatDate } from '@/utils/formatters';
import type { InvoiceTableActionSet } from '@/components/features/invoice/InvoiceTable';

export interface InvoiceCardListProps {
  invoices: Invoice[];
  actions: InvoiceTableActionSet;
}

const menuEntriesFor = (invoice: Invoice): MenuProps['items'] => {
  const entries: MenuProps['items'] = [
    { key: 'open', label: 'Open invoice' },
    { key: 'download', label: 'Download PDF' },
    { key: 'duplicate', label: 'Duplicate as draft' },
  ];

  if (invoice.status === 'draft') {
    entries.push({ key: 'edit', label: 'Edit' }, { key: 'mark-sent', label: 'Mark as sent' }, {
      key: 'delete',
      label: 'Delete draft',
      danger: true,
    });
  } else if (invoice.balanceDueMinor > 0 && invoice.status !== 'cancelled') {
    entries.push({ key: 'payment', label: 'Record payment' });
  }

  if (invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'paid') {
    entries.push({ key: 'cancel', label: 'Cancel invoice', danger: true });
  }

  return entries;
};

/**
 * Phone rendering of the ledger. The Ant Design table is never mounted at this
 * width; each invoice becomes a card whose whole surface opens the record and
 * whose overflow button carries the same actions as the desktop row menu.
 */
export const InvoiceCardList: React.FC<InvoiceCardListProps> = ({ invoices, actions }) => {
  const dispatchMenuAction = (selectedKey: string, invoice: Invoice): void => {
    switch (selectedKey) {
      case 'open':
        actions.onOpen(invoice);
        break;
      case 'edit':
        actions.onEdit(invoice);
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

  return (
    <ul
      style={{
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        margin: 0,
        padding: 0,
        minWidth: 0,
      }}
    >
      {invoices.map((invoice) => (
        <li
          key={invoice.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md, 4px)',
            boxShadow: 'var(--shadow-card)',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => actions.onOpen(invoice)}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
                padding: 0,
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                textAlign: 'start',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 14,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {invoice.invoiceNumber}
              </span>
              <StatusBadge status={invoice.status} size="compact" variant="wash" />
            </button>
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {invoice.clientSnapshot.companyName}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--color-border)',
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Paid <CurrencyDisplay amountMinor={invoice.amountPaidMinor} currency={invoice.currency} tone="muted" />
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Balance</div>
              <CurrencyDisplay
                amountMinor={invoice.balanceDueMinor}
                currency={invoice.currency}
                tone={invoice.balanceDueMinor > 0 ? 'strong' : 'positive'}
              />
            </div>

            <Dropdown
              trigger={['click']}
              menu={{
                items: menuEntriesFor(invoice),
                onClick: ({ key }) => dispatchMenuAction(String(key), invoice),
              }}
            >
              <Button
                aria-label={`Actions for invoice ${invoice.invoiceNumber}`}
                icon={<MoreOutlined aria-hidden="true" />}
                style={{
                  minWidth: 'var(--touch-target-min, 44px)',
                  minHeight: 'var(--touch-target-min, 44px)',
                  flex: '0 0 auto',
                }}
              />
            </Dropdown>
          </div>
        </li>
      ))}
    </ul>
  );
};
