import React, { useEffect, useMemo } from 'react';
import { Alert, Modal, Spin, Typography } from 'antd';
import { MobileOutlined } from '@ant-design/icons';
import { usePDF } from '@react-pdf/renderer';
import type { Invoice } from '@/types';
import { PDFDocumentTemplate } from '@/components/features/pdf/PDFDocumentTemplate';
import { PDFDownloadButton } from '@/components/features/pdf/PDFDownloadButton';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface PDFPreviewModalProps {
  open: boolean;
  invoice: Invoice;
  actor: string;
  onClose: () => void;
}

/**
 * On-screen preview.
 *
 * Desktop and tablet get an inline iframe of the generated blob; touch devices
 * get the direct file export instead. Mobile browsers gate or crash embedded
 * PDF viewers often enough that shipping a preview that silently fails on a
 * phone is worse than shipping none at all.
 *
 * State comes from the renderer's own `usePDF` hook rather than the `PDFViewer`
 * component: the hook exposes `loading` and `error`, which the component hides,
 * and driving it directly avoids running the document layout pass twice.
 */
export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ open, invoice, actor, onClose }) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;

  const documentNode = useMemo(() => <PDFDocumentTemplate invoice={invoice} />, [invoice]);
  const [renderState, updateRenderedDocument] = usePDF();

  useEffect(() => {
    if (!open) return;
    updateRenderedDocument(documentNode);
  }, [open, documentNode, updateRenderedDocument]);

  return (
    <Modal
      title={`Preview — ${invoice.invoiceNumber}`}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={prefersTouchInput ? '100%' : 900}
      styles={{ body: { padding: prefersTouchInput ? 16 : 0, height: '72vh' } }}
      footer={[
        <button
          key="close"
          type="button"
          onClick={onClose}
          style={{
            minHeight: 'var(--touch-target-min, 44px)',
            padding: '0 20px',
            borderRadius: 'var(--radius-md, 4px)',
            border: '1px solid var(--color-border-strong)',
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-main)',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Close
        </button>,
      ]}
    >
      {prefersTouchInput ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 8, minWidth: 0 }}>
          <Alert
            type="info"
            showIcon
            icon={<MobileOutlined aria-hidden="true" />}
            message="Inline preview is disabled on touch devices"
            description={
              <Typography.Paragraph style={{ margin: 0 }}>
                Mobile browsers restrict in-page PDF rendering. Download the document to open it in your
                usual PDF reader, then share or print it from there.
              </Typography.Paragraph>
            }
          />
          <PDFDownloadButton
            invoice={invoice}
            actor={actor}
            label="Download this invoice"
            block
            onDownloaded={onClose}
          />
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', minWidth: 0 }}>
          {renderState.error ? (
            <Alert
              type="error"
              showIcon
              message="This invoice could not be rendered"
              description={
                <Typography.Paragraph style={{ margin: 0 }}>{renderState.error}</Typography.Paragraph>
              }
              style={{ margin: 16 }}
            />
          ) : renderState.loading || !renderState.url ? (
            <div
              style={{
                display: 'flex',
                height: '100%',
                minHeight: 240,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <iframe
              title={`Preview of invoice ${invoice.invoiceNumber}`}
              src={`${renderState.url}#toolbar=1`}
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            />
          )}
        </div>
      )}
    </Modal>
  );
};
