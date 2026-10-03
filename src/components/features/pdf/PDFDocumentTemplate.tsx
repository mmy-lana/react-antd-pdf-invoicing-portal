import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import type { Invoice } from '@/types';
import { buildInvoiceFileName, pdfStyles } from '@/components/features/pdf/PDFStyles';
import { isSafeImageDataUrl } from '@/utils/validators';
import { formatCurrency, formatDate, formatPercent, formatQuantity } from '@/utils/formatters';

export interface PDFDocumentTemplateProps {
  invoice: Invoice;
}

/** Optional text is dropped entirely rather than printing "undefined". */
const optionalText = (candidate: string | undefined): string | null => {
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Printable invoice. The line-item header repeats on every page and each row
 * refuses to split across a page break, so a multi-page invoice never leaves an
 * orphaned row or a header stranded at the foot of a page.
 */
export const PDFDocumentTemplate: React.FC<PDFDocumentTemplateProps> = ({ invoice }) => {
  const issuer = invoice.organizationSnapshot;
  const billed = invoice.clientSnapshot;

  /*
   * SEC-01: the logo is passed to a native layout engine that throws on a
   * truncated or mislabelled image and takes the whole document down with it. A
   * value that is not verified base64 PNG, JPEG or WebP carrying the matching
   * container signature is dropped, and the invoice prints without it.
   */
  const hasUsableLogo = isSafeImageDataUrl(issuer.companyLogoDataUrl);
  const logoSource = hasUsableLogo ? optionalText(issuer.companyLogoDataUrl) : null;

  const secondStreetLine = optionalText(issuer.companyAddress.street2);
  const billedSecondStreetLine = optionalText(billed.billingAddress.street2);
  const paymentInstructions = optionalText(invoice.paymentInstructions);
  const termsAndConditions = optionalText(invoice.termsAndConditions);
  const invoiceNotes = optionalText(invoice.notes);

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={issuer.companyName}
      subject={`Invoice for ${billed.companyName}`}
      creator={issuer.companyName}
      producer="Corporate Invoicing Portal"
      keywords={`invoice,${invoice.invoiceNumber},${billed.companyName}`}
    >
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerRow}>
          <View style={pdfStyles.headerIdentity}>
            {logoSource ? <Image style={pdfStyles.companyLogo} src={logoSource} /> : null}
            <Text style={pdfStyles.companyName}>{issuer.companyName}</Text>
            <Text style={pdfStyles.companyMeta}>{issuer.companyAddress.street1}</Text>
            {secondStreetLine ? <Text style={pdfStyles.companyMeta}>{secondStreetLine}</Text> : null}
            <Text style={pdfStyles.companyMeta}>
              {issuer.companyAddress.city}, {issuer.companyAddress.state} {issuer.companyAddress.postalCode}
            </Text>
            <Text style={pdfStyles.companyMeta}>{issuer.companyAddress.country}</Text>
            <Text style={pdfStyles.companyMeta}>
              {issuer.companyEmail} | {issuer.companyPhone}
            </Text>
            <Text style={pdfStyles.companyMeta}>Tax ID: {issuer.companyTaxId || 'N/A'}</Text>
          </View>

          <View style={pdfStyles.headerFacts}>
            <Text style={pdfStyles.invoiceTitle}>INVOICE</Text>
            <Text style={pdfStyles.invoiceMetaText}>Invoice # {invoice.invoiceNumber}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Issue date: {formatDate(invoice.issueDate)}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Due date: {formatDate(invoice.dueDate)}</Text>
            <Text style={pdfStyles.invoiceMetaText}>Status: {invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={pdfStyles.addressGrid}>
          <View style={pdfStyles.addressCol}>
            <Text style={pdfStyles.subHeading}>Billed to</Text>
            <Text style={pdfStyles.bodyTextStrong}>{billed.companyName}</Text>
            <Text style={pdfStyles.bodyText}>Attn: {billed.name}</Text>
            <Text style={pdfStyles.bodyText}>{billed.billingAddress.street1}</Text>
            {billedSecondStreetLine ? <Text style={pdfStyles.bodyText}>{billedSecondStreetLine}</Text> : null}
            <Text style={pdfStyles.bodyText}>
              {billed.billingAddress.city}, {billed.billingAddress.state} {billed.billingAddress.postalCode}
            </Text>
            <Text style={pdfStyles.bodyText}>{billed.billingAddress.country}</Text>
            <Text style={pdfStyles.bodyText}>Tax ID: {billed.taxId || 'N/A'}</Text>
            <Text style={pdfStyles.bodyText}>{billed.email}</Text>
          </View>

          <View style={pdfStyles.addressCol}>
            <Text style={pdfStyles.subHeading}>Terms</Text>
            <Text style={pdfStyles.bodyText}>Net {billed.paymentTermsDays} days</Text>
            <Text style={pdfStyles.bodyText}>Currency: {invoice.currency}</Text>
            <Text style={pdfStyles.bodyText}>Amounts exclude conversion.</Text>
          </View>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader} fixed>
            <Text style={[pdfStyles.columnDescription, pdfStyles.columnHeading]}>Description</Text>
            <Text style={[pdfStyles.columnUnit, pdfStyles.columnHeading]}>Unit</Text>
            <Text style={[pdfStyles.columnQuantity, pdfStyles.columnHeading]}>Qty</Text>
            <Text style={[pdfStyles.columnRate, pdfStyles.columnHeading]}>Rate</Text>
            <Text style={[pdfStyles.columnTax, pdfStyles.columnHeading]}>Tax</Text>
            <Text style={[pdfStyles.columnLineTotal, pdfStyles.columnHeading]}>Line total</Text>
          </View>

          {invoice.items.map((lineItem) => (
            <View style={pdfStyles.tableRow} key={lineItem.id} wrap={false}>
              <Text style={[pdfStyles.columnDescription, pdfStyles.cellText]}>{lineItem.description}</Text>
              <Text style={[pdfStyles.columnUnit, pdfStyles.cellText]}>{lineItem.unit || 'unit'}</Text>
              <Text style={[pdfStyles.columnQuantity, pdfStyles.cellTextRight]}>
                {formatQuantity(lineItem.quantity)}
              </Text>
              <Text style={[pdfStyles.columnRate, pdfStyles.cellTextRight]}>
                {formatCurrency(lineItem.unitPriceMinor, invoice.currency)}
              </Text>
              <Text style={[pdfStyles.columnTax, pdfStyles.cellTextRight]}>{formatPercent(lineItem.taxRate)}</Text>
              <Text style={[pdfStyles.columnLineTotal, pdfStyles.cellTextRight]}>
                {formatCurrency(lineItem.totalMinor, invoice.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.totalsWrapper} wrap={false}>
          <View style={pdfStyles.totalsBlock}>
            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.cellText}>Subtotal</Text>
              <Text style={pdfStyles.cellTextRight}>
                {formatCurrency(invoice.subtotalMinor, invoice.currency)}
              </Text>
            </View>

            {invoice.discountTotalMinor > 0 ? (
              <View style={pdfStyles.totalsRow}>
                <Text style={pdfStyles.cellText}>Discount</Text>
                <Text style={pdfStyles.cellTextRight}>
                  -{formatCurrency(invoice.discountTotalMinor, invoice.currency)}
                </Text>
              </View>
            ) : null}

            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.cellText}>Tax</Text>
              <Text style={pdfStyles.cellTextRight}>
                {formatCurrency(invoice.taxTotalMinor, invoice.currency)}
              </Text>
            </View>

            <View style={pdfStyles.grandTotalRow}>
              <Text style={pdfStyles.grandTotalText}>Total amount</Text>
              <Text style={pdfStyles.grandTotalText}>
                {formatCurrency(invoice.totalAmountMinor, invoice.currency)}
              </Text>
            </View>

            <View style={pdfStyles.totalsRow}>
              <Text style={pdfStyles.cellText}>Amount paid</Text>
              <Text style={pdfStyles.cellTextRight}>
                {formatCurrency(invoice.amountPaidMinor, invoice.currency)}
              </Text>
            </View>

            <View style={pdfStyles.balanceRow}>
              <Text style={pdfStyles.balanceText}>Balance due</Text>
              <Text style={pdfStyles.balanceText}>
                {formatCurrency(invoice.balanceDueMinor, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.remittanceBlock} wrap={false}>
          <Text style={pdfStyles.remittanceTitle}>Remittance details</Text>
          <Text style={pdfStyles.remittanceText}>
            Bank: {issuer.bankDetails.bankName || 'N/A'}
          </Text>
          <Text style={pdfStyles.remittanceText}>
            Account name: {issuer.bankDetails.accountName || 'N/A'}
          </Text>
          <Text style={pdfStyles.remittanceText}>
            Account number: {issuer.bankDetails.accountNumber || 'N/A'}
          </Text>
          {issuer.bankDetails.routingNumber ? (
            <Text style={pdfStyles.remittanceText}>Routing (ABA): {issuer.bankDetails.routingNumber}</Text>
          ) : null}
          {issuer.bankDetails.swiftCode ? (
            <Text style={pdfStyles.remittanceText}>SWIFT/BIC: {issuer.bankDetails.swiftCode}</Text>
          ) : null}
          {issuer.bankDetails.iban ? <Text style={pdfStyles.remittanceText}>IBAN: {issuer.bankDetails.iban}</Text> : null}

          {paymentInstructions ? (
            <Text style={[pdfStyles.remittanceText, { marginTop: 5 }]}>
              Instructions: {paymentInstructions}
            </Text>
          ) : null}
          {termsAndConditions ? (
            <Text style={[pdfStyles.remittanceText, { marginTop: 3 }]}>Terms: {termsAndConditions}</Text>
          ) : null}
          {invoiceNotes ? <Text style={[pdfStyles.remittanceText, { marginTop: 3 }]}>Notes: {invoiceNotes}</Text> : null}
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

export { buildInvoiceFileName };
