"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BmcIcon } from "./BmcShared";
import {
  CHECKOUT_PROMO_CODE,
  calculateCheckoutTotals,
  isCheckoutPromoCode,
  validateCheckoutCard,
} from "./checkoutRules";
import type { CheckoutCardDetails, CheckoutFieldErrors } from "./checkoutRules";
import { BIG_SENDER_TIERS, MAX_BIG_SENDER_CARDS, MIN_BIG_SENDER_CARDS } from "./pricingCatalog";

type CheckoutTab = "cards" | "credits";

type PickerPack = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  cards?: number | string;
  tokens?: number | string;
  bonus?: number;
  featured?: boolean;
  requiresPricingChoice?: boolean;
  per?: string;
};

export type CheckoutPack = {
  kind: CheckoutTab | "cart";
  name: string;
  price: number;
  cards?: number | string;
  tokens?: number | string;
  bonus?: number;
  lineCount?: number;
  cardCount?: number;
};

type CheckoutPickerProps = {
  open: boolean;
  onClose: () => void;
  onChoose: (pack: CheckoutPack) => void;
  defaultTab?: CheckoutTab;
};

type CheckoutModalProps = {
  open: boolean;
  pack?: CheckoutPack | null;
  country?: string;
  initialPromoCode?: string | null;
  onClose: () => void;
  onPaid?: (pack: CheckoutPack) => void | Promise<void>;
  onBack?: () => void;
};

const CO_CARD_PACKS: PickerPack[] = [
  {
    id: "trf",
    name: "Try Risk-Free",
    cards: 1,
    price: 9.99,
    per: "Shipping included",
    tokens: 10,
    bonus: 2,
    blurb: "One card to send, ten AI credits to play with. Pay only for what you use.",
  },
  {
    id: "bigsender",
    name: "Big Sender",
    cards: `${MIN_BIG_SENDER_CARDS}-${MAX_BIG_SENDER_CARDS}`,
    price: BIG_SENDER_TIERS[0].pricePerCard,
    per: "Choose card count on the pricing page",
    tokens: "10 per card",
    bonus: 0,
    featured: true,
    requiresPricingChoice: true,
    blurb: "2-10 cards are $8.99 each, 11-20 are $7.99 each, and 21-30 are $6.99 each.",
  },
];

const CO_CREDIT_PACKS: PickerPack[] = [
  { id: "starter", name: "Starter", tokens: 10, price: 2.0, blurb: "A quick top-up for one more generation." },
  { id: "creator", name: "Creator", tokens: 80, price: 10.0, featured: true, blurb: "Our most popular: a season of cards & songs." },
  { id: "power", name: "Power", tokens: 250, price: 25.0, blurb: "Best value for makers and gift-givers." },
];

function coMoney(value: number) {
  return "$" + value.toFixed(2);
}

