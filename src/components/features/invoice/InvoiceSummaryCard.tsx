import React from 'react';
import type { CurrencyCode } from '@/types';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';

/**
 * The settled figures a summary needs. `Invoice` satisfies this structurally, so
 * a stored invoice can be passed straight in while the editor can hand over live
 * totals without fabricating an invoice that was never issued.
 */
export interface InvoiceTotalsSnapshot {
  currency: CurrencyCode;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalAmountMinor: number;
  amountPaidMinor: number;
  balanceDueMinor: number;
}

export interface InvoiceSummaryCardProps {
  totals: InvoiceTotalsSnapshot;
  /** `sticky` pins the card while the line-item list scrolls behind it on mobile. */
  variant?: 'panel' | 'sticky';
  title?: string;
}

interface SummaryRow {
  caption: string;
  amountMinor: number;
  emphasis?: 'strong' | 'default' | 'muted' | 'positive' | 'critical';
  emphasisHint?: string;
}

/**
 * Settlement roll-up. Amounts arrive already reconciled from the service, so
 * the figures an operator checks are exactly the figures that were stored.
 */
export const InvoiceSummaryCard: React.FC<InvoiceSummaryCardProps> = ({
  totals,
  variant = 'panel',
  title = 'Invoice summary',
}) => {
  const rows: SummaryRow[] = [{ caption: 'Subtotal', amountMinor: totals.subtotalMinor }];

  if (totals.discountTotalMinor > 0) {
    rows.push({ caption: 'Discount', amountMinor: -totals.discountTotalMinor, emphasis: 'positive' });
  }

  rows.push({
    caption: 'Tax',
    amountMinor: totals.taxTotalMinor,
    emphasisHint: totals.taxTotalMinor > 0 ? 'Charged per line item' : undefined,
  });

  const settlementRows: SummaryRow[] = [
    { caption: 'Total invoiced', amountMinor: totals.totalAmountMinor, emphasis: 'strong' },
    { caption: 'Amount paid', amountMinor: totals.amountPaidMinor, emphasis: 'positive' },
    {
      caption: 'Balance due',
      amountMinor: totals.balanceDueMinor,
      emphasis: totals.balanceDueMinor > 0 ? 'critical' : 'positive',
      emphasisHint:
        totals.balanceDueMinor > 0 ? 'Outstanding until a payment is recorded' : 'Nothing further to collect',
    },
  ];

  const renderRow = (row: SummaryRow, isEmphasised: boolean) => (
    <div
      key={row.caption}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: isEmphasised ? 8 : 0,
        paddingBottom: isEmphasised ? 8 : 0,
        marginTop: isEmphasised ? 6 : 0,
        borderTop: isEmphasised ? '1.5px solid var(--color-text-main)' : 'none',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: isEmphasised ? 13 : 12.5,
          fontWeight: isEmphasised ? 700 : 500,
          color: 'var(--color-text-secondary)',
          minWidth: 0,
        }}
      >
        {row.caption}
      </span>
      <CurrencyDisplay
        amountMinor={row.amountMinor}
        currency={totals.currency}
        tone={row.emphasis ?? 'default'}
        size={isEmphasised ? 'large' : 'inherit'}
      />
    </div>
  );

  return (
    <section
      aria-label={title}
      style={{
        padding: 16,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
        ...(variant === 'sticky'
          ? {
              position: 'sticky' as const,
              bottom: 'calc(var(--safe-area-bottom) + 8px)',
              zIndex: 5,
            }
          : {}),
      }}
    >
      <h2
        style={{
          margin: '0 0 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {title}
      </h2>

      {rows.map((row) => renderRow(row, false))}
      {settlementRows.map((row) => renderRow(row, true))}

      {totals.currency !== 'USD' ? (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          All figures are stated in {totals.currency}. No conversion is applied.
        </p>
      ) : null}
    </section>
  );
};

/** Share of the invoice already settled, for balance-ageing annotations. */
export const settledSharePercent = (totals: Pick<InvoiceTotalsSnapshot, 'amountPaidMinor' | 'totalAmountMinor'>): number => {
  if (totals.totalAmountMinor <= 0) return 0;
  return Math.round((totals.amountPaidMinor / totals.totalAmountMinor) * 100);
};
