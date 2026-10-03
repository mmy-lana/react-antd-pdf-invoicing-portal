import React, { useMemo, useState } from 'react';
import { App, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { pdf } from '@react-pdf/renderer';
import type { ButtonProps } from 'antd';
import type { Invoice } from '@/types';
import { PDFDocumentTemplate } from '@/components/features/pdf/PDFDocumentTemplate';
import { buildInvoiceFileName } from '@/components/features/pdf/PDFStyles';
import { logInvoiceEvent } from '@/services/auditService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

/**
 * Blob URLs stay alive for a grace period after the click.
 *
 * Revoking synchronously in the same tick can abort the transfer before the
 * browser has started reading the blob. Ten seconds comfortably covers the
 * hand-off, and anything still outstanding is released when the document goes
 * away, so a long session cannot accumulate them.
 */
const OBJECT_URL_GRACE_MS = 10_000;
const liveObjectUrls = new Set<string>();

const releaseObjectUrl = (objectUrl: string): void => {
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    liveObjectUrls.delete(objectUrl);
  }, OBJECT_URL_GRACE_MS);
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const objectUrl of liveObjectUrls) URL.revokeObjectURL(objectUrl);
    liveObjectUrls.clear();
  });
}

export interface InvoicePdfExportOutcome {
  fileName: string;
}

/**
 * Renders the invoice and hands the bytes to the browser as a file download.
 *
 * Every export funnels through here — list actions, detail actions and the
 * client statement — so a download always uses the sanitised filename and is
 * always filed in the audit trail, no matter which surface triggered it.
 */
export const downloadInvoicePdf = async (invoice: Invoice, actor: string): Promise<InvoicePdfExportOutcome> => {
  const fileName = buildInvoiceFileName(invoice.invoiceNumber, invoice.clientSnapshot.companyName);

  const documentBlob = await pdf(<PDFDocumentTemplate invoice={invoice} />).toBlob();
  const objectUrl = URL.createObjectURL(documentBlob);
  liveObjectUrls.add(objectUrl);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  releaseObjectUrl(objectUrl);

  await logInvoiceEvent(
    invoice.id,
    'pdf_download',
    actor,
    `Exported ${invoice.invoiceNumber} for ${invoice.clientSnapshot.companyName} as ${fileName}`
  );

  return { fileName };
};

export interface PDFDownloadButtonProps {
  invoice: Invoice;
  actor: string;
  label?: string;
  block?: boolean;
  className?: string;
  onDownloaded?: () => void;
  buttonProps?: Pick<ButtonProps, 'type' | 'size' | 'icon'>;
}

/**
 * Direct-to-disk export control. On touch devices this is the *only* export
 * path, because mobile browsers block the embedded PDF preview reliably.
 */
export const PDFDownloadButton: React.FC<PDFDownloadButtonProps> = ({
  invoice,
  actor,
  label = 'Download PDF',
  block = false,
  className,
  onDownloaded,
  buttonProps,
}) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const [isRendering, setIsRendering] = useState(false);

  const accessibleLabel = useMemo(() => `Download ${invoice.invoiceNumber} as PDF`, [invoice.invoiceNumber]);

  const runExport = async (): Promise<void> => {
    setIsRendering(true);
    try {
      await downloadInvoicePdf(invoice, actor);
      message.success(`${invoice.invoiceNumber} downloaded.`);
      onDownloaded?.();
    } catch (exportError) {
      message.error(exportError instanceof Error ? exportError.message : 'The PDF could not be generated.');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <Button
      type={buttonProps?.type ?? 'primary'}
      icon={buttonProps?.icon ?? <DownloadOutlined aria-hidden="true" />}
      aria-label={accessibleLabel}
      block={block}
      loading={isRendering}
      className={className}
      style={{ minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : undefined }}
      onClick={() => void runExport()}
    >
      {label}
    </Button>
  );
};
