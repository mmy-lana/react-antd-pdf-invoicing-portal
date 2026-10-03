import React, { useEffect, useState } from 'react';
import { App, Button, Drawer, Form, Input, InputNumber, Select } from 'antd';
import type { Client, CurrencyCode } from '@/types';
import { CURRENCY_CODES } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { looksLikeEmailAddress } from '@/utils/validators';
import { createClient, updateClient } from '@/services/clientService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface ClientDrawerFormProps {
  open: boolean;
  /** Present when editing an existing directory record. */
  client?: Client;
  onClose: () => void;
  onSaved: (savedClient: Client) => void;
}

interface ClientFormFields {
  companyName: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  currency: CurrencyCode;
  paymentTermsDays: number;
  notes?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

/** Register or amend a billing party without leaving the directory. */
export const ClientDrawerForm: React.FC<ClientDrawerFormProps> = ({ open, client, onClose, onSaved }) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const [clientForm] = Form.useForm<ClientFormFields>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState('');

  useEffect(() => {
    if (!open) return;
    setSaveFailure('');
    clientForm.setFieldsValue(
      client
        ? {
            companyName: client.companyName,
            name: client.name,
            email: client.email,
            phone: client.phone,
            taxId: client.taxId,
            currency: client.currency,
            paymentTermsDays: client.paymentTermsDays,
            notes: client.notes,
            street1: client.billingAddress.street1,
            street2: client.billingAddress.street2,
            city: client.billingAddress.city,
            state: client.billingAddress.state,
            postalCode: client.billingAddress.postalCode,
            country: client.billingAddress.country,
          }
        : { currency: 'USD', paymentTermsDays: 30 }
    );
  }, [open, client, clientForm]);

  const closeDrawer = (): void => {
    setSaveFailure('');
    clientForm.resetFields();
    onClose();
  };

  const submitClient = async (): Promise<void> => {
    let enteredFields: ClientFormFields;
    try {
      enteredFields = await clientForm.validateFields();
    } catch {
      return;
    }

    setIsSaving(true);
    setSaveFailure('');

    const payload = {
      companyName: enteredFields.companyName.trim(),
      name: enteredFields.name.trim(),
      email: enteredFields.email.trim(),
      phone: enteredFields.phone?.trim() ?? '',
      taxId: enteredFields.taxId?.trim() ?? '',
      currency: enteredFields.currency,
      paymentTermsDays: enteredFields.paymentTermsDays,
      notes: enteredFields.notes?.trim() || undefined,
      billingAddress: {
        street1: enteredFields.street1.trim(),
        street2: enteredFields.street2?.trim() || undefined,
        city: enteredFields.city.trim(),
        state: enteredFields.state.trim(),
        postalCode: enteredFields.postalCode.trim(),
        country: enteredFields.country.trim(),
      },
    };

    try {
      const savedClient = client
        ? await updateClient(client.id, payload, ACTOR_LOCAL_ADMIN)
        : await createClient(payload, ACTOR_LOCAL_ADMIN);

      message.success(client ? `${savedClient.companyName} updated.` : `${savedClient.companyName} added.`);
      onSaved(savedClient);
      closeDrawer();
    } catch (saveError) {
      setSaveFailure(saveError instanceof Error ? saveError.message : 'The client could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      title={client ? `Edit ${client.companyName}` : 'Register client'}
      placement={prefersTouchInput ? 'bottom' : 'right'}
      height={prefersTouchInput ? '92dvh' : undefined}
      width={prefersTouchInput ? undefined : 520}
      open={open}
      onClose={closeDrawer}
      destroyOnHidden
      extra={
        <Button type="primary" loading={isSaving} onClick={() => void submitClient()}>
          {client ? 'Save changes' : 'Add client'}
        </Button>
      }
      styles={{ body: { minWidth: 0 } }}
    >
      {saveFailure ? (
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
          {saveFailure}
        </div>
      ) : null}

      <Form<ClientFormFields>
        form={clientForm}
        layout="vertical"
        requiredMark
        style={{ minWidth: 0 }}
      >
        <Form.Item
          name="companyName"
          label="Company name"
          rules={[{ required: true, whitespace: true, message: 'Company name is required.' }]}
        >
          <Input placeholder="Apex Logistics Global" inputMode="text" />
        </Form.Item>

        <Form.Item
          name="name"
          label="Billing contact"
          rules={[{ required: true, whitespace: true, message: 'A billing contact is required.' }]}
        >
          <Input placeholder="Sarah Jenkins" inputMode="text" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Accounts email"
          rules={[
            { required: true, whitespace: true, message: 'An accounts email is required.' },
            {
              validator: (_rule, candidate: string) =>
                !candidate || looksLikeEmailAddress(candidate)
                  ? Promise.resolve()
                  : Promise.reject(new Error('Enter a valid email address.')),
            },
          ]}
        >
          <Input placeholder="accounts@company.com" inputMode="email" autoComplete="email" />
        </Form.Item>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+1 (555) 000-0000" inputMode="tel" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="taxId" label="Tax ID">
            <Input placeholder="US-000000000" inputMode="text" />
          </Form.Item>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            minWidth: 0,
          }}
        >
          <Form.Item name="currency" label="Billing currency" rules={[{ required: true }]}>
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="paymentTermsDays"
            label="Payment terms (days)"
            rules={[{ required: true, message: 'Enter the agreed payment terms.' }]}
          >
            <InputNumber min={0} max={365} step={1} style={{ width: '100%', minWidth: 0 }} inputMode="numeric" />
          </Form.Item>
        </div>

        <Form.Item
          name="street1"
          label="Billing street address"
          rules={[{ required: true, whitespace: true, message: 'A billing street address is required.' }]}
        >
          <Input placeholder="450 Harbor Way" inputMode="text" autoComplete="address-line1" />
        </Form.Item>
        <Form.Item name="street2" label="Street address line 2">
          <Input placeholder="Dock 4" inputMode="text" autoComplete="address-line2" />
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
            <Input placeholder="Long Beach" inputMode="text" autoComplete="address-level2" />
          </Form.Item>
          <Form.Item name="state" label="State" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
            <Input placeholder="CA" inputMode="text" autoComplete="address-level1" />
          </Form.Item>
          <Form.Item
            name="postalCode"
            label="Postal code"
            rules={[{ required: true, whitespace: true, message: 'Required.' }]}
          >
            <Input placeholder="90802" inputMode="text" autoComplete="postal-code" />
          </Form.Item>
          <Form.Item name="country" label="Country" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
            <Input placeholder="United States" inputMode="text" autoComplete="country-name" />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Internal notes">
          <Input.TextArea rows={2} placeholder="Not printed on any issued document" inputMode="text" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
