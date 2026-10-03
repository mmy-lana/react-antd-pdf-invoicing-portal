import React from 'react';
import { Button } from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusCircleOutlined,
  StopOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { Invoice } from '@/types';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface InvoiceActionsBarProps {
  invoice: Invoice;
  isBusy?: boolean;
  onEdit: () => void;
  onPreviewPdf: () => void;
  onDownloadPdf: () => void;
  onRecordPayment: () => void;
  onMarkSent: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  canEdit: boolean;
  canSettle: boolean;
  canSend: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
}

/**
 * Lifecycle actions for one invoice.
 *
 * Which actions exist is decided by the caller from invoice status and is
 * passed in as explicit capability flags, so the bar can never offer a write
 * the service would reject. Anything not permitted is omitted rather than
 * disabled, which keeps a phone screen uncluttered.
 */
export const InvoiceActionsBar: React.FC<InvoiceActionsBarProps> = ({
  invoice,
  isBusy = false,
  onEdit,
  onPreviewPdf,
  onDownloadPdf,
  onRecordPayment,
  onMarkSent,
  onCancel,
  onDelete,
  onDuplicate,
  canEdit,
  canSettle,
  canSend,
  canCancel,
  canDelete,
  canDuplicate,
}) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const controlHeight = prefersTouchInput ? 'var(--touch-target-min, 44px)' : 36;
  const isDraft = invoice.status === 'draft';

  return (
    <div
      role="group"
      aria-label={`Actions for invoice ${invoice.invoiceNumber}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        minWidth: 0,
      }}
    >
      <Button
        type="primary"
        icon={<DownloadOutlined aria-hidden="true" />}
        onClick={onDownloadPdf}
        loading={isBusy}
        style={{ minHeight: controlHeight }}
      >
        Download PDF
      </Button>

      {!prefersTouchInput ? (
        <Button
          icon={<EyeOutlined aria-hidden="true" />}
          onClick={onPreviewPdf}
          style={{ minHeight: controlHeight }}
        >
          Preview
        </Button>
      ) : null}

      {canSettle ? (
        <Button
          type="primary"
          ghost
          icon={<PlusCircleOutlined aria-hidden="true" />}
          onClick={onRecordPayment}
          style={{ minHeight: controlHeight }}
        >
          Record payment
        </Button>
      ) : null}

      {canEdit ? (
        <Button icon={<EditOutlined aria-hidden="true" />} onClick={onEdit} style={{ minHeight: controlHeight }}>
          Edit
        </Button>
      ) : null}

      {canSend ? (
        <Button
          icon={<CheckCircleOutlined aria-hidden="true" />}
          onClick={onMarkSent}
          style={{ minHeight: controlHeight }}
        >
          Mark as sent
        </Button>
      ) : null}

      {canDuplicate ? (
        <Button icon={<CopyOutlined aria-hidden="true" />} onClick={onDuplicate} style={{ minHeight: controlHeight }}>
          Duplicate
        </Button>
      ) : null}

      {canCancel ? (
        <Button
          danger
          icon={<StopOutlined aria-hidden="true" />}
          onClick={onCancel}
          disabled={isDraft}
          style={{ minHeight: controlHeight }}
        >
          Cancel invoice
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          danger
          icon={<DeleteOutlined aria-hidden="true" />}
          onClick={onDelete}
          style={{ minHeight: controlHeight }}
        >
          Delete draft
        </Button>
      ) : null}
    </div>
  );
};
