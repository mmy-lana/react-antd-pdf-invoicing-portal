import { StyleSheet } from '@react-pdf/renderer';

/**
 * Print stylesheet for the A4 invoice document.
 *
 * The renderer supports a deliberately small subset of CSS: no `gap`, no
 * shorthand `border`, no flexbox `gap`. Spacing is therefore expressed with
 * margins and paddings only, and every border is written longhand.
 */
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
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
  headerIdentity: {
    width: '58%',
  },
  headerFacts: {
    width: '38%',
    alignItems: 'flex-end',
  },
  companyLogo: {
    width: 132,
    maxHeight: 44,
    objectFit: 'contain',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  companyMeta: {
    fontSize: 8.5,
    lineHeight: 1.35,
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
    marginTop: 3,
  },

  addressGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  addressCol: {
    width: '47%',
  },
  subHeading: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 5,
  },
  bodyText: {
    fontSize: 8.5,
    lineHeight: 1.4,
    color: '#1e293b',
  },
  bodyTextStrong: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0f172a',
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
    alignItems: 'flex-start',
  },
  columnDescription: { width: '38%' },
  columnUnit: { width: '10%', textAlign: 'center' },
  columnQuantity: { width: '9%', textAlign: 'right' },
  columnRate: { width: '15%', textAlign: 'right' },
  columnTax: { width: '11%', textAlign: 'right' },
  columnLineTotal: { width: '17%', textAlign: 'right' },
  columnHeading: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 8.5,
    color: '#1e293b',
  },
  cellTextRight: {
    fontSize: 8.5,
    color: '#1e293b',
    textAlign: 'right',
  },

  totalsWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBlock: {
    width: '46%',
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
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
  },
  balanceText: {
    fontSize: 9.5,
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
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  remittanceText: {
    fontSize: 7.5,
    color: '#64748b',
    lineHeight: 1.4,
  },

  pageNumber: {
    position: 'absolute',
    bottom: 18,
    right: 36,
    left: 36,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'right',
  },
});

/** Strips path separators and shell-hostile characters out of a download name. */
export const sanitizePdfFileNameSegment = (rawSegment: string): string =>
  rawSegment
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Client and invoice name can contain characters a filesystem or browser will
 * reject. Sanitising here means the download attribute is always safe.
 */
export const buildInvoiceFileName = (invoiceNumber: string, clientCompanyName: string): string => {
  const safeInvoiceNumber = sanitizePdfFileNameSegment(invoiceNumber) || 'invoice';
  const safeClientName = sanitizePdfFileNameSegment(clientCompanyName) || 'client';
  return `${safeInvoiceNumber}_${safeClientName}.pdf`;
};
