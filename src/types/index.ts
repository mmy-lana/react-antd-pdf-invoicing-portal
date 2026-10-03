export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'SGD' | 'JPY';

export const CURRENCY_CODES: readonly CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY'];

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  SGD: 2,
  JPY: 0,
};

export type InvoiceStatus = 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
];

export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'cash' | 'stripe' | 'ach' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'bank_transfer',
  'credit_card',
  'cash',
  'stripe',
  'ach',
  'other',
];

export const ACTOR_LOCAL_ADMIN = 'local-admin';
export const ACTOR_CLIENT_PORTAL = 'client-portal';

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
}

export interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxId: string;
  billingAddress: Address;
  shippingAddress?: Address;
  currency: CurrencyCode;
  paymentTermsDays: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Billing party copied onto the invoice at issue time. Issued documents must keep
 * reproducing the details the client was actually billed with, even after the
 * master client record is later corrected or archived.
 */
export interface ClientSnapshot {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxId: string;
  billingAddress: Address;
  currency: CurrencyCode;
  paymentTermsDays: number;
}

export interface OrganizationSettings {
  id: 'org';
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: Address;
  companyTaxId: string;
  companyLogoDataUrl?: string;
  defaultCurrency: CurrencyCode;
  defaultPaymentTermsDays: number;
  defaultTaxRate: number;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  bankDetails: BankDetails;
  defaultPaymentInstructions: string;
  defaultTermsAndConditions: string;
  updatedAt: string;
}

export interface OrganizationSnapshot {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: Address;
  companyTaxId: string;
  companyLogoDataUrl?: string;
  bankDetails: BankDetails;
  defaultPaymentInstructions: string;
  defaultTermsAndConditions: string;
}

export interface InvoiceItem {
  id: string;
  sortOrder: number;
  description: string;
  unit: string;
  quantity: number;
  unitPriceMinor: number;
  taxRate: number;
  discountRate: number;
  subtotalMinor: number;
  taxAmountMinor: number;
  discountAmountMinor: number;
  totalMinor: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientSnapshot: ClientSnapshot;
  organizationSnapshot: OrganizationSnapshot;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: CurrencyCode;
  items: InvoiceItem[];
  subtotalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  totalAmountMinor: number;
  amountPaidMinor: number;
  balanceDueMinor: number;
  portalToken: string;
  version: number;
  notes?: string;
  paymentInstructions?: string;
  termsAndConditions?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  paidAt?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes?: string;
  createdAt: string;
  voidedAt?: string;
}

export interface FieldDiff {
  before: unknown;
  after: unknown;
}

export interface AuditLog {
  id: string;
  entityId: string;
  entityType: 'invoice' | 'client' | 'payment' | 'settings';
  action: 'create' | 'update' | 'delete' | 'status_change' | 'pdf_download' | 'view';
  actor: string;
  performedAt: string;
  details: string;
  diff?: Record<string, FieldDiff>;
}

export interface InvoiceFilters {
  searchQuery: string;
  statuses?: InvoiceStatus[];
  clientId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CalculationBreakdownMinor {
  subtotalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  totalAmountMinor: number;
  balanceDueMinor: number;
}

export interface ItemTotalsMinor {
  subtotalMinor: number;
  taxAmountMinor: number;
  discountAmountMinor: number;
  totalMinor: number;
}

/** Monetary aggregates keyed by currency so figures are never summed across codes. */
export type CurrencyTotals = Partial<Record<CurrencyCode, number>>;
