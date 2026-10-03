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
 * Registry for generated blob URLs (CODE-01).
 *
 * Revoking in the same tick as the anchor click can abort the transfer before
 * the browser has started reading the blob, so each URL is held for a grace
 * period and then released. Timers are tracked alongside their URLs so a flush
 * can cancel pending work instead of firing revocations for a document that is
 * already gone, and a failure part-way through rendering never leaves an
 * unregistered URL behind.
 */
const OBJECT_URL_GRACE_MS = 10_000;

interface TrackedObjectUrl {
  url: string;
  timer: number;
}

class ObjectUrlRegistry {
  private readonly tracked = new Map<string, TrackedObjectUrl>();

  register(url: string): void {
    if (this.tracked.has(url)) return;

    const timer = window.setTimeout(() => {
      this.release(url);
    }, OBJECT_URL_GRACE_MS);

    this.tracked.set(url, { url, timer });
  }

  release(url: string): void {
    const entry = this.tracked.get(url);
    if (!entry) return;

    window.clearTimeout(entry.timer);
    URL.revokeObjectURL(url);
    this.tracked.delete(url);
  }

  /** Releases everything immediately; used when the document is going away. */
  flush(): void {
    for (const url of [...this.tracked.keys()]) {
      this.release(url);
    }
  }

  get size(): number {
    return this.tracked.size;
  }
}

const blobUrlRegistry = new ObjectUrlRegistry();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => blobUrlRegistry.flush());
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

  // If the layout pass throws, no URL has been minted yet and there is nothing
  // to unwind; the caller clears its busy state in a finally block either way.
  const documentBlob = await pdf(<PDFDocumentTemplate invoice={invoice} />).toBlob();

  const objectUrl = URL.createObjectURL(documentBlob);
  blobUrlRegistry.register(objectUrl);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (dispatchFailure) {
    // The URL would otherwise sit registered until its grace period expired
    // even though nothing will ever read it.
    blobUrlRegistry.release(objectUrl);
    throw dispatchFailure;
  }

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
