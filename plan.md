# Architecture & Implementation Plan: react-antd-pdf-invoicing-portal

## 1. System Architecture & Directory Tree

```
react-antd-pdf-invoicing-portal/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── router.tsx
    ├── vite-env.d.ts
    ├── test/
    │   └── setup.ts
    ├── types/
    │   └── index.ts
    ├── styles/
    │   ├── theme.ts
    │   └── corporate-tokens.css
    ├── db/
    │   ├── database.ts
    │   └── seed.ts
    ├── utils/
    │   ├── id.ts
    │   ├── calculations.ts
    │   ├── formatters.ts
    │   └── validators.ts
    ├── services/
    │   ├── invoiceService.ts
    │   ├── clientService.ts
    │   ├── paymentService.ts
    │   ├── settingsService.ts
    │   ├── statusReconciliationService.ts
    │   └── auditService.ts
    ├── hooks/
    │   ├── useInvoices.ts
    │   ├── useInvoiceDetail.ts
    │   ├── useClients.ts
    │   ├── useOrganizationSettings.ts
    │   └── useResponsiveBreakpoints.ts
    ├── components/
    │   ├── primitives/
    │   │   ├── StatusBadge.tsx
    │   │   ├── CurrencyDisplay.tsx
    │   │   ├── MetricCard.tsx
    │   │   ├── ResponsiveDateSelector.tsx
    │   │   └── EmptyStateDisplay.tsx
    │   ├── molecules/
    │   │   ├── InvoiceTableToolbar.tsx
    │   │   ├── ClientSelectSearch.tsx
    │   │   ├── LineItemCardEditor.tsx
    │   │   ├── PaymentModal.tsx
    │   │   └── AuditTimeline.tsx
    │   ├── features/
    │   │   ├── invoice/
    │   │   │   ├── InvoiceTable.tsx
    │   │   │   ├── InvoiceCardList.tsx
    │   │   │   ├── InvoiceForm.tsx
    │   │   │   ├── InvoiceSummaryCard.tsx
    │   │   │   └── InvoiceActionsBar.tsx
    │   │   ├── pdf/
    │   │   │   ├── PDFStyles.ts
    │   │   │   ├── PDFDocumentTemplate.tsx
    │   │   │   ├── PDFPreviewModal.tsx
    │   │   │   └── PDFDownloadButton.tsx
    │   │   ├── client/
    │   │   │   ├── ClientTable.tsx
    │   │   │   ├── ClientCardList.tsx
    │   │   │   ├── ClientDrawerForm.tsx
    │   │   │   └── ClientStatement.tsx
    │   │   └── settings/
    │   │       ├── CompanyInfoForm.tsx
    │   │       ├── BankDetailsForm.tsx
    │   │       └── InvoiceSequencingForm.tsx
    │   └── layout/
    │       ├── ResponsiveShell.tsx
    │       ├── CorporateHeader.tsx
    │       ├── CorporateSidebar.tsx
    │       └── MobileBottomNavigation.tsx
    └── routes/
        ├── InvoicesRoute.tsx
        ├── InvoiceCreateEditRoute.tsx
        ├── InvoiceDetailRoute.tsx
        ├── ClientsRoute.tsx
        ├── ClientPortalRoute.tsx
        └── SettingsRoute.tsx
```

### 1.1 Toolchain & Build Configuration

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "verbatimModuleSyntax": true,
    "types": ["vite/client", "vitest/globals"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

`vitest.config.ts`:
```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  })
);
```

`src/test/setup.ts`:
```typescript
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

`src/router.tsx`:
```typescript
import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, Outlet } from 'react-router';
import { Spin } from 'antd';
import { ResponsiveShell } from '@/components/layout/ResponsiveShell';

const InvoicesRoute = lazy(() => import('@/routes/InvoicesRoute'));
const InvoiceCreateEditRoute = lazy(() => import('@/routes/InvoiceCreateEditRoute'));
const InvoiceDetailRoute = lazy(() => import('@/routes/InvoiceDetailRoute'));
const ClientsRoute = lazy(() => import('@/routes/ClientsRoute'));
const SettingsRoute = lazy(() => import('@/routes/SettingsRoute'));
const ClientPortalRoute = lazy(() => import('@/routes/ClientPortalRoute'));

const RouteSuspenseFallback = () => (
  <div style={{ display: 'flex', height: '100%', minHeight: '300px', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

export const router = createHashRouter([
  {
    path: '/',
    element: (
      <ResponsiveShell>
        <Suspense fallback={<RouteSuspenseFallback />}>
          <Outlet />
        </Suspense>
      </ResponsiveShell>
    ),
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoicesRoute /> },
      { path: 'invoices/new', element: <InvoiceCreateEditRoute /> },
      { path: 'invoices/:id', element: <InvoiceDetailRoute /> },
      { path: 'invoices/:id/edit', element: <InvoiceCreateEditRoute /> },
      { path: 'clients', element: <ClientsRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
    ],
  },
  {
    path: '/portal/:token',
    element: (
      <Suspense fallback={<RouteSuspenseFallback />}>
        <ClientPortalRoute />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/invoices" replace />,
  },
]);
```

---

## 2. Strict TypeScript Domain Models (`src/types/index.ts`)

```typescript
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'SGD' | 'JPY';

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

export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'cash' | 'stripe' | 'ach' | 'other';

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
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
    iban?: string;
  };
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
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
    iban?: string;
  };
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
```

---

## 3. Financial Engine & Base Utilities

### 3.1 Money Math & Calculations (`src/utils/calculations.ts`)
```typescript
import type { CurrencyCode, InvoiceItem, InvoiceStatus, CalculationBreakdownMinor } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';

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

export const calculateItemTotalsMinor = (
  quantity: number,
  unitPriceMinor: number,
  taxRatePercent: number,
  discountRatePercent: number
): {
  subtotalMinor: number;
  discountAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
} => {
  const safeQty = Math.max(0, quantity);
  const safePrice = Math.max(0, Math.round(unitPriceMinor));
  const safeTaxRate = Math.max(0, taxRatePercent);
  const safeDiscountRate = Math.min(100, Math.max(0, discountRatePercent));

  const subtotalMinor = Math.round(safeQty * safePrice);
  const discountAmountMinor = Math.round((subtotalMinor * safeDiscountRate) / 100);
  const taxableAmountMinor = Math.max(0, subtotalMinor - discountAmountMinor);
  const taxAmountMinor = Math.round((taxableAmountMinor * safeTaxRate) / 100);
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
  const breakdown = items.reduce(
    (acc, item) => {
      acc.subtotalMinor += item.subtotalMinor;
      acc.discountTotalMinor += item.discountAmountMinor;
      acc.taxTotalMinor += item.taxAmountMinor;
      acc.totalAmountMinor += item.totalMinor;
      return acc;
    },
    {
      subtotalMinor: 0,
      discountTotalMinor: 0,
      taxTotalMinor: 0,
      totalAmountMinor: 0,
    }
  );

  const safePaid = Math.max(0, Math.round(amountPaidMinor));
  const balanceDueMinor = Math.max(0, breakdown.totalAmountMinor - safePaid);

  return {
    subtotalMinor: breakdown.subtotalMinor,
    discountTotalMinor: breakdown.discountTotalMinor,
    taxTotalMinor: breakdown.taxTotalMinor,
    totalAmountMinor: breakdown.totalAmountMinor,
    balanceDueMinor,
  };
};

export const determineInvoiceStatus = (
  dueDateISO: string,
  totalAmountMinor: number,
  amountPaidMinor: number,
  currentStatus: InvoiceStatus
): InvoiceStatus => {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';
  if (totalAmountMinor === 0 || amountPaidMinor >= totalAmountMinor) return 'paid';

  const todayISO = todayLocalISO();
  const isPastDue = dueDateISO.slice(0, 10) < todayISO;

  if (isPastDue) return 'overdue';
  if (amountPaidMinor > 0) return 'partial';
  return 'pending';
};
```

### 3.2 Formatters (`src/utils/formatters.ts`)
```typescript
import type { CurrencyCode } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { fromMinorUnits } from '@/utils/calculations';

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

export const formatDate = (isoString: string): string => {
  if (!isoString) return '';
  const datePart = isoString.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return isoString;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
};

export const formatInvoiceSequence = (prefix: string, sequence: number): string => {
  return `${prefix}-${String(sequence).padStart(5, '0')}`;
};
```

### 3.3 Secure ID Generator (`src/utils/id.ts`)
```typescript
export const newId = (prefix: string = ''): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const rawUuid = crypto.randomUUID();
    return prefix ? `${prefix}-${rawUuid}` : rawUuid;
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return prefix ? `${prefix}-${uuid}` : uuid;
};

export const newPortalToken = (): string => {
  return newId().replace(/-/g, '');
};
```

### 3.4 Validators (`src/utils/validators.ts`)
```typescript
import type { InvoiceItem } from '@/types';

export const validateInvoiceDates = (issueDate: string, dueDate: string): { valid: boolean; message?: string } => {
  if (!issueDate || !dueDate) {
    return { valid: false, message: 'Both issue date and due date are required.' };
  }
  if (issueDate.slice(0, 10) > dueDate.slice(0, 10)) {
    return { valid: false, message: 'Due date cannot be earlier than issue date.' };
  }
  return { valid: true };
};

