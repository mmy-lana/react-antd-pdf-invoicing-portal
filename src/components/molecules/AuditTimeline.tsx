import React from 'react';
import { Timeline, Typography } from 'antd';
import type { AuditLog } from '@/types';
import { formatTimestamp } from '@/utils/formatters';

export interface AuditTimelineProps {
  entries: AuditLog[];
  emptyDescription?: string;
}

const ACTION_HEADLINE: Record<AuditLog['action'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  pdf_download: 'PDF downloaded',
  view: 'Viewed',
};

const ACTION_ACCENT: Record<AuditLog['action'], string> = {
  create: '#15803d',
  update: '#1d4ed8',
  delete: '#b91c1c',
  status_change: '#b45309',
  pdf_download: '#475569',
  view: '#64748b',
};

const ACTOR_LABEL: Record<string, string> = {
  'local-admin': 'Billing operator',
  'client-portal': 'Client portal',
};

const describeDiffOperand = (operand: unknown): string => {
  if (operand === null || operand === undefined || operand === '') return '—';
  if (typeof operand === 'boolean') return operand ? 'yes' : 'no';
  if (typeof operand === 'number') return String(operand);
  if (typeof operand === 'string') return operand;
  try {
    return JSON.stringify(operand);
  } catch {
    return String(operand);
  }
};

/**
 * Chronological ledger trail. Every recorded field change is shown as
 * `field: before -> after` so an auditor can reconstruct the write without
 * opening the database.
 */
export const AuditTimeline: React.FC<AuditTimelineProps> = ({ entries, emptyDescription }) => {
  if (entries.length === 0) {
    return (
      <Typography.Paragraph style={{ margin: 0, color: 'var(--color-text-muted)' }}>
        {emptyDescription ?? 'No activity has been recorded against this invoice yet.'}
      </Typography.Paragraph>
    );
  }

  return (
    <Timeline
      style={{ minWidth: 0 }}
      items={entries.map((entry) => {
        const changedFields = entry.diff ? Object.entries(entry.diff) : [];

        return {
          key: entry.id,
          color: ACTION_ACCENT[entry.action],
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px', minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{ACTION_HEADLINE[entry.action]}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {ACTOR_LABEL[entry.actor] ?? entry.actor}
                </span>
                <time
                  dateTime={entry.performedAt}
                  style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTimestamp(entry.performedAt)}
                </time>
              </div>

              <Typography.Paragraph style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {entry.details}
              </Typography.Paragraph>

              {changedFields.length > 0 ? (
                <ul
                  style={{
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    margin: 0,
                    padding: '6px 8px',
                    backgroundColor: 'var(--color-bg-sunken)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm, 3px)',
                    minWidth: 0,
                  }}
                >
                  {changedFields.map(([fieldName, change]) => (
                    <li
                      key={fieldName}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        lineHeight: 1.6,
                        color: 'var(--color-text-secondary)',
                        wordBreak: 'break-word',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{fieldName}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>: </span>
                      <span style={{ color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                        {describeDiffOperand(change.before)}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}> {'->'} </span>
                      <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
                        {describeDiffOperand(change.after)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ),
        };
      })}
    />
  );
};
