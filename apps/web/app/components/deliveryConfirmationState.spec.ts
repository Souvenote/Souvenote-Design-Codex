import type { CheckoutSession, FulfillmentJob } from '../lib/api';
import { deriveConfirmationPhase } from './deliveryConfirmationState';

const session = {
  id: 'session-id',
  purpose: 'physical_order',
  orderId: 'order-id',
  creditPackPurchaseId: null,
  paymentId: 'payment-id',
  provider: 'mock',
  status: 'completed',
  collectionMode: 'manual',
  currency: 'CAD',
  amountMinor: 999,
  checkoutUrl: null,
  expiresAt: '2026-08-12T00:00:00.000Z',
  completedAt: '2026-08-12T00:00:00.000Z',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
} satisfies CheckoutSession;

const job = {
  id: 'job-id',
  orderId: 'order-id',
  provider: 'mock',
  status: 'accepted',
  variant: 'personalized',
  attemptCount: 1,
  lastErrorCategory: null,
  submittedAt: '2026-08-12T00:00:00.000Z',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
} satisfies FulfillmentJob;

describe('delivery confirmation state', () => {
  it('requires owner-scoped server records before reporting a reconciled physical flow', () => {
    expect(deriveConfirmationPhase(null, null)).toBe('unverified');
    expect(deriveConfirmationPhase(session, null)).toBe('payment_only');
    expect(deriveConfirmationPhase(session, job)).toBe('reconciled');
    expect(deriveConfirmationPhase(session, { ...job, orderId: 'another-order' })).toBe('mismatch');
  });

  it('accepts a completed captured credit pack without fulfillment', () => {
    expect(
      deriveConfirmationPhase(
        { ...session, purpose: 'credit_pack', orderId: null, creditPackPurchaseId: 'purchase-id', paymentId: null },
        null,
      ),
    ).toBe('reconciled');
  });
});
