'use client';

import Link from 'next/link';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { BmcIcon } from './BmcShared';
import { useAuth } from './AuthProvider';

function DeliveryConfirmationApp() {
  const auth = useAuth();

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar
          loggedIn={auth.status === 'authenticated'}
          user={auth.displayUser ?? undefined}
          credits={{ images: 0, songs: 0 }}
          cardBank={0}
          cartCount={0}
        />
        <main className="bmc-shell" data-screen-label="08 Delivery Confirmation">
          <div className="bmc-head" style={{ textAlign: 'center', margin: '0 auto 36px', maxWidth: 760 }}>
            <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
              <span className="bmc-eyebrow-num">08</span>
              <span>Confirmation</span>
            </div>
            <h1 className="bmc-title">
              Order confirmation <span className="souv-hero-italic text-metallic-rose-gold">coming soon</span>
            </h1>
            <p className="bmc-lede" style={{ margin: '0 auto' }}>
              Checkout and fulfillment are intentionally disabled until the approved Stripe test and Scribeless sandbox
              integrations are implemented.
            </p>
          </div>

          <div className="bmc-card dlv-section" style={{ maxWidth: 760, margin: '0 auto' }}>
            <div className="dlv-section-title">
              <span className="dlv-section-num">!</span>
              No transaction performed
            </div>
            <div className="co-confirm-rows" style={{ marginTop: 18 }}>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Payment</span>
                <span className="co-confirm-row-v">Not created</span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Order</span>
                <span className="co-confirm-row-v">Not created</span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Fulfillment</span>
                <span className="co-confirm-row-v">Not submitted</span>
              </div>
            </div>
            <div className="bmc-modal-acts" style={{ marginTop: 24 }}>
              <Link href="/create/my-cards-and-songs" className="bmc-cta-secondary">
                Saved Cards &amp; Songs
              </Link>
              <Link href="/create" className="bmc-cta">
                Create another <BmcIcon name="arrow" w={15} />
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export { DeliveryConfirmationApp };
