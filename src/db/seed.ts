import dayjs from 'dayjs';
import { db } from '@/db/database';
import type { Address, CurrencyCode, InvoiceItem, OrganizationSettings } from '@/types';
import { ACTOR_LOCAL_ADMIN } from '@/types';
import { createClient } from '@/services/clientService';
import { createInvoiceTransactional, cancelInvoiceTransactional } from '@/services/invoiceService';
import { recordPaymentTransactional } from '@/services/paymentService';
import { reconcileInvoiceStatuses } from '@/services/statusReconciliationService';
import { toMinorUnits } from '@/utils/calculations';

const LONG_BEACH: Address = {
  street1: '450 Harbor Way',
  street2: 'Dock 4',
  city: 'Long Beach',
  state: 'CA',
  postalCode: '90802',
  country: 'United States',
};

const DEFAULT_ISSUER_PROFILE: Omit<OrganizationSettings, 'id' | 'updatedAt'> = {
  companyName: 'Acro Corporate Solutions Inc.',
  companyEmail: 'billing@acrosolutions.com',
  companyPhone: '+1 (555) 019-2834',
  companyAddress: {
    street1: '100 Enterprise Boulevard',
    street2: 'Suite 400',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'United States',
  },
  companyTaxId: 'US-948201948',
  defaultCurrency: 'USD',
  defaultPaymentTermsDays: 30,
  defaultTaxRate: 8.875,
  invoicePrefix: 'INV',
  nextInvoiceSequence: 1001,
  bankDetails: {
    bankName: 'JPMorgan Chase Bank, N.A.',
    accountName: 'Acro Corporate Solutions Operating',
    accountNumber: '987654321098',
    routingNumber: '021000021',
    swiftCode: 'CHASUS33',
    iban: 'US33CHAS021000021987654321',
  },
  defaultPaymentInstructions:
    'Wire transfers only. Please reference the invoice number in the remittance memo.',
  defaultTermsAndConditions:
    'Payment is due within the designated net terms. Balances unpaid after the due date accrue a 1.5% monthly finance charge.',
};

const billableLine = (
  identifier: string,
  description: string,
  unit: string,
  quantity: number,
  unitPriceMajor: number,
  currency: CurrencyCode,
  taxRate: number,
  discountRate: number
): InvoiceItem => ({
  id: identifier,
  sortOrder: 1,
  description,
  unit,
  quantity,
  unitPriceMinor: toMinorUnits(unitPriceMajor, currency),
  taxRate,
  discountRate,
  subtotalMinor: 0,
  taxAmountMinor: 0,
  discountAmountMinor: 0,
  totalMinor: 0,
});

/**
 * First-run dataset.
 *
 * The whole seed runs inside one outer Dexie transaction spanning every table
 * the service layer touches, so a half-populated ledger is not reachable: if any
 * invoice or settlement fails to write, the issuer profile and client directory
 * roll back with it. Nested service transactions join the parent rather than
 * opening their own.
 */