export const validateLineItems = (items: InvoiceItem[]): { valid: boolean; message?: string } => {
  if (items.length === 0) {
    return { valid: false, message: 'An invoice must contain at least one line item.' };
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!item.description.trim()) {
      return { valid: false, message: `Item #${i + 1} requires a valid description.` };
    }
    if (item.quantity <= 0) {
      return { valid: false, message: `Item #${i + 1} quantity must be greater than zero.` };
    }
    if (item.unitPriceMinor < 0) {
      return { valid: false, message: `Item #${i + 1} unit price cannot be negative.` };
    }
  }
  return { valid: true };
};
```

---

## 4. Database Layer & Transactional Service Layer

### 4.1 Database Configuration (`src/db/database.ts`)
```typescript
import Dexie, { type Table } from 'dexie';
import type { Client, Invoice, PaymentRecord, OrganizationSettings, AuditLog } from '@/types';

export class InvoicingDatabase extends Dexie {
  clients!: Table<Client, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<PaymentRecord, string>;
  settings!: Table<OrganizationSettings, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('CorporateInvoicingDB');

    this.version(1).stores({
      clients: 'id, name, companyName, email, createdAt, archivedAt',
      invoices:
        'id, &invoiceNumber, clientId, status, issueDate, dueDate, totalAmountMinor, balanceDueMinor, portalToken, [clientId+status], [status+dueDate], createdAt',
      payments: 'id, invoiceId, paymentDate, paymentMethod, createdAt, voidedAt',
      settings: 'id',
      auditLogs: 'id, entityId, entityType, action, performedAt',
    });

    this.version(2).stores({
      invoices:
        'id, &invoiceNumber, clientId, status, issueDate, dueDate, totalAmountMinor, balanceDueMinor, portalToken, [clientId+status], [status+dueDate], createdAt, version',
    });
  }
}

export const db = new InvoicingDatabase();
```

### 4.2 Database Initialization & Seeder (`src/db/seed.ts`)
```typescript
import dayjs from 'dayjs';
import { db } from '@/db/database';
import type { OrganizationSettings } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { createClient } from '@/services/clientService';
import { createInvoiceTransactional, cancelInvoiceTransactional } from '@/services/invoiceService';
import { recordPaymentTransactional } from '@/services/paymentService';
import { reconcileInvoiceStatuses } from '@/services/statusReconciliationService';
import { toMinorUnits } from '@/utils/calculations';

let initPromise: Promise<void> | null = null;

