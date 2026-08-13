"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { BmcIcon } from "./BmcShared";
import { useAuth } from "./AuthProvider";
import { fetchFulfillments, fetchOrder } from "../lib/api";
import type { FulfillmentRecord, Order } from "../lib/api";
import {
  DELIVERY_CONFIRMATION_STEPS,
  deliveryConfirmationPresentation,
  deliveryOrderNumber,
  formatOrderDate,
  formatOrderMoney,
  formatRecipientSummary,
  safeTrackingUrl,
} from "./deliveryConfirmationRules";
import {
  MOCK_MVP_FLOW_UPDATED_EVENT,
  readMockMvpFlowState,
  rememberCheckoutResult,
  rememberFulfillmentResult,
} from "../lib/mockMvpFlow";

type DeliveryConfirmationAppProps = {
  initialOrderId?: string | null;
};

type OrderLookupStatus = "idle" | "loading" | "ready" | "error";

function supportValue(value: string | null | undefined) {
  return value || "Not returned";
}

function nextStepCopy(status: string, tone: string) {
  if (status === "fulfilled_mock") {
    return "This preview stopped before any physical card or provider request was created.";
  }
  if (status === "delivered") {
    return "Your completed card stays in Saved Cards & Songs, ready to revisit whenever you like.";
  }
  if (status === "shipped") {
    return "Use the tracking link when available. Delivery timing is controlled by the carrier.";
  }
  if (tone === "warning") {
    return "Return to Delivery to review the order. Souvenote will not duplicate a held fulfillment request.";
  }
  if (["fulfillment_started", "fulfillment_submitted", "printing"].includes(status)) {
    return "We will keep this page updated as production moves forward. You can also refresh it at any time.";
  }
  return "Your order is securely saved. Production and delivery updates will appear here as they become available.";
}

