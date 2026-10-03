# Corporate Invoicing & Client Portal

A local-first enterprise billing console and client portal with automated PDF generation. Built with React, Ant Design, Dexie.js (IndexedDB), and `@react-pdf/renderer`.

- **Repository**: [https://github.com/mmy-lana/react-antd-pdf-invoicing-portal](https://github.com/mmy-lana/react-antd-pdf-invoicing-portal)
- **Live Demo**: [https://react-antd-pdf-invoicing-portal.vercel.app](https://react-antd-pdf-invoicing-portal.vercel.app)

---

## Overview

This application serves as an offline-first enterprise ledger and billing management system. All customer records, invoices, payment settlements, and audit logs are persisted directly in the browser using IndexedDB (`CorporateInvoicingDB`). The application requires no external backend server to operate and produces print-ready A4 PDF documents entirely on the client side.

---

## Core Capabilities

- **Zero-Drift Minor-Unit Arithmetic**: All financial calculations are executed using integer minor units (cents, pence, yen) to eliminate floating-point rounding errors across multiple currencies (USD, EUR, GBP, CAD, AUD, SGD, JPY).
- **Client-Side PDF Auto-Generation**: Generates formal corporate A4 invoices using `@react-pdf/renderer`. Features repeating table headers across pages, non-breaking line item rows, remittance slips, and byte-level validation of embedded base64 issuer logos.
- **Transactional State & Audit Logs**: State transitions across numbering sequencing, client archiving, invoice issuance, and payment settlements are wrapped in atomic Dexie transactions. Every change produces a structured `field: before -> after` diff entry in the audit trail.
- **Optimistic Concurrency Control**: Invoice modifications track an incremental `version` counter to prevent concurrent edits from overwriting newer records.
- **Client Portal Simulation**: Issued invoices feature unique, unguessable capability tokens providing a read-only customer view with breakdown charges, settlement status, and immediate PDF download. Drafts and cancelled invoices are inaccessible via portal tokens.
- **Mobile-First Responsive Ergonomics**: Built with strict viewport constraints for 360px, 390px, 430px, 768px, and 1024px+ screens:
  - Minimum 44x44px touch targets on all interactive controls (WCAG 2.5.5).
  - Explicit 16px input font scaling to prevent automatic iOS Safari viewport zoom.
  - Automatic table-to-card layout switching on narrow mobile screens.
  - Collapsible sticky summary sheet on mobile invoice creation.
- **Automated Verification Harness**: Includes a dependency-free Chrome DevTools Protocol (CDP) test script (`scripts/verify-headless.mjs`) that audits layout overflow, tap target heights, input font sizes, and PDF blob generation across five viewport tiers.

---

## Technology Stack

- **Framework**: React (latest)
- **Language**: TypeScript (Strict Mode, `verbatimModuleSyntax`)
- **UI Components**: Ant Design (`antd`), `@ant-design/icons`
- **PDF Generation**: `@react-pdf/renderer`
- **Local Database**: Dexie.js with `dexie-react-hooks` (IndexedDB)
- **Routing**: React Router (`react-router`) with HashRouter for static hosting
- **Date Handling**: Day.js
- **Build Tool**: Vite
- **Test Runner**: Vitest with `jsdom` and `fake-indexeddb`
- **Package Manager**: pnpm

---

## Directory Structure

```
react-antd-pdf-invoicing-portal/
├── scripts/
│   ├── cdp-client.mjs                # Zero-dependency CDP WebSocket client
│   └── verify-headless.mjs           # Multi-viewport headless Chrome test harness
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx         # Root React error boundary
│   │   ├── features/
│   │   │   ├── client/               # Client table, card list, drawer form, statement
│   │   │   ├── invoice/              # Invoice table, card list, editor, summary card
│   │   │   ├── pdf/                  # PDFDocumentTemplate, download button, preview modal
│   │   │   └── settings/             # Company profile, bank details, sequencing forms
│   │   ├── layout/                   # ResponsiveShell, header, sidebar, mobile bottom nav
│   │   ├── molecules/                # Toolbar, line item editor, payment modal, timeline, guide
│   │   └── primitives/               # StatusBadge, CurrencyDisplay, MetricCard, EmptyStateDisplay
│   ├── db/
│   │   ├── database.ts               # Dexie database class with migration versions
│   │   └── seed.ts                   # Initial enterprise dataset and settings bootstrap
│   ├── hooks/                        # Reactive Dexie live queries and responsive breakpoints
│   ├── routes/                       # Ledger, editor, detail, clients, portal, settings
│   ├── services/                     # Transactional business logic (invoice, payment, client, audit)
│   ├── styles/                       # Design tokens and corporate palette
│   ├── types/                        # Pure domain models and snapshot interfaces
│   └── utils/                        # Currency calculations, formatters, ID generator, validators
├── USER_GUIDE.md                     # Detailed operational manual and system Q&A
├── package.json
└── vite.config.ts
```

---

## System Invariants & Financial Integrity

The system enforces the following non-negotiable business rules at the service layer:

1. **Immutable Invoicing Snapshots**: Issued invoices freeze a copy of both the client details and issuer bank settings at the moment of issue. Changes to the client directory or settings never alter historical invoices.
2. **Gapless Sequence Retirement**: Deleting a draft permanently retires its sequence number to satisfy corporate tax audit standards. Issued numbers are never recycled.
3. **Settlement Bounds**: Payments exceeding the remaining invoice balance are rejected outright. Payments cannot be dated prior to invoice issuance.
4. **Lifecycle Protection**:
   - Invoices marked `draft` cannot accept payments.
   - Invoices marked `paid` or `cancelled` cannot be edited.
   - An invoice total cannot be edited to an amount below what has already been settled.
   - Clients with unpaid or active invoices cannot be archived.
5. **Database-Level Unique Constraints**: Client email uniqueness is enforced via Dexie schema indexes (`&email`), preventing race condition duplicates.

---

## Getting Started

### Prerequisites

- Node.js >= 20.19.0 or >= 22.0.0
- pnpm (Strictly required; do not use npm or yarn)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/mmy-lana/react-antd-pdf-invoicing-portal.git
cd react-antd-pdf-invoicing-portal
pnpm install
```

### Development Server

Start the Vite development server:

```bash
pnpm dev
```

Open your browser and navigate to `http://localhost:5173`.

### Production Build

Type-check and build the optimized production bundle:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

---

## Testing & Quality Verification

### Unit & Integration Tests

Run the Vitest test suite covering financial calculations, calendar arithmetic, and transactional IndexedDB operations via `fake-indexeddb`:

```bash
pnpm test
```

### Headless Browser Verification

Run the end-to-end verification harness against an isolated, headless Google Chrome instance:

```bash
pnpm run build
pnpm run preview --port 4319 &
pnpm run verify
```

The script evaluates:
- Zero horizontal layout overflow across 360px, 390px, 430px, 768px, and 1440px viewports.
- Compliance with the 44px minimum touch target size on interactive mobile controls.
- Validation that mobile form inputs maintain a minimum 16px font size to prevent iOS Safari auto-zoom.
- End-to-end ledger navigation, client portal simulation, and binary `%PDF-` file export validation.

---

## Documentation

For a detailed user walkthrough, navigation manual, invoice lifecycle state machine diagrams, and troubleshooting guidelines, refer to [USER_GUIDE.md](./USER_GUIDE.md) or access the in-app guide via the **Guide & Q&A** button in the top navigation header.

---

## License

This project is licensed under the MIT License.
