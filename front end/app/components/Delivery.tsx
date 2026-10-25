"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { BmcIcon, BmcErrorModal, bmcError } from "./BmcShared";
import { DlvKeepsake } from "./DeliveryKeepsake";
import { consumeBlankSouvenoteGift, useBlankSouvenoteGiftCount } from "./GiftAddon";
import { completeMockCheckout, createOrder, fetchCardDraftAssets, startCheckout, submitFulfillment } from "../lib/api";
import type { CheckoutSession, FulfillmentRecord, Order, PostalAddress } from "../lib/api";
import {
  findGeneratedImageAsset,
  hasGeneratedAsset,
  MOCK_MVP_FLOW_UPDATED_EVENT,
  readMockMvpFlowState,
  rememberCheckoutResult,
  rememberFulfillmentResult,
  rememberSelectedAsset,
  writeMockMvpFlowState,
} from "../lib/mockMvpFlow";
import {
  DLV_EMPTY_RECIP,
  dlvCountry,
  dlvValidate,
  DlvRecipientSection,
  DlvReturnSection,
  DlvScheduleSection,
  DlvShippingSection,
} from "./DeliveryForm";
import type { DeliveryErrors, DeliveryMode, DeliveryRecipient, DeliveryWhen } from "./DeliveryForm";
import { readDemoBalance, useDemoBalance } from "./DemoBalance";
import type { DemoBalance } from "./DemoBalance";
import type { DemoCredits, DemoUser } from "./DemoUser";
import { rememberPricingReturn } from "./PricingReturn";
import {
  addPricingCartItemToCart,
  BIG_SENDER_TIERS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
} from "./pricingCatalog";

type DeliveryOrder = {
  number: string;
  to: string;
  carrier: string;
  scheduled: boolean;
  arrival: string;
  cards: number;
  cardsLeft: number;
};

type BackendAction =
  | "idle"
  | "loading_assets"
  | "creating_order"
  | "starting_checkout"
  | "completing_checkout"
  | "submitting_fulfillment";

type DlvSentModalProps = {
  open: boolean;
  order: DeliveryOrder | null;
  onClose: () => void;
};

type DlvToastProps = {
  msg?: string | null;
  onClose: () => void;
};

type DlvBlankGiftModalProps = {
  open: boolean;
  count: number;
  name: string;
  contact: string;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onClose: () => void;
  onKeepLater: () => void;
  onSaveGift: () => void;
};

type DlvCardTopUpModalProps = {
  open: boolean;
  onClose: () => void;
  onReserve: (quantity: number) => void;
};

type DeliveryAppProps = {
  user: DemoUser;
  initialCards?: number;
  initialCredits?: DemoCredits;
};

declare global {
  interface Window {
    __dlvSetCards?: React.Dispatch<React.SetStateAction<number>>;
    __dlvOpenCheckout?: () => void;
  }
}

function DlvSentModal({ open, order, onClose }: DlvSentModalProps) {
  if (!open || !order) return null;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="06 Delivery · Sent">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal co-confirm">
        <div className="co-confirm-seal"><BmcIcon name="check" w={38} /></div>
        <h2 className="bmc-modal-title" style={{ marginBottom: 6 }}>
          On its <span className="souv-hero-italic text-metallic-rose-gold">way</span>
        </h2>
        <p className="bmc-modal-sub" style={{ marginBottom: 4 }}>
          We&apos;re hand-writing your card now, and you&apos;ll get an email when it&apos;s posted.
        </p>
        <div className="co-confirm-order"><BmcIcon name="message" w={13} /> {order.number}</div>
        <div className="co-confirm-rows">
          <div className="co-confirm-row"><span className="co-confirm-row-k">To</span><span className="co-confirm-row-v">{order.to}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">Mailed via</span><span className="co-confirm-row-v">{order.carrier}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">{order.scheduled ? "Posts on" : "Estimated arrival"}</span><span className="co-confirm-row-v">{order.arrival}</span></div>
          <div className="co-confirm-row"><span className="co-confirm-row-k">Cards used</span><span className="co-confirm-row-v">{order.cards} {"\u00b7"} {order.cardsLeft} left</span></div>
        </div>
        <div className="bmc-modal-acts dlv-sent-acts">
          <Link href="/" className="dlv-sent-home" aria-label="Back to Souvenote">
            <BmcIcon name="back" w={16} />
            <img src="/assets/WordmarkLobster.png" alt="Souvenote" className="dlv-sent-home-logo" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function DlvToast({ msg, onClose }: DlvToastProps) {
  React.useEffect(() => {
    if (!msg) return undefined;
    const timer = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timer);
  }, [msg, onClose]);

  if (!msg) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 28,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 300,
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 22px",
      borderRadius: 9999,
      background: "var(--glass-strong)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(212,175,55,0.4)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: 12.5,
      letterSpacing: ".04em",
      color: "var(--gold-hi)",
    }}>
      <BmcIcon name="spark2" w={15} /> {msg}
    </div>
  );
}

