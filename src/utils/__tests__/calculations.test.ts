import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCalendarDays,
  calculateInvoiceBreakdownMinor,
  calculateItemTotalsMinor,
  daysPastDue,
  determineInvoiceStatus,
  fromMinorUnits,
  percentOfMinorTotal,
  toMinorUnits,
  todayLocalISO,
} from '@/utils/calculations';
import type { InvoiceItem } from '@/types';

const settleClockAt = (instant: Date | string): void => {
  vi.setSystemTime(typeof instant === 'string' ? new Date(instant) : instant);
};

describe('minor unit conversion', () => {
  it('round-trips two-decimal currencies without drift', () => {
    expect(toMinorUnits(180, 'USD')).toBe(18_000);
    expect(fromMinorUnits(18_000, 'USD')).toBe(180);
    expect(toMinorUnits(0.1, 'USD') + toMinorUnits(0.2, 'USD')).toBe(toMinorUnits(0.3, 'USD'));
  });

  it('handles zero-decimal JPY without introducing fractional units', () => {
    expect(toMinorUnits(650_000, 'JPY')).toBe(650_000);
    expect(fromMinorUnits(650_000, 'JPY')).toBe(650_000);
    expect(toMinorUnits(1_234.56, 'JPY')).toBe(1_235);
    expect(toMinorUnits(1_234.4, 'JPY')).toBe(1_234);
  });

  it('rounds an exact half minor-unit up, never toward zero', () => {
    expect(toMinorUnits(0.125, 'USD')).toBe(13);
    expect(toMinorUnits(0.375, 'USD')).toBe(38);
    expect(toMinorUnits(1.004, 'USD')).toBe(100);
  });
});

describe('calculateItemTotalsMinor', () => {
  it('charges tax on the discounted line value, not the gross value', () => {
    const totals = calculateItemTotalsMinor(2, 10_000, 10, 50);

    expect(totals.subtotalMinor).toBe(20_000);
    expect(totals.discountAmountMinor).toBe(10_000);
    expect(totals.taxAmountMinor).toBe(1_000);
    expect(totals.totalMinor).toBe(11_000);
  });

  it('clamps hostile inputs to a zero-line invoice rather than a negative one', () => {
    const totals = calculateItemTotalsMinor(-5, -10_000, 10, 140);

    expect(totals.subtotalMinor).toBe(0);
    expect(totals.discountAmountMinor).toBe(0);
    expect(totals.taxAmountMinor).toBe(0);
    expect(totals.totalMinor).toBe(0);
  });

  it('produces integers only, so persisted ledger figures never carry fractions', () => {
    const totals = calculateItemTotalsMinor(3, 3_333, 8.875, 7.5);

    for (const figure of Object.values(totals)) {
      expect(Number.isInteger(figure)).toBe(true);
    }
  });
});

describe('calculateInvoiceBreakdownMinor', () => {
  const lineItem = (overrides: Partial<InvoiceItem>): InvoiceItem => ({
    id: 'line',
    sortOrder: 1,
    description: 'Line',
    unit: 'each',
    quantity: 1,
    unitPriceMinor: 0,
    taxRate: 0,
    discountRate: 0,
    subtotalMinor: 0,
    taxAmountMinor: 0,
    discountAmountMinor: 0,
    totalMinor: 0,
    ...overrides,
  });

  it('sums persisted line figures into a settlement breakdown', () => {
    const breakdown = calculateInvoiceBreakdownMinor(
      [
        lineItem({ id: 'a', subtotalMinor: 100_000, discountAmountMinor: 10_000, taxAmountMinor: 9_000, totalMinor: 99_000 }),
        lineItem({ id: 'b', subtotalMinor: 50_000, discountAmountMinor: 0, taxAmountMinor: 4_500, totalMinor: 54_500 }),
      ],
      25_000
    );

    expect(breakdown.subtotalMinor).toBe(150_000);
    expect(breakdown.discountTotalMinor).toBe(10_000);
    expect(breakdown.taxTotalMinor).toBe(13_500);
    expect(breakdown.totalAmountMinor).toBe(153_500);
    expect(breakdown.balanceDueMinor).toBe(128_500);
  });

  it('never reports a negative outstanding balance when payments over-settle', () => {
    const breakdown = calculateInvoiceBreakdownMinor(
      [lineItem({ subtotalMinor: 10_000, totalMinor: 10_000 })],
      40_000
    );

    expect(breakdown.balanceDueMinor).toBe(0);
  });

  it('derives a stable share-of-total percentage', () => {
    expect(percentOfMinorTotal(2_500, 10_000)).toBe(25);
    expect(percentOfMinorTotal(1, 0)).toBe(0);
  });
});

