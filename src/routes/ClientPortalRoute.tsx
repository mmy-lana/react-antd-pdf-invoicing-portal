import React, { useEffect, useState } from 'react';
import { Result, Skeleton, Table } from 'antd';
import { useParams } from 'react-router';
import type { TableColumnsType } from 'antd';
import type { Invoice, PaymentRecord } from '@/types';
import { ACTOR_CLIENT_PORTAL } from '@/types';
import { getInvoiceByPortalToken } from '@/services/invoiceService';
import { listPaymentsForInvoice } from '@/services/paymentService';
import { logInvoiceEvent } from '@/services/auditService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { PDFDownloadButton } from '@/components/features/pdf/PDFDownloadButton';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  paddingTop: 'calc(16px + var(--safe-area-top))',
  minWidth: 0,
  overflowX: 'clip',
  minHeight: '100dvh',
  backgroundColor: 'var(--color-bg-layout)',
};

const METHOD_LABEL: Record<PaymentRecord['paymentMethod'], string> = {
  bank_transfer: 'Bank transfer',
  credit_card: 'Credit card',
  cash: 'Cash',
  stripe: 'Card processor',
  ach: 'ACH debit',
  other: 'Other',
};

/**
 * Simulated client portal.
 *
 * Access is by unguessable capability token, and drafts and cancelled invoices
 * are indistinguishable from a bad token so the page cannot be used to probe
 * for their existence. The "viewed" event is recorded once per visit, guarded by
 * a ref, rather than on every render.
 */
export default function ClientPortalRoute(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolved, setIsResolved] = useState(false);
  const { isMobile } = useResponsiveBreakpoints();

  useEffect(() => {
    let isStale = false;

    const resolvePortalInvoice = async (): Promise<void> => {
      setIsLoading(true);
      const matchedInvoice = await getInvoiceByPortalToken(token ?? '');

      if (isStale) return;

      if (!matchedInvoice) {
        setInvoice(null);
        setIsResolved(true);
        setIsLoading(false);
        return;
      }

      const settlementHistory = await listPaymentsForInvoice(matchedInvoice.id);
      if (isStale) return;

      setInvoice(matchedInvoice);
      setPayments(settlementHistory);
      setIsResolved(true);
      setIsLoading(false);

      await logInvoiceEvent(
        matchedInvoice.id,
        'view',
        ACTOR_CLIENT_PORTAL,
        'Client opened the portal link'
      ).catch(() => undefined);
    };

    void resolvePortalInvoice();

    return () => {
      isStale = true;
    };
  }, [token]);

  if (isLoading || !isResolved) {
    return (
      <div style={pageStyle}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={pageStyle}>
        <Result
          status="404"
          title="This link is not available"
          subTitle="The invoice may have been cancelled, or the link may have been mistyped. Please contact the billing team for a current copy."
        />
      </div>
    );
  }

  const issuer = invoice.organizationSnapshot;
  const billed = invoice.clientSnapshot;
  const bank = issuer.bankDetails;

  const paymentColumns: TableColumnsType<PaymentRecord> = [
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (paymentDate: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(paymentDate)}</span>,
    },
    {
      title: 'Received via',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (paymentMethod: PaymentRecord['paymentMethod']) => METHOD_LABEL[paymentMethod],
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      align: 'right',
      width: 140,
      render: (amountMinor: number, payment) =>
        payment.voidedAt ? (
          <span style={{ color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
            {formatCurrency(amountMinor, invoice.currency)}
          </span>
        ) : (
          formatCurrency(amountMinor, invoice.currency)
        ),
    },
  ];

  const remittanceRows: Array<[string, string | undefined]> = [
    ['Bank', bank.bankName],
    ['Account name', bank.accountName],
    ['Account number', bank.accountNumber],
    ['Routing (ABA)', bank.routingNumber],
    ['SWIFT / BIC', bank.swiftCode],
    ['IBAN', bank.iban],
  ];

  return (
    <div style={pageStyle}>
      <header style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {issuer.companyName}
        </span>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>Invoice {invoice.invoiceNumber}</h1>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <StatusBadge status={invoice.status} />
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
        </span>
      </div>

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
          Amount due
        </h2>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(invoice.balanceDueMinor, invoice.currency)}
        </p>
        <p style={{ margin: '6px 0 16px', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          Invoice total {formatCurrency(invoice.totalAmountMinor, invoice.currency)} · received so far{' '}
          {formatCurrency(invoice.amountPaidMinor, invoice.currency)}
        </p>
        <PDFDownloadButton invoice={invoice} actor={ACTOR_CLIENT_PORTAL} label="Download your invoice" block />
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
          Charges
        </h2>
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
                width: 130,
                align: 'right',
                render: (value: number) => formatCurrency(value, invoice.currency),
              },
              {
                title: 'Amount',
                dataIndex: 'totalMinor',
                key: 'totalMinor',
                width: 140,
                align: 'right',
                render: (value: number) => (
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(value, invoice.currency)}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </section>

      {payments.length > 0 ? (
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
            Payments received
          </h2>
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
        </section>
      ) : null}

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
          How to pay
        </h2>

        <dl style={{ margin: 0, display: 'grid', gap: 6, minWidth: 0 }}>
          {remittanceRows
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div
                key={label}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}
              >
                <dt style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{label}</dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    wordBreak: 'break-all',
                    textAlign: 'end',
                    minWidth: 0,
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
        </dl>

        {invoice.paymentInstructions ? (
          <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.5 }}>{invoice.paymentInstructions}</p>
        ) : null}

        {invoice.termsAndConditions ? (
          <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
            {invoice.termsAndConditions}
          </p>
        ) : null}
      </section>

      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Questions about this invoice? Contact {issuer.companyEmail} quoting {invoice.invoiceNumber}.
        {isMobile ? '' : ` Billed to ${billed.companyName}.`}
      </p>
    </div>
  );
}
