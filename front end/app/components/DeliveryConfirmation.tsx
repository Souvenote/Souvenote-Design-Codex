"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { BmcIcon } from "./BmcShared";
import { demoUser } from "./DemoUser";
import { fetchFulfillments, fetchOrder, refreshFulfillment } from "../lib/api";
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

const FULFILLMENT_ORDER_STATUSES = new Set([
  "fulfillment_started",
  "fulfillment_submitted",
  "printing",
  "shipped",
  "delivered",
  "fulfillment_on_hold",
  "fulfillment_failed",
  "fulfilled_mock",
  "failed_mock",
]);

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "Not returned";
}

function DeliveryConfirmationApp({
  initialOrderId = null,
}: DeliveryConfirmationAppProps) {
  const [flowState, setFlowState] = React.useState(() =>
    readMockMvpFlowState(),
  );
  const [lookupStatus, setLookupStatus] =
    React.useState<OrderLookupStatus>("idle");
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const requestedOrderId = initialOrderId || flowState.orderId;
  const stateMatchesRequestedOrder =
    !requestedOrderId || flowState.orderId === requestedOrderId;
  const visibleFlowState = stateMatchesRequestedOrder
    ? flowState
    : {
        ...flowState,
        cardDraftId: null,
        selectedAssetId: null,
        orderId: requestedOrderId,
        orderStatus: null,
        checkoutSessionId: null,
        paymentId: null,
        fulfillment: null,
      };

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

  React.useEffect(() => {
    const orderId = requestedOrderId ?? "";
    if (!orderId) {
      setLookupStatus("idle");
      setLookupError(null);
      return;
    }

    let active = true;
    setLookupStatus("loading");
    setLookupError(null);

    async function hydrateOrder() {
      try {
        const order = await fetchOrder(orderId);
        if (!active) return;
        rememberCheckoutResult(order);

        if (FULFILLMENT_ORDER_STATUSES.has(order.status)) {
          const fulfillments = await fetchFulfillments(order.id);
          if (!active) return;
          const latestFulfillment = fulfillments[0];
          if (latestFulfillment) {
            rememberFulfillmentResult(order, latestFulfillment);
          }
        }

        if (active) setLookupStatus("ready");
      } catch (error) {
        if (!active) return;
        setLookupStatus("error");
        setLookupError(
          error instanceof Error
            ? error.message
            : "The order confirmation could not be loaded.",
        );
      }
    }

    void hydrateOrder();
    return () => {
      active = false;
    };
  }, [requestedOrderId]);

  React.useEffect(() => {
    const orderId = visibleFlowState.orderId;
    const shouldPoll = [
      "fulfillment_started",
      "fulfillment_submitted",
      "printing",
    ].includes(visibleFlowState.orderStatus || "");
    if (!orderId || !shouldPoll) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const result = await refreshFulfillment(orderId);
        if (active) rememberFulfillmentResult(result.order, result.fulfillment);
      } catch {
        // Keep the last durable state visible; a later poll can recover.
      } finally {
        if (active) timer = setTimeout(() => void poll(), 10_000);
      }
    };
    timer = setTimeout(() => void poll(), 2_000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [visibleFlowState.orderId, visibleFlowState.orderStatus]);

  const status = visibleFlowState.orderStatus || "";
  const fulfilled = ["fulfilled_mock", "shipped", "delivered"].includes(status);
  const inProduction = [
    "fulfillment_started",
    "fulfillment_submitted",
    "printing",
  ].includes(status);
  const onHold = [
    "fulfillment_on_hold",
    "fulfillment_failed",
    "failed_mock",
  ].includes(status);
  const heading =
    status === "delivered"
      ? "Delivered"
      : status === "shipped"
        ? "On its way"
        : status === "fulfilled_mock"
          ? "Fulfilled locally"
          : inProduction
            ? "In production"
            : onHold
              ? "Needs attention"
              : "Order confirmation";
  const description =
    status === "fulfilled_mock"
      ? "The local fulfillment provider completed this order without contacting an external print service."
      : status === "shipped"
        ? "Scribeless has marked every recipient in this order as shipped."
        : status === "delivered"
          ? "Every recipient in this order has reached the delivered state."
          : inProduction
            ? "Your paid order has been submitted safely. Fulfillment status can be refreshed from Delivery as Scribeless processes each recipient."
            : onHold
              ? flowState.fulfillment?.statusReason ||
                "This order is on hold so it cannot be submitted twice while the provider outcome is reviewed."
              : "Complete secure checkout and submit fulfillment from Delivery to start production.";

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar
          user={demoUser}
          credits={{ images: 0, songs: 0 }}
          cardBank={0}
          cartCount={0}
        />
        <main
          className="bmc-shell"
          data-screen-label="08 Delivery Confirmation"
        >
          <div
            className="bmc-head"
            style={{
              textAlign: "center",
              margin: "0 auto 36px",
              maxWidth: 760,
            }}
          >
            <div className="bmc-eyebrow" style={{ justifyContent: "center" }}>
              <span className="bmc-eyebrow-num">08</span>
              <span>Confirmation</span>
            </div>
            <h1 className="bmc-title">
              <span className="souv-hero-italic text-metallic-rose-gold">
                {heading}
              </span>
            </h1>
            <p className="bmc-lede" style={{ margin: "0 auto" }}>
              {description}
            </p>
          </div>

          <div
            className="bmc-card dlv-section"
            style={{ maxWidth: 760, margin: "0 auto" }}
          >
            <div className="dlv-section-title">
              <span className="dlv-section-num">
                {fulfilled || inProduction ? (
                  <BmcIcon name="check" w={15} />
                ) : (
                  "!"
                )}
              </span>
              Backend result
            </div>
            {lookupStatus === "loading" && (
              <p className="acc-save-state" role="status">
                Refreshing the owner-scoped order and fulfillment record...
              </p>
            )}
            {lookupStatus === "error" && (
              <p className="acc-save-state is-error" role="alert">
                {lookupError}
              </p>
            )}
            {!requestedOrderId && (
              <p className="acc-save-state" role="status">
                Open this page from Delivery to load an order confirmation.
              </p>
            )}
            <div className="co-confirm-rows" style={{ marginTop: 18 }}>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Order status</span>
                <span className="co-confirm-row-v">
                  {visibleFlowState.orderStatus || "Not started"}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Order ID</span>
                <span className="co-confirm-row-v">
                  {shortId(visibleFlowState.orderId)}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Card draft</span>
                <span className="co-confirm-row-v">
                  {shortId(visibleFlowState.cardDraftId)}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Selected asset</span>
                <span className="co-confirm-row-v">
                  {shortId(visibleFlowState.selectedAssetId)}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Checkout session</span>
                <span className="co-confirm-row-v">
                  {shortId(visibleFlowState.checkoutSessionId)}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Payment</span>
                <span className="co-confirm-row-v">
                  {shortId(visibleFlowState.paymentId)}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Fulfillment</span>
                <span className="co-confirm-row-v">
                  {shortId(
                    visibleFlowState.fulfillment?.providerFulfillmentId ||
                      visibleFlowState.fulfillment?.mockFulfillmentId ||
                      visibleFlowState.fulfillment?.id,
                  )}
                </span>
              </div>
              <div className="co-confirm-row">
                <span className="co-confirm-row-k">Provider status</span>
                <span className="co-confirm-row-v">
                  {visibleFlowState.fulfillment?.providerStatus ||
                    visibleFlowState.fulfillment?.status ||
                    "Not submitted"}
                </span>
              </div>
            </div>
            <div className="bmc-modal-acts" style={{ marginTop: 24 }}>
              <Link
                href="/create/my-cards-and-songs"
                className="bmc-cta-secondary"
              >
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
