import type { CheckoutSession, FulfillmentJob } from '../lib/api';

export type ConfirmationPhase = 'unverified' | 'payment_only' | 'reconciled' | 'mismatch';

const RECONCILED_FULFILLMENT_STATES = new Set(['accepted', 'printing', 'mailed', 'delivered']);

export function deriveConfirmationPhase(
  session: CheckoutSession | null,
  fulfillmentJob: FulfillmentJob | null,
): ConfirmationPhase {
  if (!session || session.status !== 'completed') return 'unverified';
  if (session.purpose === 'credit_pack') return 'reconciled';
  if (!session.orderId) return 'mismatch';
  if (!fulfillmentJob) return 'payment_only';
  if (fulfillmentJob.orderId !== session.orderId) return 'mismatch';
  return RECONCILED_FULFILLMENT_STATES.has(fulfillmentJob.status) ? 'reconciled' : 'payment_only';
}
