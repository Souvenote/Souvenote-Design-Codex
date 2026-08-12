'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { BmcIcon } from './BmcShared';
import { useAuth } from './AuthProvider';
import { fetchCheckoutSession, fetchFulfillmentJob, type CheckoutSession, type FulfillmentJob } from '../lib/api';
import { deriveConfirmationPhase } from './deliveryConfirmationState';

function DeliveryConfirmationApp() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const fulfillmentJobId = searchParams.get('fulfillmentJobId');
  const [session, setSession] = React.useState<CheckoutSession | null>(null);
  const [fulfillmentJob, setFulfillmentJob] = React.useState<FulfillmentJob | null>(null);
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>(sessionId ? 'loading' : 'error');
  const [loadError, setLoadError] = React.useState<string | null>(
    sessionId ? null : 'No checkout session was provided.',
  );

  React.useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoadState('loading');
    setLoadError(null);
    Promise.resolve()
      .then(async () => {
        const nextSession = await fetchCheckoutSession(sessionId);
        const nextJob =
          nextSession.purpose === 'physical_order' && fulfillmentJobId
            ? await fetchFulfillmentJob(fulfillmentJobId)
            : null;
        if (!active) return;
        setSession(nextSession);
        setFulfillmentJob(nextJob);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'The server-owned confirmation could not be verified.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [fulfillmentJobId, sessionId]);

  const phase = deriveConfirmationPhase(session, fulfillmentJob);
  const reconciled = loadState === 'ready' && phase === 'reconciled';
  const paymentVerified = loadState === 'ready' && ['payment_only', 'reconciled'].includes(phase);
  const heading = reconciled
    ? 'Test flow reconciled'
    : paymentVerified
      ? 'Test payment reconciled'
      : loadState === 'loading'
        ? 'Verifying confirmation'
        : 'Confirmation not verified';
  const explanation = reconciled
    ? 'Authenticated server records confirm the deterministic local result. No external payment, print, mail, or email action occurred.'
    : paymentVerified
      ? 'The authenticated checkout is complete, but a matching fulfillment result was not verified.'
      : loadError ||
        (phase === 'mismatch'
          ? 'The checkout and fulfillment records do not belong to the same order.'
          : 'Open this page from the local hosted-checkout flow to verify its server-owned result.');

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <Navbar
        loggedIn={auth.status === 'authenticated'}
        user={auth.displayUser ?? undefined}
        credits={{ images: 0, songs: 0 }}
        cardBank={0}
        cartCount={0}
      />
      <main className="bmc-shell">
        <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 40px', maxWidth: 780 }}>
          <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bmc-eyebrow-num">08</span>
            <span>Confirmation</span>
          </div>
          <h1 className="bmc-title">
            {heading.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">{heading.split(' ').at(-1)}</span>
          </h1>
          <p className="bmc-lede" style={{ margin: '0 auto' }}>
            {explanation}
          </p>
        </div>

        <div className="bmc-card dlv-section" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="dlv-section-title">
            <span className="dlv-section-num">{reconciled ? '✓' : '!'}</span>
            {reconciled ? 'Authenticated deterministic result' : 'Verification incomplete'}
          </div>
          <div className="co-confirm-rows" style={{ marginTop: 18 }}>
            <div className="co-confirm-row">
              <span className="co-confirm-row-k">Payment state</span>
              <span className="co-confirm-row-v">{paymentVerified ? 'Verified locally' : 'Not verified'}</span>
            </div>
            <div className="co-confirm-row">
              <span className="co-confirm-row-k">Resource</span>
              <span className="co-confirm-row-v">
                {session?.orderId
                  ? `Order ${session.orderId.slice(0, 8)}`
                  : session?.creditPackPurchaseId
                    ? `Credit pack ${session.creditPackPurchaseId.slice(0, 8)}`
                    : 'None verified'}
              </span>
            </div>
            <div className="co-confirm-row">
              <span className="co-confirm-row-k">Fulfillment</span>
              <span className="co-confirm-row-v">
                {session?.purpose === 'credit_pack'
                  ? 'Not applicable'
                  : fulfillmentJob
                    ? `${fulfillmentJob.status} · ${fulfillmentJob.id.slice(0, 8)}`
                    : 'Not verified'}
              </span>
            </div>
          </div>
          <div className="bmc-modal-acts" style={{ marginTop: 24 }}>
            <Link href="/create/my-cards-and-songs" className="bmc-cta-secondary">
              Saved cards &amp; songs
            </Link>
            <Link href="/create" className="bmc-cta">
              Create another <BmcIcon name="arrow" w={15} />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export { DeliveryConfirmationApp };
