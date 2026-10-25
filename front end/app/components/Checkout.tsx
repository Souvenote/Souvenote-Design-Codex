"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BmcIcon } from "./BmcShared";
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
  onClose: () => void;
  onPaid?: (pack: CheckoutPack) => void | Promise<void>;
  onBack?: () => void;
};

type CardDetails = {
  number: string;
  exp: string;
  cvc: string;
  postal: string;
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
    blurb: "1-10 cards are $8.99 each, 11-20 are $7.99 each, and 21-30+ are $6.99 each.",
  },
];

const CO_CREDIT_PACKS: PickerPack[] = [
  { id: "starter", name: "Starter", tokens: 10, price: 2.00, blurb: "A quick top-up for one more generation." },
  { id: "creator", name: "Creator", tokens: 80, price: 10.00, featured: true, blurb: "Our most popular: a season of cards & songs." },
  { id: "power", name: "Power", tokens: 250, price: 25.00, blurb: "Best value for makers and gift-givers." },
];

function coMoney(n: number) {
  return "$" + n.toFixed(2);
}

function CheckoutPicker({ open, onClose, onChoose, defaultTab = "cards" }: CheckoutPickerProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<CheckoutTab>(defaultTab);

  if (!open) return null;

  const packs = tab === "cards" ? CO_CARD_PACKS : CO_CREDIT_PACKS;

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="07 Checkout · Choose a pack">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal co-picker">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="co-picker-head">
          <div className="bmc-eyebrow" style={{ justifyContent: "center", color: "var(--rose-gold)", whiteSpace: "nowrap" }}>
            <span>Top up to send</span>
          </div>
          <h2 className="bmc-modal-title" style={{ marginBottom: 18 }}>
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
          Billed in CAD. Cards persist on your account for 12 months · shipping is included on packs.
        </p>
      </div>
    </div>
  );
}

