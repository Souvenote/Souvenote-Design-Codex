"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutModal } from "./Checkout";
import type { CheckoutPack } from "./Checkout";
import { CardArt } from "./CardArt";
import { AuthGatePrompt } from "./AuthGatePrompt";
import { useAuth } from "./AuthProvider";
import {
  completeMockCreditPackCheckout,
  createLocalIdempotencyKey,
  fetchCreditPackPurchase,
  startCreditPackCheckout,
} from "../lib/api";
import { publishCreditBalance } from "../lib/creditBalance";
import { makeBigSenderCartItem, makeTryRiskFreeCartItem } from "./pricingCatalog";
import { addDemoBalance, getCartTopUpDelta } from "./DemoBalance";
import { consumePricingReturn, peekPricingReturn } from "./PricingReturn";
import {
  BLANK_SOUVENOTE_GIFT_CART_ID,
  BLANK_SOUVENOTE_GIFT_PRICE,
  addBlankSouvenoteGifts,
  isBlankSouvenoteGiftId,
} from "./GiftAddon";

type CartItem = {
  id: string;
  type: string;
  name: string;
  meta?: string;
  sub?: string;
  qty: number;
  price: number;
  unitNote?: string;
  palette?: string;
  glyph?: string;
  glowIdx?: number;
  lockedQuantity?: boolean;
  cardCount?: number;
  creditsPerCard?: unknown;
  replaceGroup?: string;
  cards?: unknown;
  tokens?: unknown;
  offerCode?: string;
};

type CartThumbProps = {
  item: CartItem;
};

type CartItemKind = "card" | "pack" | "credits" | "gift" | "item";

type CartItemPresentation = {
  kind: CartItemKind;
  label: string;
  icon: CartIconName;
};

type CartIconName = "minus" | "plus" | "close" | "trash" | "lock" | "arrow" | "cart" | "tag" | "truck" | "gift" | "spark" | "card" | "cards" | "coin";

type CartIcoProps = {
  name: CartIconName;
  w?: number;
};

type CartLineProps = {
  item: CartItem;
  onQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

const CART_SEED: CartItem[] = [];
const CART_KEY = "souv_cart";
const TOP_UP_GIFT_OFFER_SEEN_KEY = "souv_topup_blank_gift_offer_seen";
const PENDING_CREDIT_PURCHASE_KEY = "souv_pending_credit_purchase";

type PendingCreditPurchase = {
  offerCode: string;
  idempotencyKey: string;
  purchaseId?: string;
  checkoutSessionId?: string;
};

function makeBlankSouvenoteGiftCartItem(): CartItem {
  return {
    id: BLANK_SOUVENOTE_GIFT_CART_ID,
    type: "gift",
    name: "Blank Souvenote Gift",
    meta: "A blank Souvenote for someone else to create",
    sub: "We'll remind you at delivery that you have one to give.",
    qty: 1,
    price: BLANK_SOUVENOTE_GIFT_PRICE,
    unitNote: "gift add-on",
    lockedQuantity: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return CART_SEED;
  const next: CartItem[] = [];

  raw.forEach((item, index) => {
    if (!isRecord(item)) return;

    const source = item as Partial<CartItem>;
    const isBigSender = source.id === "pack-bigsender" || source.replaceGroup === "pack-bigsender";
    const isTryRiskFree = source.id === "pack-try-risk-free" || source.replaceGroup === "pack-try-risk-free";
    const isBlankGift = isBlankSouvenoteGiftId(source.id);
    const normalized: CartItem = isBigSender
      ? makeBigSenderCartItem(source.cardCount || parseInt(String(source.meta || ""), 10) || source.qty || 1)
      : isTryRiskFree
        ? makeTryRiskFreeCartItem({
          creditsPerCard: Number(source.creditsPerCard) || undefined,
        })
        : isBlankGift
          ? makeBlankSouvenoteGiftCartItem()
          : {
            ...source,
            id: source.id || `cart-item-${index}`,
            type: source.type || "cart",
            name: source.name || "Cart item",
            qty: Math.max(1, Math.floor(Number(source.qty) || 1)),
            price: Number(source.price) || 0,
          };

    const existing = next.find((candidate) => candidate.id === normalized.id);
    if (existing) {
      if (normalized.id === "pack-bigsender" || normalized.id === "pack-try-risk-free" || isBlankSouvenoteGiftId(normalized.id)) {
        Object.assign(existing, normalized);
      } else {
        existing.qty += normalized.qty;
      }
    } else {
      next.push(normalized);
    }
  });

  return next;
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return CART_SEED;

  try {
    return normalizeCartItems(JSON.parse(window.localStorage.getItem(CART_KEY) || "null") || CART_SEED);
  } catch {
    return CART_SEED;
  }
}

function cartMoney(n: number) {
  return "$" + n.toFixed(2);
}

function hasSeenTopUpGiftOffer(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(TOP_UP_GIFT_OFFER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markTopUpGiftOfferSeen(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TOP_UP_GIFT_OFFER_SEEN_KEY, "1");
  } catch {}
}

function readPendingCreditPurchase(): PendingCreditPurchase | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_CREDIT_PURCHASE_KEY) || "null",
    ) as unknown;
    if (
      !isRecord(parsed) ||
      typeof parsed.offerCode !== "string" ||
      typeof parsed.idempotencyKey !== "string"
    ) {
      return null;
    }
    return parsed as PendingCreditPurchase;
  } catch {
    return null;
  }
}

