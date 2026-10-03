import React from 'react';
import { Button, Input, Select, Space, Tag, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { Client, InvoiceFilters, InvoiceStatus } from '@/types';
import { INVOICE_STATUSES } from '@/types';
import { INVOICE_STATUS_LABELS } from '@/components/primitives/StatusBadge';
import { ResponsiveDateSelector } from '@/components/primitives/ResponsiveDateSelector';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface InvoiceTableToolbarProps {
  filters: InvoiceFilters;
  onFiltersChange: (nextFilters: InvoiceFilters) => void;
  clients: Client[];
  matchedCount: number;
  totalCount: number;
  onCreateInvoice: () => void;
}

const ALL_CLIENT_SENTINEL = '__all-clients__';

/**
 * Filter surface for the invoice ledger. Holds no data of its own: every change
 * is lifted to the owning route so the same query drives the desktop table and
 * the mobile card list from one source of truth.
 */
export const InvoiceTableToolbar: React.FC<InvoiceTableToolbarProps> = ({
  filters,
  onFiltersChange,
  clients,
  matchedCount,
  totalCount,
  onCreateInvoice,
}) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const controlHeight = prefersTouchInput ? 'var(--touch-target-min, 44px)' : 32;

  const selectedStatuses = filters.statuses ?? [];
  const isFiltered =
    filters.searchQuery.trim().length > 0 ||
    selectedStatuses.length > 0 ||
    Boolean(filters.clientId) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const patchFilters = (patch: Partial<InvoiceFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  const toggleStatus = (status: InvoiceStatus): void => {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((chosen) => chosen !== status)
      : [...selectedStatuses, status];
    patchFilters({ statuses: nextStatuses });
  };

  const resetFilters = (): void => {
    onFiltersChange({ searchQuery: '', statuses: [] });
  };

  const handleStartDateChange = (chosenDate: Dayjs | null): void => {
    patchFilters({ startDate: chosenDate ? chosenDate.format('YYYY-MM-DD') : undefined });
  };

  const handleEndDateChange = (chosenDate: Dayjs | null): void => {
    patchFilters({ endDate: chosenDate ? chosenDate.format('YYYY-MM-DD') : undefined });
  };

  const latestStartDate = filters.endDate ? dayjs(filters.endDate, 'YYYY-MM-DD') : undefined;
  const earliestEndDate = filters.startDate ? dayjs(filters.startDate, 'YYYY-MM-DD') : undefined;

  return (
    <section
      aria-label="Invoice filters"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <Input
          allowClear
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="Search invoice number or client"
          aria-label="Search invoices"
          value={filters.searchQuery}
          onChange={(changeEvent) => patchFilters({ searchQuery: changeEvent.target.value })}
          style={{ flex: '1 1 220px', minWidth: 0, minHeight: controlHeight }}
        />

        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          aria-label="Filter by client"
          placeholder="All clients"
          value={filters.clientId ?? undefined}
          onChange={(chosenClientId) => patchFilters({ clientId: chosenClientId ?? undefined })}
          options={[
            { value: ALL_CLIENT_SENTINEL, label: 'All clients', disabled: true },
            ...clients.map((client) => ({ value: client.id, label: client.companyName })),
          ]}
          style={{ flex: '1 1 180px', minWidth: 0, minHeight: controlHeight }}
        />

        <Button
          type="primary"
          icon={<PlusOutlined aria-hidden="true" />}
          onClick={onCreateInvoice}
          style={{ minHeight: controlHeight, flex: '0 0 auto' }}
        >
          New Invoice
        </Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <Space size={[6, 6]} wrap>
          {INVOICE_STATUSES.map((status) => (
            <Tag.CheckableTag
              key={status}
              checked={selectedStatuses.includes(status)}
              onChange={() => toggleStatus(status)}
              style={{
                minHeight: controlHeight,
                display: 'inline-flex',
                alignItems: 'center',
                paddingInline: 10,
                border: '1px solid var(--color-border-strong)',
                borderRadius: 3,
                userSelect: 'none',
              }}
            >
              {INVOICE_STATUS_LABELS[status]}
            </Tag.CheckableTag>
          ))}
        </Space>

        {isFiltered ? (
          <Button
            icon={<ClearOutlined aria-hidden="true" />}
            onClick={resetFilters}
            style={{ minHeight: controlHeight }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <Typography.Text style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 68 }}>
          Issued from
        </Typography.Text>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <ResponsiveDateSelector
            value={filters.startDate ? dayjs(filters.startDate, 'YYYY-MM-DD') : null}
            onChange={handleStartDateChange}
            placeholder="Start date"
            latestDate={latestStartDate}
          />
        </div>

        <Typography.Text style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 60 }}>Issued to</Typography.Text>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <ResponsiveDateSelector
            value={filters.endDate ? dayjs(filters.endDate, 'YYYY-MM-DD') : null}
            onChange={handleEndDateChange}
            placeholder="End date"
            earliestDate={earliestEndDate}
          />
        </div>
      </div>

      <Typography.Text
        aria-live="polite"
        style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}
      >
        {isFiltered
          ? `${matchedCount} of ${totalCount} invoice${totalCount === 1 ? '' : 's'} match the current filters`
          : `${totalCount} invoice${totalCount === 1 ? '' : 's'} on file`}
      </Typography.Text>
    </section>
  );
};
