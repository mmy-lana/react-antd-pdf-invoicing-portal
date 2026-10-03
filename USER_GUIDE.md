# User Guide: Corporate Invoicing & Client Portal

Operational guide for the local-first enterprise billing console. The same content
is available in-app from the **Guide & Q&A** button in the application header.

---

## 1. Overview

This is a local-first enterprise billing console. Every invoice, client record,
payment and audit entry lives entirely inside your browser, in a private IndexedDB
database named `CorporateInvoicingDB`. Nothing is transmitted to an external
server, and there is no backend dependency that can be unavailable.

Two consequences follow from that design and are worth stating plainly:

- **Clearing browser site data deletes the ledger permanently.** Use a different
  browser, a different device, or a private window and you will start from an
  empty ledger. Retain anything you need before clearing site data.
- **The ledger is per-device.** There is no synchronisation between browsers.

Money is stored as integer minor units rather than floating point decimals, so no
rounding drift accumulates. Every issued document freezes a snapshot of the client
and issuer details as they stood at the moment of issue, so correcting a client
record later never rewrites a document that has already gone out.

---

## 2. Navigation Guide

### 2.1 Invoices

The invoice ledger: what has been issued, what is outstanding, and what is overdue.

- **Metric tiles** break out outstanding, overdue and settled balances, plus a
  draft count. Each currency is reported as its own figure; totals are never
  blended across currency codes.
- **Filters** combine free text (invoice number, company or billing contact),
  invoice status, a single client, and an issue-date range. The toolbar reports
  how many invoices matched.
- **Opening an invoice** shows the frozen parties, line items, settlement
  history, the balance summary, the client portal link, and the full audit trail.
- **Issuing a new invoice** uses a split layout on desktop and a stacked flow on
  mobile, with line items repriced live as you type. Save as draft to hold work
  in progress, or issue immediately.
- **PDF download** produces an A4 document from any invoice, from a ledger row
  action, or from the client statement.

### 2.2 Clients

The billing directory, its terms, and per-client account statements.

- Maintain the billing contact, company, accounts email, tax ID, currency,
  payment terms and billing address for every client you invoice.
- The directory switches between Active and Archived, and carries invoice
  association counts plus outstanding balances.
- **Archiving is gated on settlement.** A client may only be archived once every
  invoice raised against them is settled or cancelled. This prevents a receivable
  from becoming unreachable because the billing party left the directory. Archived
  clients can be restored at any time.
- **The statement** rolls up invoiced, settled and outstanding totals for one
  client, lists their invoice history, and offers a PDF copy of each document.
  As elsewhere, each currency is reported separately.

### 2.3 Settings

Issuer profile, remittance instructions and invoice numbering.

- **Issuer profile**: company legal name, billing email, phone, tax ID, address,
  default currency, default payment terms and default tax rate. These values are
  printed on future issues only.
- **Remittance details**: bank name, account name and number, plus optional
  routing (ABA), SWIFT/BIC and IBAN, together with the default payment
  instructions and terms and conditions printed on issued invoices.
- **Invoice numbering**: the prefix and the next sequence number. Numbering is
  allocated inside the same transaction that issues the invoice, so two operators
  saving at the same instant cannot be handed the same number. The next sequence
  is only submitted when you explicitly change it, and it must always exceed the
  highest number already issued under the prefix in use.

### 2.4 Client Portal

The read-only customer-facing view, reached through capability tokens.

- Each issued invoice carries a unique, unguessable capability token that opens a
  read-only customer view showing the amount due, the charges, any payments
  received, the remittance details, and a PDF download.
- The link is shareable with the client. It grants viewing rights only and never
  allows editing.
- **Draft and cancelled invoices are indistinguishable from an invalid token.** The
  portal cannot be used to discover whether an invoice exists, so a token cannot
  be probed for validity by watching for different error screens.
- Reach the portal from the **View as the client** action on an invoice, or from
  the **Portal** entry in the mobile bottom navigation.

---

## 3. Mini Q&A

### Q: Where are invoice and client data stored?

All records exist in your browser's private IndexedDB (`CorporateInvoicingDB`).
Clearing browser site data deletes the ledger.

