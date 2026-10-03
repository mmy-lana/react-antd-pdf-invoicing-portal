import React, { useEffect, useState } from 'react';
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { Invoice, PaymentMethod } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { CURRENCY_DECIMALS } from '@/types';
import { fromMinorUnits, toMinorUnits } from '@/utils/calculations';
import { formatDate } from '@/utils/formatters';
import { validatePaymentAllocation } from '@/utils/validators';
import { recordPaymentTransactional } from '@/services/paymentService';
import { CurrencyDisplay } from '@/components/primitives/CurrencyDisplay';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface PaymentModalProps {
  open: boolean;
  invoice: Invoice;
  onClose: () => void;
  onRecorded: () => void;
}

interface PaymentFormFields {
  amount: number;
  paymentDate: Dayjs;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes?: string;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  credit_card: 'Credit card',
  cash: 'Cash',
  stripe: 'Card processor (Stripe)',
  ach: 'ACH debit',
  other: 'Other',
};

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABEL[method] }));

/**
 * Settlement capture. The form mirrors the service's own guards so an operator
 * is told about an overpayment or a back-dated remittance before the write is
 * attempted rather than after it is rejected.
 */
export const PaymentModal: React.FC<PaymentModalProps> = ({ open, invoice, onClose, onRecorded }) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const minorUnitDigits = CURRENCY_DECIMALS[invoice.currency];

  const [paymentForm] = Form.useForm<PaymentFormFields>();
  const [isRecording, setIsRecording] = useState(false);
  const [bookingFailure, setBookingFailure] = useState('');

  const balanceDueMajor = fromMinorUnits(invoice.balanceDueMinor, invoice.currency);

  useEffect(() => {
    if (!open) return;
    setBookingFailure('');
    paymentForm.setFieldsValue({
      amount: Number(balanceDueMajor.toFixed(minorUnitDigits)),
      paymentDate: dayjs(),
      paymentMethod: 'bank_transfer',
      transactionReference: '',
      notes: undefined,
    });
  }, [open, balanceDueMajor, minorUnitDigits, paymentForm]);

  const submitPayment = async (): Promise<void> => {
    let enteredPayment: PaymentFormFields;
    try {
      enteredPayment = await paymentForm.validateFields();
    } catch {
      return;
    }

    const amountMinor = toMinorUnits(enteredPayment.amount, invoice.currency);
    const paymentDate = enteredPayment.paymentDate.format('YYYY-MM-DD');

    const allocationCheck = validatePaymentAllocation(
      amountMinor,
      invoice.balanceDueMinor,
      invoice.issueDate,
      paymentDate
    );
    if (!allocationCheck.valid) {
      setBookingFailure(allocationCheck.message ?? 'The payment could not be applied.');
      return;
    }

    setIsRecording(true);
    setBookingFailure('');

    try {
      const settlement = await recordPaymentTransactional({
        invoiceId: invoice.id,
        amountMinor,
        paymentDate,
        paymentMethod: enteredPayment.paymentMethod,
        transactionReference: enteredPayment.transactionReference,
        notes: enteredPayment.notes,
        actor: ACTOR_LOCAL_ADMIN,
      });

      message.success(
        settlement.invoice.status === 'paid'
          ? `${invoice.invoiceNumber} is now settled in full.`
          : `Payment recorded against ${invoice.invoiceNumber}.`
      );
      onRecorded();
      onClose();
    } catch (bookingError) {
      setBookingFailure(bookingError instanceof Error ? bookingError.message : 'The payment could not be recorded.');
    } finally {
      setIsRecording(false);
    }
  };

  const inspectAmount = (_rule: unknown, candidateAmount: number | undefined): Promise<void> => {
    const amountMinor = toMinorUnits(Number(candidateAmount ?? 0), invoice.currency);
    if (!(amountMinor > 0)) {
      return Promise.reject(new Error('Enter an amount greater than zero.'));
    }
    if (amountMinor > invoice.balanceDueMinor) {
      return Promise.reject(new Error('Amount exceeds the remaining balance due.'));
    }
    return Promise.resolve();
  };

  const inspectPaymentDate = (_rule: unknown, chosenDate: Dayjs | null): Promise<void> => {
    if (!chosenDate) return Promise.reject(new Error('A payment date is required.'));
    if (chosenDate.format('YYYY-MM-DD') < invoice.issueDate.slice(0, 10)) {
      return Promise.reject(new Error('Payment date cannot precede the issue date.'));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      title={`Record payment — ${invoice.invoiceNumber}`}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={prefersTouchInput ? '100%' : 520}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isRecording}>
          Cancel
        </Button>,
        <Button
          key="record"
          type="primary"
          loading={isRecording}
          onClick={() => void submitPayment()}
        >
          Record payment
        </Button>,
      ]}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: 12,
          marginBottom: 16,
          backgroundColor: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm, 3px)',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Balance due</div>
          <CurrencyDisplay amountMinor={invoice.balanceDueMinor} currency={invoice.currency} tone="strong" size="large" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Invoice issued</div>
          <div style={{ fontWeight: 600 }}>{formatDate(invoice.issueDate)}</div>
        </div>
      </div>

      {bookingFailure ? (
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
          {bookingFailure}
        </div>
      ) : null}

      <Form<PaymentFormFields>
        form={paymentForm}
        layout="vertical"
        requiredMark
        style={{ minWidth: 0 }}
      >
        <Form.Item
          name="amount"
          label={`Amount received (${invoice.currency})`}
          rules={[
            { required: true, message: 'Enter the amount received.' },
            { validator: inspectAmount },
          ]}
        >
          <InputNumber
            min={0}
            step={1 / Math.pow(10, minorUnitDigits)}
            precision={minorUnitDigits}
            inputMode="decimal"
            style={{ width: '100%', minWidth: 0 }}
          />
        </Form.Item>

        <Form.Item
          name="paymentDate"
          label="Payment date"
          rules={[{ required: true, message: 'Enter the payment date.' }, { validator: inspectPaymentDate }]}
        >
          <DatePicker
            style={{ width: '100%', minWidth: 0 }}
            format="MMM DD, YYYY"
            needConfirm={false}
            disabledDate={(candidate) => candidate.isBefore(dayjs(invoice.issueDate, 'YYYY-MM-DD'), 'day')}
          />
        </Form.Item>

        <Form.Item
          name="paymentMethod"
          label="Settlement rail"
          rules={[{ required: true, message: 'Choose how the client settled.' }]}
        >
          <Select options={METHOD_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="transactionReference"
          label="Transaction reference"
          rules={[{ required: true, whitespace: true, message: 'A reference is required for the audit trail.' }]}
        >
          <Input placeholder="WIRE-APEX-0928" inputMode="text" />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Optional remittance detail" inputMode="text" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