const populateFirstRunLedger = async (): Promise<void> => {
  await db.transaction('rw', [db.settings, db.clients, db.invoices, db.payments, db.auditLogs], async () => {
    const existingSettings = await db.settings.get('org');
    if (!existingSettings) {
      await db.settings.put({
        id: 'org',
        ...DEFAULT_ISSUER_PROFILE,
        updatedAt: new Date().toISOString(),
      });
    }

    if ((await db.clients.count()) > 0) return;

    const apexLogistics = await createClient(
      {
        name: 'Sarah Jenkins',
        companyName: 'Apex Logistics Global',
        email: 's.jenkins@apexlogistics.com',
        phone: '+1 (555) 349-1120',
        taxId: 'US-443920192',
        billingAddress: LONG_BEACH,
        currency: 'USD',
        paymentTermsDays: 30,
      },
      ACTOR_LOCAL_ADMIN
    );

    const vanceBioTech = await createClient(
      {
        name: 'Marcus Vance',
        companyName: 'Vance BioTech Laboratories',
        email: 'accounting@vancebio.com',
        phone: '+1 (555) 887-2300',
        taxId: 'US-889102941',
        billingAddress: {
          street1: '12 Science Park Drive',
          city: 'Cambridge',
          state: 'MA',
          postalCode: '02142',
          country: 'United States',
        },
        currency: 'USD',
        paymentTermsDays: 15,
      },
      ACTOR_LOCAL_ADMIN
    );

    const nordicCleanEnergy = await createClient(
      {
        name: 'Elena Rostova',
        companyName: 'Nordic Clean Energy AB',
        email: 'finance@nordicenergy.se',
        phone: '+46 8 123 4567',
        taxId: 'SE-556123456701',
        billingAddress: {
          street1: 'Hamngatan 14',
          city: 'Stockholm',
          state: 'Stockholm',
          postalCode: '111 47',
          country: 'Sweden',
        },
        currency: 'EUR',
        paymentTermsDays: 30,
      },
      ACTOR_LOCAL_ADMIN
    );

    const pacificRimRobotics = await createClient(
      {
        name: 'David Chen',
        companyName: 'Pacific Rim Robotics',
        email: 'billing@pacrimrobotics.com',
        phone: '+1 (555) 762-9090',
        taxId: 'US-778291039',
        billingAddress: {
          street1: '888 Silicon Ave',
          city: 'San Jose',
          state: 'CA',
          postalCode: '95110',
          country: 'United States',
        },
        currency: 'USD',
        paymentTermsDays: 45,
      },
      ACTOR_LOCAL_ADMIN
    );

    const tokyoMedia = await createClient(
      {
        name: 'Kenji Sato',
        companyName: 'Tokyo Media Dynamics',
        email: 'k.sato@tokyomedia.jp',
        phone: '+81 3 5555 0143',
        taxId: 'JP-9018273645123',
        billingAddress: {
          street1: 'Roppongi Hills Mori Tower 24F',
          city: 'Minato-ku',
          state: 'Tokyo',
          postalCode: '106-6124',
          country: 'Japan',
        },
        currency: 'JPY',
        paymentTermsDays: 30,
      },
      ACTOR_LOCAL_ADMIN
    );

    const today = dayjs();

    const cancelledEngagement = await createInvoiceTransactional(
      {
        clientId: apexLogistics.id,
        issueDate: today.subtract(40, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-audit',
            'Systems architecture audit',
            'hours',
            30,
            180,
            'USD',
            8.875,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );
    await cancelInvoiceTransactional(
      cancelledEngagement.id,
      ACTOR_LOCAL_ADMIN,
      'Client requested contract scope renegotiation'
    );

    const partSettledDeployment = await createInvoiceTransactional(
      {
        clientId: apexLogistics.id,
        issueDate: today.subtract(15, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(15, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-deployment',
            'Enterprise cloud deployment — sprint 1',
            'sprint',
            1,
            8500,
            'USD',
            0,
            5
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );
    await recordPaymentTransactional({
      invoiceId: partSettledDeployment.id,
      amountMinor: toMinorUnits(4000, 'USD'),
      paymentDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0928',
      actor: ACTOR_LOCAL_ADMIN,
    });

    const settledConsultation = await createInvoiceTransactional(
      {
        clientId: vanceBioTech.id,
        issueDate: today.subtract(25, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-lims',
            'Laboratory information management consultation',
            'hours',
            20,
            220,
            'USD',
            5,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );
    await recordPaymentTransactional({
      invoiceId: settledConsultation.id,
      amountMinor: settledConsultation.totalAmountMinor,
      paymentDate: today.subtract(12, 'day').format('YYYY-MM-DD'),
      paymentMethod: 'ach',
      transactionReference: 'ACH-VANCE-8812',
      actor: ACTOR_LOCAL_ADMIN,
    });

    await createInvoiceTransactional(
      {
        clientId: vanceBioTech.id,
        issueDate: today.format('YYYY-MM-DD'),
        dueDate: today.add(15, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'draft',
        items: [
          billableLine(
            'seed-line-compliance',
            'Q2 compliance preparation',
            'fixed',
            1,
            3200,
            'USD',
            0,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );

    await createInvoiceTransactional(
      {
        clientId: nordicCleanEnergy.id,
        issueDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(25, 'day').format('YYYY-MM-DD'),
        currency: 'EUR',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-telemetry',
            'Smart grid telemetry integration',
            'days',
            8,
            1200,
            'EUR',
            25,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );

    await createInvoiceTransactional(
      {
        clientId: pacificRimRobotics.id,
        issueDate: today.subtract(50, 'day').format('YYYY-MM-DD'),
        dueDate: today.subtract(5, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-actuator',
            'Actuator control protocol programming',
            'hours',
            45,
            150,
            'USD',
            8.875,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );

    const partPaidDiagnostics = await createInvoiceTransactional(
      {
        clientId: pacificRimRobotics.id,
        issueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(35, 'day').format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-diagnostics',
            'Robotics fleet diagnostics',
            'units',
            10,
            500,
            'USD',
            8.875,
            10
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );
    await recordPaymentTransactional({
      invoiceId: partPaidDiagnostics.id,
      amountMinor: toMinorUnits(2000, 'USD'),
      paymentDate: today.subtract(2, 'day').format('YYYY-MM-DD'),
      paymentMethod: 'credit_card',
      transactionReference: 'TXN-STRIPE-44910',
      actor: ACTOR_LOCAL_ADMIN,
    });

    await createInvoiceTransactional(
      {
        clientId: tokyoMedia.id,
        issueDate: today.subtract(10, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(20, 'day').format('YYYY-MM-DD'),
        currency: 'JPY',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-license',
            'Media distribution engine licence',
            'licence',
            1,
            650000,
            'JPY',
            10,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );

    await createInvoiceTransactional(
      {
        clientId: tokyoMedia.id,
        issueDate: today.subtract(2, 'day').format('YYYY-MM-DD'),
        dueDate: today.add(28, 'day').format('YYYY-MM-DD'),
        currency: 'JPY',
        status: 'draft',
        items: [
          billableLine(
            'seed-line-retainer',
            'Technical support retainer',
            'month',
            1,
            150000,
            'JPY',
            10,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );

    const settledRouting = await createInvoiceTransactional(
      {
        clientId: apexLogistics.id,
        issueDate: today.subtract(30, 'day').format('YYYY-MM-DD'),
        dueDate: today.format('YYYY-MM-DD'),
        currency: 'USD',
        status: 'pending',
        items: [
          billableLine(
            'seed-line-routing',
            'Supply chain routing optimisation',
            'hours',
            12,
            200,
            'USD',
            8.875,
            0
          ),
        ],
      },
      ACTOR_LOCAL_ADMIN
    );
    await recordPaymentTransactional({
      invoiceId: settledRouting.id,
      amountMinor: settledRouting.totalAmountMinor,
      paymentDate: today.format('YYYY-MM-DD'),
      paymentMethod: 'bank_transfer',
      transactionReference: 'WIRE-APEX-0994',
      actor: ACTOR_LOCAL_ADMIN,
    });
  });
};

let initializationRun: Promise<void> | null = null;

/**
 * Single-flight first-run bootstrap. Concurrent callers (React StrictMode
 * double-effect, a remount, a second tab) share one run; a failure clears the
 * cached promise so the next attempt retries instead of replaying the error.
 */
export const initializeDatabase = async (): Promise<void> => {
  if (!initializationRun) {
    initializationRun = populateFirstRunLedger()
      .then(async () => {
        await reconcileInvoiceStatuses();
      })
      .catch((initializationError: unknown): never => {
        initializationRun = null;
        throw initializationError;
      });
  }
  return initializationRun;
};
