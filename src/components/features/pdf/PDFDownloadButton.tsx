import React, { useCallback, useMemo } from 'react';
import { App, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { BlobProvider } from '@react-pdf/renderer';
import type { ButtonProps } from 'antd';
import type { Invoice } from '@/types';
import { PDFDocumentTemplate } from '@/components/features/pdf/PDFDocumentTemplate';
import { buildInvoiceFileName } from '@/components/features/pdf/PDFStyles';
import { logInvoiceEvent } from '@/services/auditService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

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
 * Direct-to-disk export.
 *
 * The document element is memoised on the invoice identity so an unrelated
 * re-render never re-runs the PDF layout pass, and the download is filed in the
 * audit trail as its own event. On touch devices this button is the *only*
 * export path — mobile browsers block the PDF.js iframe preview reliably.
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

  const documentNode = useMemo(() => <PDFDocumentTemplate invoice={invoice} />, [invoice]);
  const downloadFileName = useMemo(
    () => buildInvoiceFileName(invoice.invoiceNumber, invoice.clientSnapshot.companyName),
    [invoice.invoiceNumber, invoice.clientSnapshot.companyName]
  );

  const deliverDocument = useCallback(
    (blobUrl: string) => {
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = downloadFileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      void logInvoiceEvent(
        invoice.id,
        'pdf_download',
        actor,
        `Exported ${invoice.invoiceNumber} for ${invoice.clientSnapshot.companyName} as ${downloadFileName}`
      );
      onDownloaded?.();
    },
    [actor, downloadFileName, invoice.clientSnapshot.companyName, invoice.id, invoice.invoiceNumber, onDownloaded]
  );

  return (
    <BlobProvider document={documentNode}>
      {({ url, loading, error }) => {
        const failureMessage = error instanceof Error ? error.message : String(error);

        return (
          <Button
            type={buttonProps?.type ?? 'primary'}
            icon={buttonProps?.icon ?? <DownloadOutlined aria-hidden="true" />}
            block={block}
            loading={loading}
            disabled={Boolean(error) || !url}
            className={className}
            style={{ minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : undefined }}
            onClick={() => {
              if (!url) {
                message.error('The document is still being prepared. Try again in a moment.');
                return;
              }
              deliverDocument(url);
            }}
          >
            {error ? 'PDF unavailable' : label}
          </Button>
        );
      }}
    </BlobProvider>
  );
};