function writePendingCreditPurchase(purchase: PendingCreditPurchase): void {
  window.localStorage.setItem(
    PENDING_CREDIT_PURCHASE_KEY,
    JSON.stringify(purchase),
  );
}

function getCartItemPresentation(item: CartItem): CartItemPresentation {
  const type = String(item.type || "").toLowerCase();
  const id = String(item.id || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();

  if (isBlankSouvenoteGiftId(item.id) || type === "gift" || id.includes("blank-souvenote")) {
    return { kind: "gift", label: "Blank Souvenote", icon: "gift" };
  }

  if (type === "credits" || name.includes("credit") || item.tokens != null) {
    return { kind: "credits", label: "Creation credits", icon: "coin" };
  }

  if (type === "card") {
    return { kind: "card", label: "Saved card", icon: "card" };
  }

  if (type === "pack" || item.cardCount != null || item.cards != null) {
    return { kind: "pack", label: "Card pack", icon: "cards" };
  }

  return { kind: "item", label: "Cart item", icon: "cart" };
}

function CartThumb({ item }: CartThumbProps) {
  const presentation = getCartItemPresentation(item);

  if (presentation.kind === "card") {
    return (
      <div className="cart-thumb cart-thumb-card cart-thumb-kind-card">
        <CardArt palette={item.palette} glyph={item.glyph} glowIdx={item.glowIdx} corners figure />
        <span className="cart-thumb-badge" aria-label={presentation.label}>
          <CartIco name={presentation.icon} w={14} />
        </span>
      </div>
    );
  }

  if (presentation.kind === "pack") {
    return (
      <div className="cart-thumb cart-thumb-pack cart-thumb-kind-pack">
        <span className="cart-pack-card c3" />
        <span className="cart-pack-card c2" />
        <span className="cart-pack-card c1" />
        <span className="cart-thumb-badge" aria-label={presentation.label}>
          <CartIco name={presentation.icon} w={14} />
        </span>
      </div>
    );
  }

  if (presentation.kind === "gift") {
    return (
      <div className="cart-thumb cart-thumb-gift cart-thumb-kind-gift">
        <div className="cart-token">
          <CartIco name="gift" w={26} />
        </div>
        <span className="cart-thumb-badge" aria-label={presentation.label}>
          <CartIco name={presentation.icon} w={14} />
        </span>
      </div>
    );
  }

  return (
    <div className={`cart-thumb cart-thumb-token cart-thumb-kind-${presentation.kind}`}>
      <div className="cart-token">
        <CartIco name={presentation.icon} w={28} />
      </div>
      <span className="cart-thumb-badge" aria-label={presentation.label}>
        <CartIco name={presentation.icon} w={14} />
      </span>
    </div>
  );
}

function CartIco({ name, w = 16 }: CartIcoProps) {
  const path = {
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" /><path d="M10 11v6M14 11v6" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    cart: <><path d="M3 5h2.4l2.3 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.96-1.6L21 9H6" /><circle cx="10" cy="21" r="1.2" /><circle cx="17" cy="21" r="1.2" /></>,
    tag: <><path d="M3 11.5V4a1 1 0 0 1 1-1h7.5L21 12.5 12.5 21 3 11.5z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
    truck: <><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
    gift: <><rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5" /><path d="M12 9S9.5 3.5 7 4.8 9 9 12 9zM12 9s2.5-5.5 5-4.2S15 9 12 9z" /></>,
    spark: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4z" />,
    card: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4" /></>,
    cards: <><rect x="7" y="4" width="12" height="16" rx="2" /><path d="M5 7.5h-.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H13" /><path d="M10 8h6M10 11.5h6M10 15h3.5" /></>,
    coin: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M8.75 10.25c0-1.5 1.45-2.35 3.25-2.35s3.25.85 3.25 2.35c0 3-6.5 1.35-6.5 4.15 0 1.45 1.45 2.2 3.25 2.2s3.25-.75 3.25-2.2" /></>,
  }[name];

  return (
    <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
  );
}

function CartLine({ item, onQty, onRemove }: CartLineProps) {
  const presentation = getCartItemPresentation(item);
  const lockedQuantity = item.lockedQuantity;
  const lockedLabel = item.cardCount
    ? `${item.cardCount} ${item.cardCount === 1 ? "card" : "cards"}`
    : `${item.qty} ${item.qty === 1 ? "item" : "items"}`;

  return (
    <div className="cart-line">
      <CartThumb item={item} />
      <div className="cart-line-main">
        <div className={`cart-line-kind cart-line-kind-${presentation.kind}`}>
          <CartIco name={presentation.icon} w={13} />
          <span>{presentation.label}</span>
        </div>
        <div className="cart-line-name">{item.name}</div>
        <div className="cart-line-meta">{item.meta}</div>
        {item.sub && <div className="cart-line-sub">{item.sub}</div>}
        <button type="button" className="cart-line-remove" onClick={() => onRemove(item.id)}>
          <CartIco name="trash" w={14} /> Remove
        </button>
      </div>
      <div className="cart-line-right">
        {lockedQuantity ? (
          <div className="cart-qty cart-qty-locked" aria-label={`${lockedLabel} selected`}>
            <span className="cart-qty-num">{item.cardCount || item.qty}</span>
            <span className="cart-qty-label">{item.cardCount ? (item.cardCount === 1 ? "card" : "cards") : "gift"}</span>
          </div>
        ) : (
          <div className="cart-qty" role="group" aria-label={`Quantity of ${item.name}`}>
            <button type="button" className="cart-qty-btn" onClick={() => onQty(item.id, -1)} disabled={item.qty <= 1} aria-label="Decrease quantity">
              <CartIco name="minus" w={15} />
            </button>
            <span className="cart-qty-num">{item.qty}</span>
            <button type="button" className="cart-qty-btn" onClick={() => onQty(item.id, 1)} aria-label="Increase quantity">
              <CartIco name="plus" w={15} />
            </button>
          </div>
        )}
        <div className="cart-line-price">{cartMoney(item.price * item.qty)}</div>
        <div className="cart-line-unit">{cartMoney(item.price)} {"\u00b7"} {item.unitNote}</div>
      </div>
    </div>
  );
}

type GiftCheckoutOfferProps = {
  open: boolean;
  onClose: () => void;
  onDecline: () => void;
  onAdd: () => void;
};

function GiftCheckoutOffer({ open, onClose, onDecline, onAdd }: GiftCheckoutOfferProps) {
  if (!open) return null;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cart-gift-offer-title" data-screen-label="Cart · Gift add-on">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal cart-gift-modal">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><CartIco name="close" w={16} /></button>
        <div className="cart-gift-layout">
          <div className="cart-gift-copy">
            <div className="bmc-eyebrow cart-gift-eyebrow">
              <CartIco name="gift" w={14} />
              <span>Gift a Souvenote</span>
            </div>
            <h2 id="cart-gift-offer-title" className="cart-gift-title">
              Add a blank <span className="souv-hero-italic text-metallic-gold">Souvenote</span> to your order for $6.99?
            </h2>
            <p className="cart-gift-lede">
              This lets a recipient of your choice create a Souvenote for someone else. We&apos;ll remind you at delivery that you have one to give!
            </p>
            <div className="cart-gift-includes">
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico"><CartIco name="spark" w={20} /></span>
                <div><div className="acc-gift-inc-h">Blank card experience</div><div className="acc-gift-inc-p">They choose the recipient, message, and creative direction.</div></div>
              </div>
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico"><CartIco name="truck" w={20} /></span>
                <div><div className="acc-gift-inc-h">Delivery reminder</div><div className="acc-gift-inc-p">We&apos;ll surface the gift again when you send your card.</div></div>
              </div>
            </div>
          </div>

          <aside className="acc-panel acc-gift-summary cart-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">A Souvenote,<br />on you</span>
            </div>
            <div className="acc-gift-price"><span className="cur">$</span>6.99<span className="cad">CAD</span></div>
            <div className="acc-gift-name">Blank Souvenote Gift</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row"><span className="k">Includes</span><span className="v">1 blank gift</span></div>
              <div className="acc-summary-row"><span className="k">Recipient</span><span className="v">Chosen at delivery</span></div>
              <div className="acc-summary-row"><span className="k">Reminder</span><span className="v">Delivery step</span></div>
            </div>
          </aside>
        </div>
        <div className="cart-gift-actions">
          <button type="button" className="bmc-cta-secondary cart-gift-skip" onClick={onDecline}>No thanks</button>
          <button type="button" className="bmc-cta cart-gift-add" onClick={onAdd}>Add gift · $6.99 <CartIco name="arrow" w={15} /></button>
        </div>
      </div>
    </div>
  );
}

