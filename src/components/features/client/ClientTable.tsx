import React, { useMemo } from 'react';
import { Button, Dropdown, Table, Tag } from 'antd';
import { EditOutlined, FileTextOutlined, UndoOutlined } from '@ant-design/icons';
import type { MenuProps, TableColumnsType } from 'antd';
import type { Client, CurrencyCode, CurrencyTotals, Invoice } from '@/types';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { toCurrencyFigureList } from '@/utils/calculations';

export interface ClientInvoiceRollup {
  /** Outstanding and settled amounts kept per currency, never merged. */
  outstandingByCurrency: CurrencyTotals;
  settledByCurrency: CurrencyTotals;
  invoiceCount: number;
}

export interface ClientTableProps {
  clients: Client[];
  rollups: Map<string, ClientInvoiceRollup>;
  onOpenStatement: (client: Client) => void;
  onEdit: (client: Client) => void;
  onArchive: (client: Client) => void;
  onRestore: (client: Client) => void;
}

const emptyRollup: ClientInvoiceRollup = {
  outstandingByCurrency: {},
  settledByCurrency: {},
  invoiceCount: 0,
};

const addToTotals = (base: CurrencyTotals, currency: CurrencyCode, amountMinor: number): CurrencyTotals => ({
  ...base,
  [currency]: (base[currency] ?? 0) + amountMinor,
});

/**
 * Rolls a client's live invoices into per-currency totals. Drafts and cancelled
 * invoices are excluded: neither is collectable, so neither belongs on a
 * statement an operator might read as a debt.
 */
export const buildClientRollups = (invoices: Invoice[]): Map<string, ClientInvoiceRollup> => {
  const rollups = new Map<string, ClientInvoiceRollup>();

  for (const invoice of invoices) {
    if (invoice.status === 'draft' || invoice.status === 'cancelled') continue;

    const existing = rollups.get(invoice.clientId);
    rollups.set(invoice.clientId, {
      invoiceCount: (existing?.invoiceCount ?? 0) + 1,
      outstandingByCurrency: addToTotals(
        existing?.outstandingByCurrency ?? {},
        invoice.currency,
        invoice.balanceDueMinor
      ),
      settledByCurrency: addToTotals(existing?.settledByCurrency ?? {}, invoice.currency, invoice.amountPaidMinor),
    });
  }

  return rollups;
};

/** Desktop directory. Outstanding balances render as one figure per currency. */
export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  rollups,
  onOpenStatement,
  onEdit,
  onArchive,
  onRestore,
}) => {
  const menuEntriesFor = (client: Client): MenuProps['items'] =>
    client.archivedAt
      ? [{ key: 'restore', label: 'Restore to directory' }, { key: 'edit', label: 'Edit details' }]
      : [
          { key: 'statement', label: 'Open statement' },
          { key: 'edit', label: 'Edit details' },
          { type: 'divider' },
          { key: 'archive', label: 'Archive client', danger: true },
        ];

  const dispatchMenuAction = (selectedKey: string, client: Client): void => {
    switch (selectedKey) {
      case 'statement':
        onOpenStatement(client);
        break;
      case 'edit':
        onEdit(client);
        break;
      case 'archive':
        onArchive(client);
        break;
      case 'restore':
        onRestore(client);
        break;
    }
  };

  const columns = useMemo<TableColumnsType<Client>>(
    () => [
      {
        title: 'Company',
        key: 'companyName',
        sorter: (earlier, later) => earlier.companyName.localeCompare(later.companyName),
        defaultSortOrder: 'ascend',
        render: (_columnValue, client) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{client.companyName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{client.name}</div>
          </div>
        ),
      },
      {
        title: 'Contact',
        key: 'contact',
        render: (_columnValue, client) => (
          <div style={{ minWidth: 0, fontSize: 12.5 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              {client.email}
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>{client.phone || '—'}</div>
          </div>
        ),
      },
      {
        title: 'Terms',
        key: 'terms',
        width: 140,
        render: (_columnValue, client) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {client.currency} · Net {client.paymentTermsDays}
          </span>
        ),
      },
      {
        title: 'Invoices',
        key: 'invoiceCount',
        width: 96,
        align: 'right',
        render: (_columnValue, client) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {rollups.get(client.id)?.invoiceCount ?? 0}
          </span>
        ),
      },
      {
        title: 'Outstanding',
        key: 'outstanding',
        align: 'right',
        width: 200,
        render: (_columnValue, client) => {
          const figures = toCurrencyFigureList(rollups.get(client.id)?.outstandingByCurrency ?? {});
          if (figures.length === 0) {
            return <span style={{ color: 'var(--color-status-paid)' }}>Settled</span>;
          }
          return (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              {figures.map((figure) => (
                <CurrencyDisplay
                  key={figure.currency}
                  amountMinor={figure.amountMinor}
                  currency={figure.currency}
                  tone="strong"
                />
              ))}
            </span>
          );
        },
      },
      {
        title: 'State',
        key: 'archived',
        width: 110,
        render: (_columnValue, client) =>
          client.archivedAt ? (
            <Tag style={{ marginInlineEnd: 0 }}>Archived</Tag>
          ) : (
            <Tag color="processing" style={{ marginInlineEnd: 0 }}>
              Active
            </Tag>
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 190,
        render: (_columnValue, client) => (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button
              icon={<FileTextOutlined aria-hidden="true" />}
              onClick={() => onOpenStatement(client)}
              style={{ minHeight: 'var(--touch-target-min, 44px)' }}
            >
              Statement
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: menuEntriesFor(client),
                onClick: ({ key }) => dispatchMenuAction(String(key), client),
              }}
            >
              <Button
                icon={client.archivedAt ? <UndoOutlined aria-hidden="true" /> : <EditOutlined aria-hidden="true" />}
                aria-label={`Actions for ${client.companyName}`}
                style={{ minHeight: 'var(--touch-target-min, 44px)', minWidth: 'var(--touch-target-min, 44px)' }}
              />
            </Dropdown>
          </div>
        ),
      },
    ],
    [rollups, onOpenStatement, onEdit, onArchive, onRestore]
  );

  return (
    <div style={{ minWidth: 0 }}>
      <Table<Client>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={clients}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true, style: { paddingInline: 8 } }}
      />
    </div>
  );
};

export const rollupFor = (rollups: Map<string, ClientInvoiceRollup>, clientId: string): ClientInvoiceRollup =>
  rollups.get(clientId) ?? emptyRollup;
