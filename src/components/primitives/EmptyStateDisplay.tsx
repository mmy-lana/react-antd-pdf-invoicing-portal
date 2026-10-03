import React from 'react';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';

export type EmptyStateVariant = 'no-invoices' | 'no-clients' | 'no-matches' | 'load-failure';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface EmptyStateDisplayProps {
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Tightens vertical rhythm for use inside a drawer or card body. */
  compact?: boolean;
}

const ARTWORK_TINT: Record<EmptyStateVariant, string> = {
  'no-invoices': '#1e3a8a',
  'no-clients': '#0f766e',
  'no-matches': '#64748b',
  'load-failure': '#b91c1c',
};

/** Inline artwork keeps the empty states crisp at any density with no icon font. */
const EmptyStateArtwork: React.FC<{ variant: EmptyStateVariant }> = ({ variant }) => {
  const tint = ARTWORK_TINT[variant];

  if (variant === 'no-invoices') {
    return (
      <svg width="96" height="96" viewBox="0 0 96 96" role="presentation" focusable="false">
        <rect x="24" y="14" width="48" height="62" rx="4" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
        <path d="M34 34h28M34 44h28M34 54h18" stroke={tint} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        <circle cx="66" cy="66" r="15" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
        <path d="M60 66h12M66 60v12" stroke={tint} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === 'no-clients') {
    return (
      <svg width="96" height="96" viewBox="0 0 96 96" role="presentation" focusable="false">
        <circle cx="36" cy="32" r="14" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
        <path d="M14 78c0-12 10-20 22-20s22 8 22 20" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
        <rect x="54" y="26" width="28" height="24" rx="3" fill="#ffffff" stroke={tint} strokeWidth="2.5" opacity="0.6" />
        <path d="M60 58h16" stroke={tint} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </svg>
    );
  }

  if (variant === 'load-failure') {
    return (
      <svg width="96" height="96" viewBox="0 0 96 96" role="presentation" focusable="false">
        <circle cx="48" cy="48" r="28" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
        <path d="M48 32v20" stroke={tint} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="48" cy="60" r="2.5" fill={tint} />
      </svg>
    );
  }

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="presentation" focusable="false">
      <circle cx="42" cy="42" r="22" fill="#ffffff" stroke={tint} strokeWidth="2.5" />
      <path d="M58 58l18 18" stroke={tint} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M34 42h16" stroke={tint} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
};

/**
 * Terminal state for a collection: nothing issued, nobody on file, a filter that
 * excluded everything, or a read that failed. Each state offers the one action
 * that moves the operator forward.
 */
export const EmptyStateDisplay: React.FC<EmptyStateDisplayProps> = ({
  variant,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
}) => {
  const primaryButtonProps: ButtonProps | undefined = primaryAction
    ? {
        type: 'primary',
        icon: primaryAction.icon,
        onClick: primaryAction.onClick,
        style: { minHeight: 'var(--touch-target-min, 44px)', width: '100%' },
      }
    : undefined;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 4,
        padding: compact ? '20px 16px' : '40px 20px',
        width: '100%',
        maxWidth: 460,
        margin: '0 auto',
        minWidth: 0,
      }}
    >
      <EmptyStateArtwork variant={variant} />

      <h2
        style={{
          margin: '12px 0 0',
          fontSize: compact ? 15 : 17,
          fontWeight: 700,
          color: 'var(--color-text-main)',
        }}
      >
        {title}
      </h2>

      {description ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>{description}</p>
      ) : null}

      {primaryAction || secondaryAction ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16,
            width: '100%',
            minWidth: 0,
          }}
        >
          {primaryAction ? (
            <Button {...primaryButtonProps}>{primaryAction.label}</Button>
          ) : null}
          {secondaryAction ? (
            <Button
              onClick={secondaryAction.onClick}
              style={{ minHeight: 'var(--touch-target-min, 44px)', flex: '1 1 160px', minWidth: 0 }}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