function DeliveryConfirmationApp({ initialOrderId = null }: DeliveryConfirmationAppProps) {
  const auth = useAuth();
  const [flowState, setFlowState] = React.useState(() => readMockMvpFlowState());
  const [orderRecord, setOrderRecord] = React.useState<Order | null>(null);
  const [fulfillmentRecord, setFulfillmentRecord] = React.useState<FulfillmentRecord | null>(null);
  const [lookupStatus, setLookupStatus] = React.useState<OrderLookupStatus>("idle");
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const requestedOrderId = initialOrderId || flowState.orderId;
  const stateMatchesRequestedOrder = !requestedOrderId || flowState.orderId === requestedOrderId;
  const fallbackFulfillment = stateMatchesRequestedOrder ? flowState.fulfillment : null;
  const currentFulfillment = fulfillmentRecord || fallbackFulfillment;
  const currentStatus = orderRecord?.status || (stateMatchesRequestedOrder ? flowState.orderStatus : null) || "";
  const secureStatus = auth.status === "authenticated" ? currentStatus : "";
  const presentation = deliveryConfirmationPresentation(secureStatus, currentFulfillment?.statusReason);
  const orderId = orderRecord?.id || requestedOrderId;
  const trackingUrl = safeTrackingUrl(orderRecord?.trackingUrl);
  const returnTo = orderId
    ? `/delivery/confirmation?orderId=${encodeURIComponent(orderId)}`
    : "/delivery/confirmation";

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

  const loadOrder = React.useCallback(async (quiet = false) => {
    if (auth.status !== "authenticated" || !requestedOrderId) return;
    if (!quiet) setLookupStatus("loading");
    setLookupError(null);

    try {
      const order = await fetchOrder(requestedOrderId);
      setOrderRecord(order);
      rememberCheckoutResult(order);

      const fulfillments = await fetchFulfillments(order.id);
      const latestFulfillment = fulfillments[0] || null;
      setFulfillmentRecord(latestFulfillment);
      if (latestFulfillment) rememberFulfillmentResult(order, latestFulfillment);
      setLookupStatus("ready");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "The order confirmation could not be loaded.";
      setLookupError(message);
      if (!quiet) setLookupStatus("error");
    }
  }, [auth.status, requestedOrderId]);

  React.useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status !== "authenticated" || !requestedOrderId) {
      setLookupStatus("idle");
      setLookupError(null);
      return;
    }
    void loadOrder();
  }, [auth.status, loadOrder, requestedOrderId]);

  React.useEffect(() => {
    if (auth.status !== "authenticated" || !requestedOrderId || !presentation.shouldPoll) return;
    const timer = window.setInterval(() => void loadOrder(true), 15_000);
    return () => window.clearInterval(timer);
  }, [auth.status, loadOrder, presentation.shouldPoll, requestedOrderId]);

  const quantity = orderRecord?.quantity || currentFulfillment?.providerRecipientIds?.length || 1;
  const recipientSummary = formatRecipientSummary(orderRecord?.recipientAddress, quantity);
  const orderTotal = formatOrderMoney(orderRecord?.amountCents, orderRecord?.currency || "CAD");
  const placedOn = formatOrderDate(orderRecord?.createdAt);
  const estimatedDelivery = formatOrderDate(currentFulfillment?.estimatedDelivery);
  const updatedOn = formatOrderDate(currentFulfillment?.lastSyncedAt || orderRecord?.fulfillmentStatusUpdatedAt || orderRecord?.updatedAt);
  const fulfillmentId = currentFulfillment?.providerFulfillmentId
    || currentFulfillment?.mockFulfillmentId
    || currentFulfillment?.id;
  const hasConfirmation = Boolean(
    orderRecord || (stateMatchesRequestedOrder && currentStatus),
  );

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar credits={{ images: 0, songs: 0 }} cardBank={0} cartCount={0} />
        <main className="bmc-shell dc-shell" data-screen-label="08 Delivery Confirmation">
          <div className="bmc-head dc-head">
            <div className="bmc-eyebrow dc-eyebrow">
              <span className="bmc-eyebrow-num">08</span>
              <span>Delivery confirmation</span>
            </div>
            <h1 className="bmc-title">
              <span className="souv-hero-italic text-metallic-rose-gold">{presentation.heading}</span>
            </h1>
            <p className="bmc-lede">{presentation.description}</p>
          </div>

          {auth.status === "loading" && (
            <section className="bmc-card dc-state-card" role="status">
              <span className="bmc-gen-spin" aria-hidden="true" />
              <h2>Checking your secure session</h2>
              <p>One moment while Souvenote prepares your private order confirmation.</p>
            </section>
          )}

          {auth.status !== "loading" && auth.status !== "authenticated" && (
            <section className="bmc-card dc-state-card">
              <span className="dc-state-icon"><BmcIcon name="lock" w={28} /></span>
              <h2>Sign in to view this order</h2>
              <p>Delivery confirmations contain private recipient and fulfillment details tied to your Souvenote account.</p>
              <div className="dc-state-actions">
                <Link className="bmc-cta" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Log in <BmcIcon name="arrow" w={15} /></Link>
                <Link className="bmc-cta-secondary" href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Create account</Link>
              </div>
            </section>
          )}

          {auth.status === "authenticated" && !requestedOrderId && (
            <section className="bmc-card dc-state-card">
              <span className="dc-state-icon"><BmcIcon name="message" w={28} /></span>
              <h2>No order selected</h2>
              <p>Open a completed order from Delivery or your account to see its confirmation and fulfillment timeline.</p>
              <Link className="bmc-cta" href="/delivery">Go to Delivery <BmcIcon name="arrow" w={15} /></Link>
            </section>
          )}

          {auth.status === "authenticated" && requestedOrderId && lookupStatus === "loading" && !hasConfirmation && (
            <section className="bmc-card dc-state-card" role="status">
              <span className="bmc-gen-spin" aria-hidden="true" />
              <h2>Loading your order</h2>
              <p>Refreshing the owner-scoped order and its latest fulfillment record.</p>
            </section>
          )}

          {auth.status === "authenticated" && requestedOrderId && lookupStatus === "error" && !hasConfirmation && (
            <section className="bmc-card dc-state-card is-warning" role="alert">
              <span className="dc-state-icon"><BmcIcon name="warn" w={28} /></span>
              <h2>We could not load this confirmation</h2>
              <p>{lookupError}</p>
              <button type="button" className="bmc-cta-secondary" onClick={() => void loadOrder()}>
                <BmcIcon name="refresh" w={15} /> Try again
              </button>
            </section>
          )}

          {auth.status === "authenticated" && requestedOrderId && hasConfirmation && (
            <>
              {lookupError && <p className="dc-inline-error" role="alert">{lookupError}</p>}
              <div className="dc-layout">
                <section className={`bmc-card dc-status-card is-${presentation.tone}`}>
                  <div className="dc-status-head">
                    <span className="dc-confirm-seal" aria-hidden="true">
                      <BmcIcon name={presentation.tone === "warning" ? "warn" : "check"} w={30} />
                    </span>
                    <div>
                      <div className="dc-order-number">Order {deliveryOrderNumber(orderId)}</div>
                      <div className={`dc-status-pill is-${presentation.tone}`} role="status">{presentation.statusLabel}</div>
                    </div>
                  </div>

                  <div className="dc-timeline" aria-label="Delivery progress">
                    {DELIVERY_CONFIRMATION_STEPS.map((step, index) => {
                      const done = presentation.tone === "success"
                        ? index <= presentation.activeStep
                        : index < presentation.activeStep;
                      const active = index === presentation.activeStep && !done;
                      return (
                        <div key={step} className={`dc-step ${done ? "is-done" : active ? "is-active" : "is-pending"}`} aria-current={active ? "step" : undefined}>
                          <div className="dc-step-rail">
                            <span className="dc-step-dot">{done ? <BmcIcon name="check" w={14} /> : index + 1}</span>
                            {index < DELIVERY_CONFIRMATION_STEPS.length - 1 && <span className="dc-step-line" />}
                          </div>
                          <span className="dc-step-label">{step}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dc-next-card">
                    <BmcIcon name={presentation.tone === "warning" ? "warn" : "spark2"} w={18} />
                    <div>
                      <strong>What happens next</strong>
                      <p>{nextStepCopy(currentStatus, presentation.tone)}</p>
                    </div>
                  </div>

                  <div className="dc-status-actions">
                    {trackingUrl && (
                      <a className="bmc-cta" href={trackingUrl} target="_blank" rel="noreferrer">
                        Track shipment <BmcIcon name="arrow" w={15} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="bmc-cta-secondary"
                      onClick={() => void loadOrder()}
                      disabled={lookupStatus === "loading"}
                    >
                      <BmcIcon name="refresh" w={15} /> {lookupStatus === "loading" ? "Refreshing..." : "Refresh status"}
                    </button>
                  </div>
                </section>

                <aside className="bmc-card dc-details-card">
                  <div className="dc-card-kicker">Order details</div>
                  <dl className="dc-detail-list">
                    <div><dt>Recipient</dt><dd>{recipientSummary}</dd></div>
                    <div><dt>{quantity === 1 ? "Card" : "Cards"}</dt><dd>{quantity}</dd></div>
                    <div><dt>Total</dt><dd>{orderTotal}</dd></div>
                    <div><dt>Placed</dt><dd>{placedOn}</dd></div>
                    <div><dt>Estimated delivery</dt><dd>{estimatedDelivery}</dd></div>
                    <div><dt>Last updated</dt><dd>{updatedOn}</dd></div>
                  </dl>

                  <details className="dc-support-details">
                    <summary>Technical details for support <BmcIcon name="chevron" w={14} /></summary>
                    <dl>
                      <div><dt>Order ID</dt><dd>{supportValue(orderId)}</dd></div>
                      <div><dt>Checkout session</dt><dd>{supportValue(orderRecord?.checkoutSessionId || (stateMatchesRequestedOrder ? flowState.checkoutSessionId : null))}</dd></div>
                      <div><dt>Payment</dt><dd>{supportValue(orderRecord?.paymentId || (stateMatchesRequestedOrder ? flowState.paymentId : null))}</dd></div>
                      <div><dt>Fulfillment</dt><dd>{supportValue(fulfillmentId)}</dd></div>
                      <div><dt>Provider status</dt><dd>{supportValue(currentFulfillment?.providerStatus || currentFulfillment?.status)}</dd></div>
                    </dl>
                  </details>
                </aside>
              </div>

              <div className="dc-page-actions">
                <Link href="/create/my-cards-and-songs" className="bmc-cta-secondary">Saved Cards &amp; Songs</Link>
                <Link href="/create" className="bmc-cta">Create another <BmcIcon name="arrow" w={15} /></Link>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export { DeliveryConfirmationApp };
