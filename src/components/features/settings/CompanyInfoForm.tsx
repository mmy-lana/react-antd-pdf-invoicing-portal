import React, { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Select } from 'antd';
import type { CurrencyCode, OrganizationSettings } from '@/types';
import { CURRENCY_CODES } from '@/types';
import { looksLikeEmailAddress } from '@/utils/validators';

export interface CompanyInfoFormProps {
  settings: OrganizationSettings;
  isSaving: boolean;
  onSubmit: (patch: {
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyTaxId: string;
    companyAddress: {
      street1: string;
      street2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    defaultCurrency: CurrencyCode;
    defaultPaymentTermsDays: number;
    defaultTaxRate: number;
  }) => void;
}

interface CompanyInfoFields {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyTaxId: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  defaultCurrency: CurrencyCode;
  defaultPaymentTermsDays: number;
  defaultTaxRate: number;
}

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

/**
 * Issuer identity and invoicing defaults. These values are cut into every
 * invoice snapshot at issue time, so editing them never rewrites a document
 * that has already gone out.
 */
export const CompanyInfoForm: React.FC<CompanyInfoFormProps> = ({ settings, isSaving, onSubmit }) => {
  const { message } = App.useApp();
  const [companyForm] = Form.useForm<CompanyInfoFields>();
  const [submitFailure, setSubmitFailure] = useState('');

  useEffect(() => {
    companyForm.setFieldsValue({
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyTaxId: settings.companyTaxId,
      street1: settings.companyAddress.street1,
      street2: settings.companyAddress.street2,
      city: settings.companyAddress.city,
      state: settings.companyAddress.state,
      postalCode: settings.companyAddress.postalCode,
      country: settings.companyAddress.country,
      defaultCurrency: settings.defaultCurrency,
      defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
      defaultTaxRate: settings.defaultTaxRate,
    });
  }, [settings, companyForm]);

  const submitCompanyProfile = async (): Promise<void> => {
    let enteredFields: CompanyInfoFields;
    try {
      enteredFields = await companyForm.validateFields();
    } catch {
      return;
    }

    if (enteredFields.defaultTaxRate < 0 || enteredFields.defaultTaxRate > 100) {
      setSubmitFailure('Default tax rate must sit between 0% and 100%.');
      return;
    }

    setSubmitFailure('');
    onSubmit({
      companyName: enteredFields.companyName.trim(),
      companyEmail: enteredFields.companyEmail.trim(),
      companyPhone: enteredFields.companyPhone.trim(),
      companyTaxId: enteredFields.companyTaxId?.trim() ?? '',
      companyAddress: {
        street1: enteredFields.street1.trim(),
        street2: enteredFields.street2?.trim() || undefined,
        city: enteredFields.city.trim(),
        state: enteredFields.state.trim(),
        postalCode: enteredFields.postalCode.trim(),
        country: enteredFields.country.trim(),
      },
      defaultCurrency: enteredFields.defaultCurrency,
      defaultPaymentTermsDays: enteredFields.defaultPaymentTermsDays,
      defaultTaxRate: enteredFields.defaultTaxRate,
    });

    message.success('Issuer profile updated.');
  };

  return (
    <section
      aria-label="Issuer profile"
      style={{
        padding: 16,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 4px)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Issuer profile</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Printed on every issued invoice. Changes apply to future issues only — existing invoices keep the
        snapshot they were issued with.
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

      <Form<CompanyInfoFields> form={companyForm} layout="vertical" requiredMark style={{ minWidth: 0 }}>
        <Form.Item
          name="companyName"
          label="Company name"
          rules={[{ required: true, whitespace: true, message: 'Company name is required.' }]}
        >
          <Input placeholder="Acro Corporate Solutions Inc." inputMode="text" />
        </Form.Item>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item
            name="companyEmail"
            label="Billing email"
            rules={[
              { required: true, whitespace: true, message: 'A billing email is required.' },
              {
                validator: (_rule, candidate: string) =>
                  !candidate || looksLikeEmailAddress(candidate)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Enter a valid email address.')),
              },
            ]}
          >
            <Input placeholder="billing@company.com" inputMode="email" autoComplete="email" />
          </Form.Item>

          <Form.Item name="companyPhone" label="Phone">
            <Input placeholder="+1 (555) 000-0000" inputMode="tel" autoComplete="tel" />
          </Form.Item>

          <Form.Item name="companyTaxId" label="Tax ID">
            <Input placeholder="US-000000000" inputMode="text" />
          </Form.Item>
        </div>

        <Form.Item
          name="street1"
          label="Street address"
          rules={[{ required: true, whitespace: true, message: 'A street address is required.' }]}
        >
          <Input placeholder="100 Enterprise Boulevard" inputMode="text" autoComplete="address-line1" />
        </Form.Item>
        <Form.Item name="street2" label="Street address line 2">
          <Input placeholder="Suite 400" inputMode="text" autoComplete="address-line2" />
        </Form.Item>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item name="city" label="City" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
            <Input placeholder="New York" inputMode="text" autoComplete="address-level2" />
          </Form.Item>
          <Form.Item name="state" label="State" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
            <Input placeholder="NY" inputMode="text" autoComplete="address-level1" />
          </Form.Item>
          <Form.Item
            name="postalCode"
            label="Postal code"
            rules={[{ required: true, whitespace: true, message: 'Required.' }]}
          >
            <Input placeholder="10001" inputMode="text" autoComplete="postal-code" />
          </Form.Item>
          <Form.Item name="country" label="Country" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
            <Input placeholder="United States" inputMode="text" autoComplete="country-name" />
          </Form.Item>
        </div>

        <h3
          style={{
            margin: '8px 0 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Invoicing defaults
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item name="defaultCurrency" label="Default currency" rules={[{ required: true }]}>
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="defaultPaymentTermsDays"
            label="Default terms (days)"
            rules={[{ required: true, message: 'Enter default payment terms.' }]}
          >
            <InputNumber min={0} max={365} step={1} style={{ width: '100%', minWidth: 0 }} inputMode="numeric" />
          </Form.Item>

          <Form.Item
            name="defaultTaxRate"
            label="Default tax rate %"
            rules={[{ required: true, message: 'Enter a default tax rate.' }]}
          >
            <InputNumber min={0} max={100} step={0.001} style={{ width: '100%', minWidth: 0 }} inputMode="decimal" />
          </Form.Item>
        </div>

        <Button
          type="primary"
          loading={isSaving}
          onClick={() => void submitCompanyProfile()}
          style={{ minHeight: 'var(--touch-target-min, 44px)' }}
        >
          Save issuer profile
        </Button>
      </Form>
    </section>
  );
};