function DlvBlankGiftModal({
  open,
  count,
  name,
  contact,
  onNameChange,
  onContactChange,
  onClose,
  onKeepLater,
  onSaveGift,
}: DlvBlankGiftModalProps) {
  if (!open || count <= 0) return null;

  const canSave = contact.trim().length > 3;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="dlv-blank-gift-title" data-screen-label="Delivery · Blank gift reminder">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal dlv-blank-gift-modal">
        <button type="button" className="bmc-modal-close" aria-label="Close" onClick={onClose}>
          <BmcIcon name="close" w={16} />
        </button>
        <div className="dlv-blank-gift-grid">
          <div className="dlv-blank-gift-copy">
            <div className="bmc-eyebrow dlv-blank-gift-eyebrow">
              <BmcIcon name="spark2" w={14} />
              <span>Blank Souvenote Gift</span>
            </div>
            <h2 id="dlv-blank-gift-title" className="bmc-modal-title">
              You have a blank <span className="souv-hero-italic text-metallic-gold">Souvenote</span> to give.
            </h2>
            <p className="bmc-modal-sub">
              Before you send this card, choose who should receive the blank Souvenote or keep it in your account for later.
            </p>
            <div className="dlv-blank-gift-fields">
              <label className="acc-flabel">Recipient name</label>
              <input className="input-dark" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Who should receive it?" />
              <label className="acc-flabel">Email or phone</label>
              <input className="input-dark" value={contact} onChange={(event) => onContactChange(event.target.value)} placeholder="name@example.com or phone" />
            </div>
          </div>
          <aside className="acc-panel acc-gift-summary dlv-blank-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">A Souvenote,<br />on you</span>
            </div>
            <div className="acc-gift-name">Blank Souvenote Gift</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row"><span className="k">Available</span><span className="v">{count} {count === 1 ? "gift" : "gifts"}</span></div>
              <div className="acc-summary-row"><span className="k">Recipient</span><span className="v">{contact.trim() ? "Ready to save" : "Choose now or later"}</span></div>
              <div className="acc-summary-row"><span className="k">Reminder</span><span className="v">Delivery step</span></div>
            </div>
          </aside>
        </div>
        <div className="bmc-modal-acts dlv-blank-gift-actions">
          <button type="button" className="bmc-cta-secondary" onClick={onKeepLater}>Keep for later</button>
          <button type="button" className="bmc-cta" onClick={onSaveGift} disabled={!canSave}>
            Save gift &amp; send card <BmcIcon name="arrow" w={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DlvCardTopUpModal({
  open,
  onClose,
  onReserve,
}: DlvCardTopUpModalProps) {
  const [qty, setQty] = React.useState(MIN_BIG_SENDER_CARDS);

  if (!open) return null;

  function setQtyClamped(nextRaw: number | string) {
    setQty(clampBigSenderQuantity(nextRaw));
  }

  const pricing = getBigSenderPricing(qty);
  const creationCredits = qty * 10;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="dlv-card-topup-title" data-screen-label="Delivery - Card balance top-up modal">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal dlv-card-topup-modal is-gold">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="bmc-eyebrow dlv-card-topup-eyebrow">
          <span>Card balance required</span>
        </div>
        <h2 id="dlv-card-topup-title" className="bmc-modal-title dlv-card-topup-title">
          Top up your card balance to send this{' '}
          <span className="dlv-card-topup-wordmark">
            <img src="/assets/WordmarkLobster.png" alt="Souvenote" />
          </span>
        </h2>
        <ul className="dlv-card-topup-sub" aria-label="Card balance benefits">
          <li className="dlv-card-topup-subline">Choose between Bulk, multi or single sends at delivery</li>
          <li className="dlv-card-topup-subline">Each card comes with 10 creation credits</li>
        </ul>

        <div className="dlv-card-topup-pack" aria-label="Choose card quantity">
          <div className="dlv-card-topup-tiers" role="list" aria-label="Volume tiers">
            {BIG_SENDER_TIERS.map((tier) => {
              const active = qty >= tier.min && qty <= tier.max;
              return (
                <button
                  key={tier.label}
                  type="button"
                  role="listitem"
                  className={`dlv-card-topup-tier ${active ? "is-active" : ""}`}
                  onClick={() => setQtyClamped(tier.min)}
                >
                  <span>{tier.label}</span>
                  <b>${tier.pricePerCard.toFixed(2)}</b>
                  <em>/ card</em>
                </button>
              );
            })}
          </div>

          <div className="dlv-card-topup-stepper">
            <span>How many cards?</span>
            <div className="dlv-card-topup-value">
              <strong>${pricing.totalText}</strong>
              <em>{creationCredits} credits</em>
            </div>
            <div className="dlv-card-topup-controls">
              <button type="button" aria-label="Decrease" onClick={() => setQtyClamped(qty - 1)} disabled={qty <= MIN_BIG_SENDER_CARDS}>-</button>
              <input
                aria-label="Card quantity"
                type="number"
                min={MIN_BIG_SENDER_CARDS}
                max={MAX_BIG_SENDER_CARDS}
                value={qty}
                onChange={(event) => setQtyClamped(event.target.value)}
              />
              <button type="button" aria-label="Increase" onClick={() => setQtyClamped(qty + 1)} disabled={qty >= MAX_BIG_SENDER_CARDS}>+</button>
            </div>
          </div>
        </div>

        <div className="bmc-modal-acts dlv-card-topup-actions">
          <button type="button" className="bmc-cta" onClick={() => onReserve(qty)}>
            Reserve {qty} {qty === 1 ? "card" : "cards"} - ${pricing.totalText} <BmcIcon name="arrow" w={15} />
          </button>
        </div>
        <p className="dlv-card-topup-fineprint">
          Your creations will be saved in "Saved Cards &amp; Songs" for 30 days upon generation.
        </p>
      </div>
    </div>
  );
}

function dlvArrival(_shipping: string, when: DeliveryWhen, date: string) {
  const base = when === "schedule" && date ? new Date(date + "T12:00:00") : new Date();
  const add = 7;
  if (when !== "schedule") base.setDate(base.getDate() + add + 1);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (when === "schedule" && date) return base.toLocaleDateString("en-CA", opts);
  return "~" + base.toLocaleDateString("en-CA", opts);
}

const DELIVERY_DEFAULT_CREDITS: DemoCredits = { images: 0, songs: 0 };

function dlvRecipientName(recipient: DeliveryRecipient, fallback: string) {
  return [recipient.firstName, recipient.lastName].filter(Boolean).join(" ").trim() || fallback;
}

function dlvPostalAddress(recipient: DeliveryRecipient, fallbackName: string): PostalAddress {
  const line1 = [recipient.address1, recipient.address2, recipient.address3].filter(Boolean).join(", ");

  return {
    name: dlvRecipientName(recipient, fallbackName),
    line1: line1 || "123 Main St",
    city: recipient.city || "Toronto",
    region: recipient.state || "ON",
    postalCode: recipient.postalCode || "M1M 1M1",
    country: recipient.country || "CA",
  };
}

function deliveryOrderNumber(orderId: string | null | undefined) {
  return orderId ? `SVN-${orderId.slice(0, 8).toUpperCase()}` : "SVN-MOCK";
}

function backendStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "Order created";
    case "checkout_started":
      return "Mock checkout started";
    case "paid_mock":
      return "Mock checkout paid";
    case "fulfillment_started":
      return "Mock fulfillment started";
    case "fulfilled_mock":
      return "Fulfilled locally";
    case "failed_mock":
      return "Mock fulfillment failed";
    default:
      return "Ready for mock checkout";
  }
}

