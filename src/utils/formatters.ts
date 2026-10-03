import type { CurrencyCode } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { fromMinorUnits } from '@/utils/calculations';

/**
 * Minor units are the single source of truth for money; conversion to major
 * units happens exactly here so the printed symbol always agrees with the
 * currency's own minor-unit precision (JPY carries no fractional part).
 */
export const formatCurrency = (amountMinor: number, currency: CurrencyCode): string => {
  const decimals = CURRENCY_DECIMALS[currency];
  const majorAmount = fromMinorUnits(amountMinor, currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(majorAmount);
};

export const formatMajorAmount = (amount: number, currency: CurrencyCode): string => {
  const decimals = CURRENCY_DECIMALS[currency];
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

/** Parses operator input that may carry grouping separators or a currency symbol. */
export const parseMajorAmountInput = (input: string): number => {
  const sanitized = input.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatDate = (isoString: string): string => {
  if (!isoString) return '';
  const datePart = isoString.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return isoString;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(calendarDate);
};

/** Ledger timestamps are stored as UTC instants; audit trails render them locally. */
export const formatTimestamp = (isoInstant: string): string => {
  if (!isoInstant) return '';
  const instant = new Date(isoInstant);
  if (Number.isNaN(instant.getTime())) return isoInstant;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
};

export const formatInvoiceSequence = (prefix: string, sequence: number): string => {
  return `${prefix}-${String(sequence).padStart(5, '0')}`;
};

export const formatQuantity = (quantity: number): string => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(quantity);
};

export const formatPercent = (ratePercent: number): string => {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(ratePercent)}%`;
};
