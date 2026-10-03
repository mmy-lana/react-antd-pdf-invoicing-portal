import React from 'react';
import { Button, Collapse, Drawer, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface HelpGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface GuideEntry {
  heading: string;
  summary: string;
  detail: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
}

const OVERVIEW_PARAGRAPHS: readonly string[] = [
  'This console is a local-first enterprise billing system. Every invoice, client record, payment and audit entry lives entirely inside this browser, in a private IndexedDB database named CorporateInvoicingDB. Nothing is transmitted to an external server, and the application has no backend dependency to be unavailable.',
  'Because the ledger lives on this device, clearing site data, using private browsing, or moving to a different browser starts from an empty ledger. Export anything you need to retain before doing so.',
  'Monetary amounts are stored as integer minor units rather than floating point decimals, and every document freezes a snapshot of the client and issuer details as they stood at the moment of issue.',
];

const NAVIGATION_GUIDE: readonly GuideEntry[] = [
  {
    heading: 'Invoices',
    summary: 'The ledger: what has been issued, what is outstanding, and what is overdue.',
    detail:
      'Open an invoice to see its frozen parties, line items, settlement history and full audit trail. The ledger filters by free text, invoice status, client and issue-date range, and the metric tiles break out outstanding, overdue and settled balances. Issue new invoices from the editor, which reprices line items live, and download the auto-generated A4 PDF from any invoice or from the client statement.',
  },
  {
    heading: 'Clients',
    summary: 'The billing directory, its terms, and per-client account statements.',
    detail:
      'Maintain the billing contact, company, email, currency, payment terms and billing address for every client you invoice. A client may only be archived once every invoice raised against them is settled or cancelled, which prevents a receivable from becoming unreachable. The statement view rolls up outstanding and settled totals per client, keeping each currency in its own figure rather than blending them.',
  },
  {
    heading: 'Settings',
    summary: 'Issuer profile, remittance instructions and invoice numbering.',
    detail:
      'Configure the company legal profile, default currency, default payment terms and default tax rate. Enter the bank and remittance details that are printed on every issued invoice. Manage the invoice numbering prefix and next sequence: numbering is allocated inside the same transaction that issues the invoice, and the sequence may only move forward past the highest number already issued.',
  },
  {
    heading: 'Client Portal',
    summary: 'The read-only customer-facing view, reached through capability tokens.',
    detail:
      'Each issued invoice carries a unique unguessable capability token that opens a read-only customer view showing the amount due, the charges, any payments received, the remittance details and a PDF download. Draft and cancelled invoices are indistinguishable from an invalid token, so the portal cannot be used to discover whether an invoice exists. The link is shareable with the client; it grants viewing rights only and never allows editing.',
  },
];

const QUESTIONS_AND_ANSWERS: readonly QuestionAnswer[] = [
  {
    question: 'Where are invoice and client data stored?',
    answer:
      'All records exist in your browser private IndexedDB database, CorporateInvoicingDB. Nothing leaves this device. Clearing browser site data deletes the ledger permanently, so export anything you need to keep before clearing it.',
  },
  {
    question: 'How does automatic PDF generation work?',
    answer:
      'PDFs are generated client-side using @react-pdf/renderer with exact A4 print styles and remittance slips. The document repeats its column header on every page, keeps each line row intact across page breaks, and is written to disk straight from the browser. On touch devices the direct file download is used instead of an inline preview, because mobile browsers restrict embedded PDF viewers.',
  },
  {
    question: 'Can an issued invoice number be reused or deleted?',
    answer:
      'Drafts can be deleted, but their numbering sequence is permanently retired to ensure audit compliance, so the sequence stays gapless for an auditor. Issued invoices can only be cancelled: the document remains on file with its number, and the cancellation reason is written to the audit trail. A number that has ever been issued is never issued again.',
  },
  {
    question: 'How do payment settlements affect status?',
    answer:
      'Recording a payment shifts status from pending to part paid, or to paid once the balance is cleared in full. Voiding a payment restores the outstanding balance automatically and re-derives the status from what genuinely remains settled. Overpayment is refused outright rather than creating a customer credit that downstream tax handling would have to unwind.',
  },
];

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2
    style={{
      margin: '0 0 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--color-text-muted)',
    }}
  >
    {children}
  </h2>
);

/**
 * In-app operating manual.
 *
 * Every answer here is also maintained in USER_GUIDE.md at the repository root.
 * Keeping the same four questions in both places means an operator without the
 * repository can still resolve the common cases from inside the product.
 */
export const HelpGuideDrawer: React.FC<HelpGuideDrawerProps> = ({ open, onClose }) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;

  return (
    <Drawer
      title="System Guide & Mini Q&A"
      placement={prefersTouchInput ? 'bottom' : 'right'}
      height={prefersTouchInput ? '92dvh' : undefined}
      width={prefersTouchInput ? undefined : 520}
      open={open}
      onClose={onClose}
      destroyOnHidden
      styles={{ body: { minWidth: 0 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
        <section aria-labelledby="guide-overview-heading">
          <SectionHeading>
            <span id="guide-overview-heading">Overview</span>
          </SectionHeading>
          {OVERVIEW_PARAGRAPHS.map((paragraph) => (
            <Typography.Paragraph
              key={paragraph.slice(0, 32)}
              style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}
            >
              {paragraph}
            </Typography.Paragraph>
          ))}
        </section>

        <section aria-labelledby="guide-navigation-heading">
          <SectionHeading>
            <span id="guide-navigation-heading">Navigation Guide</span>
          </SectionHeading>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            {NAVIGATION_GUIDE.map((entry) => (
              <li
                key={entry.heading}
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-bg-sunken)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm, 3px)',
                  minWidth: 0,
                }}
              >
                <h3 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>{entry.heading}</h3>
                <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {entry.summary}
                </p>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                  {entry.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="guide-qa-heading">
          <SectionHeading>
            <span id="guide-qa-heading">Mini Q&amp;A</span>
          </SectionHeading>
          <Collapse
            ghost
            size={isMobile ? 'middle' : 'small'}
            items={QUESTIONS_AND_ANSWERS.map((entry) => ({
              key: entry.question,
              label: (
                <span style={{ fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <QuestionCircleOutlined aria-hidden="true" style={{ color: 'var(--color-primary)', flex: '0 0 auto' }} />
                  <span style={{ minWidth: 0 }}>{entry.question}</span>
                </span>
              ),
              children: (
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                  {entry.answer}
                </p>
              ),
            }))}
          />
        </section>

        <Button block onClick={onClose} style={{ minHeight: 'var(--touch-target-min, 44px)' }}>
          Close guide
        </Button>
      </div>
    </Drawer>
  );
};
