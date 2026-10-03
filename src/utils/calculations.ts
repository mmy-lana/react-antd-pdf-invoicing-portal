import type {
  CalculationBreakdownMinor,
  CurrencyCode,
  CurrencyTotals,
  InvoiceItem,
  InvoiceStatus,
  ItemTotalsMinor,
} from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { isStrictIsoDay, isoDayToEpochDay } from '@/utils/validators';

/**
 * Calendar day in the operator's own timezone. Due-date comparisons are plain
 * string comparisons on this format, so a UTC offset can never push an invoice
 * across the midnight boundary and mark it overdue a day early.
 */
export const todayLocalISO = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toMinorUnits = (amount: number, currency: CurrencyCode): number => {
  const decimals = CURRENCY_DECIMALS[currency];
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor);
};

export const fromMinorUnits = (amountMinor: number, currency: CurrencyCode): number => {
  const decimals = CURRENCY_DECIMALS[currency];
  const factor = Math.pow(10, decimals);
  return amountMinor / factor;
};

/** Calendar-day arithmetic on `YYYY-MM-DD` strings, immune to DST length shifts. */
export const addCalendarDays = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const anchor = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const shifted = new Date(anchor + days * 24 * 60 * 60 * 1000);
  const shiftedYear = shifted.getUTCFullYear();
  const shiftedMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const shiftedDay = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
};

/**
 * Tax is levied on the discounted line value, never the gross line value, and
 * every intermediate figure is rounded to whole minor units so a printed
 * document reconciles exactly against the stored ledger totals.
 *
 * Both percentage inputs are clamped to 0-100. An unclamped rate lets a single
 * bad keystroke multiply a line value by an unbounded factor and push the
 * persisted total past the safe integer range, which is unrecoverable once it
 * has been written.
 */
export const calculateItemTotalsMinor = (
  quantity: number,
  unitPriceMinor: number,
  taxRatePercent: number,
  discountRatePercent: number
): ItemTotalsMinor => {
  const billableQuantity = Math.max(0, quantity);
  const billableUnitPriceMinor = Math.max(0, Math.round(unitPriceMinor));
  const appliedTaxRate = Math.min(100, Math.max(0, taxRatePercent));
  const appliedDiscountRate = Math.min(100, Math.max(0, discountRatePercent));

  const subtotalMinor = Math.round(billableQuantity * billableUnitPriceMinor);
  const discountAmountMinor = Math.round((subtotalMinor * appliedDiscountRate) / 100);
  const taxableAmountMinor = Math.max(0, subtotalMinor - discountAmountMinor);
  const taxAmountMinor = Math.round((taxableAmountMinor * appliedTaxRate) / 100);
  const totalMinor = taxableAmountMinor + taxAmountMinor;

  return {
    subtotalMinor,
    discountAmountMinor,
    taxAmountMinor,
    totalMinor,
  };
};

export const calculateInvoiceBreakdownMinor = (
  items: InvoiceItem[],
  amountPaidMinor: number = 0
): CalculationBreakdownMinor => {
  const ledger = items.reduce(
    (runningTotals, item) => {
      runningTotals.subtotalMinor += item.subtotalMinor;
      runningTotals.discountTotalMinor += item.discountAmountMinor;
      runningTotals.taxTotalMinor += item.taxAmountMinor;
      runningTotals.totalAmountMinor += item.totalMinor;
      return runningTotals;
    },
    {
      subtotalMinor: 0,
      discountTotalMinor: 0,
      taxTotalMinor: 0,
      totalAmountMinor: 0,
    }
  );

  const settledMinor = Math.max(0, Math.round(amountPaidMinor));
  const balanceDueMinor = Math.max(0, ledger.totalAmountMinor - settledMinor);

  return {
    subtotalMinor: ledger.subtotalMinor,
    discountTotalMinor: ledger.discountTotalMinor,
    taxTotalMinor: ledger.taxTotalMinor,
    totalAmountMinor: ledger.totalAmountMinor,
    balanceDueMinor,
  };
};

/**
 * Single authority for lifecycle status. Author-only states (draft, cancelled)
 * are never escaped implicitly, and a settled ledger always resolves to paid
 * regardless of the calendar.
 */
export const determineInvoiceStatus = (
  dueDateISO: string,
  totalAmountMinor: number,
  amountPaidMinor: number,
  currentStatus: InvoiceStatus
): InvoiceStatus => {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';
  if (totalAmountMinor === 0 || amountPaidMinor >= totalAmountMinor) return 'paid';

  /*
   * Compared as epoch days rather than by slicing characters off the string. A
   * stored date that is not a strict calendar day would otherwise be ordered by
   * its first ten characters and silently mis-age, so an unparseable due date is
   * treated as still within terms rather than guessed at.
   */
  const dueEpochDay = isoDayToEpochDay(dueDateISO);
  if (dueEpochDay === null) {
    return amountPaidMinor > 0 ? 'partial' : 'pending';
  }

  const todayEpochDay = isoDayToEpochDay(todayLocalISO());
  const isPastDue = todayEpochDay !== null && dueEpochDay < todayEpochDay;

  if (isPastDue) return 'overdue';
  if (amountPaidMinor > 0) return 'partial';
  return 'pending';
};

/** Whole days elapsed since the due date; negative while still within terms. */
export const daysPastDue = (dueDateISO: string, referenceDateISO: string = todayLocalISO()): number => {
  const dueEpochDay = isoDayToEpochDay(dueDateISO);
  const referenceEpochDay = isoDayToEpochDay(referenceDateISO);
  if (dueEpochDay === null || referenceEpochDay === null) return 0;
  return referenceEpochDay - dueEpochDay;
};

/** Exposed so callers can assert a stored date is well formed before ordering it. */
export const isCalendarDay = isStrictIsoDay;

export const percentOfMinorTotal = (partMinor: number, wholeMinor: number): number => {
  if (wholeMinor === 0) return 0;
  return Math.round((partMinor / wholeMinor) * 1000) / 10;
};

/**
 * Totals bucketed by currency code.
 *
 * Money in two currencies is two numbers, never one number. Aggregating without
 * this would silently add euros to dollars and produce a figure that means
 * nothing, so every roll-up on screen is built from this shape.
 */
export const accumulateByCurrency = (
  entries: ReadonlyArray<{ currency: CurrencyCode; amountMinor: number }>
): CurrencyTotals => {
  return entries.reduce<CurrencyTotals>((runningTotals, entry) => {
    runningTotals[entry.currency] = (runningTotals[entry.currency] ?? 0) + entry.amountMinor;
    return runningTotals;
  }, {});
};

/** Stable display order for currency buckets, so tiles never reshuffle on re-render. */
export const toCurrencyFigureList = (totals: CurrencyTotals): Array<{ currency: CurrencyCode; amountMinor: number }> => {
  return (Object.entries(totals) as Array<[CurrencyCode, number]>)
    .filter(([, amountMinor]) => Number.isFinite(amountMinor) && amountMinor !== 0)
    .sort(([earlierCurrency], [laterCurrency]) => earlierCurrency.localeCompare(laterCurrency))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));
};
