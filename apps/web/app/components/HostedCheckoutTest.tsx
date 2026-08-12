'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BmcIcon } from './BmcShared';
import { useAuth } from './AuthProvider';
import { completeMockCheckout, fetchCheckoutSession, submitMockFulfillment, type CheckoutSession } from '../lib/api';

type HostedCheckoutTestProps = {
  sessionId: string;
  variant: 'personalized' | 'blank_handoff';
};

function cad(amountMinor: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amountMinor / 100);
}

function HostedCheckoutTest({ sessionId, variant }: HostedCheckoutTestProps) {
  const router = useRouter();
  const auth = useAuth();
  const [session, setSession] = React.useState<CheckoutSession | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetchCheckoutSession(sessionId)
      .then((next) => {
        if (!active) return;
        setSession(next);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : 'Checkout could not be loaded.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  async function confirm() {
    if (!session || state === 'submitting') return;
    setState('submitting');
    setMessage(null);
    try {
      const completed = await completeMockCheckout(session.id);
      let fulfillmentJobId = '';
      if (completed.purpose === 'physical_order' && completed.orderId) {
        const job = await submitMockFulfillment(completed.orderId, variant);
        fulfillmentJobId = job.id;
      }
      const params = new URLSearchParams({
        sessionId: completed.id,
        ...(fulfillmentJobId ? { fulfillmentJobId } : {}),
      });
      router.push(`/delivery/confirmation?${params.toString()}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Checkout could not be completed.');
      setState('error');
    }
  }

  return (
    <>
      <Navbar
        loggedIn={auth.status === 'authenticated'}
        user={auth.displayUser ?? undefined}
        credits={{ images: 0, songs: 0 }}
        cardBank={0}
        cartCount={0}
      />
      <main className="bmc-shell" data-screen-label="Provider-hosted test checkout">
        <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 32px', maxWidth: 720 }}>
          <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
            <BmcIcon name="lock" w={15} /> Hosted checkout simulator
          </div>
          <h1 className="bmc-title">
            Confirm your <span className="souv-hero-italic text-metallic-gold">test checkout</span>
          </h1>
          <p className="bmc-lede" style={{ margin: '0 auto' }}>
            This local screen models a provider-hosted redirect. It deliberately contains no card-number, expiry, or
            security-code inputs, so raw payment details never enter Souvenote.
          </p>
        </div>

        <section className="bmc-card dlv-section" style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="dlv-section-title">
            <span className="dlv-section-num">$</span>
            Server-owned total
          </div>
          {session ? (
            <div className="co-confirm-rows" style={{ marginTop: 18 }}>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Purchase</span>
                <span className="co-confirm-row-v">
                  {session.purpose === 'credit_pack' ? 'Creation credit pack' : 'Physical Souvenote'}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Collection</span>
                <span className="co-confirm-row-v">
                  {session.collectionMode === 'manual' ? '5-day authorization' : 'Automatic capture'}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Total</span>
                <span className="co-confirm-row-v text-metallic-gold">{cad(session.amountMinor)} CAD</span>
              </div>
            </div>
          ) : (
            <p className="bmc-lede">Loading the server-owned checkout snapshot…</p>
          )}
          {message && (
            <p className="opt-pricing-state is-error" role="alert" style={{ marginTop: 18 }}>
              {message}
            </p>
          )}
          <div className="bmc-modal-acts" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="bmc-cta"
              disabled={!session || state === 'loading' || state === 'submitting' || session.status !== 'open'}
              onClick={() => void confirm()}
            >
              {state === 'submitting' ? 'Reconciling…' : 'Confirm deterministic test payment'}{' '}
              <BmcIcon name="arrow" w={15} />
            </button>
          </div>
          <p className="cart-secure" style={{ marginTop: 14 }}>
            <BmcIcon name="lock" w={13} /> No external payment, print, email, or provider call occurs.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

export { HostedCheckoutTest };
