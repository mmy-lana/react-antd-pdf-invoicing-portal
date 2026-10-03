import React, { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Typography } from 'antd';
import { isAlphanumericSequenceToken } from '@/utils/validators';
import { formatInvoiceSequence } from '@/utils/formatters';

export interface InvoiceSequencingFormProps {
  invoicePrefix: string;
  nextInvoiceSequence: number;
  /** Highest number already issued under the current prefix, for guidance. */
  highestIssuedSequence: number;
  isSaving: boolean;
  onSubmit: (patch: { invoicePrefix: string; nextInvoiceSequence?: number }) => void;
}

interface SequencingFields {
  invoicePrefix: string;
  nextInvoiceSequence: number;
}

/**
 * Numbering control.
 *
 * The next number is only submitted when the operator actually edits it. If the
 * prefix changes, the sequence is still sent because the two are meaningless
 * apart — but an untouched sequence is left to the ledger so a save made for an
 * unrelated reason can never roll numbering backwards.
 */
export const InvoiceSequencingForm: React.FC<InvoiceSequencingFormProps> = ({
  invoicePrefix,
  nextInvoiceSequence,
  highestIssuedSequence,
  isSaving,
  onSubmit,
}) => {
  const { message } = App.useApp();
  const [sequencingForm] = Form.useForm<SequencingFields>();
  const [wasSequenceEdited, setWasSequenceEdited] = useState(false);
  const [submitFailure, setSubmitFailure] = useState('');

  useEffect(() => {
    sequencingForm.setFieldsValue({ invoicePrefix, nextInvoiceSequence });
    setWasSequenceEdited(false);
  }, [invoicePrefix, nextInvoiceSequence, sequencingForm]);

  const watchedPrefix = Form.useWatch<string>('invoicePrefix', sequencingForm) ?? invoicePrefix;
  const watchedSequence = Form.useWatch<number>('nextInvoiceSequence', sequencingForm) ?? nextInvoiceSequence;
  const prefixIsValid = isAlphanumericSequenceToken(watchedPrefix ?? '');
  const nextNumberPreview = formatInvoiceSequence(
    prefixIsValid ? watchedPrefix : invoicePrefix,
    watchedSequence ?? nextInvoiceSequence
  );

  const submitSequencing = async (): Promise<void> => {
    let enteredFields: SequencingFields;
    try {
      enteredFields = await sequencingForm.validateFields();
    } catch {
      return;
    }

    if (!isAlphanumericSequenceToken(enteredFields.invoicePrefix)) {
      setSubmitFailure('Prefix must be alphanumeric; dashes and underscores are allowed.');
      return;
    }

    if (enteredFields.nextInvoiceSequence <= 0) {
      setSubmitFailure('Next invoice sequence must be a positive integer.');
      return;
    }

    const prefixIsChanging = enteredFields.invoicePrefix !== invoicePrefix;
    if ((wasSequenceEdited || prefixIsChanging) && enteredFields.nextInvoiceSequence <= highestIssuedSequence) {
      setSubmitFailure(
        `The next sequence must exceed ${highestIssuedSequence}, the highest number already issued under "${enteredFields.invoicePrefix}".`
      );
      return;
    }

    setSubmitFailure('');
    onSubmit({
      invoicePrefix: enteredFields.invoicePrefix,
      nextInvoiceSequence: wasSequenceEdited || prefixIsChanging ? enteredFields.nextInvoiceSequence : undefined,
    });

    message.success('Invoice numbering updated.');
  };

  return (
    <section
      aria-label="Invoice numbering"
      style={{
        padding: 16,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Invoice numbering</h2>
      <Typography.Paragraph style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Numbers are allocated inside the same transaction that issues the invoice, so two operators saving
        at the same moment can never be handed the same number.
      </Typography.Paragraph>

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

      <Form<SequencingFields>
        form={sequencingForm}
        layout="vertical"
        requiredMark
        initialValues={{ invoicePrefix, nextInvoiceSequence }}
        style={{ minWidth: 0 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item
            name="invoicePrefix"
            label="Prefix"
            rules={[
              { required: true, whitespace: true, message: 'A prefix is required.' },
              {
                validator: (_rule, candidate: string) =>
                  !candidate || isAlphanumericSequenceToken(candidate)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Letters, numbers, dashes and underscores only.')),
              },
            ]}
          >
            <Input placeholder="INV" inputMode="text" autoCapitalize="characters" />
          </Form.Item>

          <Form.Item
            name="nextInvoiceSequence"
            label="Next sequence"
            rules={[{ required: true, message: 'Enter the next sequence number.' }]}
          >
            <InputNumber
              min={1}
              step={1}
              precision={0}
              style={{ width: '100%', minWidth: 0 }}
              inputMode="numeric"
              onChange={() => setWasSequenceEdited(true)}
            />
          </Form.Item>
        </div>

        <p
          style={{
            margin: '0 0 16px',
            fontSize: 12.5,
            color: 'var(--color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Next invoice will be numbered <strong>{nextNumberPreview}</strong>. Highest number issued under the
          current prefix: <strong>{highestIssuedSequence}</strong>.
        </p>

        <Button
          type="primary"
          loading={isSaving}
          onClick={() => void submitSequencing()}
          style={{ minHeight: 'var(--touch-target-min, 44px)' }}
        >
          Save numbering
        </Button>
      </Form>
    </section>
  );
};
