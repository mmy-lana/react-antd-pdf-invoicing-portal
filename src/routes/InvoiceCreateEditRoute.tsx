import React from 'react';
import { App, Button, Result, Skeleton } from 'antd';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useInvoiceDetail } from '@/hooks/useInvoiceDetail';
import { useClients } from '@/hooks/useClients';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { InvoiceForm } from '@/components/features/invoice/InvoiceForm';
import { EmptyStateDisplay } from '@/components/primitives/EmptyStateDisplay';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 0,
  overflowX: 'clip',
};

/**
 * Create and edit screen for one invoice. The same form serves both: when an
 * invoice id is present the record is loaded and the expected version is passed
 * to the service so a concurrent save cannot be silently overwritten.
 */
export default function InvoiceCreateEditRoute(): React.ReactElement {
  // The route is declared as invoices/:id/edit, so the param name is `id`.
  const { id: invoiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const isEditing = Boolean(invoiceId);
  const { invoice, isLoading } = useInvoiceDetail(invoiceId);
  const { clients } = useClients();
  const { settings } = useOrganizationSettings();

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (isEditing && !invoice) {
    return (
      <div style={pageStyle}>
        <Result
          status="404"
          title="Invoice not found"
          subTitle="This invoice no longer exists, so there is nothing to edit."
          extra={
            <Button type="primary" onClick={() => navigate('/invoices')}>
              Back to the ledger
            </Button>
          }
        />
      </div>
    );
  }

  if (invoice && (invoice.status === 'paid' || invoice.status === 'cancelled')) {
    return (
      <div style={pageStyle}>
        <Result
          status="info"
          title={`${invoice.invoiceNumber} cannot be edited`}
          subTitle={
            invoice.status === 'paid'
              ? 'This invoice is settled. Void its payments first if the figures genuinely need to change.'
              : 'This invoice was cancelled. Duplicate it as a draft to raise a replacement.'
          }
          extra={
            <Button type="primary" onClick={() => navigate(`/invoices/${invoice.id}`)}>
              Open invoice
            </Button>
          }
        />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div style={pageStyle}>
        <Button
          icon={<ArrowLeftOutlined aria-hidden="true" />}
          onClick={() => navigate('/clients')}
          style={{ minHeight: 'var(--touch-target-min, 44px)', alignSelf: 'flex-start' }}
        >
          Back to clients
        </Button>
        <EmptyStateDisplay
          variant="no-clients"
          title="Add a client before raising an invoice"
          description="An invoice needs a billing party. Register the client first and their currency and payment terms will be applied automatically."
          primaryAction={{ label: 'Open client directory', onClick: () => navigate('/clients') }}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Button
        icon={<ArrowLeftOutlined aria-hidden="true" />}
        onClick={() => navigate(invoice ? `/invoices/${invoice.id}` : '/invoices')}
        style={{ minHeight: 'var(--touch-target-min, 44px)', alignSelf: 'flex-start' }}
      >
        {invoice ? `Back to ${invoice.invoiceNumber}` : 'Back to the ledger'}
      </Button>

      <InvoiceForm
        invoice={invoice}
        clients={clients}
        defaultCurrency={settings?.defaultCurrency ?? 'USD'}
        defaultTaxRate={settings?.defaultTaxRate ?? 0}
        onCompleted={(savedInvoiceId) => {
          if (invoice) {
            message.info('Review the updated figures before returning to the ledger.');
          }
          navigate(`/invoices/${savedInvoiceId}`);
        }}
        onCancelled={() => navigate(invoice ? `/invoices/${invoice.id}` : '/invoices')}
      />
    </div>
  );
}
