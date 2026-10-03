import React from 'react';
import { Tag } from 'antd';
import type { InvoiceStatus } from '@/types';

export interface StatusPresentation {
  label: string;
  /** Filled background; each pairing clears 4.5:1 against white text. */
  solid: string;
  /** Tinted background for dense surfaces such as table rows and summary tiles. */
  wash: string;
}

export const INVOICE_STATUS_PRESENTATION: Record<InvoiceStatus, StatusPresentation> = {
  draft: { label: 'Draft', solid: '#475569', wash: '#f1f5f9' },
  pending: { label: 'Awaiting Payment', solid: '#b45309', wash: '#fef3c7' },
  partial: { label: 'Part Paid', solid: '#1d4ed8', wash: '#dbeafe' },
  paid: { label: 'Paid', solid: '#15803d', wash: '#dcfce7' },
  overdue: { label: 'Overdue', solid: '#b91c1c', wash: '#fee2e2' },
  cancelled: { label: 'Cancelled', solid: '#334155', wash: '#e2e8f0' },
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: INVOICE_STATUS_PRESENTATION.draft.label,
  pending: INVOICE_STATUS_PRESENTATION.pending.label,
  partial: INVOICE_STATUS_PRESENTATION.partial.label,
  paid: INVOICE_STATUS_PRESENTATION.paid.label,
  overdue: INVOICE_STATUS_PRESENTATION.overdue.label,
  cancelled: INVOICE_STATUS_PRESENTATION.cancelled.label,
};

export interface StatusBadgeProps {
  status: InvoiceStatus;
  variant?: 'solid' | 'wash';
  size?: 'compact' | 'regular';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = 'solid', size = 'regular', className }) => {
  const presentation = INVOICE_STATUS_PRESENTATION[status];
  const isSolid = variant === 'solid';

  return (
    <Tag
      className={className}
      title={`Invoice status: ${presentation.label}`}
      style={{
        marginInlineEnd: 0,
        backgroundColor: isSolid ? presentation.solid : presentation.wash,
        color: isSolid ? '#ffffff' : presentation.solid,
        borderColor: presentation.solid,
        borderWidth: 1,
        borderStyle: 'solid',
        fontWeight: 600,
        fontSize: size === 'compact' ? 11 : 12,
        lineHeight: size === 'compact' ? '18px' : '20px',
        paddingInline: size === 'compact' ? 6 : 8,
        borderRadius: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {presentation.label}
    </Tag>
  );
};
