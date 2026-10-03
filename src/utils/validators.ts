import type { InvoiceItem } from '@/types';

export interface ValidationOutcome {
  valid: boolean;
  message?: string;
}

/**
 * Canonical calendar-day format used everywhere a date is compared or stored.
 * The shape is checked rather than trimmed, because a sloppy value such as
 * "2026-1-5" sorts incorrectly against "2026-01-05" in a plain string compare.
 */
export const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Strict `YYYY-MM-DD` check that also rejects impossible calendar days such as
 * 2026-02-31, which a regex alone would happily accept.
 */
export const isStrictIsoDay = (value: string): boolean => {
  if (!ISO_DAY_PATTERN.test(value)) return false;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const anchor = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(anchor);

  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
};

/**
 * Whole days since the Unix epoch, computed at UTC midnight so daylight-saving
 * transitions cannot shorten or lengthen a day. Returns null when the input is
 * not a strict calendar day.
 */
export const isoDayToEpochDay = (value: string): number | null => {
  if (!isStrictIsoDay(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return Math.round(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
};

/**
 * Day-level ordering for two calendar days. Null means at least one input was
 * not a strict calendar day, which callers must treat as a validation failure
 * rather than silently coercing.
 */
export const compareIsoDays = (earlier: string, later: string): number | null => {
  const earlierEpochDay = isoDayToEpochDay(earlier);
  const laterEpochDay = isoDayToEpochDay(later);
  if (earlierEpochDay === null || laterEpochDay === null) return null;
  return earlierEpochDay <= laterEpochDay ? 0 : 1;
};

/**
 * Accepted issuer-logo encodings.
 *
 * A logo is handed to a native PDF layout engine, which will throw on a
 * truncated or mislabelled payload and take the whole document with it. The
 * pattern is therefore checked, and the decoded bytes are inspected for the
 * container's magic number before the value is allowed anywhere near the
 * renderer.
 */
const LOGO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Generous ceiling that still refuses a payload sized to exhaust the renderer. */
export const MAX_LOGO_DATA_URL_LENGTH = 512 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50];

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean => {
  if (bytes.length < signature.length) return false;
  return signature.every((expected, index) => bytes[index] === expected);
};

const decodeBase64Payload = (payload: string): Uint8Array | null => {
  if (payload.length === 0 || payload.length % 4 !== 0) return null;

  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};

/**
 * True only for a base64 PNG, JPEG or WebP data URL whose payload decodes to
 * bytes carrying that format's signature. Anything else, including a
 * syntactically valid but truncated payload, returns false so the caller can
 * omit the image instead of failing the export.
 */
export const isSafeImageDataUrl = (candidate: string | undefined | null): boolean => {
  if (!candidate) return false;

  const value = candidate.trim();
  if (value.length === 0 || value.length > MAX_LOGO_DATA_URL_LENGTH) return false;

  const match = LOGO_DATA_URL_PATTERN.exec(value);
  if (!match) return false;

  const mediaType = (match[1] ?? '').toLowerCase();
  const payload = match[2] ?? '';
  const bytes = decodeBase64Payload(payload);
  if (!bytes) return false;

  if (mediaType === 'png') return startsWithBytes(bytes, PNG_MAGIC);
  if (mediaType === 'jpeg' || mediaType === 'jpg') return startsWithBytes(bytes, JPEG_MAGIC);

  // WebP is a RIFF container whose form type appears after the four size bytes.
  return startsWithBytes(bytes, RIFF_MAGIC) && startsWithBytes(bytes.subarray(8, 12), WEBP_TAG);
};

const MISSING_DATES: ValidationOutcome = {
  valid: false,
  message: 'Both issue date and due date are required.',
};

const MALFORMED_DATES: ValidationOutcome = {
  valid: false,
  message: 'Dates must be valid calendar days in YYYY-MM-DD format.',
};

const REVERSED_DATES: ValidationOutcome = {
  valid: false,
  message: 'Due date cannot be earlier than issue date.',
};

const EMPTY_LINE_ITEMS: ValidationOutcome = {
  valid: false,
  message: 'An invoice must contain at least one line item.',
};

export const validateInvoiceDates = (issueDate: string, dueDate: string): ValidationOutcome => {
  if (!issueDate || !dueDate) return MISSING_DATES;

  const ordering = compareIsoDays(issueDate, dueDate);
  if (ordering === null) return MALFORMED_DATES;
  if (ordering !== 0) return REVERSED_DATES;

  return { valid: true };
};

export const validateLineItems = (items: InvoiceItem[]): ValidationOutcome => {
  if (!Array.isArray(items) || items.length === 0) return EMPTY_LINE_ITEMS;

  for (let index = 0; index < items.length; index += 1) {
    const lineItem = items[index]!;
    const ordinal = index + 1;

    if (!lineItem.description.trim()) {
      return { valid: false, message: `Item #${ordinal} requires a valid description.` };
    }
    if (!(lineItem.quantity > 0)) {
      return { valid: false, message: `Item #${ordinal} quantity must be greater than zero.` };
    }
    if (!(lineItem.unitPriceMinor >= 0)) {
      return { valid: false, message: `Item #${ordinal} unit price cannot be negative.` };
    }
    if (!(lineItem.taxRate >= 0)) {
      return { valid: false, message: `Item #${ordinal} tax rate cannot be negative.` };
    }
    if (!(lineItem.taxRate <= 100)) {
      return { valid: false, message: `Item #${ordinal} tax rate cannot exceed 100%.` };
    }
    if (!(lineItem.discountRate >= 0) || !(lineItem.discountRate <= 100)) {
      return { valid: false, message: `Item #${ordinal} discount must sit between 0% and 100%.` };
    }
  }

  return { valid: true };
};

export const validatePaymentAllocation = (
  amountMinor: number,
  balanceDueMinor: number,
  issueDate: string,
  paymentDate: string
): ValidationOutcome => {
  if (!Number.isFinite(amountMinor) || !(amountMinor > 0)) {
    return { valid: false, message: 'Payment amount must be greater than zero.' };
  }
  if (amountMinor > balanceDueMinor) {
    return { valid: false, message: 'Payment amount cannot exceed the remaining balance due.' };
  }

  /*
   * `compareIsoDays` returns 0 when its first argument is not later than its
   * second, so the issue date is the first operand here: a zero result means the
   * invoice was issued on or before the payment, which is the only valid case.
   */
  const ordering = compareIsoDays(issueDate, paymentDate);
  if (ordering === null) return MALFORMED_DATES;
  if (ordering !== 0) {
    return { valid: false, message: 'Payment date cannot be prior to invoice issue date.' };
  }

  return { valid: true };
};

export const isBlank = (input: string | undefined | null): boolean => !input || input.trim().length === 0;

export const looksLikeEmailAddress = (input: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
};

export const isAlphanumericSequenceToken = (input: string): boolean => /^[A-Za-z0-9_-]+$/.test(input);