function CheckoutModal({ open, pack, country = "CA", onClose, onPaid, onBack }: CheckoutModalProps) {
  const [promo, setPromo] = React.useState("");
  const [promoApplied, setPromoApplied] = React.useState(false);
  const [card, setCard] = React.useState<CardDetails>({ number: "", exp: "", cvc: "", postal: "" });
  const [processing, setProcessing] = React.useState(false);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setProcessing(false);
      setPaymentError(null);
    }
  }, [open, pack]);

  if (!open || !pack) return null;

  const isCards = pack.kind === "cards";
  const isCart = pack.kind === "cart";
  const subtotal = pack.price;
  const discount = promoApplied ? +(subtotal * 0.10).toFixed(2) : 0;
  const taxable = subtotal - discount;
  const taxRate = country === "CA" ? 0.05 : (country === "GB" ? 0.20 : 0);
  const taxLabel = country === "CA" ? "GST (5%)" : (country === "GB" ? "VAT (20%)" : "Tax");
  const tax = +(taxable * taxRate).toFixed(2);
  const total = +(taxable + tax).toFixed(2);

  function fmtCard(value: string) {
    return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  function fmtExp(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + " / " + digits.slice(2) : digits;
  }

  function pay() {
    if (!pack) return;
    if (processing) return;
    if (!onPaid) return;
    setProcessing(true);
    setPaymentError(null);
    window.setTimeout(() => {
      Promise.resolve(onPaid?.(pack))
        .catch((error) => {
          setPaymentError(error instanceof Error ? error.message : "Payment succeeded, but credits could not be added. Please try again.");
          setProcessing(false);
        });
    }, 1300);
  }

  return (
    <div className="bmc-modal-wrap" role="dialog" aria-modal="true" data-screen-label="07 Checkout · Payment">
      <div className="bmc-modal-scrim" onClick={onClose} />
      <div className="bmc-modal is-gold co-modal">
        <button type="button" className="bmc-modal-close" onClick={onClose} aria-label="Close"><BmcIcon name="close" w={16} /></button>
        <div className="co-grid">
          <div className="co-pay">
            <div className="co-eyebrow"><BmcIcon name="lock" w={13} /> Secure checkout</div>
            <h2 className="co-title">Complete your purchase</h2>

            <div className="co-express">
              <button type="button" className="co-paybtn is-apple" onClick={pay}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.5c0-2.1 1.7-3.1 1.78-3.16-0.97-1.42-2.48-1.62-3.02-1.64-1.28-0.13-2.5 0.76-3.15 0.76-0.65 0-1.65-0.74-2.72-0.72-1.4 0.02-2.69 0.81-3.41 2.07-1.45 2.52-0.37 6.25 1.04 8.3 0.69 1 1.51 2.13 2.58 2.09 1.04-0.04 1.43-0.67 2.69-0.67 1.25 0 1.61 0.67 2.71 0.65 1.12-0.02 1.83-1.02 2.51-2.03 0.79-1.16 1.12-2.29 1.13-2.35-0.02-0.01-2.17-0.83-2.19-3.29zM15.0 6.6c0.57-0.69 0.96-1.65 0.85-2.6-0.82 0.03-1.82 0.55-2.41 1.24-0.53 0.61-0.99 1.59-0.87 2.52 0.92 0.07 1.85-0.47 2.43-1.16z" /></svg>
                Pay
              </button>
              <button type="button" className="co-paybtn is-google" onClick={pay}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.6-.05-1.2-.16-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 6.1 12 6.1z" /></svg>
                Pay
              </button>
            </div>

            <div className="co-or">or pay with card</div>

            <div className="co-card-el">
              <div>
                <div className="co-field-label">Card number</div>
                <div className="co-input-wrap">
                  <input className="co-input" inputMode="numeric" value={card.number} onChange={(event) => setCard({ ...card, number: fmtCard(event.target.value) })} placeholder="1234 1234 1234 1234" />
                  <span className="co-card-brands">
                    <span className="co-brand visa">VISA</span>
                    <span className="co-brand mc">MC</span>
                    <span className="co-brand amex">AMEX</span>
                  </span>
                </div>
              </div>
              <div className="co-card-split">
                <div>
                  <div className="co-field-label">Expiry</div>
                  <input className="co-input" inputMode="numeric" value={card.exp} onChange={(event) => setCard({ ...card, exp: fmtExp(event.target.value) })} placeholder="MM / YY" />
                </div>
                <div>
                  <div className="co-field-label">CVC</div>
                  <input className="co-input" inputMode="numeric" value={card.cvc} onChange={(event) => setCard({ ...card, cvc: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="CVC" />
                </div>
              </div>
              <div>
                <div className="co-field-label">Billing postal code</div>
                <input className="co-input" value={card.postal} onChange={(event) => setCard({ ...card, postal: event.target.value })} placeholder="V6B 1A1" />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="co-field-label">Promo code</div>
              {promoApplied ? (
                <div className="co-promo-ok"><BmcIcon name="check" w={13} /> Code <b style={{ fontStyle: "normal" }}>SOUVENOTE10</b> applied, 10% off</div>
              ) : (
                <div className="co-promo-row">
                  <input className="co-input" value={promo} onChange={(event) => setPromo(event.target.value.toUpperCase())} placeholder="Add a code" />
                  <button type="button" className="co-promo-apply" onClick={() => setPromoApplied(promo.trim().length > 0)}>Apply</button>
                </div>
              )}
            </div>

            <button type="button" className="bmc-cta co-pay-cta" onClick={pay} style={processing ? { opacity: 0.7, pointerEvents: "none" } : undefined}>
              {processing ? <><span className="bmc-gen-spin" style={{ borderTopColor: "#2a1015", borderColor: "rgba(42,16,21,0.3)" }} /> Processing...</> : <>Pay {coMoney(total)} CAD <BmcIcon name="arrow" w={15} /></>}
            </button>
            {paymentError && (
              <div className="co-promo-ok" role="alert" style={{ marginTop: 12, borderColor: "rgba(229,184,177,.45)", color: "var(--rose-gold-hi)" }}>
                {paymentError}
              </div>
            )}
            <div className="co-secure"><BmcIcon name="lock" w={13} /> Payments secured by <b>Stripe</b></div>
            {onBack && <button type="button" className="bmc-text-link" onClick={onBack} style={{ display: "block", margin: "14px auto 0" }}>{"\u2190 Choose a different pack"}</button>}
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
              {promoApplied && <div className="co-line"><span className="co-line-label">Promo · SOUVENOTE10</span><span className="co-line-val is-discount">{"\u2212"}{coMoney(discount)}</span></div>}
              {tax > 0 && <div className="co-line"><span className="co-line-label">{taxLabel}</span><span className="co-line-val">{coMoney(tax)}</span></div>}
            </div>

            <div className="co-total">
              <span className="co-total-label">Total</span>
              <span><span className="co-total-val">{coMoney(total)}</span><span className="co-total-cur">CAD</span></span>
            </div>

            {isCards && Number(pack.bonus) > 0 && (
              <div className="co-bonus"><BmcIcon name="spark2" w={16} /> Includes {pack.tokens} AI credits, plus {pack.bonus} bonus on your first send</div>
            )}
            <p className="co-fx">{taxLabel === "Tax" ? "Tax calculated at your delivery address." : `${taxLabel.split(" ")[0]} calculated from your delivery address.`} Cards never expire for 12 months.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CO_CARD_PACKS, CO_CREDIT_PACKS, coMoney, CheckoutPicker, CheckoutModal };