### Q: How does automatic PDF generation work?

PDFs are generated client-side using `@react-pdf/renderer` with exact A4 print
styles and remittance slips. The column header repeats on every page and each line
row refuses to split across a page break, so a multi-page invoice never strands a
row. Downloads are written straight from the browser; on touch devices the direct
file download is used instead of an inline preview, because mobile browsers
restrict embedded PDF viewers.

### Q: Can an issued invoice number be reused or deleted?

Drafts can be deleted, but their numbering sequence is permanently retired to
ensure audit compliance, keeping the sequence gapless for an auditor. Issued
invoices can only be cancelled: the document stays on file with its number, and
the cancellation reason is written to the audit trail. A number that has ever been
issued is never issued again.

### Q: How do payment settlements affect status?

Recording a payment shifts status from pending to part paid, or to paid once the
balance clears in full. Voiding a payment restores the outstanding balance
automatically and re-derives the status from what genuinely remains settled.
Overpayment is refused outright rather than creating a customer credit that
downstream tax handling would have to unwind.

---

## 4. Invoice Lifecycle

```
draft ──(mark as sent)──> pending ──(partial payment)──> part paid
                             │                              │
                             │                    (balance cleared)
                             │                              ▼
                             └──────────────────────────> paid

pending / part paid ──(due date passes, unpaid)──> overdue

any live invoice ──(cancel with reason)──> cancelled   (terminal, number retained)
```

- **Draft** is the only author-controlled state. It can be edited or deleted.
- **Pending**, **part paid** and **overdue** are derived from the settlement and
  the calendar. A reconciliation sweep re-derives them hourly and whenever the tab
  regains focus, so an invoice left untouched overnight stops showing as pending
  after its due date.
- **Paid** and **cancelled** are terminal.

---

## 5. Invariants the System Enforces

These are not conventions; each is a guard that rejects a write:

| Invariant | Where it is enforced |
| --- | --- |
| All money is integer minor units | `src/utils/calculations.ts` |
| Tax is charged on the discounted line value | `calculateItemTotalsMinor` |
| Tax and discount rates are clamped to 0-100 | `calculateItemTotalsMinor` |
| Invoice numbers are allocated inside the issuing transaction | `createInvoiceTransactional` |
| A number that has been issued is never issued again | `deleteDraftInvoice` retires the sequence |
| A stale concurrent edit is rejected | `updateInvoiceTransactional` version check |
| An invoice cannot be reduced below what is already settled | `updateInvoiceTransactional` |
| Overpayment is refused | `recordPaymentTransactional` |
| Payments cannot be back-dated before issue | `validatePaymentAllocation` |
| Drafts and cancelled invoices cannot take payment | `recordPaymentTransactional` |
| A client with outstanding invoices cannot be archived | `archiveClient` |
| A client email is unique in the directory | Dexie unique index plus `createClient` |
| Drafts and cancelled invoices are invisible to the portal | `getInvoiceByPortalToken` |
| PDF filenames are sanitised of path and shell characters | `buildInvoiceFileName` |
| Only validated base64 image data reaches the PDF renderer | `PDFDocumentTemplate` |

---

## 6. Troubleshooting

**An invoice shows as overdue before its due date.**
Status is derived in the operator's own timezone. If the device clock or timezone
is wrong, the ledger will follow it. Check the system date and timezone.

**A save reports "Concurrent modification detected".**
Another session, tab or device profile already saved that invoice. Open the
invoice again to load the current version, review the differences, then reapply
your edit.

**The PDF will not generate.**
The invoice's issuer logo is only rendered if it is valid base64 PNG, JPEG or
WebP. A corrupted or unsupported image is omitted from the document rather than
failing the export. If generation still fails, download from a different invoice to
isolate whether the problem is data-specific.

**The guide button is not visible.**
It lives in the application header. On narrow viewports the label shortens to
"Guide"; the accessible name remains "Open the system guide and frequently asked
questions".

**An unexpected error screen appeared.**
The console is wrapped in an error boundary. Use the recovery action on that
screen to reload; the ledger is committed transactionally, so a failure to render
never leaves a partially written invoice behind.
