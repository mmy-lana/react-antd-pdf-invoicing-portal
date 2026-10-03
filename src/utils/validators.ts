import type { InvoiceItem } from '@/types';

export interface ValidationOutcome {
  valid: boolean;
  message?: string;
}

const INVALID_DATES: ValidationOutcome = {
  valid: false,
  message: 'Both issue date and due date are required.',
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
  if (!issueDate || !dueDate) return INVALID_DATES;
  if (issueDate.slice(0, 10) > dueDate.slice(0, 10)) return REVERSED_DATES;
  return { valid: true };
};

export const validateLineItems = (items: InvoiceItem[]): ValidationOutcome => {
  if (items.length === 0) return EMPTY_LINE_ITEMS;

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
    if (lineItem.discountRate < 0 || lineItem.discountRate > 100) {
      return { valid: false, message: `Item #${ordinal} discount must sit between 0% and 100%.` };
    }
    if (lineItem.taxRate < 0) {
      return { valid: false, message: `Item #${ordinal} tax rate cannot be negative.` };
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
  if (!(amountMinor > 0)) {
    return { valid: false, message: 'Payment amount must be greater than zero.' };
  }
  if (amountMinor > balanceDueMinor) {
    return { valid: false, message: 'Payment amount cannot exceed the remaining balance due.' };
  }
  if (paymentDate.slice(0, 10) < issueDate.slice(0, 10)) {
    return { valid: false, message: 'Payment date cannot be prior to invoice issue date.' };
  }
  return { valid: true };
};

export const isBlank = (input: string | undefined | null): boolean => !input || input.trim().length === 0;

export const looksLikeEmailAddress = (input: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
};

export const isAlphanumericSequenceToken = (input: string): boolean => /^[A-Za-z0-9_-]+$/.test(input);