function CartEmpty() {
  return (
    <div className="cart-empty">
      <div className="cart-empty-ico"><CartIco name="cart" w={34} /></div>
      <h2 className="cart-empty-h">Your cart is empty</h2>
      <p className="cart-empty-p">Nothing waiting to send just yet. Start a card or browse a template, and it&apos;ll land here.</p>
      <div className="cart-empty-cta">
        <Link href="/create/personalize-a-template" className="bmc-cta">Browse templates <CartIco name="arrow" w={15} /></Link>
        <Link href="/create/build-my-card" className="bmc-cta-secondary">Build my card</Link>
      </div>
    </div>
  );
}

function CartPaid() {
  const order = "SV-" + Math.floor(100000 + Math.random() * 899999);

  return (
    <div className="cart-empty cart-paid">
      <div className="cart-empty-ico cart-paid-ico"><CartIco name="lock" w={30} /></div>
      <h2 className="cart-empty-h">Payment confirmed</h2>
      <p className="cart-empty-p">
        Thank you - your order <b style={{ color: "var(--gold-hi)" }}>{order}</b> is in. A receipt is on its way to your inbox,
        and your cards, packs, and credits are now on your account.
      </p>
      <div className="cart-empty-cta">
        <Link href="/create/my-cards-and-songs" className="bmc-cta">Go to Saved Cards &amp; Songs <CartIco name="arrow" w={15} /></Link>
        <Link href="/create/personalize-a-template" className="bmc-cta-secondary">Keep browsing</Link>
      </div>
    </div>
  );
}

