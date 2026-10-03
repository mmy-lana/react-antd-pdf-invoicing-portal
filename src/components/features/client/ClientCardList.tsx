import React from 'react';
import { Button, Dropdown } from 'antd';
import { EditOutlined, FileTextOutlined, UndoOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Client } from '@/types';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { toCurrencyFigureList } from '@/utils/calculations';
import type { ClientInvoiceRollup } from '@/components/features/client/ClientTable';

export interface ClientCardListProps {
  clients: Client[];
  rollups: Map<string, ClientInvoiceRollup>;
  onOpenStatement: (client: Client) => void;
  onEdit: (client: Client) => void;
  onArchive: (client: Client) => void;
  onRestore: (client: Client) => void;
}

/** Phone rendering of the client directory, mirroring the desktop table's actions. */
export const ClientCardList: React.FC<ClientCardListProps> = ({
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
      {clients.map((client) => {
        const outstandingFigures = toCurrencyFigureList(rollups.get(client.id)?.outstandingByCurrency ?? {});
        const invoiceCount = rollups.get(client.id)?.invoiceCount ?? 0;

        return (
          <li
            key={client.id}
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
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {client.companyName}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {client.name} · {client.email}
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
              {client.currency} · Net {client.paymentTermsDays} · {invoiceCount} invoice
              {invoiceCount === 1 ? '' : 's'}
              {client.archivedAt ? ' · archived' : ''}
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
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Outstanding</div>
                {outstandingFigures.length === 0 ? (
                  <span style={{ color: 'var(--color-status-paid)', fontWeight: 600 }}>Settled</span>
                ) : (
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    {outstandingFigures.map((figure) => (
                      <CurrencyDisplay
                        key={figure.currency}
                        amountMinor={figure.amountMinor}
                        currency={figure.currency}
                        tone="strong"
                      />
                    ))}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                <Button
                  icon={<FileTextOutlined aria-hidden="true" />}
                  onClick={() => onOpenStatement(client)}
                  aria-label={`Statement for ${client.companyName}`}
                  style={{ minHeight: 'var(--touch-target-min, 44px)', minWidth: 'var(--touch-target-min, 44px)' }}
                />
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
            </div>
          </li>
        );
      })}
    </ul>
  );
};
