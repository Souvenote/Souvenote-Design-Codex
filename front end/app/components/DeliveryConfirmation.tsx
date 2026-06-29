"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { BmcIcon } from "./BmcShared";
import { demoUser } from "./DemoUser";
import { useDemoBalance, ZERO_DEMO_BALANCE } from "./DemoBalance";
import { MOCK_MVP_FLOW_UPDATED_EVENT, readMockMvpFlowState } from "../lib/mockMvpFlow";

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "Not returned";
}

function DeliveryConfirmationApp() {
  const demoBalance = useDemoBalance(ZERO_DEMO_BALANCE);
  const [flowState, setFlowState] = React.useState(() => readMockMvpFlowState());

  React.useEffect(() => {
    const sync = () => setFlowState(readMockMvpFlowState());

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(MOCK_MVP_FLOW_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MOCK_MVP_FLOW_UPDATED_EVENT, sync);
    };
  }, []);

  const fulfilled = flowState.orderStatus === "fulfilled_mock";

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar loggedIn user={demoUser} credits={demoBalance.credits} cardBank={demoBalance.cardBank} cartCount={0} />
        <main className="bmc-shell" data-screen-label="08 Delivery Confirmation">
          <div className="bmc-head" style={{ textAlign: "center", margin: "0 auto 36px", maxWidth: 760 }}>
            <div className="bmc-eyebrow" style={{ justifyContent: "center" }}>
              <span className="bmc-eyebrow-num">08</span>
              <span>Confirmation</span>
            </div>
            <h1 className="bmc-title">
              {fulfilled ? "Fulfilled " : "Order "}
              <span className="souv-hero-italic text-metallic-rose-gold">locally</span>
            </h1>
            <p className="bmc-lede" style={{ margin: "0 auto" }}>
              {fulfilled
                ? "The mock backend has marked this order as fulfilled_mock. This is the final local MVP stop before real auth, Stripe, S3, AI providers, and Scribeless are added."
                : "No fulfilled mock order is stored yet. Complete checkout and mock fulfillment from Delivery first."}
            </p>
          </div>

          <div className="bmc-card dlv-section" style={{ maxWidth: 760, margin: "0 auto" }}>
            <div className="dlv-section-title">
              <span className="dlv-section-num">{fulfilled ? <BmcIcon name="check" w={15} /> : "!"}</span>
              Backend result
            </div>
            <div className="co-confirm-rows" style={{ marginTop: 18 }}>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Order status</span><span className="co-confirm-row-v">{flowState.orderStatus || "Not started"}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Order ID</span><span className="co-confirm-row-v">{shortId(flowState.orderId)}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Card draft</span><span className="co-confirm-row-v">{shortId(flowState.cardDraftId)}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Selected asset</span><span className="co-confirm-row-v">{shortId(flowState.selectedAssetId)}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Checkout session</span><span className="co-confirm-row-v">{shortId(flowState.checkoutSessionId)}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Payment</span><span className="co-confirm-row-v">{shortId(flowState.paymentId)}</span></div>
              <div className="co-confirm-row"><span className="co-confirm-row-k">Fulfillment</span><span className="co-confirm-row-v">{shortId(flowState.fulfillment?.mockFulfillmentId || flowState.fulfillment?.id)}</span></div>
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