function CheckoutPicker({ open, onClose, onChoose, defaultTab = "cards" }: CheckoutPickerProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<CheckoutTab>(defaultTab);

  if (!open) return null;

  const packs = tab === "cards" ? CO_CARD_PACKS : CO_CREDIT_PACKS;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="checkout-picker-title" data-screen-label="07 Checkout · Choose a pack">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal co-picker">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="co-picker-head">
          <div className="bmc-eyebrow" style={{ justifyContent: "center", color: "var(--rose-gold)", whiteSpace: "nowrap" }}>
            <span>Top up to send</span>
          </div>
          <h2 className="bmc-modal-title" id="checkout-picker-title" style={{ marginBottom: 18 }}>
            Choose your <span className="souv-hero-italic text-metallic-rose-gold">cards</span>
          </h2>
          <div className="co-picker-tabs">
            <div className="bmc-chip-row">
              <button type="button" className={`bmc-chip ${tab === "cards" ? "is-active" : ""}`} onClick={() => setTab("cards")}>Card packs</button>
              <button type="button" className={`bmc-chip ${tab === "credits" ? "is-active" : ""}`} onClick={() => setTab("credits")}>AI credits</button>
            </div>
          </div>
        </div>

        <div className="co-pk-grid">
          {packs.map((pack) => (
            <div key={pack.id} className={`co-pk ${pack.featured ? "is-featured" : ""}`}>
              {pack.featured && <span className="co-pk-badge">Most loved</span>}
              <div className="co-pk-name">{pack.name}</div>
              <div className="co-pk-count">{tab === "cards" ? pack.cards : pack.tokens}</div>
              <div className="co-pk-count-label">{tab === "cards" ? (pack.cards === 1 ? "Card" : "Cards") : "Credits"}</div>
              <div className="co-pk-price">{coMoney(pack.price)}<span className="co-total-cur"> CAD</span></div>
              {tab === "cards" && <div className="co-pk-per">{pack.per}</div>}
              <p className="co-pk-blurb">{pack.blurb}</p>
              <button
                type="button"
                className="bmc-cta co-pk-cta"
                onClick={() => {
                  if (pack.requiresPricingChoice) {
                    router.push("/pricing");
                    return;
                  }
                  onChoose({ ...pack, kind: tab });
                }}
              >
                {pack.requiresPricingChoice ? "Choose amount" : "Choose"} <BmcIcon name="arrow" w={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="co-fx" style={{ textAlign: "center", marginTop: 18 }}>
          All prices shown and billed in CAD. Cards are saved to your account · shipping is included on packs.
        </p>
      </div>
    </div>
  );
}

function CheckoutModal({
  open,
  pack,
  country = "CA",
  initialPromoCode,
  onClose,
  onPaid,
  onBack,
}: CheckoutModalProps) {
  const [promo, setPromo] = React.useState("");
  const [promoApplied, setPromoApplied] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [card, setCard] = React.useState<CheckoutCardDetails>({ number: "", exp: "", cvc: "", postal: "" });
  const [fieldErrors, setFieldErrors] = React.useState<CheckoutFieldErrors>({});
  const [processing, setProcessing] = React.useState(false);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const hasInitialPromo = isCheckoutPromoCode(initialPromoCode || "");
    setPromo(hasInitialPromo ? CHECKOUT_PROMO_CODE : "");
    setPromoApplied(hasInitialPromo);
    setPromoError(null);
    setCard({ number: "", exp: "", cvc: "", postal: "" });
    setFieldErrors({});
    setProcessing(false);
    setPaymentError(null);
  }, [initialPromoCode, open, pack]);

  React.useEffect(() => {
    if (!open || processing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, processing]);

  if (!open || !pack) return null;

  const isCards = pack.kind === "cards";
  const isCart = pack.kind === "cart";
  const { subtotal, discount, tax, total, taxLabel } = calculateCheckoutTotals(pack.price, country, promoApplied);

  function fmtCard(value: string) {
    return value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  }

  function fmtExp(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + " / " + digits.slice(2) : digits;
  }

  function updateCard<Field extends keyof CheckoutCardDetails>(field: Field, value: CheckoutCardDetails[Field]) {
    setCard((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function applyPromo() {
    if (isCheckoutPromoCode(promo)) {
      setPromo(CHECKOUT_PROMO_CODE);
      setPromoApplied(true);
      setPromoError(null);
      return;
    }
    setPromoApplied(false);
    setPromoError(`That code is not valid. Try ${CHECKOUT_PROMO_CODE}.`);
  }

  function completePreview() {
    if (processing || !onPaid || !pack) return;
    const selectedPack = pack;
    const nextFieldErrors = validateCheckoutCard(card);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setProcessing(true);
    setPaymentError(null);
    window.setTimeout(() => {
      Promise.resolve(onPaid(selectedPack)).catch((error) => {
        setPaymentError(error instanceof Error ? error.message : "Checkout could not be completed. Please try again.");
        setProcessing(false);
      });
    }, 800);
  }

  return (
    <div
      className="bmc-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      aria-describedby="checkout-preview-note"
      data-screen-label="07 Checkout · Payment"
    >
      <div className="bmc-modal-scrim" onClick={processing ? undefined : onClose} />
      <div className="bmc-modal is-gold co-modal">
        <button type="button" className="bmc-modal-close" onClick={onClose} disabled={processing} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="co-grid">
          <div className="co-pay">
            <div className="co-eyebrow"><BmcIcon name="lock" w={13} /> Checkout preview</div>
            <h2 className="co-title" id="checkout-title">Review your purchase</h2>

            <div className="co-preview-note" id="checkout-preview-note" role="note">
              <BmcIcon name="spark2" w={17} />
              <span><b>No-charge preview.</b> No card information is sent or stored, and completing this step only updates the local demo balance.</span>
            </div>

            <div className="co-card-el">
              <div>
                <label className="co-field-label" htmlFor="checkout-card-number">Card number</label>
                <div className="co-input-wrap">
                  <input
                    className="co-input"
                    id="checkout-card-number"
                    name="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.number}
                    onChange={(event) => updateCard("number", fmtCard(event.target.value))}
                    placeholder="4242 4242 4242 4242"
                    aria-invalid={Boolean(fieldErrors.number)}
                    aria-describedby={fieldErrors.number ? "checkout-card-number-error" : undefined}
                  />
                  <span className="co-card-brands" aria-hidden="true">
                    <span className="co-brand visa">VISA</span>
                    <span className="co-brand mc">MC</span>
                    <span className="co-brand amex">AMEX</span>
                  </span>
                </div>
                {fieldErrors.number && <span className="co-field-error" id="checkout-card-number-error">{fieldErrors.number}</span>}
              </div>
              <div className="co-card-split">
                <div>
                  <label className="co-field-label" htmlFor="checkout-card-expiry">Expiry</label>
                  <input
                    className="co-input"
                    id="checkout-card-expiry"
                    name="card-expiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={card.exp}
                    onChange={(event) => updateCard("exp", fmtExp(event.target.value))}
                    placeholder="MM / YY"
                    aria-invalid={Boolean(fieldErrors.exp)}
                    aria-describedby={fieldErrors.exp ? "checkout-card-expiry-error" : undefined}
                  />
                  {fieldErrors.exp && <span className="co-field-error" id="checkout-card-expiry-error">{fieldErrors.exp}</span>}
                </div>
                <div>
                  <label className="co-field-label" htmlFor="checkout-card-cvc">CVC</label>
                  <input
                    className="co-input"
                    id="checkout-card-cvc"
                    name="card-cvc"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={card.cvc}
                    onChange={(event) => updateCard("cvc", event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="CVC"
                    aria-invalid={Boolean(fieldErrors.cvc)}
                    aria-describedby={fieldErrors.cvc ? "checkout-card-cvc-error" : undefined}
                  />
                  {fieldErrors.cvc && <span className="co-field-error" id="checkout-card-cvc-error">{fieldErrors.cvc}</span>}
                </div>
              </div>
              <div>
                <label className="co-field-label" htmlFor="checkout-card-postal">Billing postal code</label>
                <input
                  className="co-input"
                  id="checkout-card-postal"
                  name="billing-postal-code"
                  autoComplete="postal-code"
                  value={card.postal}
                  onChange={(event) => updateCard("postal", event.target.value.toUpperCase())}
                  placeholder="V6B 1A1"
                  aria-invalid={Boolean(fieldErrors.postal)}
                  aria-describedby={fieldErrors.postal ? "checkout-card-postal-error" : undefined}
                />
                {fieldErrors.postal && <span className="co-field-error" id="checkout-card-postal-error">{fieldErrors.postal}</span>}
              </div>
            </div>

            <div className="co-promo-block">
              <label className="co-field-label" htmlFor="checkout-promo">Promo code</label>
              {promoApplied ? (
                <div className="co-promo-ok"><BmcIcon name="check" w={13} /> Code <b>{CHECKOUT_PROMO_CODE}</b> applied, 10% off</div>
              ) : (
                <>
                  <div className="co-promo-row">
                    <input
                      className="co-input"
                      id="checkout-promo"
                      name="promo-code"
                      value={promo}
                      onChange={(event) => {
                        setPromo(event.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      onKeyDown={(event) => { if (event.key === "Enter") applyPromo(); }}
                      placeholder="Add a code"
                      aria-invalid={Boolean(promoError)}
                      aria-describedby={promoError ? "checkout-promo-error" : undefined}
                    />
                    <button type="button" className="co-promo-apply" onClick={applyPromo}>Apply</button>
                  </div>
                  {promoError && <span className="co-field-error" id="checkout-promo-error" role="alert">{promoError}</span>}
                </>
              )}
            </div>

            <button
              type="button"
              className="bmc-cta co-pay-cta"
              onClick={completePreview}
              disabled={processing}
              aria-busy={processing}
            >
              {processing
                ? <><span className="bmc-gen-spin" style={{ borderTopColor: "#2a1015", borderColor: "rgba(42,16,21,0.3)" }} /> Completing preview...</>
                : <>Complete preview · {coMoney(total)} CAD <BmcIcon name="arrow" w={15} /></>}
            </button>
            {paymentError && <div className="co-checkout-error" role="alert">{paymentError}</div>}
            <div className="co-secure"><BmcIcon name="lock" w={13} /> Preview only · no payment or card data leaves this page</div>
            {onBack && <button type="button" className="bmc-text-link" onClick={onBack} style={{ display: "block", margin: "14px auto 0" }}>← Choose a different pack</button>}
          </div>

          <div className="co-summary">
            <div className="co-summary-title">Order summary</div>
            <div className="co-pack">
              <div className="co-pack-name">{pack.name}</div>
              <div className="co-pack-tag">
                {isCart
                  ? <><b>{pack.lineCount} {pack.lineCount === 1 ? "item" : "items"}</b> · cards, packs &amp; credits</>
                  : isCards
                    ? <><b>{pack.cards} {pack.cards === 1 ? "card" : "cards"}</b> · {pack.cards === 1 ? "one physical send" : "physical sends"} · shipping included</>
                    : <><b>{pack.tokens} credits</b> · AI image, edit, or optional QR-song generations</>}
              </div>
            </div>

            <div className="co-lines">
              <div className="co-line"><span className="co-line-label">Subtotal</span><span className="co-line-val">{coMoney(subtotal)}</span></div>
              {(isCards || isCart) && <div className="co-line"><span className="co-line-label">Shipping</span><span className="co-line-val is-discount">Included</span></div>}
              {promoApplied && <div className="co-line"><span className="co-line-label">Promo · {CHECKOUT_PROMO_CODE}</span><span className="co-line-val is-discount">−{coMoney(discount)}</span></div>}
              {tax > 0 && <div className="co-line"><span className="co-line-label">{taxLabel}</span><span className="co-line-val">{coMoney(tax)}</span></div>}
            </div>

            <div className="co-total">
              <span className="co-total-label">Total</span>
              <span><span className="co-total-val">{coMoney(total)}</span><span className="co-total-cur">CAD</span></span>
            </div>

            {isCards && Number(pack.bonus) > 0 && (
              <div className="co-bonus"><BmcIcon name="spark2" w={16} /> Includes {pack.tokens} AI credits, plus {pack.bonus} bonus on your first send</div>
            )}
            <p className="co-fx">{taxLabel === "Tax" ? "Tax calculated at your delivery address." : `${taxLabel.split(" ")[0]} calculated from your delivery address.`} Cards are saved to your account so you can return later.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CO_CARD_PACKS, CO_CREDIT_PACKS, coMoney, CheckoutPicker, CheckoutModal };