const runInit = async (): Promise<void> => {
  await db.transaction('rw', [db.settings, db.clients, db.invoices, db.payments, db.auditLogs], async () => {
    const existingSettings = await db.settings.get('org');
    if (!existingSettings) {
      const defaultSettings: OrganizationSettings = {
        id: 'org',
        companyName: 'Acro Corporate Solutions Inc.',
        companyEmail: 'billing@acrosolutions.com',
        companyPhone: '+1 (555) 019-2834',
        companyAddress: {
          street1: '100 Enterprise Boulevard',
          street2: 'Suite 400',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'United States',
        },
        companyTaxId: 'US-948201948',
        defaultCurrency: 'USD',
        defaultPaymentTermsDays: 30,
        defaultTaxRate: 8.875,
        invoicePrefix: 'INV',
        nextInvoiceSequence: 1001,
        bankDetails: {
          bankName: 'JPMorgan Chase Bank, N.A.',
          accountName: 'Acro Corporate Solutions Operating',
          accountNumber: '987654321098',
          routingNumber: '021000021',
          swiftCode: 'CHASUS33',
          iban: 'US33CHAS021000021987654321',
        },
        defaultPaymentInstructions: 'Wire transfers only. Please reference invoice number in remittance memo.',
        defaultTermsAndConditions: 'Payment is due within designated net terms. Late payments subject to a 1.5% monthly finance charge.',
        updatedAt: new Date().toISOString(),
      };
      await db.settings.put(defaultSettings);
    }

    const clientCount = await db.clients.count();
    if (clientCount === 0) {
      const c1 = await createClient({
        name: 'Sarah Jenkins',
        companyName: 'Apex Logistics Global',
        email: 's.jenkins@apexlogistics.com',
        phone: '+1 (555) 349-1120',
        taxId: 'US-443920192',
        billingAddress: {
          street1: '450 Harbor Way',
          street2: 'Dock 4',
          city: 'Long Beach',
          state: 'CA',
          postalCode: '90802',
          country: 'United States',
        },
        currency: 'USD',
        paymentTermsDays: 30,
      }, ACTOR_LOCAL_ADMIN);

      const c2 = await createClient({
        name: 'Marcus Vance',
        companyName: 'Vance BioTech Laboratories',
        email: 'accounting@vancebio.com',
        phone: '+1 (555) 887-2300',
        taxId: 'US-889102941',
        billingAddress: {
          street1: '12 Science Park Drive',
          city: 'Cambridge',
          state: 'MA',
          postalCode: '02142',
          country: 'United States',
        },
        currency: 'USD',
        paymentTermsDays: 15,
      }, ACTOR_LOCAL_ADMIN);

      const c3 = await createClient({
        name: 'Elena Rostova',
        companyName: 'Nordic Clean Energy AB',
        email: 'finance@nordicenergy.se',
        phone: '+46 8 123 4567',
        taxId: 'SE-556123456701',
        billingAddress: {
          street1: 'Hamngatan 14',
          city: 'Stockholm',
          state: 'Stockholm',
          postalCode: '111 47',
          country: 'Sweden',
        },
        currency: 'EUR',
        paymentTermsDays: 30,
      }, ACTOR_LOCAL_ADMIN);

      const c4 = await createClient({
        name: 'David Chen',
        companyName: 'Pacific Rim Robotics',
        email: 'billing@pacrimrobotics.com',
        phone: '+1 (555) 762-9090',
        taxId: 'US-778291039',
        billingAddress: {
          street1: '888 Silicon Ave',
          city: 'San Jose',
          state: 'CA',
          postalCode: '95110',
          country: 'United States',
        },
        currency: 'USD',
        paymentTermsDays: 45,
      }, ACTOR_LOCAL_ADMIN);

      const c5 = await createClient({
        name: 'Kenji Sato',
        companyName: 'Tokyo Media Dynamics',
        email: 'k.sato@tokyomedia.jp',
        phone: '+81 3 5555 0143',
        taxId: 'JP-9018273645123',
        billingAddress: {
          street1: 'Roppongi Hills Mori Tower 24F',
          city: 'Minato-ku',
          state: 'Tokyo',
          postalCode: '106-6124',
          country: 'Japan',
        },
        currency: 'JPY',
        paymentTermsDays: 30,
      }, ACTOR_LOCAL_ADMIN);

      const today = dayjs();

      const inv1 = await createInvoiceTransactional({
        clientId: c1.id,
        issueDate: today.subtract(40, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-1',
          sortOrder: 1,
          description: 'Systems Architecture Audit',
          unit: 'hours',
          quantity: 30,
          unitPriceMinor: toMinorUnits(180, 'USD'),
          taxRate: 8.875,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await cancelInvoiceTransactional(inv1.id, ACTOR_LOCAL_ADMIN, 'Client requested contract scope renegotiation');

      const inv2 = await createInvoiceTransactional({
        clientId: c1.id,
        issueDate: today.subtract(15, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(15, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-2',
          sortOrder: 1,
          description: 'Enterprise Cloud Deployment - Sprint 1',
          unit: 'sprint',
          quantity: 1,
          unitPriceMinor: toMinorUnits(8500, 'USD'),
          taxRate: 0,
          discountRate: 5,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await recordPaymentTransactional({
        invoiceId: inv2.id,
        amountMinor: toMinorUnits(4000, 'USD'),
        paymentDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
        paymentMethod: 'bank_transfer',
        transactionReference: 'WIRE-APEX-0928',
        actor: ACTOR_LOCAL_ADMIN,
      });

      const inv3 = await createInvoiceTransactional({
        clientId: c2.id,
        issueDate: today.subtract(25, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-3',
          sortOrder: 1,
          description: 'Laboratory Information Management Consultation',
          unit: 'hours',
          quantity: 20,
          unitPriceMinor: toMinorUnits(220, 'USD'),
          taxRate: 5,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await recordPaymentTransactional({
        invoiceId: inv3.id,
        amountMinor: inv3.totalAmountMinor,
        paymentDate: today.subtract(12, 'day').format('YYYY-MM-DD'),
        paymentMethod: 'ach',
        transactionReference: 'ACH-VANCE-8812',
        actor: ACTOR_LOCAL_ADMIN,
      });

      await createInvoiceTransactional({
        clientId: c2.id,
        issueDate: today.format('YYYY-MM-DD'),
        dueDate: today.add(15, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'draft',
        items: [{
          id: 'item-seed-4',
          sortOrder: 1,
          description: 'Q2 Compliance Preparation',
          unit: 'fixed',
          quantity: 1,
          unitPriceMinor: toMinorUnits(3200, 'USD'),
          taxRate: 0,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await createInvoiceTransactional({
        clientId: c3.id,
        issueDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(25, 'day').format('YYYY-MM-DD'),
        currency: 'EUR',
        status: 'pending',
        items: [{
          id: 'item-seed-5',
          sortOrder: 1,
          description: 'Smart Grid Telemetry Integration',
          unit: 'days',
          quantity: 8,
          unitPriceMinor: toMinorUnits(1200, 'EUR'),
          taxRate: 25,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await createInvoiceTransactional({
        clientId: c4.id,
        issueDate: today.subtract(50, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-6',
          sortOrder: 1,
          description: 'Actuator Control Protocol Programming',
          unit: 'hours',
          quantity: 45,
          unitPriceMinor: toMinorUnits(150, 'USD'),
          taxRate: 8.875,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      const inv7 = await createInvoiceTransactional({
        clientId: c4.id,
        issueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(35, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-7',
          sortOrder: 1,
          description: 'Robotics Fleet Diagnostics',
          unit: 'units',
          quantity: 10,
          unitPriceMinor: toMinorUnits(500, 'USD'),
          taxRate: 8.875,
          discountRate: 10,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await recordPaymentTransactional({
        invoiceId: inv7.id,
        amountMinor: toMinorUnits(2000, 'USD'),
        paymentDate: today.subtract(2, 'day').format('YYYY-MM-DD'),
        paymentMethod: 'credit_card',
        transactionReference: 'TXN-STRIPE-44910',
        actor: ACTOR_LOCAL_ADMIN,
      });

      await createInvoiceTransactional({
        clientId: c5.id,
        issueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(20, 'day').format('YYYY-MM-DD'),
        currency: 'JPY',
        status: 'pending',
        items: [{
          id: 'item-seed-8',
          sortOrder: 1,
          description: 'Media Distribution Engine License',
          unit: 'license',
          quantity: 1,
          unitPriceMinor: toMinorUnits(650000, 'JPY'),
          taxRate: 10,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await createInvoiceTransactional({
        clientId: c5.id,
        issueDate: today.subtract(2, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(28, 'day').format('YYYY-MM-DD'),
        currency: 'JPY',
        status: 'draft',
        items: [{
          id: 'item-seed-9',
          sortOrder: 1,
          description: 'Technical Support Retainer - May',
          unit: 'month',
          quantity: 1,
          unitPriceMinor: toMinorUnits(150000, 'JPY'),
          taxRate: 10,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      const inv10 = await createInvoiceTransactional({
        clientId: c1.id,
        issueDate: today.subtract(30, 'day').format('YYYY-MM-DD'),
        dueDate: today.format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [{
          id: 'item-seed-10',
          sortOrder: 1,
          description: 'Supply Chain Routing Optimization',
          unit: 'hours',
          quantity: 12,
          unitPriceMinor: toMinorUnits(200, 'USD'),
          taxRate: 8.875,
          discountRate: 0,
          subtotalMinor: 0,
          taxAmountMinor: 0,
          discountAmountMinor: 0,
          totalMinor: 0,
        }],
      }, ACTOR_LOCAL_ADMIN);

      await recordPaymentTransactional({
        invoiceId: inv10.id,
        amountMinor: inv10.totalAmountMinor,
        paymentDate: today.format('YYYY-MM-DD'),
        paymentMethod: 'bank_transfer',
        transactionReference: 'WIRE-APEX-0994',
        actor: ACTOR_LOCAL_ADMIN,
      });
    }
  });

  await reconcileInvoiceStatuses();
};

export const initializeDatabase = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};
```

### 4.3 Transactional Invoice Service (`src/services/invoiceService.ts`)
```typescript
import dayjs from 'dayjs';
import { db } from '@/db/database';
import type { Invoice, InvoiceItem, OrganizationSnapshot } from '@/types';
import { formatInvoiceSequence } from '@/utils/formatters';
import { calculateItemTotalsMinor, calculateInvoiceBreakdownMinor, determineInvoiceStatus, todayLocalISO } from '@/utils/calculations';
import { validateInvoiceDates, validateLineItems } from '@/utils/validators';
import { newId, newPortalToken } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export interface CreateInvoiceParams {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: Invoice['currency'];
  status?: 'draft' | 'pending';
  items: InvoiceItem[];
  notes?: string;
  paymentInstructions?: string;
  termsAndConditions?: string;
}

export const createInvoiceTransactional = async (
  params: CreateInvoiceParams,
  actor: string
): Promise<Invoice> => {
  const dateVal = validateInvoiceDates(params.issueDate, params.dueDate);
  if (!dateVal.valid) throw new Error(dateVal.message);

  const itemsVal = validateLineItems(params.items);
  if (!itemsVal.valid) throw new Error(itemsVal.message);

  return await db.transaction('rw', [db.settings, db.clients, db.invoices, db.auditLogs], async () => {
    const settings = await db.settings.get('org');
    if (!settings) throw new Error('Organization settings not found.');

    const client = await db.clients.get(params.clientId);
    if (!client || client.archivedAt) throw new Error('Active client must be selected.');

    let seq = settings.nextInvoiceSequence;
    let invoiceNumber = formatInvoiceSequence(settings.invoicePrefix, seq);

    while (await db.invoices.where('invoiceNumber').equals(invoiceNumber).first()) {
      seq += 1;
      invoiceNumber = formatInvoiceSequence(settings.invoicePrefix, seq);
    }

    settings.nextInvoiceSequence = seq + 1;
    settings.updatedAt = new Date().toISOString();
    await db.settings.put(settings);

    const recomputedItems: InvoiceItem[] = params.items.map((item, index) => {
      const calc = calculateItemTotalsMinor(item.quantity, item.unitPriceMinor, item.taxRate, item.discountRate);
      return {
        ...item,
        id: item.id || newId('item'),
        sortOrder: index + 1,
        subtotalMinor: calc.subtotalMinor,
        discountAmountMinor: calc.discountAmountMinor,
        taxAmountMinor: calc.taxAmountMinor,
        totalMinor: calc.totalMinor,
      };
    });

    const breakdown = calculateInvoiceBreakdownMinor(recomputedItems, 0);
    const requestedStatus = params.status || 'pending';

    if (requestedStatus !== 'draft' && breakdown.totalAmountMinor === 0) {
      throw new Error('Invoices with zero total cannot be finalized or sent. Save as draft instead.');
    }

    const initialStatus = requestedStatus === 'draft'
      ? 'draft'
      : determineInvoiceStatus(params.dueDate, breakdown.totalAmountMinor, 0, 'pending');

    const orgSnapshot: OrganizationSnapshot = {
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyAddress: settings.companyAddress,
      companyTaxId: settings.companyTaxId,
      companyLogoDataUrl: settings.companyLogoDataUrl,
      bankDetails: settings.bankDetails,
      defaultPaymentInstructions: settings.defaultPaymentInstructions,
      defaultTermsAndConditions: settings.defaultTermsAndConditions,
    };

    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      id: newId('inv'),
      invoiceNumber,
      clientId: client.id,
      clientSnapshot: {
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        email: client.email,
        phone: client.phone,
        taxId: client.taxId,
        billingAddress: client.billingAddress,
        currency: client.currency,
        paymentTermsDays: client.paymentTermsDays,
      },
      organizationSnapshot: orgSnapshot,
      issueDate: params.issueDate,
      dueDate: params.dueDate,
      status: initialStatus,
      currency: params.currency,
      items: recomputedItems,
      subtotalMinor: breakdown.subtotalMinor,
      taxTotalMinor: breakdown.taxTotalMinor,
      discountTotalMinor: breakdown.discountTotalMinor,
      totalAmountMinor: breakdown.totalAmountMinor,
      amountPaidMinor: 0,
      balanceDueMinor: breakdown.balanceDueMinor,
      portalToken: newPortalToken(),
      version: 1,
      notes: params.notes,
      paymentInstructions: params.paymentInstructions || settings.defaultPaymentInstructions,
      termsAndConditions: params.termsAndConditions || settings.defaultTermsAndConditions,
      createdAt: now,
      updatedAt: now,
      sentAt: requestedStatus !== 'draft' ? now : undefined,
    };

    await db.invoices.add(newInvoice);

    await writeAuditLog({
      entityId: newInvoice.id,
      entityType: 'invoice',
      action: 'create',
      actor,
      details: `Created invoice ${newInvoice.invoiceNumber}`,
      diff: {
        status: { before: null, after: newInvoice.status },
        totalAmountMinor: { before: null, after: newInvoice.totalAmountMinor },
      },
    });

    return newInvoice;
  });
};

export const updateInvoiceTransactional = async (
  invoiceId: string,
  params: Partial<CreateInvoiceParams>,
  expectedVersion: number,
  actor: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error(`Invoice ${invoiceId} not found.`);

    if (existing.version !== expectedVersion) {
      throw new Error('Concurrent modification detected. Refresh and review changes before saving.');
    }

    if (existing.status === 'cancelled') {
      throw new Error('Cancelled invoices cannot be modified.');
    }

    if (existing.status === 'paid') {
      throw new Error('Paid invoices cannot be modified.');
    }

    if (existing.status !== 'draft' && params.status === 'draft') {
      throw new Error('Cannot revert a finalized or sent invoice to draft.');
    }

    const issueDate = params.issueDate ?? existing.issueDate;
    const dueDate = params.dueDate ?? existing.dueDate;
    const dateVal = validateInvoiceDates(issueDate, dueDate);
    if (!dateVal.valid) throw new Error(dateVal.message);

    let recomputedItems = existing.items;
    if (params.items) {
      const itemsVal = validateLineItems(params.items);
      if (!itemsVal.valid) throw new Error(itemsVal.message);

      recomputedItems = params.items.map((item, index) => {
        const calc = calculateItemTotalsMinor(item.quantity, item.unitPriceMinor, item.taxRate, item.discountRate);
        return {
          ...item,
          id: item.id || newId('item'),
          sortOrder: index + 1,
          subtotalMinor: calc.subtotalMinor,
          discountAmountMinor: calc.discountAmountMinor,
          taxAmountMinor: calc.taxAmountMinor,
          totalMinor: calc.totalMinor,
        };
      });
    }

    const breakdown = calculateInvoiceBreakdownMinor(recomputedItems, existing.amountPaidMinor);
    if (breakdown.totalAmountMinor < existing.amountPaidMinor) {
      throw new Error('Invoice total cannot be reduced below the amount already paid.');
    }

    const targetStatus = params.status ?? existing.status;
    if (targetStatus !== 'draft' && breakdown.totalAmountMinor === 0) {
      throw new Error('Invoices with zero total cannot be finalized or sent.');
    }

    const newStatus = existing.status === 'draft' && !params.status
      ? 'draft'
      : determineInvoiceStatus(dueDate, breakdown.totalAmountMinor, existing.amountPaidMinor, targetStatus);

    const now = new Date().toISOString();

    const updated: Invoice = {
      ...existing,
      issueDate,
      dueDate,
      status: newStatus,
      items: recomputedItems,
      subtotalMinor: breakdown.subtotalMinor,
      taxTotalMinor: breakdown.taxTotalMinor,
      discountTotalMinor: breakdown.discountTotalMinor,
      totalAmountMinor: breakdown.totalAmountMinor,
      balanceDueMinor: breakdown.balanceDueMinor,
      notes: params.notes ?? existing.notes,
      paymentInstructions: params.paymentInstructions ?? existing.paymentInstructions,
      termsAndConditions: params.termsAndConditions ?? existing.termsAndConditions,
      sentAt: existing.sentAt ?? (existing.status === 'draft' && newStatus !== 'draft' ? now : undefined),
      paidAt: newStatus === 'paid' ? (existing.paidAt ?? now) : existing.paidAt,
      version: existing.version + 1,
      updatedAt: now,
    };

    await db.invoices.put(updated);

    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'update',
      actor,
      details: `Updated invoice ${updated.invoiceNumber} to version ${updated.version}`,
      diff: {
        totalAmountMinor: { before: existing.totalAmountMinor, after: updated.totalAmountMinor },
        status: { before: existing.status, after: updated.status },
        version: { before: existing.version, after: updated.version },
      },
    });

    return updated;
  });
};

export const markInvoiceSentTransactional = async (invoiceId: string, actor: string): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');

    if (existing.status !== 'draft') {
      throw new Error('Only draft invoices can be transitioned to sent.');
    }

    if (existing.totalAmountMinor === 0) {
      throw new Error('Cannot send an invoice with zero total.');
    }

    const newStatus = determineInvoiceStatus(existing.dueDate, existing.totalAmountMinor, existing.amountPaidMinor, 'pending');

    const updated: Invoice = {
      ...existing,
      status: newStatus,
      sentAt: new Date().toISOString(),
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await db.invoices.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'status_change',
      actor,
      details: `Marked invoice ${updated.invoiceNumber} as sent`,
      diff: {
        status: { before: existing.status, after: updated.status },
        sentAt: { before: existing.sentAt, after: updated.sentAt },
      },
    });

    return updated;
  });
};

export const cancelInvoiceTransactional = async (
  invoiceId: string,
  actor: string,
  reason: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');
    if (existing.amountPaidMinor > 0) {
      throw new Error('Cannot cancel an invoice with recorded payments. Void payments first.');
    }

    const updated: Invoice = {
      ...existing,
      status: 'cancelled',
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await db.invoices.put(updated);

    await writeAuditLog({
      entityId: updated.id,
      entityType: 'invoice',
      action: 'status_change',
      actor,
      details: `Cancelled invoice ${updated.invoiceNumber}. Reason: ${reason}`,
      diff: {
        status: { before: existing.status, after: 'cancelled' },
      },
    });

    return updated;
  });
};

export const deleteDraftInvoice = async (invoiceId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.invoices, db.auditLogs], async () => {
    const existing = await db.invoices.get(invoiceId);
    if (!existing) throw new Error('Invoice not found.');
    if (existing.status !== 'draft') {
      throw new Error('Only draft invoices can be permanently deleted. Cancel finalized invoices instead.');
    }

    await db.invoices.delete(invoiceId);
    await writeAuditLog({
      entityId: invoiceId,
      entityType: 'invoice',
      action: 'delete',
      actor,
      details: `Deleted draft invoice ${existing.invoiceNumber}. Sequence number is retired per tax audit requirements.`,
    });
  });
};

export const duplicateInvoice = async (invoiceId: string, actor: string): Promise<Invoice> => {
  const existing = await db.invoices.get(invoiceId);
  if (!existing) throw new Error('Source invoice not found.');

  const todayStr = todayLocalISO();
  const dueDateStr = dayjs(todayStr).add(existing.clientSnapshot.paymentTermsDays || 30, 'day').format('YYYY-MM-DD');

  return await createInvoiceTransactional(
    {
      clientId: existing.clientId,
      issueDate: todayStr,
      dueDate: dueDateStr,
      currency: existing.currency,
      status: 'draft',
      items: existing.items.map((it) => ({ ...it, id: newId('item') })),
      notes: existing.notes,
      paymentInstructions: existing.paymentInstructions,
      termsAndConditions: existing.termsAndConditions,
    },
    actor
  );
};

export const getInvoiceByPortalToken = async (token: string): Promise<Invoice | null> => {
  const inv = await db.invoices.where('portalToken').equals(token).first();
  return inv && inv.status !== 'draft' && inv.status !== 'cancelled' ? inv : null;
};
```

### 4.4 Transactional Payment Service (`src/services/paymentService.ts`)
```typescript
import { db } from '@/db/database';
import type { PaymentRecord, PaymentMethod, Invoice } from '@/types';
import { determineInvoiceStatus } from '@/utils/calculations';
import { newId } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export interface RecordPaymentParams {
  invoiceId: string;
  amountMinor: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes?: string;
  actor: string;
}

export const recordPaymentTransactional = async (
  params: RecordPaymentParams
): Promise<{ payment: PaymentRecord; invoice: Invoice }> => {
  return await db.transaction('rw', [db.invoices, db.payments, db.auditLogs], async () => {
    const invoice = await db.invoices.get(params.invoiceId);
    if (!invoice) throw new Error('Invoice not found.');

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot record payments against a cancelled invoice.');
    }

    if (invoice.status === 'draft') {
      throw new Error('Cannot record payments against a draft invoice. Finalize or send the invoice first.');
    }

    if (params.paymentDate.slice(0, 10) < invoice.issueDate.slice(0, 10)) {
      throw new Error('Payment date cannot be prior to invoice issue date.');
    }

    if (params.amountMinor <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (params.amountMinor > invoice.balanceDueMinor) {
      throw new Error('Payment amount cannot exceed the remaining balance due.');
    }

    const payment: PaymentRecord = {
      id: newId('pay'),
      invoiceId: invoice.id,
      amountMinor: params.amountMinor,
      paymentDate: params.paymentDate,
      paymentMethod: params.paymentMethod,
      transactionReference: params.transactionReference,
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    const newAmountPaid = invoice.amountPaidMinor + params.amountMinor;
    const newBalanceDue = Math.max(0, invoice.totalAmountMinor - newAmountPaid);
    const newStatus = determineInvoiceStatus(invoice.dueDate, invoice.totalAmountMinor, newAmountPaid, invoice.status);

    const updatedInvoice: Invoice = {
      ...invoice,
      amountPaidMinor: newAmountPaid,
      balanceDueMinor: newBalanceDue,
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date().toISOString() : invoice.paidAt,
      version: invoice.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await db.payments.add(payment);
    await db.invoices.put(updatedInvoice);

    await writeAuditLog({
      entityId: payment.id,
      entityType: 'payment',
      action: 'create',
      actor: params.actor,
      details: `Recorded payment of minor units ${params.amountMinor} for ${invoice.invoiceNumber}`,
      diff: {
        amountPaidMinor: { before: invoice.amountPaidMinor, after: newAmountPaid },
        balanceDueMinor: { before: invoice.balanceDueMinor, after: newBalanceDue },
        status: { before: invoice.status, after: newStatus },
      },
    });

    return { payment, invoice: updatedInvoice };
  });
};

export const voidPaymentTransactional = async (
  paymentId: string,
  actor: string,
  reason: string
): Promise<Invoice> => {
  return await db.transaction('rw', [db.invoices, db.payments, db.auditLogs], async () => {
    const payment = await db.payments.get(paymentId);
    if (!payment || payment.voidedAt) {
      throw new Error('Payment not found or already voided.');
    }

    const invoice = await db.invoices.get(payment.invoiceId);
    if (!invoice) throw new Error('Associated invoice not found.');

    payment.voidedAt = new Date().toISOString();
    await db.payments.put(payment);

    const newAmountPaid = Math.max(0, invoice.amountPaidMinor - payment.amountMinor);
    const newBalanceDue = invoice.totalAmountMinor - newAmountPaid;
    const newStatus = determineInvoiceStatus(invoice.dueDate, invoice.totalAmountMinor, newAmountPaid, invoice.status);

    const updatedInvoice: Invoice = {
      ...invoice,
      amountPaidMinor: newAmountPaid,
      balanceDueMinor: newBalanceDue,
      status: newStatus,
      paidAt: newStatus === 'paid' ? invoice.paidAt : undefined,
      version: invoice.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await db.invoices.put(updatedInvoice);

    await writeAuditLog({
      entityId: payment.id,
      entityType: 'payment',
      action: 'status_change',
      actor,
      details: `Voided payment ${payment.id}. Reason: ${reason}`,
      diff: {
        amountPaidMinor: { before: invoice.amountPaidMinor, after: newAmountPaid },
        balanceDueMinor: { before: invoice.balanceDueMinor, after: newBalanceDue },
        status: { before: invoice.status, after: newStatus },
        voidedAt: { before: null, after: payment.voidedAt },
      },
    });

    return updatedInvoice;
  });
};
```

### 4.5 Audit Service (`src/services/auditService.ts`)
```typescript
import { db } from '@/db/database';
import type { AuditLog } from '@/types';
import { newId } from '@/utils/id';

export const writeAuditLog = async (log: Omit<AuditLog, 'id' | 'performedAt'>): Promise<void> => {
  const auditEntry: AuditLog = {
    ...log,
    id: newId('aud'),
    performedAt: new Date().toISOString(),
  };
  await db.auditLogs.add(auditEntry);
};

export const logInvoiceEvent = async (
  invoiceId: string,
  action: 'view' | 'pdf_download',
  actor: string,
  details: string
): Promise<void> => {
  await writeAuditLog({
    entityId: invoiceId,
    entityType: 'invoice',
    action,
    actor,
    details,
  });
};
```

### 4.6 Client Service (`src/services/clientService.ts`)
```typescript
import { db } from '@/db/database';
import type { Client } from '@/types';
import { newId } from '@/utils/id';
import { writeAuditLog } from '@/services/auditService';

export const createClient = async (
  clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>,
  actor: string
): Promise<Client> => {
  return await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const newClient: Client = {
      ...clientData,
      id: newId('cli'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.clients.add(newClient);
    await writeAuditLog({
      entityId: newClient.id,
      entityType: 'client',
      action: 'create',
      actor,
      details: `Created client ${newClient.companyName}`,
      diff: {
        companyName: { before: null, after: newClient.companyName },
      },
    });
    return newClient;
  });
};

export const updateClient = async (
  clientId: string,
  clientData: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>>,
  actor: string
): Promise<Client> => {
  return await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const existing = await db.clients.get(clientId);
    if (!existing) throw new Error('Client not found.');

    const updated: Client = {
      ...existing,
      ...clientData,
      updatedAt: new Date().toISOString(),
    };
    await db.clients.put(updated);
    await writeAuditLog({
      entityId: updated.id,
      entityType: 'client',
      action: 'update',
      actor,
      details: `Updated client ${updated.companyName}`,
    });
    return updated;
  });
};

export const archiveClient = async (clientId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.clients, db.invoices, db.auditLogs], async () => {
    const activeInvoices = await db.invoices
      .where('clientId')
      .equals(clientId)
      .and((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
      .count();

    if (activeInvoices > 0) {
      throw new Error('Cannot archive client with unpaid or active invoices.');
    }

    const client = await db.clients.get(clientId);
    if (!client) throw new Error('Client not found.');

    client.archivedAt = new Date().toISOString();
    client.updatedAt = new Date().toISOString();
    await db.clients.put(client);

    await writeAuditLog({
      entityId: client.id,
      entityType: 'client',
      action: 'status_change',
      actor,
      details: `Archived client ${client.companyName}`,
      diff: {
        archivedAt: { before: null, after: client.archivedAt },
      },
    });
  });
};

export const unarchiveClient = async (clientId: string, actor: string): Promise<void> => {
  await db.transaction('rw', [db.clients, db.auditLogs], async () => {
    const client = await db.clients.get(clientId);
    if (!client) throw new Error('Client not found.');

    const previous = client.archivedAt;
    client.archivedAt = undefined;
    client.updatedAt = new Date().toISOString();
    await db.clients.put(client);

    await writeAuditLog({
      entityId: client.id,
      entityType: 'client',
      action: 'status_change',
      actor,
      details: `Restored client ${client.companyName}`,
      diff: {
        archivedAt: { before: previous, after: null },
      },
    });
  });
};
```

### 4.7 Organization Settings Service (`src/services/settingsService.ts`)
```typescript
import { db } from '@/db/database';
import type { OrganizationSettings } from '@/types';
import { writeAuditLog } from '@/services/auditService';

export const updateSettingsTransactional = async (
  newSettings: Omit<OrganizationSettings, 'id' | 'updatedAt'>,
  actor: string
): Promise<OrganizationSettings> => {
  if (!newSettings.invoicePrefix || !/^[A-Za-z0-9_-]+$/.test(newSettings.invoicePrefix)) {
    throw new Error('Invoice prefix must be non-empty and alphanumeric (dashes and underscores allowed).');
  }

  if (!Number.isInteger(newSettings.nextInvoiceSequence) || newSettings.nextInvoiceSequence <= 0) {
    throw new Error('Next invoice sequence must be a positive integer.');
  }

  return await db.transaction('rw', [db.settings, db.invoices, db.auditLogs], async () => {
    const existing = await db.settings.get('org');
    if (!existing) throw new Error('Settings not initialized.');

    const escapedPrefix = newSettings.invoicePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);

    const allInvoices = await db.invoices.toArray();
    const matched = allInvoices
      .map((inv) => {
        const match = inv.invoiceNumber.match(pattern);
        return match && match[1] ? Number(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const maxExisting = matched.length > 0 ? Math.max(...matched) : 0;
    if (newSettings.nextInvoiceSequence <= maxExisting) {
      throw new Error(`Next invoice sequence must exceed the highest existing sequence (${maxExisting}) for prefix "${newSettings.invoicePrefix}".`);
    }

    const updated: OrganizationSettings = {
      ...newSettings,
      id: 'org',
      updatedAt: new Date().toISOString(),
    };

    await db.settings.put(updated);
    await writeAuditLog({
      entityId: 'org',
      entityType: 'settings',
      action: 'update',
      actor,
      details: 'Updated organization profile and billing settings',
      diff: {
        invoicePrefix: { before: existing.invoicePrefix, after: updated.invoicePrefix },
        nextInvoiceSequence: { before: existing.nextInvoiceSequence, after: updated.nextInvoiceSequence },
      },
    });

    return updated;
  });
};
```

### 4.8 Status Reconciliation Service (`src/services/statusReconciliationService.ts`)
```typescript
import { db } from '@/db/database';
import { determineInvoiceStatus } from '@/utils/calculations';

export const reconcileInvoiceStatuses = async (): Promise<number> => {
  return await db.transaction('rw', db.invoices, async () => {
    const candidates = await db.invoices
      .where('status')
      .anyOf(['pending', 'partial'])
      .toArray();

    let updatedCount = 0;
    for (const inv of candidates) {
      const derived = determineInvoiceStatus(inv.dueDate, inv.totalAmountMinor, inv.amountPaidMinor, inv.status);
      if (derived !== inv.status) {
        inv.status = derived;
        inv.updatedAt = new Date().toISOString();
        await db.invoices.put(inv);
        updatedCount++;
      }
    }
    return updatedCount;
  });
};

export const startStatusReconciliationScheduler = (): (() => void) => {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      reconcileInvoiceStatuses().catch(() => {});
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  const intervalId = setInterval(() => {
    reconcileInvoiceStatuses().catch(() => {});
  }, 1000 * 60 * 60);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearInterval(intervalId);
  };
};
```

---

## 5. Reactive Hooks Layer (`dexie-react-hooks`)

### 5.1 Reactive Invoices Hook (`src/hooks/useInvoices.ts`)
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Invoice, InvoiceFilters } from '@/types';

export interface UseInvoicesResult {
  invoices: Invoice[];
  isLoading: boolean;
}

const EMPTY_INVOICES: Invoice[] = [];

export const useInvoices = (filters?: InvoiceFilters): UseInvoicesResult => {
  const statusesKey = filters?.statuses ? filters.statuses.slice().sort().join(',') : '';

  const result = useLiveQuery(
    async () => {
      const items = await db.invoices.orderBy('createdAt').reverse().toArray();

      if (!filters) return items;

      const query = filters.searchQuery ? filters.searchQuery.trim().toLowerCase() : '';
      const selectedStatuses = filters.statuses && filters.statuses.length > 0 ? new Set(filters.statuses) : null;

      return items.filter((inv) => {
        if (query) {
          const matchNumber = inv.invoiceNumber.toLowerCase().includes(query);
          const matchClient = inv.clientSnapshot.companyName.toLowerCase().includes(query);
          if (!matchNumber && !matchClient) return false;
        }

        if (selectedStatuses && !selectedStatuses.has(inv.status)) {
          return false;
        }

        if (filters.clientId && inv.clientId !== filters.clientId) {
          return false;
        }

        if (filters.startDate && inv.issueDate < filters.startDate) {
          return false;
        }

        if (filters.endDate && inv.issueDate > filters.endDate) {
          return false;
        }

        return true;
      });
    },
    [filters?.searchQuery, statusesKey, filters?.clientId, filters?.startDate, filters?.endDate]
  );

  return {
    invoices: result ?? EMPTY_INVOICES,
    isLoading: result === undefined,
  };
};
```

### 5.2 Reactive Invoice Detail Hook (`src/hooks/useInvoiceDetail.ts`)
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Invoice, PaymentRecord, AuditLog } from '@/types';

export interface UseInvoiceDetailResult {
  invoice: Invoice | undefined;
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  isLoading: boolean;
}

const EMPTY_PAYMENTS: PaymentRecord[] = [];
const EMPTY_AUDIT_LOGS: AuditLog[] = [];

export const useInvoiceDetail = (invoiceId: string | undefined): UseInvoiceDetailResult => {
  const result = useLiveQuery(
    async () => {
      if (!invoiceId) return null;
      const invoice = await db.invoices.get(invoiceId);
      if (!invoice) return null;

      const payments = await db.payments.where('invoiceId').equals(invoiceId).reverse().sortBy('paymentDate');
      const entityIds = [invoiceId, ...payments.map((p) => p.id)];
      const auditLogs = (await db.auditLogs.where('entityId').anyOf(entityIds).toArray())
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

      return { invoice, payments, auditLogs };
    },
    [invoiceId]
  );

  return {
    invoice: result?.invoice,
    payments: result?.payments ?? EMPTY_PAYMENTS,
    auditLogs: result?.auditLogs ?? EMPTY_AUDIT_LOGS,
    isLoading: result === undefined,
  };
};
```

### 5.3 Reactive Clients Hook (`src/hooks/useClients.ts`)
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Client } from '@/types';

export interface UseClientsResult {
  clients: Client[];
  isLoading: boolean;
}

const EMPTY_CLIENTS: Client[] = [];

export const useClients = (options?: { includeArchived?: boolean }): UseClientsResult => {
  const includeArchived = options?.includeArchived ?? false;

  const result = useLiveQuery(
    async () => {
      const allClients = await db.clients.orderBy('name').toArray();
      if (includeArchived) return allClients;
      return allClients.filter((c) => !c.archivedAt);
    },
    [includeArchived]
  );

  return {
    clients: result ?? EMPTY_CLIENTS,
    isLoading: result === undefined,
  };
};
```

### 5.4 Reactive Organization Settings Hook (`src/hooks/useOrganizationSettings.ts`)
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { OrganizationSettings } from '@/types';

export interface UseOrganizationSettingsResult {
  settings: OrganizationSettings | undefined;
  isLoading: boolean;
}

export const useOrganizationSettings = (): UseOrganizationSettingsResult => {
  const result = useLiveQuery(() => db.settings.get('org'));
  return {
    settings: result,
    isLoading: result === undefined,
  };
};
```

### 5.5 Responsive Breakpoints Hook (`src/hooks/useResponsiveBreakpoints.ts`)
```typescript
import { useSyncExternalStore, useMemo } from 'react';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isCoarsePointer: boolean;
}

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
const COARSE_QUERY = '(pointer: coarse)';

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const mqls = [
    window.matchMedia(MOBILE_QUERY),
    window.matchMedia(TABLET_QUERY),
    window.matchMedia(COARSE_QUERY),
  ];
  mqls.forEach((mql) => mql.addEventListener('change', callback));
  return () => mqls.forEach((mql) => mql.removeEventListener('change', callback));
};

const getSnapshot = (): string => {
  if (typeof window === 'undefined') {
    return 'desktop|0';
  }
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const isTablet = !isMobile && window.matchMedia(TABLET_QUERY).matches;
  const tier = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const coarse = window.matchMedia(COARSE_QUERY).matches ? '1' : '0';
  return `${tier}|${coarse}`;
};

const getServerSnapshot = (): string => 'desktop|0';

export const useResponsiveBreakpoints = (): ResponsiveState => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const [tier, coarse] = snapshot.split('|');
    return {
      isMobile: tier === 'mobile',
      isTablet: tier === 'tablet',
      isDesktop: tier === 'desktop',
      isCoarsePointer: coarse === '1',
    };
  }, [snapshot]);
};
```

---

## 6. PDF Auto-Gen Engine (`@react-pdf/renderer`)

### 6.1 Unified PDF Styles (`src/components/features/pdf/PDFStyles.ts`)
```typescript
import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    paddingBottom: 14,
    marginBottom: 18,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  companyMeta: {
    fontSize: 8.5,
    lineHeight: 1.3,
    color: '#334155',
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a8a',
    textAlign: 'right',
  },
  invoiceMetaText: {
    fontSize: 8.5,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2,
  },
  addressGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  addressCol: {
    width: '48%',
  },
  subHeading: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 4,
  },
  table: {
    width: '100%',
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  colDesc: { width: '40%' },
  colUnit: { width: '10%', textAlign: 'center' },
  colQty: { width: '10%', textAlign: 'right' },
  colRate: { width: '15%', textAlign: 'right' },
  colTax: { width: '10%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  headerColText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  rowText: {
    fontSize: 8.5,
    color: '#1e293b',
  },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBlock: {
    width: '48%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#0f172a',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    marginTop: 4,
    marginBottom: 4,
  },
  grandTotalText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  remittanceBlock: {
    marginTop: 'auto',
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 10,
  },
  remittanceTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 3,
  },
  remittanceText: {
    fontSize: 7.5,
    color: '#64748b',
    lineHeight: 1.3,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 36,
    fontSize: 7,
    color: '#94a3b8',
  },
});
```

### 6.2 Printable PDF Template (`src/components/features/pdf/PDFDocumentTemplate.tsx`)
```typescript
import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import type { Invoice } from '@/types';
import { pdfStyles } from '@/components/features/pdf/PDFStyles';
import { formatCurrency, formatDate } from '@/utils/formatters';

export interface PDFDocumentTemplateProps {
  invoice: Invoice;
}

export const PDFDocumentTemplate: React.FC<PDFDocumentTemplateProps> = ({ invoice }) => {
  const org = invoice.organizationSnapshot;
  const client = invoice.clientSnapshot;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerRow}>
          <View>
            <Text style={pdfStyles.companyName}>{org.companyName}</Text>
            <Text style={pdfStyles.companyMeta}>{org.companyAddress.street1}</Text>
            {Boolean(org.companyAddress.street2) ? (
              <Text style={pdfStyles.companyMeta}>{org.companyAddress.street2}</Text>
            ) : null}
            <Text style={pdfStyles.companyMeta}>
              {org.companyAddress.city}, {org.companyAddress.state} {org.companyAddress.postalCode}, {org.companyAddress.country}
            </Text>
            <Text style={pdfStyles.companyMeta}>{org.companyEmail} | {org.companyPhone}</Text>
            <Text style={pdfStyles.companyMeta}>Tax ID: {org.companyTaxId}</Text>
          </View>
          <View>
            <Text style={pdfStyles.invoiceTitle}>INVOICE</Text>
            <Text style={pdfStyles.invoiceMetaText}>Invoice #: {invoice.invoiceNumber}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Issue Date: {formatDate(invoice.issueDate)}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Due Date: {formatDate(invoice.dueDate)}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Status: {invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={pdfStyles.addressGrid}>
          <View style={pdfStyles.addressCol}>
            <Text style={pdfStyles.subHeading}>Billed To</Text>
            <Text style={[pdfStyles.rowText, { fontWeight: 'bold' }]}>{client.companyName}</Text>
            <Text style={pdfStyles.rowText}>Attn: {client.name}</Text>
            <Text style={pdfStyles.rowText}>{client.billingAddress.street1}</Text>
            {Boolean(client.billingAddress.street2) ? (
              <Text style={pdfStyles.rowText}>{client.billingAddress.street2}</Text>
            ) : null}
            <Text style={pdfStyles.rowText}>
              {client.billingAddress.city}, {client.billingAddress.state} {client.billingAddress.postalCode}
            </Text>
            <Text style={pdfStyles.rowText}>Tax ID: {client.taxId || 'N/A'}</Text>
          </View>
          <View style={pdfStyles.addressCol}>
            <Text style={pdfStyles.subHeading}>Payment Terms</Text>
            <Text style={pdfStyles.rowText}>Terms: Net {client.paymentTermsDays} Days</Text>
            <Text style={pdfStyles.rowText}>Currency: {invoice.currency}</Text>
          </View>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader} fixed>
            <Text style={[pdfStyles.colDesc, pdfStyles.headerColText]}>Description</Text>
            <Text style={[pdfStyles.colUnit, pdfStyles.headerColText]}>Unit</Text>
            <Text style={[pdfStyles.colQty, pdfStyles.headerColText]}>Qty</Text>
            <Text style={[pdfStyles.colRate, pdfStyles.headerColText]}>Rate</Text>
            <Text style={[pdfStyles.colTax, pdfStyles.headerColText]}>Tax</Text>
            <Text style={[pdfStyles.colTotal, pdfStyles.headerColText]}>Total</Text>
          </View>

          {invoice.items.map((item) => (
            <View style={pdfStyles.tableRow} key={item.id} wrap={false}>
              <Text style={[pdfStyles.colDesc, pdfStyles.rowText]}>{item.description}</Text>
              <Text style={[pdfStyles.colUnit, pdfStyles.rowText]}>{item.unit || 'unit'}</Text>
              <Text style={[pdfStyles.colQty, pdfStyles.rowText]}>{item.quantity}</Text>
              <Text style={[pdfStyles.colRate, pdfStyles.rowText]}>
                {formatCurrency(item.unitPriceMinor, invoice.currency)}
              </Text>
              <Text style={[pdfStyles.colTax, pdfStyles.rowText]}>{item.taxRate}%</Text>
              <Text style={[pdfStyles.colTotal, pdfStyles.rowText]}>
                {formatCurrency(item.totalMinor, invoice.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.totalsContainer} wrap={false}>
          <View style={pdfStyles.totalsBlock}>
            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.rowText}>Subtotal:</Text>
              <Text style={pdfStyles.rowText}>{formatCurrency(invoice.subtotalMinor, invoice.currency)}</Text>
            </View>
            {invoice.discountTotalMinor > 0 && (
              <View style={pdfStyles.totalsRow}>
                <Text style={pdfStyles.rowText}>Discount:</Text>
                <Text style={pdfStyles.rowText}>-{formatCurrency(invoice.discountTotalMinor, invoice.currency)}</Text>
              </View>
            )}
            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.rowText}>Tax:</Text>
              <Text style={pdfStyles.rowText}>{formatCurrency(invoice.taxTotalMinor, invoice.currency)}</Text>
            </View>
            <View style={pdfStyles.grandTotalRow}>
              <Text style={pdfStyles.grandTotalText}>Total Amount:</Text>
              <Text style={pdfStyles.grandTotalText}>{formatCurrency(invoice.totalAmountMinor, invoice.currency)}</Text>
            </View>
            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.rowText}>Amount Paid:</Text>
              <Text style={pdfStyles.rowText}>{formatCurrency(invoice.amountPaidMinor, invoice.currency)}</Text>
            </View>
            <View style={[pdfStyles.totalsRow, { borderTopWidth: 0.5, borderTopColor: '#cbd5e1', paddingTop: 2 }]}>
              <Text style={[pdfStyles.rowText, { fontWeight: 'bold' }]}>Balance Due:</Text>
              <Text style={[pdfStyles.rowText, { fontWeight: 'bold' }]}>
                {formatCurrency(invoice.balanceDueMinor, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.remittanceBlock} wrap={false}>
          <Text style={pdfStyles.remittanceTitle}>Remittance / Wire Details</Text>
          <Text style={pdfStyles.remittanceText}>
            Bank: {org.bankDetails.bankName} | Account Name: {org.bankDetails.accountName} | Account #: {org.bankDetails.accountNumber}
          </Text>
          {Boolean(org.bankDetails.routingNumber) ? (
            <Text style={pdfStyles.remittanceText}>Routing (ABA): {org.bankDetails.routingNumber}</Text>
          ) : null}
          {Boolean(org.bankDetails.swiftCode) ? (
            <Text style={pdfStyles.remittanceText}>SWIFT/BIC: {org.bankDetails.swiftCode}</Text>
          ) : null}
          {Boolean(org.bankDetails.iban) ? (
            <Text style={pdfStyles.remittanceText}>IBAN: {org.bankDetails.iban}</Text>
          ) : null}
          {Boolean(invoice.paymentInstructions) ? (
            <Text style={[pdfStyles.remittanceText, { marginTop: 3 }]}>Instructions: {invoice.paymentInstructions}</Text>
          ) : null}
          {Boolean(invoice.termsAndConditions) ? (
            <Text style={[pdfStyles.remittanceText, { marginTop: 2 }]}>Terms: {invoice.termsAndConditions}</Text>
          ) : null}
          {Boolean(invoice.notes) ? (
            <Text style={[pdfStyles.remittanceText, { marginTop: 2 }]}>Notes: {invoice.notes}</Text>
          ) : null}
        </View>

        <Text
          style={pdfStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};
```

---

## 7. Mobile-First Layout & Component Specs

### 7.1 Ant Design Theme & Entry Setup (`src/App.tsx`)
```typescript
import React, { useState, useEffect } from 'react';
import { ConfigProvider, App as AntdApp, Spin, Result } from 'antd';
import { RouterProvider } from 'react-router/dom';
import { router } from '@/router';
import { initializeDatabase } from '@/db/seed';
import { startStatusReconciliationScheduler } from '@/services/statusReconciliationService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export const App: React.FC = () => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setDbState('ready');
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize local IndexedDB');
        setDbState('error');
      });

    const stopScheduler = startStatusReconciliationScheduler();
    return () => stopScheduler();
  }, []);

  if (dbState === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (dbState === 'error') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Result
          status="error"
          title="Database Initialization Error"
          subTitle={errorMessage}
        />
      </div>
    );
  }

  const useTouchHeight = isMobile || isCoarsePointer;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1e3a8a',
          colorInfo: '#1e3a8a',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          borderRadius: 4,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          controlHeight: useTouchHeight ? 44 : 36,
          fontSize: useTouchHeight ? 16 : 14,
        },
      }}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
};
```

### 7.2 Mobile Navigation & Shell Pattern (`src/components/layout/ResponsiveShell.tsx`)
`ResponsiveShell` Contract:
- Signature: `ResponsiveShell: React.FC<{ children: React.ReactNode }>`.
- Renders `children` inside the content area.
- Never renders its own `<Outlet/>`.

Layout specifications:
1. **Desktop (`>= 1024px`):** Fixed left corporate sidebar (width: 240px), top utility bar, main content area.
2. **Tablet (`768px - 1023px`):** Collapsible top header with hamburger opening a side drawer navigation.
3. **Mobile (`360px - 767px`):**
   - No sidebar.
   - Fixed top header (height: 56px) displaying title and portal switcher.
   - Sticky bottom navigation bar with 4 core destinations (Invoices, Clients, Settings, Portal) styled with `env(safe-area-inset-bottom)` and minimum 44px tap targets.
   - Route-conditional visibility: Hide bottom navigation completely on `/invoices/new` and `/invoices/:id/edit` so it does not collide with the sticky financial summary sheet.
   - Root layout uses `height: 100dvh` with `overflow-x: clip; min-width: 0;` ensuring sticky headers remain functional without horizontal clipping.

### 7.3 Data Display: Responsive Table-to-Card Strategy
Ant Design `<Table>` is never rendered when `isMobile` is true:
- Desktop: Dense multi-column `<Table>` with sortable column headers.
- Mobile: Renders `<InvoiceCardList>` where each card includes:
  - Header: Invoice Number (truncated) + `StatusBadge`.
  - Body: Client company name, issue date, due date.
  - Footer: Amount paid, balance due in bold, and a 44px Action Dropdown button.

### 7.4 Line Item Mobile Card Editor
On mobile screens:
- Form state maintains human-entered major currency amounts (`InputNumber precision={CURRENCY_DECIMALS[currency]}`), converted to integer minor units via `toMinorUnits` upon payload creation.
- Line items render as stacked cards via Ant Design `Form.List` with `min-width: 0`:
  - Row 1: Description text field (full width).
  - Row 2 (Grid 2 cols): Quantity (`inputMode="decimal"`) | Unit.
  - Row 3 (Grid 2 cols): Unit Price in Major Units (`inputMode="decimal"`) | Tax Rate %.
  - Row 4 (Grid 2 cols): Discount Rate % | Calculated Item Total Preview.
  - Row 5: Full-width removal button with minimum 44px tap target.

---

## 8. Sequential 5-Phase Implementation Queue

### Phase 1: Types, Storage/API Client Config, and Base Utilities
- [ ] Task 1.1: Configure `package.json` with latest dependencies:
  - Dependencies: `react`, `react-dom`, `antd`, `@ant-design/icons`, `@react-pdf/renderer` (>= 4.1 for React 19 compatibility), `dexie`, `dexie-react-hooks`, `react-router`, `dayjs`.
  - Dev Dependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vitest`, `jsdom`, `fake-indexeddb`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`.
  - HTML Setup: Ensure `index.html` contains `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` and verify `antd/dist/reset.css` is not imported.
- [ ] Task 1.2: Set up `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` with `verbatimModuleSyntax: true`, `strict: true`, and `@/*` alias mapping.
- [ ] Task 1.3: Create `src/types/index.ts` containing domain models, minor unit constants, snapshots, diff structures, and filter interfaces.
- [ ] Task 1.4: Implement `src/utils/calculations.ts` incorporating minor unit math, rounding guarantees, ISO string local date derivations, and status transitions.
- [ ] Task 1.5: Implement `src/utils/formatters.ts` with minor unit `Intl.NumberFormat` currency displays, zero-padded invoice numbers, and date string formatters.
- [ ] Task 1.6: Implement `src/utils/id.ts` and `src/utils/validators.ts` for UUID generation (with non-secure LAN fallback) and data integrity assertions.
- [ ] Task 1.7: Write comprehensive unit and service test suites:
  - Unit tests in `src/utils/__tests__/calculations.test.ts`:
    - Verify minor unit conversion, rounding accuracy, and zero-decimal JPY handling.
    - Verify `determineInvoiceStatus` handles zero-total invoices, draft protections, and partial payments.
    - Use `vi.useFakeTimers()` to test `todayLocalISO()` across timezone offsets and verify overdue transitions across midnight boundaries.
  - Service tests in `src/services/__tests__/invoicing.test.ts` backed by `fake-indexeddb`:
    - Include `beforeEach` fixture that invokes `await db.delete(); await db.open();` and seeds default organization settings.
    - Verify concurrent `Promise.all` execution of 5 invoice creates produces 5 sequential, collision-free invoice numbers.
    - Verify recording full balance payment marks invoice as `paid`, and voiding that payment reverts status to `partial` or `pending`.
    - Verify recording payment against a draft or cancelled invoice throws a validation error.
    - Verify recording payment greater than `balanceDueMinor` throws validation error.
    - Verify archiving a client with unpaid invoices throws constraint error.
    - Verify updating an invoice with a stale `expectedVersion` throws an optimistic concurrency collision error.
- [ ] Gate: All phase deliverables must pass `tsc -b && vitest run` with 0 errors before proceeding. (`vi.useFakeTimers()` is strictly reserved for pure calculation tests in `calculations.test.ts` and never used inside `fake-indexeddb` service tests).

### Phase 2: Design Foundation & Atomic UI Primitives
- [ ] Task 2.1: Implement corporate stylesheet `src/styles/corporate-tokens.css` with CSS custom properties for slate/navy themes and safe-area adjustments (`env(safe-area-inset-bottom)`).
- [ ] Task 2.2: Implement `src/components/primitives/StatusBadge.tsx` handling `draft`, `pending`, `partial`, `paid`, `overdue`, `cancelled` with high-contrast text and border treatments.
- [ ] Task 2.3: Implement `src/components/primitives/CurrencyDisplay.tsx` accepting minor unit integers and currency code with fractional alignment.
- [ ] Task 2.4: Implement `src/components/primitives/MetricCard.tsx` with fixed 44px tap area, label, value, and trend indicators.
- [ ] Task 2.5: Implement `src/components/primitives/EmptyStateDisplay.tsx` using inline clean SVG icons for zero invoices/clients states with action buttons.
- [ ] Task 2.6: Implement `src/components/primitives/ResponsiveDateSelector.tsx` rendering Ant Design `DatePicker` on desktop and touch-friendly single picker on mobile.
- [ ] Gate: All phase deliverables must pass `tsc -b && vitest run` with 0 errors before proceeding.

### Phase 3: Compound Molecules & Feature Components
- [ ] Task 3.1: Build `src/components/molecules/InvoiceTableToolbar.tsx` with search input, multi-select status tag filters, and client filter.
- [ ] Task 3.2: Build `src/components/molecules/LineItemCardEditor.tsx` using `Form.List` with automatic recalculation via `Form.useWatch` and mobile 5-row responsive input grids.
- [ ] Task 3.3: Build `src/components/molecules/ClientSelectSearch.tsx` supporting client selection and quick-add modal.
- [ ] Task 3.4: Build `src/components/molecules/PaymentModal.tsx` validating payment amount minor units against invoice balance due and enforcing `amount <= balanceDue` and `paymentDate >= issueDate`.
- [ ] Task 3.5: Build `src/components/molecules/AuditTimeline.tsx` displaying chronological event history with actor names, actions, timestamps, and rendering `diff` entries formatted as `field: before -> after`.
- [ ] Task 3.6: Build `src/components/features/invoice/InvoiceSummaryCard.tsx` presenting subtotal, tax breakdown, discounts, amount paid, and net balance due.
- [ ] Gate: All phase deliverables must pass `tsc -b && vitest run` with 0 errors before proceeding.

### Phase 4: Domain Logic, Reactive State, and Specialized APIs
- [ ] Task 4.1: Implement `src/db/database.ts` with Dexie table schemas and compound indices (`&invoiceNumber`, `[clientId+status]`, `[status+dueDate]`).
- [ ] Task 4.2: Implement `src/db/seed.ts` with outer transaction wrapping and module singleton promise initialization.
- [ ] Task 4.3: Implement `src/services/invoiceService.ts` executing atomic transactions across settings, invoices, and audit logs for sequence generation, sentAt/paidAt state management, and optimistic locking.
- [ ] Task 4.4: Implement `src/services/paymentService.ts` executing atomic transactions for payments and invoice balance updates.
- [ ] Task 4.5: Implement `src/services/clientService.ts` and `src/services/auditService.ts`.
- [ ] Task 4.6: Implement reactive hooks `src/hooks/useInvoices.ts`, `src/hooks/useInvoiceDetail.ts`, `src/hooks/useClients.ts`, and `src/hooks/useOrganizationSettings.ts`.
- [ ] Task 4.7: Implement `src/components/features/pdf/PDFStyles.ts` and `src/components/features/pdf/PDFDocumentTemplate.tsx` with repeated table headers (`fixed`) and non-breaking rows (`wrap={false}`).
- [ ] Task 4.8: Implement `src/components/features/pdf/PDFPreviewModal.tsx` and `src/components/features/pdf/PDFDownloadButton.tsx` using `BlobProvider` with memoized document instances and mobile-safe fallbacks. Sanitize the client name in the PDF filename (strip `/\:*?"<>|` and collapse spaces), and call `logInvoiceEvent(..., 'pdf_download', ...)` on download.
- [ ] Task 4.9: Implement auxiliary transactional services, status scheduler, and portal token resolver:
  - `src/services/settingsService.ts` (`updateSettingsTransactional` with prefix regex escaping and sequence validation).
  - `src/services/statusReconciliationService.ts` (`reconcileInvoiceStatuses` and `startStatusReconciliationScheduler`).
  - Invoice lifecycle functions in `src/services/invoiceService.ts`: `markInvoiceSentTransactional`, `deleteDraftInvoice`, `duplicateInvoice`, `cancelInvoiceTransactional`, and `getInvoiceByPortalToken`.
  - Client state mutators in `src/services/clientService.ts`: `updateClient` and `unarchiveClient`.
  - Telemetry event recorder in `src/services/auditService.ts`: `logInvoiceEvent`.
- [ ] Gate: All phase deliverables must pass `tsc -b && vitest run` with 0 errors before proceeding.

### Phase 5: Complete Page/Screen Assembly & Responsive Shell
Requirement: Every file in `src/routes/` has a default export (`export default function ...`).

- [ ] Task 5.1: Build `src/components/layout/CorporateHeader.tsx`, `CorporateSidebar.tsx`, `MobileBottomNavigation.tsx`, and `ResponsiveShell.tsx` with dynamic breakpoint detection.
- [ ] Task 5.2: Build `src/routes/InvoicesRoute.tsx` with dashboard metrics, filter bar, desktop `<Table>` view, and mobile `<InvoiceCardList>` view. Never sum `*Minor` across currencies; group by `currency` and render one figure per currency.
- [ ] Task 5.3: Build `src/routes/InvoiceCreateEditRoute.tsx` with validation rules, split desktop layout, and stacked mobile flow with collapsible summary.
- [ ] Task 5.4: Build `src/routes/InvoiceDetailRoute.tsx` with status actions (mark sent, cancel, record payment, download PDF).
- [ ] Task 5.5: Build `src/routes/ClientsRoute.tsx` with client directory, invoice association counts, and statement drawer. In `ClientStatement`, never sum `*Minor` across currencies; group by `currency` and render one figure per currency.
- [ ] Task 5.6: Build `src/routes/ClientPortalRoute.tsx` providing a simulated portal view filtered by `portalToken` with PDF download access and session-deduped view event logging (a `useRef` guard, not per render).
- [ ] Task 5.7: Build `src/routes/SettingsRoute.tsx` for organization details, banking remittance info, and invoice sequence prefixing (submitting `nextInvoiceSequence` only when explicitly modified).
- [ ] Task 5.8: Mobile-first viewport audit across 360px, 390px, 430px, 768px, and 1024px+:
  - Verify zero horizontal scrolling across all screens with `overflow-x: clip`.
  - Verify touch tap target heights (>= 44px) and input font size (16px) preventing iOS zoom.
  - Verify strict prohibition of `size="small"` on mobile buttons, tags, pagination, and checkboxes.
  - Verify PDF generation: fallback to direct Blob download button on mobile devices (bypassing unsupported mobile iframe `<PDFViewer>`).
- [ ] Gate: All phase deliverables must pass `tsc -b && vitest run` with 0 errors before proceeding.

---

## 9. Verification & Integrity Checklist

- [ ] Every file in `src/routes/` has a default export (`export default function ...`).
- [ ] Metrics calculations and client statements group by `currency` and never sum amounts across differing currency codes.
- [ ] `ResponsiveShell` accepts `children` and never renders its own `<Outlet/>`.
- [ ] All monetary operations execute using integer minor units or currency precision lookups.
- [ ] All imports adhere to `import type` where appropriate to satisfy `verbatimModuleSyntax`.
- [ ] Navigation strictly switches between desktop sidebar, tablet drawer, and mobile bottom bar without layout overlap.
- [ ] Ant Design modal dialogues and notifications execute under `<App>` and `App.useApp()`.
- [ ] Line item editors render correctly on 360px viewports without horizontal clipping.
- [ ] Multi-page PDFs render clean page breaks with repeating table headers and guarded string expressions.
- [ ] No placeholder logic exists; all services utilize transactional Dexie operations.
- [ ] Timeline queries retrieve audit logs for both the invoice and all linked payments without silent omission.