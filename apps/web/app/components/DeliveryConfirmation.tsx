'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { BmcIcon } from './BmcShared';
import { useAuth } from './AuthProvider';

function DeliveryConfirmationApp() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const purpose = searchParams.get('purpose');
  const orderId = searchParams.get('orderId');
  const purchaseId = searchParams.get('purchaseId');
  const fulfillmentJobId = searchParams.get('fulfillmentJobId');
  const fulfillmentStatus = searchParams.get('fulfillmentStatus');
  const completed = Boolean(searchParams.get('sessionId'));

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
              {completed ? 'Test flow ' : 'Confirmation '}
              <span className="souv-hero-italic text-metallic-rose-gold">
                {completed ? 'reconciled' : 'not available'}
              </span>
            </h1>
            <p className="bmc-lede" style={{ margin: '0 auto' }}>
              {completed
                ? 'The deterministic local provider state was recorded. No external payment, print, mail, or email action occurred.'
                : 'Open this page from the local hosted-checkout flow to see a verified test result.'}
            </p>
          </div>

          <div className="bmc-card dlv-section" style={{ maxWidth: 760, margin: '0 auto' }}>
            <div className="dlv-section-title">
              <span className="dlv-section-num">{completed ? '✓' : '!'}</span>
              {completed ? 'Deterministic test result' : 'No transaction performed'}
            </div>
            <div className="co-confirm-rows" style={{ marginTop: 18 }}>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Payment state</span>
                <span className="co-confirm-row-v">{completed ? 'Verified locally' : 'Not created'}</span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Resource</span>
                <span className="co-confirm-row-v">
                  {orderId
                    ? `Order ${orderId.slice(0, 8)}`
                    : purchaseId
                      ? `Credit pack ${purchaseId.slice(0, 8)}`
                      : 'None'}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Fulfillment</span>
                <span className="co-confirm-row-v">
                  {purpose === 'physical_order' && fulfillmentJobId
                    ? `${fulfillmentStatus || 'submitted'} · ${fulfillmentJobId.slice(0, 8)}`
                    : purpose === 'credit_pack'
                      ? 'Not applicable'
                      : 'Not submitted'}
                </span>
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
