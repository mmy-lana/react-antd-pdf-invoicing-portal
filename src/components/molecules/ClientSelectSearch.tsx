import React, { useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import { PlusOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import type { Client, CurrencyCode } from '@/types';
import { CURRENCY_CODES } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { looksLikeEmailAddress } from '@/utils/validators';
import { createClient } from '@/services/clientService';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface ClientSelectSearchProps {
  clients: Client[];
  value?: string;
  onChange?: (chosenClientId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Pass false to hide the inline quick-add affordance on read-only screens. */
  allowQuickAdd?: boolean;
  onClientCreated?: (createdClient: Client) => void;
}

interface QuickAddClientFields {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxId: string;
  currency: CurrencyCode;
  paymentTermsDays: number;
  street1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

/**
 * Client picker with an inline registrar. Registering the billing party without
 * leaving the invoice form keeps the common case — a first invoice for a brand
 * new customer — to a single screen.
 */
export const ClientSelectSearch: React.FC<ClientSelectSearchProps> = ({
  clients,
  value,
  onChange,
  placeholder = 'Select a client',
  disabled = false,
  allowQuickAdd = true,
  onClientCreated,
}) => {
  const { message } = App.useApp();
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;
  const controlHeight = prefersTouchInput ? 'var(--touch-target-min, 44px)' : 32;

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationFailure, setRegistrationFailure] = useState('');
  const [quickAddForm] = Form.useForm<QuickAddClientFields>();

  const openQuickAdd = (): void => {
    setRegistrationFailure('');
    quickAddForm.resetFields();
    setIsQuickAddOpen(true);
  };

  const closeQuickAdd = (): void => {
    setIsQuickAddOpen(false);
    setRegistrationFailure('');
    quickAddForm.resetFields();
  };

  const submitQuickAdd = async (): Promise<void> => {
    let enteredFields: QuickAddClientFields;
    try {
      enteredFields = await quickAddForm.validateFields();
    } catch {
      return;
    }

    setIsRegistering(true);
    setRegistrationFailure('');

    try {
      const createdClient = await createClient(
        {
          name: enteredFields.name.trim(),
          companyName: enteredFields.companyName.trim(),
          email: enteredFields.email.trim(),
          phone: enteredFields.phone.trim(),
          taxId: enteredFields.taxId.trim(),
          currency: enteredFields.currency,
          paymentTermsDays: enteredFields.paymentTermsDays,
          billingAddress: {
            street1: enteredFields.street1.trim(),
            city: enteredFields.city.trim(),
            state: enteredFields.state.trim(),
            postalCode: enteredFields.postalCode.trim(),
            country: enteredFields.country.trim(),
          },
        },
        ACTOR_LOCAL_ADMIN
      );

      message.success(`${createdClient.companyName} added to the directory.`);
      onClientCreated?.(createdClient);
      onChange?.(createdClient.id);
      closeQuickAdd();
    } catch (registrationError) {
      setRegistrationFailure(
        registrationError instanceof Error ? registrationError.message : 'The client could not be registered.'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, minWidth: 0, width: '100%' }}>
        <Select
          showSearch
          allowClear
          disabled={disabled}
          optionFilterProp="label"
          aria-label="Client"
          placeholder={placeholder}
          value={value ?? undefined}
          onChange={(chosenClientId) => onChange?.(chosenClientId ?? undefined)}
          notFoundContent={
            clients.length === 0 ? 'No clients on file yet' : 'No client matches that search'
          }
          options={clients.map((client) => ({
            value: client.id,
            label: client.companyName,
            disabled: Boolean(client.archivedAt),
          }))}
          suffixIcon={<SearchOutlined aria-hidden="true" />}
          style={{ flex: '1 1 auto', minWidth: 0, minHeight: controlHeight }}
        />

        {allowQuickAdd ? (
          <Button
            icon={<UserAddOutlined aria-hidden="true" />}
            onClick={openQuickAdd}
            disabled={disabled}
            style={{ minHeight: controlHeight, flex: '0 0 auto' }}
          >
            {prefersTouchInput ? 'Add' : 'Add client'}
          </Button>
        ) : null}
      </div>

      <Modal
        title="Register client"
        open={isQuickAddOpen}
        onCancel={closeQuickAdd}
        destroyOnHidden
        width={prefersTouchInput ? '100%' : 560}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={closeQuickAdd} disabled={isRegistering}>
            Cancel
          </Button>,
          <Button
            key="register"
            type="primary"
            loading={isRegistering}
            icon={<PlusOutlined aria-hidden="true" />}
            onClick={() => void submitQuickAdd()}
          >
            Add to directory
          </Button>,
        ]}
      >
        {registrationFailure ? (
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
            {registrationFailure}
          </div>
        ) : null}

        <Form<QuickAddClientFields>
          form={quickAddForm}
          layout="vertical"
          requiredMark
          initialValues={{ currency: 'USD', paymentTermsDays: 30 }}
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

          <Form.Item name="phone" label="Phone">
            <Input placeholder="+1 (555) 000-0000" inputMode="tel" autoComplete="tel" />
          </Form.Item>

          <Form.Item name="taxId" label="Tax ID">
            <Input placeholder="US-000000000" inputMode="text" />
          </Form.Item>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
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
            <Form.Item
              name="country"
              label="Country"
              rules={[{ required: true, whitespace: true, message: 'Required.' }]}
            >
              <Input placeholder="United States" inputMode="text" autoComplete="country-name" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
};
