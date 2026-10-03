import React, { useMemo, useState } from 'react';
import { App, Button, Segmented, Skeleton } from 'antd';
import { useNavigate } from 'react-router';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { Client } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { archiveClient, unarchiveClient } from '@/services/clientService';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';
import { EmptyStateDisplay } from '@/components/primitives/EmptyStateDisplay';
import { ClientTable, buildClientRollups } from '@/components/features/client/ClientTable';
import { ClientCardList } from '@/components/features/client/ClientCardList';
import { ClientDrawerForm } from '@/components/features/client/ClientDrawerForm';
import { ClientStatement } from '@/components/features/client/ClientStatement';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 0,
  overflowX: 'clip',
};

/** Client directory with per-client invoice rollups and an account statement. */
export default function ClientsRoute(): React.ReactElement {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { isMobile } = useResponsiveBreakpoints();

  const [directoryScope, setDirectoryScope] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [statementClient, setStatementClient] = useState<Client | null>(null);

  const { clients, isLoading } = useClients({ includeArchived: true });
  const { invoices } = useInvoices();

  const rollups = useMemo(() => buildClientRollups(invoices), [invoices]);

  const visibleClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      if (directoryScope === 'archived' ? !client.archivedAt : Boolean(client.archivedAt)) return false;
      if (!term) return true;
      return (
        client.companyName.toLowerCase().includes(term) ||
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term)
      );
    });
  }, [clients, directoryScope, searchTerm]);

  const confirmArchive = (client: Client): void => {
    modal.confirm({
      title: `Archive ${client.companyName}?`,
      content:
        'Archiving is only permitted once every invoice for this client is settled or cancelled. The record stays on file and can be restored.',
      okText: 'Archive client',
      okButtonProps: { danger: true },
      cancelText: 'Keep active',
      onOk: async () => {
        try {
          await archiveClient(client.id, ACTOR_LOCAL_ADMIN);
          message.success(`${client.companyName} archived.`);
        } catch (archiveError) {
          message.error(
            archiveError instanceof Error ? archiveError.message : 'The client could not be archived.'
          );
          throw archiveError;
        }
      },
    });
  };

  const restoreClient = async (client: Client): Promise<void> => {
    try {
      await unarchiveClient(client.id, ACTOR_LOCAL_ADMIN);
      message.success(`${client.companyName} restored to the directory.`);
    } catch (restoreError) {
      message.error(restoreError instanceof Error ? restoreError.message : 'The client could not be restored.');
    }
  };

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <Segmented
          value={directoryScope}
          onChange={(chosenScope) => setDirectoryScope(chosenScope as 'active' | 'archived')}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
          ]}
          style={{ minHeight: isMobile ? 'var(--touch-target-min, 44px)' : 32 }}
        />

        <input
          type="search"
          value={searchTerm}
          onChange={(changeEvent) => setSearchTerm(changeEvent.target.value)}
          placeholder="Search company, contact or email"
          aria-label="Search clients"
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            minHeight: isMobile ? 'var(--touch-target-min, 44px)' : 32,
            padding: '0 12px',
            font: 'inherit',
            fontSize: isMobile ? 16 : 'inherit',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md, 4px)',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-main)',
          }}
        />

        <Button
          type="primary"
          icon={<PlusOutlined aria-hidden="true" />}
          onClick={() => {
            setEditingClient(undefined);
            setIsDrawerOpen(true);
          }}
          style={{ minHeight: isMobile ? 'var(--touch-target-min, 44px)' : 32 }}
        >
          Register client
        </Button>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : visibleClients.length === 0 ? (
        <EmptyStateDisplay
          variant={clients.length === 0 ? 'no-clients' : 'no-matches'}
          title={
            clients.length === 0
              ? 'No clients on file yet'
              : directoryScope === 'archived'
                ? 'No archived clients'
                : 'No clients match this search'
          }
          description={
            clients.length === 0
              ? 'Register the first billing party to start issuing invoices against them.'
              : directoryScope === 'archived'
                ? 'Archived clients appear here once they have been retired from the active directory.'
                : 'Try a different company name, contact or email address.'
          }
          primaryAction={
            clients.length === 0
              ? { label: 'Register client', icon: <PlusOutlined aria-hidden="true" />, onClick: () => setIsDrawerOpen(true) }
              : searchTerm
                ? { label: 'Clear search', icon: <SearchOutlined aria-hidden="true" />, onClick: () => setSearchTerm('') }
                : undefined
          }
        />
      ) : isMobile ? (
        <ClientCardList
          clients={visibleClients}
          rollups={rollups}
          onOpenStatement={setStatementClient}
          onEdit={(client) => {
            setEditingClient(client);
            setIsDrawerOpen(true);
          }}
          onArchive={confirmArchive}
          onRestore={(client) => void restoreClient(client)}
        />
      ) : (
        <ClientTable
          clients={visibleClients}
          rollups={rollups}
          onOpenStatement={setStatementClient}
          onEdit={(client) => {
            setEditingClient(client);
            setIsDrawerOpen(true);
          }}
          onArchive={confirmArchive}
          onRestore={(client) => void restoreClient(client)}
        />
      )}

      <ClientDrawerForm
        open={isDrawerOpen}
        client={editingClient}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingClient(undefined);
        }}
        onSaved={(savedClient) => {
          setEditingClient(undefined);
          setIsDrawerOpen(false);
          void savedClient;
        }}
      />

      <ClientStatement
        open={statementClient !== null}
        client={statementClient}
        invoices={invoices}
        onClose={() => setStatementClient(null)}
        onOpenInvoice={(invoice) => {
          setStatementClient(null);
          navigate(`/invoices/${invoice.id}`);
        }}
        onCreateInvoice={(client) => {
          setStatementClient(null);
          navigate('/invoices/new');
          void client;
        }}
      />
    </div>
  );
}