describe('determineInvoiceStatus', () => {
  const localNoon = (year: number, monthIndex: number, day: number): Date =>
    new Date(year, monthIndex, day, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    settleClockAt(localNoon(2026, 5, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a fully settled ledger to paid', () => {
    expect(determineInvoiceStatus('2026-07-15', 10_000, 10_000, 'pending')).toBe('paid');
    expect(determineInvoiceStatus('2026-07-15', 10_000, 25_000, 'partial')).toBe('paid');
  });

  it('treats a zero-total invoice as settled rather than outstanding', () => {
    expect(determineInvoiceStatus('2026-07-15', 0, 0, 'pending')).toBe('paid');
  });

  it('protects author-only states from automatic promotion', () => {
    expect(determineInvoiceStatus('2020-01-01', 10_000, 0, 'draft')).toBe('draft');
    expect(determineInvoiceStatus('2020-01-01', 10_000, 10_000, 'cancelled')).toBe('cancelled');
  });

  it('separates a partial settlement from an untouched invoice within terms', () => {
    expect(determineInvoiceStatus('2026-07-15', 10_000, 4_000, 'pending')).toBe('partial');
    expect(determineInvoiceStatus('2026-07-15', 10_000, 0, 'pending')).toBe('pending');
  });

  it('flags an unpaid invoice as overdue once the due date passes', () => {
    expect(determineInvoiceStatus('2026-06-14', 10_000, 0, 'pending')).toBe('overdue');
    expect(determineInvoiceStatus('2026-06-14', 10_000, 4_000, 'partial')).toBe('overdue');
  });

  it('flips to overdue exactly at the midnight boundary, never a day early', () => {
    const dueDate = '2026-06-15';

    settleClockAt(new Date(2026, 5, 14, 23, 59, 59));
    expect(determineInvoiceStatus(dueDate, 10_000, 0, 'pending')).toBe('pending');

    settleClockAt(new Date(2026, 5, 15, 0, 0, 0));
    expect(determineInvoiceStatus(dueDate, 10_000, 0, 'pending')).toBe('pending');

    settleClockAt(new Date(2026, 5, 15, 23, 59, 59));
    expect(determineInvoiceStatus(dueDate, 10_000, 0, 'pending')).toBe('pending');

    settleClockAt(new Date(2026, 5, 16, 0, 0, 1));
    expect(determineInvoiceStatus(dueDate, 10_000, 0, 'pending')).toBe('overdue');
  });
});

describe('todayLocalISO across timezone offsets', () => {
  const applyTimeZone = (timeZone: string): void => {
    process.env.TZ = timeZone;
  };

  let restoreTimeZone = (): void => {};

  beforeEach(() => {
    const previousTimeZone = process.env.TZ;
    vi.useFakeTimers();
    restoreTimeZone = () => {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    };
  });

  afterEach(() => {
    restoreTimeZone();
    vi.useRealTimers();
  });

  it('reports the ahead-of-UTC calendar day when the instant has already rolled over there', () => {
    applyTimeZone('Pacific/Kiritimati');
    settleClockAt('2026-03-14T23:00:00.000Z');
    expect(todayLocalISO()).toBe('2026-03-15');
  });

  it('reports the behind-UTC calendar day when the instant has not rolled over yet', () => {
    applyTimeZone('Pacific/Niue');
    settleClockAt('2026-03-15T01:00:00.000Z');
    expect(todayLocalISO()).toBe('2026-03-14');
  });

  it('pads single-digit months and days so string comparisons stay well-ordered', () => {
    applyTimeZone('Asia/Tokyo');
    settleClockAt(new Date(2026, 0, 5, 9, 15, 0));
    expect(todayLocalISO()).toBe('2026-01-05');
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2026-03-05', -5)).toBe('2026-02-28');
  });

  it('measures how far a due date has drifted behind today', () => {
    expect(daysPastDue('2026-03-05', '2026-03-15')).toBe(10);
    expect(daysPastDue('2026-03-15', '2026-03-05')).toBe(-10);
    expect(daysPastDue('2026-03-15', '2026-03-15')).toBe(0);
  });
});
