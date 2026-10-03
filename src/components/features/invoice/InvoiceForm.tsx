import React, { useRef, useState } from 'react';
import { App, Button, DatePicker, Form, Input, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { Client, CurrencyCode, Invoice, InvoiceItem } from '@/types';
import { CURRENCY_CODES } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { calculateInvoiceBreakdownMinor, fromMinorUnits, toMinorUnits } from '@/utils/calculations';
import { validateInvoiceDates, validateLineItems } from '@/utils/validators';
import { newId } from '@/utils/id';
import { createInvoiceTransactional, updateInvoiceTransactional } from '@/services/invoiceService';
import { ClientSelectSearch } from '@/components/molecules/ClientSelectSearch';
import { LineItemCardEditor, type LineItemEditorValues } from '@/components/molecules/LineItemCardEditor';
import { InvoiceSummaryCard } from '@/components/features/invoice/InvoiceSummaryCard';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface InvoiceFormProps {
  /** Present when editing; absent when drafting a new invoice. */
  invoice?: Invoice;
  clients: Client[];
  defaultCurrency: CurrencyCode;
  defaultTaxRate: number;
  onCompleted: (savedInvoiceId: string) => void;
  onCancelled: () => void;
}

interface InvoiceFormFields {
  clientId?: string;
  currency: CurrencyCode;
  issueDate: Dayjs;
  dueDate: Dayjs;
  notes?: string;
  paymentInstructions?: string;
  termsAndConditions?: string;
  items: LineItemEditorValues[];
}

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

/** Builds the persisted line item, converting the typed major amount to minor units. */
const toPersistedLineItem = (
  typedLine: LineItemEditorValues,
  currency: CurrencyCode,
  position: number
): InvoiceItem => ({
  id: newId('item'),
  sortOrder: position + 1,
  description: typedLine.description?.trim() ?? '',
  unit: typedLine.unit?.trim() || 'each',
  quantity: Number(typedLine.quantity ?? 0),
  unitPriceMinor: toMinorUnits(Number(typedLine.unitPrice ?? 0), currency),
  taxRate: Number(typedLine.taxRate ?? 0),
  discountRate: Number(typedLine.discountRate ?? 0),
  subtotalMinor: 0,
  taxAmountMinor: 0,
  discountAmountMinor: 0,
  totalMinor: 0,
});

/**
 * Create and edit surface for an invoice.
 *
 * The form never sends derived money: it sends quantity, rate and percentage,
 * and the transactional service re-derives every minor-unit figure. That keeps
 * a single authority for arithmetic regardless of which screen produced the
 * numbers.
 */
export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  clients,
  defaultCurrency,
  defaultTaxRate,
  onCompleted,
  onCancelled,
}) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const [invoiceForm] = Form.useForm<InvoiceFormFields>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailure, setSubmitFailure] = useState('');

  /*
   * FIN-01: a synchronous lock alongside the rendered `isSubmitting` state.
   * React state does not commit until the next render, so two clicks landing in
   * the same tick both observe `isSubmitting === false` and both start a write.
   * Because the ref is mutated immediately, the second caller is rejected before
   * it can allocate a second invoice number or send a second update.
   */
  const isSubmittingRef = useRef(false);

  const watchedCurrency = Form.useWatch<CurrencyCode>('currency', invoiceForm) ?? invoice?.currency ?? defaultCurrency;
  const watchedItems = Form.useWatch<LineItemEditorValues[]>('items', invoiceForm);

  /*
   * TYPE-01: `useWatch` returns undefined before the form is mounted and can
   * return a non-array if the field is ever reshaped. Both cases previously
   * reached `.map` and would throw while rendering rather than showing a zero
   * total, so the list is narrowed before it is used.
   */
  const watchedLineItems: readonly LineItemEditorValues[] = Array.isArray(watchedItems)
    ? watchedItems
    : Array.isArray(invoice?.items)
      ? invoice.items
      : [];

  const liveTotals = calculateInvoiceBreakdownMinor(
    watchedLineItems.map((typedLine, position) => toPersistedLineItem(typedLine, watchedCurrency, position)),
    invoice?.amountPaidMinor ?? 0
  );

  const initialValues: Partial<InvoiceFormFields> = invoice
    ? {
        clientId: invoice.clientId,
        currency: invoice.currency,
        issueDate: dayjs(invoice.issueDate, 'YYYY-MM-DD'),
        dueDate: dayjs(invoice.dueDate, 'YYYY-MM-DD'),
        notes: invoice.notes,
        paymentInstructions: invoice.paymentInstructions,
        termsAndConditions: invoice.termsAndConditions,
        items: invoice.items.map((lineItem) => ({
          description: lineItem.description,
          unit: lineItem.unit,
          quantity: lineItem.quantity,
          unitPrice: fromMinorUnits(lineItem.unitPriceMinor, invoice.currency),
          taxRate: lineItem.taxRate,
          discountRate: lineItem.discountRate,
        })),
      }
    : {
        currency: defaultCurrency,
        issueDate: dayjs(),
        dueDate: dayjs().add(30, 'day'),
        items: [{ description: '', unit: 'each', quantity: 1, unitPrice: 0, taxRate: defaultTaxRate, discountRate: 0 }],
      };

  const submitInvoice = async (targetStatus: 'draft' | 'pending'): Promise<void> => {
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitFailure('');

    try {
      let enteredFields: InvoiceFormFields;
      try {
        enteredFields = await invoiceForm.validateFields();
      } catch {
        return;
      }

      const issueDate = enteredFields.issueDate.format('YYYY-MM-DD');
      const dueDate = enteredFields.dueDate.format('YYYY-MM-DD');
      const dateCheck = validateInvoiceDates(issueDate, dueDate);
      if (!dateCheck.valid) throw new Error(dateCheck.message);

      // TYPE-01: the submitted list is narrowed the same way as the live preview.
      const submittedLineItems: LineItemEditorValues[] = Array.isArray(enteredFields.items) ? enteredFields.items : [];

      const persistedItems = submittedLineItems.map((typedLine, position) =>
        toPersistedLineItem(typedLine, enteredFields.currency, position)
      );
      const lineItemCheck = validateLineItems(persistedItems);
      if (!lineItemCheck.valid) throw new Error(lineItemCheck.message);

      if (!enteredFields.clientId) {
        throw new Error('Select the client being billed.');
      }

      const payload = {
        clientId: enteredFields.clientId,
        issueDate,
        dueDate,
        currency: enteredFields.currency,
        status: targetStatus,
        items: persistedItems,
        notes: enteredFields.notes,
        paymentInstructions: enteredFields.paymentInstructions,
        termsAndConditions: enteredFields.termsAndConditions,
      };

      const savedInvoice = invoice
        ? await updateInvoiceTransactional(invoice.id, payload, invoice.version, ACTOR_LOCAL_ADMIN)
        : await createInvoiceTransactional(payload, ACTOR_LOCAL_ADMIN);

      message.success(
        invoice
          ? `${savedInvoice.invoiceNumber} updated.`
          : targetStatus === 'draft'
            ? `${savedInvoice.invoiceNumber} saved as a draft.`
            : `${savedInvoice.invoiceNumber} issued.`
      );
      onCompleted(savedInvoice.id);
    } catch (saveError) {
      setSubmitFailure(saveError instanceof Error ? saveError.message : 'The invoice could not be saved.');
    } finally {
      // The lock is released on every exit path, including validation failure,
      // so a rejected submission cannot wedge the form.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Form<InvoiceFormFields>
      form={invoiceForm}
      layout="vertical"
      requiredMark
      initialValues={initialValues}
      style={{ minWidth: 0 }}
    >
      {submitFailure ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm, 3px)',
            backgroundColor: 'var(--color-status-overdue-wash)',
            color: 'var(--color-status-overdue)',
            fontWeight: 600,
          }}
        >
          {submitFailure}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: prefersTouchInput ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Form.Item
            name="clientId"
            label="Client"
            rules={[{ required: true, message: 'Select the client being billed.' }]}
            style={{ marginBottom: 12, minWidth: 0 }}
          >
            <ClientSelectSearch clients={clients} />
          </Form.Item>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              minWidth: 0,
            }}
          >
            <Form.Item
              name="issueDate"
              label="Issue date"
              rules={[{ required: true, message: 'Set the issue date.' }]}
              style={{ marginBottom: 12, minWidth: 0 }}
            >
              <DatePicker
                style={{ width: '100%', minWidth: 0 }}
                format="MMM DD, YYYY"
                needConfirm={false}
                allowClear={false}
              />
            </Form.Item>

            <Form.Item
              name="dueDate"
              label="Due date"
              dependencies={['issueDate']}
              rules={[
                { required: true, message: 'Set the due date.' },
                ({ getFieldValue }) => ({
                  validator: (_rule, chosenDate: Dayjs | null) => {
                    const issueDate = getFieldValue('issueDate') as Dayjs | undefined;
                    if (!chosenDate || !issueDate) return Promise.resolve();
                    if (chosenDate.isBefore(issueDate, 'day')) {
                      return Promise.reject(new Error('Due date cannot precede the issue date.'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
              style={{ marginBottom: 12, minWidth: 0 }}
            >
              <DatePicker
                style={{ width: '100%', minWidth: 0 }}
                format="MMM DD, YYYY"
                needConfirm={false}
                allowClear={false}
              />
            </Form.Item>

            <Form.Item name="currency" label="Currency" style={{ marginBottom: 12, minWidth: 0 }}>
              <Select options={CURRENCY_OPTIONS} disabled={Boolean(invoice && invoice.amountPaidMinor > 0)} />
            </Form.Item>
          </div>

          <h2
            style={{
              margin: '4px 0 8px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Line items
          </h2>

          <LineItemCardEditor currency={watchedCurrency} defaultTaxRate={defaultTaxRate} />

          <Form.Item name="notes" label="Notes" style={{ marginTop: 16, marginBottom: 12, minWidth: 0 }}>
            <Input.TextArea rows={2} placeholder="Visible on the issued document" inputMode="text" />
          </Form.Item>

          <Form.Item
            name="paymentInstructions"
            label="Payment instructions"
            style={{ marginBottom: 12, minWidth: 0 }}
          >
            <Input.TextArea rows={2} placeholder="Defaults to the organization profile" inputMode="text" />
          </Form.Item>

          <Form.Item name="termsAndConditions" label="Terms and conditions" style={{ marginBottom: 12, minWidth: 0 }}>
            <Input.TextArea rows={2} placeholder="Defaults to the organization profile" inputMode="text" />
          </Form.Item>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
            <Button
              type="primary"
              loading={isSubmitting}
              onClick={() => void submitInvoice('pending')}
              style={{ minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : 36, flex: '1 1 160px' }}
            >
              {invoice ? 'Save changes' : 'Issue invoice'}
            </Button>
            <Button
              loading={isSubmitting}
              onClick={() => void submitInvoice('draft')}
              style={{ minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : 36, flex: '1 1 140px' }}
            >
              Save as draft
            </Button>
            <Button onClick={onCancelled} style={{ minHeight: prefersTouchInput ? 'var(--touch-target-min, 44px)' : 36 }}>
              Cancel
            </Button>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <InvoiceSummaryCard
            totals={{
              currency: watchedCurrency,
              subtotalMinor: liveTotals.subtotalMinor,
              taxTotalMinor: liveTotals.taxTotalMinor,
              discountTotalMinor: liveTotals.discountTotalMinor,
              totalAmountMinor: liveTotals.totalAmountMinor,
              amountPaidMinor: invoice?.amountPaidMinor ?? 0,
              balanceDueMinor: liveTotals.balanceDueMinor,
            }}
            variant={prefersTouchInput ? 'sticky' : 'panel'}
            title="Live totals"
          />
        </div>
      </div>
    </Form>
  );
};