function CartPage() {
  const router = useRouter();
  const auth = useAuth();
  const [items, setItems] = React.useState<CartItem[]>(CART_SEED);
  const [hydrated, setHydrated] = React.useState(false);
  const [promo, setPromo] = React.useState("");
  const [promoApplied, setPromoApplied] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [authPromptOpen, setAuthPromptOpen] = React.useState(false);
  const [giftOfferOpen, setGiftOfferOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [checkoutProcessing, setCheckoutProcessing] = React.useState(false);
  const isAuthenticated = auth.status === "authenticated" && Boolean(auth.user?.id);

  React.useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(items)));
    } catch {}
  }, [items, hydrated]);

  React.useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    const pending = readPendingCreditPurchase();
    if (!pending?.purchaseId) return;

    let active = true;
    let timeoutId: number | undefined;
    const checkPurchase = async (attempt: number) => {
      try {
        const result = await fetchCreditPackPurchase(pending.purchaseId!);
        if (!active) return;
        if (result.purchase.status === "paid") {
          finishCreditPackPurchase(result.balance);
          window.history.replaceState({}, "", "/cart");
          return;
        }
        if (
          [
            "payment_failed",
            "payment_canceled",
            "checkout_expired",
          ].includes(result.purchase.status)
        ) {
          throw new Error(
            `Credit-pack checkout ended with status ${result.purchase.status}.`,
          );
        }
        if (attempt >= 10) {
          throw new Error(
            "Payment is still being confirmed. Refresh this page in a moment.",
          );
        }
        timeoutId = window.setTimeout(
          () => void checkPurchase(attempt + 1),
          1000,
        );
      } catch (error) {
        if (!active) return;
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "Credit-pack payment could not be confirmed.",
        );
        setCheckoutProcessing(false);
      }
    };
    setCheckoutProcessing(true);
    void checkPurchase(0);

    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [hydrated, isAuthenticated]);

  function onQty(id: string, delta: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  }

  function onRemove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function applyPromo() {
    if (promo.trim().toUpperCase() === "SOUVENOTE10") setPromoApplied(true);
  }

  async function handlePaid() {
    const topUpDelta = getCartTopUpDelta(items);

    if (topUpDelta.credits > 0) {
      throw new Error(
        "Credit packs must complete their server-priced checkout separately.",
      );
    }

    const blankGiftCount = items.reduce((sum, item) => (
      isBlankSouvenoteGiftId(item.id) ? sum + Math.max(1, item.qty) : sum
    ), 0);
    if (topUpDelta.cards > 0) addDemoBalance({ cards: topUpDelta.cards });
    if (blankGiftCount > 0) addBlankSouvenoteGifts(blankGiftCount);
    setCheckoutOpen(false);
    setItems([]);
    try {
      window.localStorage.removeItem(CART_KEY);
    } catch {}

    const returnTo = consumePricingReturn();
    if (returnTo) {
      router.push(returnTo);
      return;
    }

    setConfirmed(true);
  }

  function finishCreditPackPurchase(
    balance: Parameters<typeof publishCreditBalance>[0],
  ) {
    publishCreditBalance(balance);
    setCheckoutProcessing(false);
    setCheckoutError(null);
    setCheckoutOpen(false);
    setItems([]);
    try {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem(PENDING_CREDIT_PURCHASE_KEY);
    } catch {}

    const returnTo = consumePricingReturn();
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    setConfirmed(true);
  }

  async function beginCreditPackCheckout(item: CartItem) {
    if (!item.offerCode) {
      throw new Error(
        "This credit pack is missing its backend offer code. Remove it and choose the pack again.",
      );
    }
    const existing = readPendingCreditPurchase();
    const pending: PendingCreditPurchase =
      existing?.offerCode === item.offerCode
        ? existing
        : {
            offerCode: item.offerCode,
            idempotencyKey: createLocalIdempotencyKey(
              `credit-pack-${item.offerCode}`,
            ),
          };
    writePendingCreditPurchase(pending);

    const started = await startCreditPackCheckout(
      pending.offerCode,
      pending.idempotencyKey,
    );
    const nextPending = {
      ...pending,
      purchaseId: started.purchase.id,
      checkoutSessionId: started.checkoutSession.id,
    };
    writePendingCreditPurchase(nextPending);

    if (started.checkoutSession.providerMode === "mock") {
      const completed = await completeMockCreditPackCheckout(
        started.purchase.id,
        started.checkoutSession.id,
      );
      if (!completed.balance) {
        throw new Error(
          "Credit-pack payment completed without an updated balance.",
        );
      }
      finishCreditPackPurchase(completed.balance);
      return;
    }

    const checkoutUrl = started.checkoutSession.checkoutUrl;
    if (!checkoutUrl) {
      throw new Error("Stripe did not return a secure checkout URL.");
    }
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("Stripe checkout must use HTTPS.");
    }
    window.location.assign(parsed.toString());
  }

  function continueToCheckout() {
    setGiftOfferOpen(false);
    setCheckoutOpen(true);
  }

  function addBlankSouvenoteGift() {
    setItems((current) => {
      if (current.some((item) => isBlankSouvenoteGiftId(item.id))) return current;
      return [...current, makeBlankSouvenoteGiftCartItem()];
    });
    continueToCheckout();
  }

  async function handleCheckoutClick() {
    if (!isAuthenticated) {
      setAuthPromptOpen(true);
      return;
    }

    setCheckoutError(null);
    const creditItems = items.filter(
      (item) => getCartItemPresentation(item).kind === "credits",
    );
    if (creditItems.length > 0) {
      if (
        items.length !== 1 ||
        creditItems.length !== 1 ||
        creditItems[0].qty !== 1
      ) {
        setCheckoutError(
          "Credit packs are purchased separately. Keep one credit pack in the cart and check out physical items in a separate order.",
        );
        return;
      }
      setCheckoutProcessing(true);
      try {
        await beginCreditPackCheckout(creditItems[0]);
      } catch (error) {
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "Credit-pack checkout could not start.",
        );
        setCheckoutProcessing(false);
      }
      return;
    }

    if (items.some((item) => isBlankSouvenoteGiftId(item.id))) {
      continueToCheckout();
      return;
    }

    const isTopUpReturnFlow = Boolean(peekPricingReturn());
    if (isTopUpReturnFlow) {
      if (hasSeenTopUpGiftOffer()) {
        continueToCheckout();
        return;
      }

      markTopUpGiftOfferSeen();
    }

    setGiftOfferOpen(true);
  }

  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const creditOnlyCart =
    items.length === 1 &&
    getCartItemPresentation(items[0]).kind === "credits";
  const cardCount = items.reduce((sum, item) => sum + (item.cardCount || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const lockedCartItem = items.length === 1 && items[0].lockedQuantity && items[0].cardCount ? items[0] : null;
  const lockedCardCount = lockedCartItem?.cardCount ?? 0;
  const lockedCreditsPerCard = Number(lockedCartItem?.creditsPerCard) || 10;
  const checkoutPack: CheckoutPack = lockedCartItem
    ? { kind: "cards", name: lockedCartItem.name, price: subtotal, cards: lockedCardCount, tokens: lockedCardCount * lockedCreditsPerCard, bonus: 0 }
    : { kind: "cart", name: "Your cart", price: subtotal, lineCount: count, cardCount };
  const discount =
    promoApplied && !creditOnlyCart ? +(subtotal * 0.10).toFixed(2) : 0;
  const taxable = subtotal - discount;
  const tax = +(taxable * 0.05).toFixed(2);
  const total = +(taxable + tax).toFixed(2);

  return (
    <>
      <div className="bmc-shell" data-screen-label="Cart">
        <div className="bmc-head" style={{ marginBottom: 30, maxWidth: "100%" }}>
          <div className="bmc-eyebrow"><span>Account</span><span className="dot" />Cart</div>
          <h1 className="bmc-title" style={{ margin: "6px 0 0" }}>
            Your <span className="souv-hero-italic text-metallic-gold">cart</span>
          </h1>
          {!confirmed && items.length > 0 && (
            <p className="bmc-lede" style={{ margin: "10px 0 0" }}>
              {count} {count === 1 ? "item" : "items"} ready to check out - cards, packs, and credits all in one go.
            </p>
          )}
        </div>

        {confirmed ? <CartPaid /> : items.length === 0 ? <CartEmpty /> : (
          <div className="cart-grid">
            <div className="cart-items">
              <div className="cart-items-head">
                <span>Item</span>
                <span>Qty {"\u00b7"} Price</span>
              </div>
              {items.map((item) => (
                <CartLine key={item.id} item={item} onQty={onQty} onRemove={onRemove} />
              ))}
              <Link href="/pricing" className="cart-continue">
                {"\u2190 Add more cards"}
              </Link>
            </div>

            <aside className="cart-summary-wrap">
              <div className="acc-panel cart-summary">
                <div className="acc-panel-title">Order summary</div>

                <div className="cart-sum-lines">
                  <div className="cart-sum-row">
                    <span className="k">Subtotal</span>
                    <span className="v">{cartMoney(subtotal)}</span>
                  </div>
                  <div className="cart-sum-row">
                    <span className="k"><CartIco name="truck" w={14} /> Shipping</span>
                    <span className="v is-included">
                      {creditOnlyCart ? "Not applicable" : "Included"}
                    </span>
                  </div>
                  {promoApplied && (
                    <div className="cart-sum-row">
                      <span className="k">Promo {"\u00b7"} SOUVENOTE10</span>
                      <span className="v is-discount">{"\u2212"}{cartMoney(discount)}</span>
                    </div>
                  )}
                  <div className="cart-sum-row">
                    <span className="k">GST (5%)</span>
                    <span className="v">{cartMoney(tax)}</span>
                  </div>
                </div>

                {!creditOnlyCart && <div className="cart-promo">
                  {promoApplied ? (
                    <div className="cart-promo-ok"><CartIco name="tag" w={13} /> Code <b>SOUVENOTE10</b> applied {"\u00b7"} 10% off</div>
                  ) : (
                    <div className="cart-promo-row">
                      <input
                        className="input-dark"
                        value={promo}
                        onChange={(event) => setPromo(event.target.value.toUpperCase())}
                        placeholder="Promo code"
                        onKeyDown={(event) => { if (event.key === "Enter") applyPromo(); }}
                      />
                      <button type="button" className="btn-matte cart-promo-apply" onClick={applyPromo}>Apply</button>
                    </div>
                  )}
                </div>}

                <div className="cart-total">
                  <span className="cart-total-label">Total</span>
                  <span className="cart-total-val"><span className="text-metallic-gold">{cartMoney(total)}</span><span className="cur">CAD</span></span>
                </div>

                {checkoutError && (
                  <p className="cart-foot" role="alert">
                    {checkoutError}
                  </p>
                )}
                <button
                  type="button"
                  className="bmc-cta cart-checkout"
                  onClick={() => void handleCheckoutClick()}
                  disabled={checkoutProcessing}
                >
                  {checkoutProcessing
                    ? "Confirming secure checkout..."
                    : "Proceed to checkout"}{" "}
                  <CartIco name="arrow" w={15} />
                </button>
                <div className="cart-secure"><CartIco name="lock" w={13} /> Secure checkout {"\u00b7"} payments by <b>Stripe</b></div>
              </div>

              <p className="cart-foot">
                {creditOnlyCart
                  ? "Standalone credits are added to your account after payment."
                  : "Shipping is always included."}
              </p>
            </aside>
          </div>
        )}
      </div>
      <CheckoutModal
        open={checkoutOpen}
        pack={checkoutPack}
        onClose={() => setCheckoutOpen(false)}
        onBack={() => {
          setCheckoutOpen(false);
          router.push("/pricing");
        }}
        onPaid={handlePaid}
      />
      <GiftCheckoutOffer
        open={giftOfferOpen}
        onClose={() => setGiftOfferOpen(false)}
        onDecline={continueToCheckout}
        onAdd={addBlankSouvenoteGift}
      />
      <AuthGatePrompt
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        returnTo="/cart"
        title="Log in before checkout"
        body="Sign up or log in to purchase cards and credits so everything is added to your account, not a temporary demo profile."
        primaryLabel="Sign up"
        secondaryLabel="Log in"
      />
    </>
  );
}

export { CartPage };