function DeliveryApp({ user, initialCards = 0, initialCredits = DELIVERY_DEFAULT_CREDITS }: DeliveryAppProps) {
  const router = useRouter();
  const defaultBalance: DemoBalance = React.useMemo(
    () => ({ credits: initialCredits, cardBank: initialCards }),
    [initialCards, initialCredits],
  );
  const demoBalance = useDemoBalance(defaultBalance);

  const [mode, setMode] = React.useState<DeliveryMode>("single");
  const [quantity, setQuantity] = React.useState(1);
  const [recipients, setRecipients] = React.useState<DeliveryRecipient[]>([]);
  const [draft, setDraft] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    firstName: "Alex",
    lastName: "Smith",
    address1: "123 Main St",
    city: "Toronto",
    state: "ON",
    postalCode: "M1M 1M1",
    country: "CA",
  });
  const [errors, setErrors] = React.useState<DeliveryErrors>({});
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [returnOn, setReturnOn] = React.useState(true);
  const [sender, setSender] = React.useState<DeliveryRecipient>({
    ...DLV_EMPTY_RECIP,
    firstName: "Samuel",
    lastName: "Mathew",
    address1: "456 Sender St",
    city: "Waterloo",
    state: "ON",
    postalCode: "N2L 1A1",
    country: "CA",
  });
  const [when, setWhen] = React.useState<DeliveryWhen>("now");
  const [date, setDate] = React.useState("");
  const [shipping, setShipping] = React.useState("standard");
  const [cardBank, setCardBank] = React.useState(demoBalance.cardBank);
  const [song, setSong] = React.useState(false);
  const [flowState, setFlowState] = React.useState(() => readMockMvpFlowState());
  const [backendOrder, setBackendOrder] = React.useState<Order | null>(null);
  const [checkoutSession, setCheckoutSession] = React.useState<CheckoutSession | null>(null);
  const [fulfillment, setFulfillment] = React.useState<FulfillmentRecord | null>(null);
  const [backendAction, setBackendAction] = React.useState<BackendAction>("idle");
  const [backendError, setBackendError] = React.useState<string | null>(null);
  const assetLookupDraftRef = React.useRef<string | null>(null);
  const songIncluded = flowState.generatedAssets.length ? hasGeneratedAsset(flowState.generatedAssets, "song") : true;
  const [sent, setSent] = React.useState<DeliveryOrder | null>(null);
  const blankGiftCount = useBlankSouvenoteGiftCount();
  const [giftReminderDismissed, setGiftReminderDismissed] = React.useState(false);
  const [giftModalOpen, setGiftModalOpen] = React.useState(false);
  const [cardTopUpOpen, setCardTopUpOpen] = React.useState(false);
  const [giftRecipientName, setGiftRecipientName] = React.useState("");
  const [giftRecipientContact, setGiftRecipientContact] = React.useState("");

  React.useEffect(() => {
    setCardBank(demoBalance.cardBank);
  }, [demoBalance.cardBank]);

  const selectedImageAssetId = flowState.selectedAssetId || findGeneratedImageAsset(flowState.generatedAssets)?.id || null;
  const cardsNeeded = mode === "single" ? quantity : Math.max(recipients.length, 0);
  const orderStatus = backendOrder?.status || flowState.orderStatus;
  const hasBackendOrderInputs = Boolean(flowState.cardDraftId && selectedImageAssetId);
  const enough = hasBackendOrderInputs && cardsNeeded > 0;
  const needsCardTopUp = false;
  const backendBusy = backendAction !== "idle";
  const carrier = dlvCountry(draft.country).carrier;
  const goToPricing = React.useCallback(() => {
    router.push("/pricing");
  }, [router]);

  React.useEffect(() => {
    const liveCardBank = readDemoBalance(defaultBalance).cardBank;

    if (liveCardBank >= cardsNeeded && cardsNeeded > 0) {
      setCardBank(liveCardBank);
      setCardTopUpOpen(false);
      return;
    }

    if (needsCardTopUp && !sent) setCardTopUpOpen(true);
  }, [cardsNeeded, defaultBalance, needsCardTopUp, sent]);

  React.useEffect(() => {
    const syncFlowState = () => setFlowState(readMockMvpFlowState());

    syncFlowState();
    window.addEventListener("storage", syncFlowState);
    window.addEventListener(MOCK_MVP_FLOW_UPDATED_EVENT, syncFlowState);
    return () => {
      window.removeEventListener("storage", syncFlowState);
      window.removeEventListener(MOCK_MVP_FLOW_UPDATED_EVENT, syncFlowState);
    };
  }, []);

  React.useEffect(() => {
    if (
      !flowState.cardDraftId
      || selectedImageAssetId
      || backendAction !== "idle"
      || assetLookupDraftRef.current === flowState.cardDraftId
    ) return;

    let active = true;
    assetLookupDraftRef.current = flowState.cardDraftId;
    setBackendAction("loading_assets");
    setBackendError(null);

    fetchCardDraftAssets(flowState.cardDraftId)
      .then((assets) => {
        if (!active || !flowState.cardDraftId) return;
        const imageAsset = findGeneratedImageAsset(assets);
        if (imageAsset?.id) {
          rememberSelectedAsset(flowState.cardDraftId, imageAsset.id, assets);
        } else {
          setBackendError("Generated image asset is not ready yet. Go back to Review and wait for generation to finish.");
        }
      })
      .catch((error) => {
        if (!active) return;
        setBackendError(error instanceof Error ? error.message : "Generated assets could not be loaded from the backend.");
      })
      .finally(() => {
        if (active) setBackendAction("idle");
      });

    return () => {
      active = false;
    };
  }, [backendAction, flowState.cardDraftId, selectedImageAssetId]);

  React.useEffect(() => {
    window.__dlvSetCards = setCardBank;
    window.__dlvOpenCheckout = goToPricing;
  }, [goToPricing]);

  function buildSentOrder(order: Order): DeliveryOrder {
    const primary = mode === "single" ? draft : recipients[0];
    const toName = mode === "single"
      ? [primary.title, primary.firstName, primary.lastName].filter(Boolean).join(" ")
      : `${recipients.length} recipients`;

    return {
      number: deliveryOrderNumber(order.id),
      to: toName,
      carrier,
      scheduled: when === "schedule",
      arrival: dlvArrival(shipping, when, date),
      cards: cardsNeeded,
      cardsLeft: cardBank,
    };
  }

  function validateDeliveryInputs() {
    if (!flowState.cardDraftId || !selectedImageAssetId) {
      const message = "Review a generated card first so Delivery can use the real card draft and generated image asset.";
      setBackendError(message);
      bmcError(message, "Generated card needed");
      return false;
    }

    if (mode === "single") {
      const nextErrors = dlvValidate(draft);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        bmcError(
          "Fill in the recipient's required address fields - name, street, city, province and postal code - before sending. We can't mail a card without a complete, deliverable address.",
          "Address needed",
        );
        return false;
      }
    } else if (recipients.length === 0) {
      bmcError("Add at least one recipient address before sending. Fill in the required fields and tap Add recipient.", "Address needed");
      return false;
    }

    return true;
  }

  async function createOrderAndStartMockCheckout() {
    if (backendBusy || !validateDeliveryInputs() || !flowState.cardDraftId || !selectedImageAssetId) return;

    setBackendError(null);
    setBackendAction("creating_order");

    try {
      const primaryRecipient = mode === "single" ? draft : recipients[0];
      const order = await createOrder({
        cardDraftId: flowState.cardDraftId,
        selectedAssetId: selectedImageAssetId,
        recipientAddress: dlvPostalAddress(primaryRecipient, "Alex Smith"),
        senderAddress: dlvPostalAddress(sender, "Samuel Mathew"),
      });

      setBackendOrder(order);
      writeMockMvpFlowState({
        cardDraftId: order.cardDraftId,
        selectedAssetId: order.selectedAssetId,
        orderId: order.id,
        orderStatus: order.status,
      });

      setBackendAction("starting_checkout");
      const checkout = await startCheckout(order.id);
      setBackendOrder(checkout.order);
      setCheckoutSession(checkout.checkoutSession);
      rememberCheckoutResult(checkout.order, checkout.checkoutSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The mock checkout flow could not start.";
      setBackendError(message);
      bmcError(message, "Mock checkout failed");
    } finally {
      setBackendAction("idle");
    }
  }

  async function completeCheckout() {
    const orderId = backendOrder?.id || flowState.orderId;
    if (backendBusy || !orderId) return;

    setBackendError(null);
    setBackendAction("completing_checkout");

    try {
      const checkout = await completeMockCheckout(orderId);
      setBackendOrder(checkout.order);
      setCheckoutSession(checkout.checkoutSession);
      rememberCheckoutResult(checkout.order, checkout.checkoutSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mock checkout could not be completed.";
      setBackendError(message);
      bmcError(message, "Mock checkout failed");
    } finally {
      setBackendAction("idle");
    }
  }

  async function submitMockFulfillment() {
    const order = backendOrder;
    const orderId = order?.id || flowState.orderId;
    const currentStatus = order?.status || flowState.orderStatus;
    if (backendBusy || !orderId) return;

    if (currentStatus !== "paid_mock") {
      const message = "Complete mock checkout before submitting fulfillment.";
      setBackendError(message);
      bmcError(message, "Checkout required");
      return;
    }

    setBackendError(null);
    setBackendAction("submitting_fulfillment");

    try {
      const result = await submitFulfillment(orderId);
      setBackendOrder(result.order);
      setFulfillment(result.fulfillment);
      rememberFulfillmentResult(result.order, result.fulfillment);
      setSent(buildSentOrder(result.order));
      router.push("/delivery/confirmation");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mock fulfillment could not be submitted.";
      setBackendError(message);
      bmcError(message, "Mock fulfillment failed");
    } finally {
      setBackendAction("idle");
    }
  }

  function handlePrimaryAction() {
    if (orderStatus === "checkout_started") {
      void completeCheckout();
      return;
    }

    if (orderStatus === "paid_mock") {
      void submitMockFulfillment();
      return;
    }

    if (orderStatus === "fulfilled_mock") {
      router.push("/delivery/confirmation");
      return;
    }

    handleSend();
  }

  function handleSend() {
    if (needsCardTopUp) {
      setCardTopUpOpen(true);
      return;
    }

    if (!validateDeliveryInputs()) return;

    if (blankGiftCount > 0) {
      setGiftModalOpen(true);
      return;
    }

    void createOrderAndStartMockCheckout();
  }

  function keepGiftForLaterAndSend() {
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    void createOrderAndStartMockCheckout();
  }

  function saveGiftRecipientAndSend() {
    consumeBlankSouvenoteGift();
    setGiftModalOpen(false);
    setGiftReminderDismissed(true);
    void createOrderAndStartMockCheckout();
  }

  function reserveCardsForDelivery(quantity: number) {
    addPricingCartItemToCart(makeBigSenderCartItem(quantity));
    rememberPricingReturn("/delivery");
    setCardTopUpOpen(false);
    router.push("/cart");
  }

  const primaryActionLabel = (() => {
    if (backendAction === "loading_assets") return "Loading assets...";
    if (backendAction === "creating_order") return "Creating order...";
    if (backendAction === "starting_checkout") return "Starting checkout...";
    if (backendAction === "completing_checkout") return "Completing checkout...";
    if (backendAction === "submitting_fulfillment") return "Submitting fulfillment...";
    if (orderStatus === "checkout_started") return "Complete mock checkout";
    if (orderStatus === "paid_mock") return "Submit mock fulfillment";
    if (orderStatus === "fulfilled_mock") return "View confirmation";
    return "Start mock checkout";
  })();

  const backendStatus = backendStatusLabel(orderStatus);
  const checkoutDetail = checkoutSession?.id || flowState.checkoutSessionId;
  const fulfillmentDetail = fulfillment?.mockFulfillmentId || flowState.fulfillment?.mockFulfillmentId;

  return (
    <>
      <Navbar user={user} credits={{ images: 0, songs: 0 }} cardBank={0} cartCount={0} />

      <div className="bmc-shell" data-screen-label="06 Delivery">
        <div className="bmc-head" style={{ textAlign: "center", margin: "0 auto 40px", maxWidth: 780 }}>
          <div className="bmc-eyebrow" style={{ justifyContent: "center", whiteSpace: "nowrap" }}>
            <span className="bmc-eyebrow-num">07</span>
            <span>Delivery</span>
          </div>
          <h1 className="bmc-title">
            A card{" "}
            <span className="souv-hero-italic text-metallic-rose-gold">worth sending</span>
          </h1>
          <p className="bmc-lede" style={{ margin: "0 auto" }}>
            Your card is printed and folded, your message is hand-written in real ink, and any optional song is tucked
            behind a QR code inside. Tell us where it&apos;s going, then walk the local mock order through checkout and fulfillment.
          </p>
        </div>

        {blankGiftCount > 0 && !giftReminderDismissed && (
          <div className="dlv-gift-reminder" role="status">
            <span className="dlv-gift-reminder-ico"><BmcIcon name="spark2" w={18} /></span>
            <div>
              <div className="dlv-gift-reminder-title">You have a blank Souvenote to give</div>
              <p>We&apos;ll remind you when you send this card. You have {blankGiftCount} {blankGiftCount === 1 ? "blank gift" : "blank gifts"} ready.</p>
            </div>
            <button
              type="button"
              className="dlv-gift-reminder-dismiss"
              onClick={() => setGiftReminderDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="dlv-grid">
          <div className="dlv-keepsake-col">
            <DlvKeepsake song={song} songIncluded={songIncluded} onPlaySong={() => setSong((current) => !current)} />
          </div>

          <div className="dlv-form">
            <DlvRecipientSection
              mode={mode}
              setMode={setMode}
              quantity={quantity}
              setQuantity={setQuantity}
              recipients={recipients}
              setRecipients={setRecipients}
              draft={draft}
              setDraft={setDraft}
              errors={errors}
              setErrors={setErrors}
              editingIdx={editingIdx}
              setEditingIdx={setEditingIdx}
            />
            <DlvReturnSection on={returnOn} setOn={setReturnOn} sender={sender} setSender={setSender} />
            <DlvScheduleSection when={when} setWhen={setWhen} date={date} setDate={setDate} />
            <DlvShippingSection shipping={shipping} setShipping={setShipping} country={draft.country} />
          </div>
        </div>

        <div className="dlv-actionbar">
          <div className="dlv-cost">
            <span className="dlv-cost-main">
              <BmcIcon name="message" w={15} />
              {backendStatus}
            </span>
            <span className={`dlv-cost-sub ${!enough ? "is-low" : ""}`}>
              {backendError
                ? backendError
                : enough
                  ? <>Draft {flowState.cardDraftId?.slice(0, 8)} {"\u00b7"} image asset {selectedImageAssetId?.slice(0, 8)}{checkoutDetail ? ` \u00b7 checkout ${checkoutDetail.slice(0, 18)}` : ""}{fulfillmentDetail ? ` \u00b7 ${fulfillmentDetail.slice(0, 24)}` : ""}</>
                  : <>Go back to Review so Delivery can use a generated backend image asset.</>}
            </span>
          </div>
          <div className="dlv-actionbar-right">
            <Link href="/create/build-my-card#review" className="bmc-cta-secondary"><BmcIcon name="back" w={14} /> Back to review</Link>
            <button type="button" className="bmc-cta bmc-cta-lg" onClick={handlePrimaryAction} disabled={backendBusy || (!enough && orderStatus !== "fulfilled_mock")}>
              {primaryActionLabel} <BmcIcon name="arrow" w={16} />
            </button>
          </div>
        </div>
      </div>

      <Footer />

      <DlvSentModal open={!!sent} order={sent} onClose={() => setSent(null)} />
      <DlvBlankGiftModal
        open={giftModalOpen}
        count={blankGiftCount}
        name={giftRecipientName}
        contact={giftRecipientContact}
        onNameChange={setGiftRecipientName}
        onContactChange={setGiftRecipientContact}
        onClose={() => setGiftModalOpen(false)}
        onKeepLater={keepGiftForLaterAndSend}
        onSaveGift={saveGiftRecipientAndSend}
      />
      <DlvCardTopUpModal
        open={cardTopUpOpen}
        onClose={() => setCardTopUpOpen(false)}
        onReserve={reserveCardsForDelivery}
      />
      <BmcErrorModal />
    </>
  );
}

export { DeliveryApp, DlvSentModal, DlvToast };
