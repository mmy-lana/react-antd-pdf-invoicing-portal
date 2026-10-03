import React from 'react';
import { Button, Form, Input, InputNumber } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { CurrencyCode } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { calculateItemTotalsMinor, toMinorUnits } from '@/utils/calculations';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface LineItemEditorValues {
  description?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  discountRate?: number;
}

export interface LineItemCardEditorProps {
  /** Form field path holding the list of line items. */
  fieldName?: string;
  currency: CurrencyCode;
  defaultTaxRate?: number;
  disabled?: boolean;
}

export const emptyLineItem = (defaultTaxRate: number): LineItemEditorValues => ({
  description: '',
  unit: 'each',
  quantity: 1,
  unitPrice: 0,
  taxRate: defaultTaxRate,
  discountRate: 0,
});

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
  gap: 8,
  minWidth: 0,
};

/**
 * One billable line. Extracted into its own component because `Form.useWatch`
 * is a hook and `Form.List`'s children callback is not a component boundary.
 */
const LineItemCard: React.FC<{
  ordinal: number;
  fieldName: string;
  position: number;
  currency: CurrencyCode;
  disabled: boolean;
  onRemove: () => void;
}> = ({ ordinal, fieldName, position, currency, disabled, onRemove }) => {
  const minorUnitDigits = CURRENCY_DECIMALS[currency];
  const watchedQuantity = Form.useWatch<number>([fieldName, position, 'quantity'], Form.useFormInstance());
  const watchedUnitPrice = Form.useWatch<number>([fieldName, position, 'unitPrice'], Form.useFormInstance());
  const watchedTaxRate = Form.useWatch<number>([fieldName, position, 'taxRate'], Form.useFormInstance());
  const watchedDiscountRate = Form.useWatch<number>([fieldName, position, 'discountRate'], Form.useFormInstance());

  const derivedTotals = calculateItemTotalsMinor(
    Number(watchedQuantity ?? 0),
    toMinorUnits(Number(watchedUnitPrice ?? 0), currency),
    Number(watchedTaxRate ?? 0),
    Number(watchedDiscountRate ?? 0)
  );

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Line {ordinal}
        </span>
        <CurrencyDisplay amountMinor={derivedTotals.totalMinor} currency={currency} tone="strong" />
      </div>

      <Form.Item
        name={[position, 'description']}
        label="Description"
        rules={[{ required: true, whitespace: true, message: 'Describe the work being billed.' }]}
        style={{ marginBottom: 0, minWidth: 0 }}
      >
        <Input placeholder="Systems architecture audit" disabled={disabled} inputMode="text" />
      </Form.Item>

      <div style={fieldGridStyle}>
        <Form.Item
          name={[position, 'quantity']}
          label="Quantity"
          rules={[{ required: true, message: 'Enter a quantity.' }]}
          style={{ marginBottom: 0, minWidth: 0 }}
        >
          <InputNumber
            min={0}
            step={1}
            inputMode="decimal"
            disabled={disabled}
            style={{ width: '100%', minWidth: 0 }}
            placeholder="0"
          />
        </Form.Item>

        <Form.Item name={[position, 'unit']} label="Unit" style={{ marginBottom: 0, minWidth: 0 }}>
          <Input placeholder="hours" disabled={disabled} inputMode="text" />
        </Form.Item>

        <Form.Item
          name={[position, 'unitPrice']}
          label={`Unit price (${currency})`}
          rules={[{ required: true, message: 'Enter a unit price.' }]}
          style={{ marginBottom: 0, minWidth: 0 }}
        >
          <InputNumber
            min={0}
            step={1 / Math.pow(10, minorUnitDigits)}
            precision={minorUnitDigits}
            inputMode="decimal"
            disabled={disabled}
            style={{ width: '100%', minWidth: 0 }}
            placeholder="0.00"
          />
        </Form.Item>

        <Form.Item
          name={[position, 'taxRate']}
          label="Tax rate %"
          rules={[{ required: true, message: 'Enter a tax rate.' }]}
          style={{ marginBottom: 0, minWidth: 0 }}
        >
          <InputNumber
            min={0}
            max={100}
            step={0.001}
            inputMode="decimal"
            disabled={disabled}
            style={{ width: '100%', minWidth: 0 }}
            placeholder="0"
          />
        </Form.Item>

        <Form.Item
          name={[position, 'discountRate']}
          label="Discount %"
          rules={[{ required: true, message: 'Enter a discount rate.' }]}
          style={{ marginBottom: 0, minWidth: 0 }}
        >
          <InputNumber
            min={0}
            max={100}
            step={0.5}
            inputMode="decimal"
            disabled={disabled}
            style={{ width: '100%', minWidth: 0 }}
            placeholder="0"
          />
        </Form.Item>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 2,
            padding: '4px 8px',
            backgroundColor: 'var(--color-bg-sunken)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-sm, 3px)',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Line total</span>
          <CurrencyDisplay amountMinor={derivedTotals.totalMinor} currency={currency} tone="strong" />
          {derivedTotals.discountAmountMinor > 0 ? (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              after{' '}
              <CurrencyDisplay
                amountMinor={derivedTotals.discountAmountMinor}
                currency={currency}
                tone="positive"
              />{' '}
              discount
            </span>
          ) : null}
        </div>
      </div>

      <Button
        danger
        block
        icon={<DeleteOutlined aria-hidden="true" />}
        onClick={onRemove}
        disabled={disabled}
        style={{ minHeight: 'var(--touch-target-min, 44px)' }}
      >
        Remove line
      </Button>
    </li>
  );
};

/**
 * Stacked line-item editor. Inputs hold major-unit decimals typed by a human and
 * are converted to integer minor units only when the invoice payload is built;
 * the running preview reuses the same engine, so what the operator sees always
 * matches what will be stored.
 */
export const LineItemCardEditor: React.FC<LineItemCardEditorProps> = ({
  fieldName = 'items',
  currency,
  defaultTaxRate = 0,
  disabled = false,
}) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;

  return (
    <Form.List name={fieldName}>
      {(lineItems, { add, remove }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {lineItems.map((lineItemField, position) => (
              <LineItemCard
                key={String(lineItemField.key ?? position)}
                ordinal={position + 1}
                fieldName={fieldName}
                position={position}
                currency={currency}
                disabled={disabled}
                onRemove={() => remove(position)}
              />
            ))}
          </ul>

          <Button
            type="dashed"
            block
            icon={<PlusOutlined aria-hidden="true" />}
            onClick={() => add(emptyLineItem(defaultTaxRate))}
            disabled={disabled}
            style={{
              minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : 36,
              fontWeight: 600,
            }}
          >
            Add line item
          </Button>
        </div>
      )}
    </Form.List>
  );
};
