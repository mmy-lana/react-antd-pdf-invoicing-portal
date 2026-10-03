import React from 'react';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import type { CurrencyCode } from '@/types';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';

export interface MetricCardFigure {
  currency: CurrencyCode;
  amountMinor: number;
}

export interface MetricCardTrend {
  direction: 'up' | 'down' | 'flat';
  label: string;
}

export type MetricCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export interface MetricCardProps {
  label: string;
  /** One entry per currency. Figures are never added across currency codes. */
  figures: MetricCardFigure[];
  trend?: MetricCardTrend;
  tone?: MetricCardTone;
  hint?: string;
  onClick?: () => void;
  className?: string;
}

const TONE_ACCENT: Record<MetricCardTone, string> = {
  neutral: 'var(--color-primary)',
  positive: 'var(--color-status-paid)',
  warning: 'var(--color-status-pending)',
  critical: 'var(--color-status-overdue)',
};

const TREND_COLOR: Record<MetricCardTrend['direction'], string> = {
  up: 'var(--color-status-paid)',
  down: 'var(--color-status-overdue)',
  flat: 'var(--color-text-muted)',
};

/**
 * Headline figure tile. The whole tile is the hit target, never just the
 * numerals, and it always clears the 44px comfortable minimum so a dashboard
 * row stays tappable on a phone.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  figures,
  trend,
  tone = 'neutral',
  hint,
  onClick,
  className,
}) => {
  const isInteractive = typeof onClick === 'function';

  const tileContent = (
    <>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          insetBlockStart: 0,
          insetBlockEnd: 0,
          width: 3,
          backgroundColor: TONE_ACCENT[tone],
          borderRadius: '3px 0 0 3px',
        }}
      />
      <span style={{ display: 'block', minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>

        <span
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '2px 12px',
            marginTop: 6,
            minWidth: 0,
          }}
        >
          {figures.length === 0 ? (
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>No activity yet</span>
          ) : (
            figures.map((figure) => (
              <CurrencyDisplay
                key={figure.currency}
                amountMinor={figure.amountMinor}
                currency={figure.currency}
                tone="strong"
                size="large"
              />
            ))
          )}
        </span>

        {trend ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              fontSize: 12,
              fontWeight: 600,
              color: TREND_COLOR[trend.direction],
            }}
          >
            {trend.direction === 'up' ? <ArrowUpOutlined aria-hidden="true" /> : null}
            {trend.direction === 'down' ? <ArrowDownOutlined aria-hidden="true" /> : null}
            {trend.direction === 'flat' ? <MinusOutlined aria-hidden="true" /> : null}
            {trend.label}
          </span>
        ) : null}

        {hint ? (
          <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>{hint}</span>
        ) : null}
      </span>
    </>
  );

  const tileStyle: React.CSSProperties = {
    position: 'relative',
    display: 'block',
    width: '100%',
    minHeight: 'var(--touch-target-min, 44px)',
    padding: '14px 16px 14px 18px',
    textAlign: 'start',
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 4px)',
    boxShadow: 'var(--shadow-card)',
    minWidth: 0,
    font: 'inherit',
    color: 'inherit',
  };

  if (!isInteractive) {
    return (
      <div className={className} style={tileStyle}>
        {tileContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ ...tileStyle, cursor: 'pointer' }}
      onClick={onClick}
    >
      {tileContent}
    </button>
  );
};
