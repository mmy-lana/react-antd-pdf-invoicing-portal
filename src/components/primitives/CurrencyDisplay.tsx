import React from 'react';
import type { CurrencyCode } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { fromMinorUnits } from '@/utils/calculations';

export type CurrencyTone = 'strong' | 'default' | 'muted' | 'positive' | 'critical';

export interface CurrencyDisplayProps {
  amountMinor: number;
  currency: CurrencyCode;
  tone?: CurrencyTone;
  size?: 'inherit' | 'large';
  /** Appends the ISO code, useful where several currencies share one column. */
  showCode?: boolean;
  className?: string;
}

const TONE_COLOR: Record<CurrencyTone, string> = {
  strong: 'var(--color-text-main)',
  default: 'var(--color-text-secondary)',
  muted: 'var(--color-text-muted)',
  positive: 'var(--color-status-paid)',
  critical: 'var(--color-status-overdue)',
};

/**
 * Renders from minor units and splits the figure into whole and fractional runs
 * so decimal points line up column-to-column in dense tables. The separator
 * and fraction are omitted entirely for zero-decimal currencies.
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amountMinor,
  currency,
  tone = 'default',
  size = 'inherit',
  showCode = false,
  className,
}) => {
  const minorUnitDigits = CURRENCY_DECIMALS[currency];
  const currencySymbol =
    new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? '';

  const absoluteMajorAmount = Math.abs(fromMinorUnits(amountMinor, currency));
  const wholeUnits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.trunc(absoluteMajorAmount)
  );
  const fractionUnits =
    minorUnitDigits > 0
      ? Math.round(absoluteMajorAmount * Math.pow(10, minorUnitDigits)).toString().padStart(minorUnitDigits, '0')
      : '';
  const sign = amountMinor < 0 ? '-' : '';

  /*
   * The visible run is split so decimal points align in a column, but a screen
   * reader is better served by the locale's own formatted string. The ISO code
   * is always included in the spoken form: this ledger shows several currencies
   * side by side, and "$12,000" is ambiguous out of context.
   */
  const spokenAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnitDigits,
    maximumFractionDigits: minorUnitDigits,
  }).format(fromMinorUnits(amountMinor, currency));

  return (
    <span
      className={className}
      style={{
        color: TONE_COLOR[tone],
        fontSize: size === 'large' ? 22 : 'inherit',
        fontWeight: tone === 'strong' ? 700 : tone === 'muted' ? 400 : 600,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">
        {sign}
        {currencySymbol}
        {wholeUnits}
        {fractionUnits ? `.${fractionUnits}` : ''}
      </span>
      {showCode ? (
        <span style={{ fontSize: '0.78em', fontWeight: 500, opacity: 0.7, marginLeft: 4 }}>{currency}</span>
      ) : null}
      <span className="visually-hidden">
        {spokenAmount} {currency}
      </span>
    </span>
  );
};
