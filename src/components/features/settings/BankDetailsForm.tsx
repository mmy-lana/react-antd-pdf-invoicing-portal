import React, { useEffect, useState } from 'react';
import { App, Button, Form, Input } from 'antd';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface BankDetailsFormProps {
  settings: {
    bankDetails: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      routingNumber?: string;
      swiftCode?: string;
      iban?: string;
    };
    defaultPaymentInstructions: string;
    defaultTermsAndConditions: string;
  };
  isSaving: boolean;
  onSubmit: (patch: {
    bankDetails: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      routingNumber?: string;
      swiftCode?: string;
      iban?: string;
    };
    defaultPaymentInstructions: string;
    defaultTermsAndConditions: string;
  }) => void;
}

interface BankFields {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  defaultPaymentInstructions: string;
  defaultTermsAndConditions: string;
}

/**
 * Remittance block printed on every invoice. Only the domestic fields are
 * mandatory; SWIFT and IBAN are shown when the issuer banks cross-border.
 */
export const BankDetailsForm: React.FC<BankDetailsFormProps> = ({ settings, isSaving, onSubmit }) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const [bankForm] = Form.useForm<BankFields>();
  const [submitFailure, setSubmitFailure] = useState('');

  /*
   * UI-01: iOS Safari zooms the viewport when a focused field renders below
   * 16px, and that zoom survives a form error. The constraint is applied to
   * every control in this form explicitly rather than relying on a stylesheet
   * cascade, so it holds even if the form is rendered inside a themed portal.
   */
  const fieldStyle: React.CSSProperties = prefersTouchInput
    ? { fontSize: 16, minHeight: 'var(--touch-target-min, 44px)' }
    : {};

  const textAreaStyle: React.CSSProperties = prefersTouchInput ? { fontSize: 16 } : {};

  useEffect(() => {
    bankForm.setFieldsValue({
      bankName: settings.bankDetails.bankName,
      accountName: settings.bankDetails.accountName,
      accountNumber: settings.bankDetails.accountNumber,
      routingNumber: settings.bankDetails.routingNumber,
      swiftCode: settings.bankDetails.swiftCode,
      iban: settings.bankDetails.iban,
      defaultPaymentInstructions: settings.defaultPaymentInstructions,
      defaultTermsAndConditions: settings.defaultTermsAndConditions,
    });
  }, [settings, bankForm]);

  const submitBankProfile = async (): Promise<void> => {
    let enteredFields: BankFields;
    try {
      enteredFields = await bankForm.validateFields();
    } catch {
      return;
    }

    if (enteredFields.defaultTermsAndConditions.length > 2000) {
      setSubmitFailure('Terms and conditions must stay under 2000 characters to fit one PDF page.');
      return;
    }

    setSubmitFailure('');
    onSubmit({
      bankDetails: {
        bankName: enteredFields.bankName.trim(),
        accountName: enteredFields.accountName.trim(),
        accountNumber: enteredFields.accountNumber.trim(),
        routingNumber: enteredFields.routingNumber?.trim() || undefined,
        swiftCode: enteredFields.swiftCode?.trim() || undefined,
        iban: enteredFields.iban?.trim() || undefined,
      },
      defaultPaymentInstructions: enteredFields.defaultPaymentInstructions?.trim() ?? '',
      defaultTermsAndConditions: enteredFields.defaultTermsAndConditions?.trim() ?? '',
    });

    message.success('Remittance details updated.');
  };

  return (
    <section
      aria-label="Remittance details"
      style={{
        padding: 16,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Remittance details</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Printed in the payment block of every issued invoice so the client knows where to send funds.
      </p>

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

      <Form<BankFields> form={bankForm} layout="vertical" requiredMark style={{ minWidth: 0 }}>
        <Form.Item
          name="bankName"
          label="Bank name"
          rules={[{ required: true, whitespace: true, message: 'Bank name is required.' }]}
        >
          <Input placeholder="JPMorgan Chase Bank, N.A." inputMode="text" style={fieldStyle} />
        </Form.Item>

        <Form.Item
          name="accountName"
          label="Account name"
          rules={[{ required: true, whitespace: true, message: 'Account name is required.' }]}
        >
          <Input placeholder="Acro Corporate Solutions Operating" inputMode="text" style={fieldStyle} />
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
            name="accountNumber"
            label="Account number"
            rules={[{ required: true, whitespace: true, message: 'Account number is required.' }]}
          >
            <Input placeholder="987654321098" inputMode="numeric" style={fieldStyle} />
          </Form.Item>

          <Form.Item name="routingNumber" label="Routing (ABA)">
            <Input placeholder="021000021" inputMode="numeric" style={fieldStyle} />
          </Form.Item>

          <Form.Item name="swiftCode" label="SWIFT / BIC">
            <Input placeholder="CHASUS33" inputMode="text" autoCapitalize="characters" style={fieldStyle} />
          </Form.Item>

          <Form.Item name="iban" label="IBAN">
            <Input placeholder="US33CHAS021000021987654321" inputMode="text" autoCapitalize="characters" style={fieldStyle} />
          </Form.Item>
        </div>

        <Form.Item name="defaultPaymentInstructions" label="Default payment instructions">
          <Input.TextArea
            rows={3}
            placeholder="Wire transfers only. Reference the invoice number in the remittance memo."
            inputMode="text"
            style={textAreaStyle}
          />
        </Form.Item>

        <Form.Item name="defaultTermsAndConditions" label="Default terms and conditions">
          <Input.TextArea
            rows={4}
            placeholder="Payment is due within the designated net terms."
            inputMode="text"
            style={textAreaStyle}
          />
        </Form.Item>

        <Button
          type="primary"
          loading={isSaving}
          onClick={() => void submitBankProfile()}
          style={{ minHeight: 'var(--touch-target-min, 44px)' }}
        >
          Save remittance details
        </Button>
      </Form>
    </section>
  );
};
