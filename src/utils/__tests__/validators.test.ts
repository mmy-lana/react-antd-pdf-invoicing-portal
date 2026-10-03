import { describe, expect, it } from 'vitest';
import {
  compareIsoDays,
  isSafeImageDataUrl,
  isStrictIsoDay,
  isoDayToEpochDay,
  validateInvoiceDates,
  validatePaymentAllocation,
} from '@/utils/validators';
import { calculateItemTotalsMinor } from '@/utils/calculations';

const encodeBytes = (bytes: readonly number[]): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
};

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe('isStrictIsoDay', () => {
  it('accepts a well formed calendar day', () => {
    expect(isStrictIsoDay('2026-03-05')).toBe(true);
    expect(isStrictIsoDay('2028-02-29')).toBe(true);
  });

  it('rejects malformed shapes rather than coercing them', () => {
    expect(isStrictIsoDay('2026-3-5')).toBe(false);
    expect(isStrictIsoDay('20260305')).toBe(false);
    expect(isStrictIsoDay('2026-03-05T00:00:00Z')).toBe(false);
    expect(isStrictIsoDay('03/05/2026')).toBe(false);
    expect(isStrictIsoDay('')).toBe(false);
  });

  it('rejects days that do not exist on the calendar', () => {
    expect(isStrictIsoDay('2026-02-31')).toBe(false);
    expect(isStrictIsoDay('2026-13-01')).toBe(false);
    expect(isStrictIsoDay('2026-00-10')).toBe(false);
    expect(isStrictIsoDay('2027-02-29')).toBe(false);
  });
});

describe('epoch day arithmetic', () => {
  it('maps calendar days onto consecutive integers', () => {
    expect(isoDayToEpochDay('1970-01-01')).toBe(0);
    expect(isoDayToEpochDay('1970-01-02')).toBe(1);
    expect(isoDayToEpochDay('2026-03-06')! - isoDayToEpochDay('2026-03-05')!).toBe(1);
  });

  it('refuses to order a malformed day', () => {
    expect(isoDayToEpochDay('2026-02-31')).toBeNull();
    expect(compareIsoDays('2026-13-01', '2026-03-05')).toBeNull();
  });

  it('orders days regardless of their written shape', () => {
    expect(compareIsoDays('2026-03-05', '2026-03-06')).toBe(0);
    expect(compareIsoDays('2026-03-06', '2026-03-05')).toBe(1);
    expect(compareIsoDays('2026-03-05', '2026-03-05')).toBe(0);
  });
});

describe('validateInvoiceDates', () => {
  it('accepts a correctly ordered pair', () => {
    expect(validateInvoiceDates('2026-03-05', '2026-04-05').valid).toBe(true);
    expect(validateInvoiceDates('2026-03-05', '2026-03-05').valid).toBe(true);
  });

  it('rejects a due date that precedes the issue date', () => {
    expect(validateInvoiceDates('2026-04-05', '2026-03-05').valid).toBe(false);
  });

  it('rejects malformed dates instead of silently comparing characters', () => {
    const outcome = validateInvoiceDates('2026-3-5', '2026-04-05');
    expect(outcome.valid).toBe(false);
    expect(outcome.message).toMatch(/YYYY-MM-DD/i);
  });
});

describe('validatePaymentAllocation', () => {
  it('accepts a settlement on or after the issue date', () => {
    expect(validatePaymentAllocation(1_000, 5_000, '2026-03-05', '2026-03-05').valid).toBe(true);
    expect(validatePaymentAllocation(1_000, 5_000, '2026-03-05', '2026-03-20').valid).toBe(true);
  });

  it('rejects a back-dated settlement', () => {
    const outcome = validatePaymentAllocation(1_000, 5_000, '2026-03-05', '2026-03-04');
    expect(outcome.valid).toBe(false);
    expect(outcome.message).toMatch(/prior to invoice issue date/i);
  });

  it('rejects a malformed date rather than ordering it as text', () => {
    const outcome = validatePaymentAllocation(1_000, 5_000, '2026-03-05', 'not-a-date');
    expect(outcome.valid).toBe(false);
    expect(outcome.message).toMatch(/YYYY-MM-DD/i);
  });

  it('rejects non-positive and over-balance amounts', () => {
    expect(validatePaymentAllocation(0, 5_000, '2026-03-05', '2026-03-06').valid).toBe(false);
    expect(validatePaymentAllocation(-10, 5_000, '2026-03-05', '2026-03-06').valid).toBe(false);
    expect(validatePaymentAllocation(5_001, 5_000, '2026-03-05', '2026-03-06').valid).toBe(false);
  });
});

describe('isSafeImageDataUrl', () => {
  it('accepts a PNG, JPEG or WebP payload carrying the matching signature', () => {
    expect(isSafeImageDataUrl(`data:image/png;base64,${encodeBytes(PNG_HEADER)}`)).toBe(true);
    expect(isSafeImageDataUrl(`data:image/jpeg;base64,${encodeBytes(JPEG_HEADER)}`)).toBe(true);
    expect(isSafeImageDataUrl(`data:image/jpg;base64,${encodeBytes(JPEG_HEADER)}`)).toBe(true);
    expect(isSafeImageDataUrl(`data:image/webp;base64,${encodeBytes(WEBP_HEADER)}`)).toBe(true);
  });

  it('rejects a payload whose bytes contradict the declared media type', () => {
    expect(isSafeImageDataUrl(`data:image/png;base64,${encodeBytes(JPEG_HEADER)}`)).toBe(false);
    expect(isSafeImageDataUrl(`data:image/webp;base64,${encodeBytes(PNG_HEADER)}`)).toBe(false);
  });

  it('rejects a truncated or corrupt payload that a regex alone would pass', () => {
    expect(isSafeImageDataUrl('data:image/png;base64,QUJD')).toBe(false);
    expect(isSafeImageDataUrl(`data:image/png;base64,${encodeBytes(PNG_HEADER).slice(0, 8)}`)).toBe(false);
    expect(isSafeImageDataUrl(`data:image/png;base64,${encodeBytes([0x89])}`)).toBe(false);
  });

  it('rejects non-image and remote sources outright', () => {
    expect(isSafeImageDataUrl('https://example.com/logo.png')).toBe(false);
    expect(isSafeImageDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
    expect(isSafeImageDataUrl('data:text/html;base64,PGgxPmhpPC9oMT4=')).toBe(false);
    expect(isSafeImageDataUrl(undefined)).toBe(false);
    expect(isSafeImageDataUrl('')).toBe(false);
  });

  it('rejects an oversized payload sized to exhaust the layout engine', () => {
    const oversized = `data:image/png;base64,${'A'.repeat(600 * 1024)}`;
    expect(isSafeImageDataUrl(oversized)).toBe(false);
  });
});

describe('calculateItemTotalsMinor bounds', () => {
  it('clamps an out-of-range tax rate instead of scaling the line without limit', () => {
    const clamped = calculateItemTotalsMinor(1, 10_000, 1_000_000, 0);

    expect(clamped.taxAmountMinor).toBe(10_000);
    expect(clamped.totalMinor).toBe(20_000);
    expect(Number.isSafeInteger(clamped.totalMinor)).toBe(true);
  });

  it('clamps a negative tax rate to zero', () => {
    const clamped = calculateItemTotalsMinor(1, 10_000, -50, 0);
    expect(clamped.taxAmountMinor).toBe(0);
  });
});
