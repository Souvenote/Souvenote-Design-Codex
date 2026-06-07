"use client";

import * as React from "react";
import Link from "next/link";
import { StampCorners } from "./Ornaments";

// Options.jsx — DEDICATED to the "With Credits" view (index.html + options.html).
// Independent copy: edits here do NOT affect the "0 Credits · Modal" view (Options.intercept.jsx).
// Tiles · Referral · Card Packs · AI Credit Packs · (optional) Pricing modal.

// ============================================================
// ICONS — single-path strokes, currentColor, viewBox 0 0 24 24
// ============================================================
function IconTemplate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9h17" />
      <path d="M9 9v11.5" />
      <circle cx="14.5" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBuild() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h12l4 4v9H4z" />
      <path d="M16 7v4h4" />
      <path d="M8 14h6M8 17h4" />
      <path d="M19 4l1.6 1.6M21 7l-1.6-1.6M19 4l-1.6 1.6M21 7l1.6-1.6" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function IconCommunity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="9" r="3.2" />
      <circle cx="17" cy="10.5" r="2.6" />
      <path d="M2.5 19c.6-3 3-4.6 5.5-4.6S13 16 13.5 19" />
      <path d="M13.5 17c.6-1.8 2.2-2.8 3.8-2.8 1.8 0 3.3 1 4 2.8" />
    </svg>
  );
}
function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="6" width="13" height="14" rx="1.5" />
      <path d="M7 6V4.5h13V18" />
      <path d="M7 11h6M7 15h4" />
      <path d="M14.5 17.5l1.2 1.2 2.6-2.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function IconGift() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="8" width="17" height="5" />
      <path d="M5 13v8h14v-8" />
      <path d="M12 8v13" />
      <path d="M12 8s-3-4.5-5-3 .8 4 5 3zM12 8s3-4.5 5-3-.8 4-5 3z" />
    </svg>
  );
}
function IconSparkArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
function IconToken() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M9 9h4.2a1.8 1.8 0 0 1 0 3.6H9M9 12.6h5a1.8 1.8 0 0 1 0 3.6H9" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.4l2.85 6.18 6.78.74-5.07 4.6 1.46 6.68L12 17.27 5.98 20.6l1.46-6.68-5.07-4.6 6.78-.74L12 2.4z" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// ============================================================
// SHARED — Back button (centered pill beneath page content)
// ============================================================
function BackButton({ href = '/', label = 'Back' }) {
  return (
    <div className="opt-back-row" data-screen-label="Back">
      <Link className="opt-back" href={href}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span>{label}</span>
      </Link>
    </div>
  );
}

// ============================================================
// SECTION — HEADER (heading + welcome)
// ============================================================
function OptionsHeader({ user, credits, lowBalance }) {
  return (
    <section className="opt-head" data-screen-label="01 Header">
      <div className="opt-head-inner">
        <h1 className="souv-hero-title opt-title">
          Choose how to{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">create your card</span>
        </h1>
        <p className="opt-lede">
          Every option lets you create a personalized song and link it via QR code.
        </p>
      </div>
    </section>
  );
}

// ============================================================
// SECTION — TILE GRID (2×2)
// ============================================================
function TileGrid({ credits, onGated = undefined }) {
  const TILES = [
    {
      id: 'personalize',
      tone: 'gold',
      title: 'Personalize a Template',
      sub: 'Need inspiration? Personalize one of our pre-built cards like Horoscope or Comic cards!',
      gated: true,
      badge: 'Most popular',
    },
    {
      id: 'build',
      tone: 'bronze',
      title: 'Build My Card',
      sub: 'Have your own idea? Answer a few questions and watch your card come to life.',
      gated: true,
    },
    {
      id: 'community',
      tone: 'rose',
      title: 'Community Cards',
      sub: 'Browse, send, or remix cards shared by the Souvenote community.',
      gated: false,
    },
    {
      id: 'library',
      tone: 'silver',
      title: 'My Cards & Songs',
      sub: 'Resume a draft. Re-send a saved card. Queue another song.',
      gated: false,
    },
  ];

  return (
    <section className="opt-tiles" data-screen-label="02 Tile Grid">
      <div className="opt-tiles-inner">
        {TILES.map((t) => {
          const locked = t.gated && credits === 0;
          return (
            <button
              key={t.id}
              className={`opt-tile opt-tile-${t.tone} ${locked ? 'is-locked' : ''}`}
              onClick={() => locked && onGated && onGated(t)}
              aria-label={t.title}
            >
              <span className="opt-tile-surface" aria-hidden="true"></span>
              <span className="opt-tile-grain" aria-hidden="true"></span>
              {t.badge && (
                <span className="opt-tile-badge">
                  <IconStar />
                  <em>{t.badge}</em>
                </span>
              )}
              <div className="opt-tile-body">
                <div className="opt-tile-title">
                  {t.title}
                </div>
                <div className="opt-tile-sub">{t.sub}</div>
              </div>
              <span className="opt-tile-music" aria-hidden="true">
                <IconMusic />
              </span>
              {locked && (
                <span className="opt-tile-lock" aria-hidden="true">
                  <LockGlyph />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function IconMusic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.6" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

// ============================================================
// SECTION — REFERRAL
// ============================================================
function ReferralBlock() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  return (
    <section className="opt-referral" data-screen-label="03 Referral">
      <div className="opt-referral-inner">
        <div className="opt-referral-copy">
          <div className="souv-eyebrow opt-eyebrow">REFERRAL</div>
          <h2 className="souv-h1 opt-h2">
            Invite a friend,{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">give 3, get 3</span>
          </h2>
          <p className="opt-lede opt-referral-lede">
            Each friend who signs up adds <em>three credits</em> to your balance and starts theirs
            with two.
          </p>
          <ul className="opt-referral-ticks">
            <li><Tick /> +3 credits per successful signup</li>
            <li><Tick /> No cap, keep inviting</li>
            <li><Tick /> Delivered by Sendgrid, never spammy</li>
          </ul>
        </div>
        <form
          className="opt-referral-form"
          onSubmit={(e) => { e.preventDefault(); if (email) { setSent(true); setTimeout(() => setSent(false), 2400); setEmail(''); } }}
        >
          <label className="opt-referral-label" htmlFor="ref-email">Their email</label>
          <div className="opt-referral-row">
            <input
              id="ref-email"
              type="email"
              className="opt-input"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="souv-cta-flow opt-referral-cta">
              <span>{sent ? 'Sent ✓' : 'Invite a Friend'}</span>
            </button>
          </div>
          <div className="opt-referral-or">
            <span className="souv-rule-gold" />
            <span>or</span>
            <span className="souv-rule-gold" />
          </div>
          <button type="button" className="souv-btn-log opt-referral-copy-btn">
            Copy My Referral Link
          </button>
          <div className="opt-referral-link" title="Tap copy button">
            souvenote.com/?ref=<b>cameron-w</b>
          </div>
        </form>
      </div>
    </section>
  );
}
function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

// ============================================================
// SECTION — CARD PACKS
// ============================================================
const CARD_PACKS_DATA = {
  trf: {
    id: 'trf',
    name: 'Try Risk-Free',
    price: '$9.99',
    priceUnit: 'shipping included',
    tokens: '10',
    cards: '1 physical 5×7',
    creditsPerCard: '10',
    blurb: 'Pay only for what you use, $0.20 per credit if you do not send. Hold released after seven days.',
    accent: 'gold',
  },
  tiered: {
    id: 'tiered',
    name: 'Big Sender',
    priceUnit: 'Sliding Scale · Includes shipping and 10 AI design and song credits',
    creditsPerCard: '10',
    minCards: 2,
    maxCards: 30,
    tiers: [
      { min: 2,  max: 10, pricePerCard: 8.99, label: '2–10 cards' },
      { min: 11, max: 20, pricePerCard: 7.99, label: '11–20 cards' },
      { min: 21, max: 99, pricePerCard: 6.99, label: '21–30+ cards' },
    ],
    blurb: 'Stock up at your own pace. The more cards you grab, the lower the per-card price. Twelve-month send window.',
    accent: 'gold',
  },
  family: {
    id: 'family',
    name: 'Share the Love',
    pricePerCard: 7.49,
    priceUnit: 'Shipping Included · Min. 3 cards',
    creditsPerCard: '10',
    minCards: 3,
    maxCards: 30,
    blurb: 'Buy cards to send to others to create their own. You may keep one for yourself. 12-month claim window across every recipient.',
    accent: 'gold',
  },
  twentyfive: null,
  community: {
    id: 'community-send',
    name: 'Community Card Send',
    price: '$7.99',
    priceUnit: 'shipping included',
    tokens: '—',
    cards: '1 physical 5×7',
    creditsPerCard: '—',
    blurb: 'Send a community card as-is. Remixing draws from your credit pool.',
    accent: 'platinum',
  },
  saved: {
    id: 'saved-send',
    name: 'Saved Card Send',
    price: '$7.99',
    priceUnit: 'shipping included',
    tokens: '—',
    cards: '1 physical 5×7',
    creditsPerCard: '—',
    blurb: 'Mail a card you have already saved. No new generation triggered.',
    accent: 'platinum',
  },
};

// Legacy flat array for the receive modal’s pack picker.
const CARD_PACKS = [
  CARD_PACKS_DATA.trf,
  CARD_PACKS_DATA.tiered,
  CARD_PACKS_DATA.family,
  CARD_PACKS_DATA.community,
  CARD_PACKS_DATA.saved,
];

function CardPacks({ currency }) {
  return (
    <section className="opt-pricing" data-screen-label="04 Card Packs" id="card-packs">
      <div className="opt-pricing-head">
        <div className="souv-eyebrow opt-eyebrow">PRICING · CARD PACKS</div>
        <h2 className="souv-h1 opt-h2 opt-h2-cardpacks">
          Physical cards,<br />
          <span className="souv-hero-italic text-metallic-rose-gold">printed and posted</span>
        </h2>
        <p className="opt-pricing-lede">
          Shipping is always included with your card, along with 10 AI design and song credits.
          Snag just one or grab a bulk pack to save.
        </p>
      </div>

      {/* Two larger cards, centred — Try Risk-Free · Big Sender */}
      <div className="opt-pricing-grid opt-pricing-grid-2c">
        <TryRiskFreeCard pack={CARD_PACKS_DATA.trf} />
        <TieredPackCard pack={CARD_PACKS_DATA.tiered} />
      </div>

      <ul className="opt-pricing-notes">
        <li>Each card has a 12 month send window and are saved in My Cards &amp; Songs so you can send when the time is right.</li>
      </ul>

      {currency === 'USD' && (
        <p className="opt-pricing-fx">
          Displayed in USD; billed in CAD at the day-of exchange rate.
        </p>
      )}
    </section>
  );
}

// ============================================================
// SECTION — AI CREDIT PACKS
// ============================================================
const AI_PACKS = [
  { id: 'starter', name: 'Starter', price: '$2.00', tokens: '10',  blurb: 'Top off a short session.',           accent: 'platinum' },
  { id: 'creator', name: 'Creator', price: '$10.00', tokens: '80',  blurb: 'A full evening of iteration.',      accent: 'gold', featured: true, badge: 'Most popular' },
  { id: 'power',   name: 'Power',   price: '$25.00', tokens: '250', blurb: 'For repeat senders and remixers.', accent: 'rose' },
];

function CreditPacks({ currency, variant = undefined }) {
  const lowCredits = variant === 'lowCredits';
  return (
    <section className="opt-pricing opt-pricing-ai" data-screen-label="05 Credit Packs" id="credit-packs">
      <div className="opt-pricing-head">
        <div className="souv-eyebrow opt-eyebrow">PRICING · AI CREDITS</div>
        {lowCredits ? (
          <h2 className="souv-h1 opt-h2 opt-h2-topup opt-h2-whoops">
            <span className="souv-hero-italic text-metallic-rose-gold">Whoops!</span>{' '}
            You need more{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">credits</span>{' '}
            to continue generating.
          </h2>
        ) : (
          <>
            <h2 className="souv-h1 opt-h2 opt-h2-topup">
              Top up{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">credits only</span>
            </h2>
            <p className="opt-pricing-lede">
              Bring your card to life.<br />
              <span style={{ whiteSpace: 'nowrap' }}>1 credit = 1 action for song creation, design generation and image editing.</span>
            </p>
          </>
        )}
      </div>
      <div className="opt-pricing-grid opt-pricing-grid-3">
        {AI_PACKS.map((p) => <PackCard key={p.id} pack={p} kind="credit" />)}
      </div>
      {currency === 'USD' && (
        <p className="opt-pricing-fx">
          Displayed in USD; billed in CAD at the day-of exchange rate.
        </p>
      )}
    </section>
  );
}

function PackCard({ pack, kind, compact, wide }) {
  return (
    <article className={`opt-pack opt-pack-${pack.accent} ${pack.featured ? 'is-featured' : ''} ${compact ? 'is-compact' : ''} ${wide ? 'is-wide' : ''}`}>
      {pack.featured && (
        <span className="opt-pack-badge">
          <IconStar />
          <em>{pack.badge}</em>
        </span>
      )}
      <StampCorners color="rgba(212,175,55,0.35)" />
      <header className="opt-pack-head">
        <div className="opt-pack-name">{pack.name}</div>
        <div className="opt-pack-price">
          {pack.price}
          {pack.priceUnit && <span className="opt-pack-unit"> {pack.priceUnit}</span>}
        </div>
      </header>
      <div className="opt-pack-rule" />
      <ul className="opt-pack-stats">
        {kind === 'card' && (
          <>
            <li>
              <span>Credits</span>
              <b>{pack.tokens}</b>
            </li>
            <li>
              <span>Cards</span>
              <b>{pack.cards}</b>
            </li>
            {pack.creditsPerCard && (
              <li>
                <span>Per card</span>
                <b>{pack.creditsPerCard}</b>
              </li>
            )}
          </>
        )}
        {kind === 'credit' && (
          <li className="opt-pack-stat-big">
            <span>Credits</span>
            <b>{pack.tokens}</b>
          </li>
        )}
      </ul>
      <p className="opt-pack-blurb">{pack.blurb}</p>
      <button className={`opt-pack-cta ${pack.featured ? 'is-gold' : ''}`}>
        <span>Choose {pack.name}</span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// SHARED — "How it works" 3-item list (used by all three packs)
// ============================================================
function HowItWorks({ items }) {
  return (
    <div className="opt-how">
      <div className="opt-how-eyebrow">
        <span className="souv-rule-gold" />
        <span>How it works</span>
        <span className="souv-rule-gold" />
      </div>
      <ul className="opt-how-list">
        {items.map((it, i) => (
          <li key={i}>
            <span className="opt-how-label">{it.label}</span>
            <span className="opt-how-body">{it.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// SHARED — meta line with rose-gold bullet separators
// ============================================================
function MetaBullets({ items }) {
  return (
    <div className="opt-pk-meta opt-pk-meta-bullets">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="opt-pk-dot" aria-hidden="true" />}
          <span>{it}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================
// SHARED — card-scale picker (quantity stepper + live total)
// ============================================================
function ScalePicker({ qty, setQty, min, max, total, helper }) {
  return (
    <div className="opt-pack-family-form">
      <label className="opt-pack-family-qty-row">
        <span className="opt-pack-family-label">How many cards?</span>
        <b className="opt-pk-row-total">${total}</b>
        <div className="opt-pack-family-stepper">
          <button type="button" aria-label="Decrease" onClick={() => setQty(qty - 1)} disabled={qty <= min}>−</button>
          <input
            type="number"
            min={min}
            max={max}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="opt-pack-family-qty"
          />
          <button type="button" aria-label="Increase" onClick={() => setQty(qty + 1)} disabled={qty >= max}>+</button>
        </div>
      </label>
      {helper && <div className="opt-pk-helper">{helper}</div>}
    </div>
  );
}

// ============================================================
// BIG SENDER — sliding-scale volume pack
//   2–10 : $8.99 · 11–20 : $7.99 · 21–30+ : $6.99
// ============================================================
function TieredPackCard({ pack }) {
  const { minCards = 2, maxCards = 30, tiers } = pack;
  const [qty, setQty] = React.useState(2);

  function setQtyClamped(nextRaw) {
    const next = Math.max(minCards, Math.min(maxCards, Math.floor(Number(nextRaw) || minCards)));
    setQty(next);
  }

  const currentTier = tiers.find((t) => qty >= t.min && qty <= t.max) || tiers[tiers.length - 1];
  const total = (qty * currentTier.pricePerCard).toFixed(2);

  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04b Big Sender">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">Big Sender</h3>
        <MetaBullets items={['Send multiple different cards', 'Includes shipping', '10 AI design and song credits per card']} />
      </header>

      {/* Cost — all three tier prices, in gold */}
      <div className="opt-pack-tiers opt-pack-tiers-hero" role="list" aria-label="Volume tiers">
        {tiers.map((t) => {
          const active = qty >= t.min && qty <= t.max;
          return (
            <button
              key={t.label}
              type="button"
              role="listitem"
              className={`opt-pack-tier ${active ? 'is-active' : ''}`}
              onClick={() => setQtyClamped(t.min)}
            >
              <span className="opt-pack-tier-range">{t.label}</span>
              <span className="opt-pack-tier-price">${t.pricePerCard.toFixed(2)}<em> / card</em></span>
            </button>
          );
        })}
      </div>

      {/* Scale picker — directly below pricing */}
      <ScalePicker
        qty={qty}
        setQty={setQtyClamped}
        min={minCards}
        max={maxCards}
        total={total}
      />

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          { label: 'Share the Love', body: 'Send a completed card to your loved ones, or gift a Souvenote so someone else can create their own.' },
          { label: 'Flexible Sending Options', body: 'Send the same card to everyone, or a unique card to each.' },
          { label: 'Always saved', body: 'Design now and send later.  Your creations will be saved in  "My Cards & Songs" for 12 months' },
        ]}
      />

      <button className="opt-pack-cta is-gold opt-pk-cta">
        <span>Reserve {qty} cards · ${total}</span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// SHARE THE LOVE — flat per-card family pack
//   $7.49 / card · min 3 · keep 1 for every 3 bought
// ============================================================
function FamilyPackCard({ pack }) {
  const { minCards = 3, maxCards = 30, pricePerCard } = pack;
  const [qty, setQty] = React.useState(minCards);

  function setQtyClamped(nextRaw) {
    const next = Math.max(minCards, Math.min(maxCards, Math.floor(Number(nextRaw) || minCards)));
    setQty(next);
  }

  const total = (qty * pricePerCard).toFixed(2);
  const keep = Math.floor(qty / 3);

  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04c Share the Love">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">Share the Love</h3>
        <div className="opt-pk-cost">
          <b>${pricePerCard.toFixed(2)}</b>
          <em>/ card</em>
        </div>
        <div className="opt-pk-meta">{pack.priceUnit}</div>
      </header>

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          { label: 'Family Discount', body: 'Buy 3 to 30 cards at a deep discount for your family to design their own.' },
          { label: 'Keep 1 for yourself', body: 'For every 3 cards you buy, you can choose to keep 1 for yourself or gift them all.' },
          { label: 'The Rules', body: <>Cards include <b>10 AI credits</b> and a 12-month expiry. Gifted cards must go to phone numbers or emails not linked to your account.</> },
        ]}
      />

      <ScalePicker
        qty={qty}
        setQty={setQtyClamped}
        min={minCards}
        max={maxCards}
        total={total}
        helper={<>Keep up to <b>{keep}</b> for yourself, gift the rest.</>}
      />

      <button className="opt-pack-cta is-gold opt-pk-cta">
        <span>Reserve {qty} cards · ${total}</span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// TRY RISK-FREE — single-card, hold-based option
// ============================================================
function TryRiskFreeCard({ pack }) {
  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04a Try Risk-Free">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">Try Risk-Free</h3>
        <MetaBullets items={['Send 1 card', 'Includes shipping', '10 AI design and song credits']} />
      </header>

      <div className="opt-pk-cost opt-pk-cost-split">
        <div className="opt-pk-cost-line"><b>$9.99</b><em>if you love it.</em></div>
        <div className="opt-pk-cost-line"><b>$2.00</b><em>if you don't.</em></div>
      </div>

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          { label: 'Unlock instantly', body: <>A temporary 5-day hold of <b>$9.99</b> is placed on your card to unlock your <b>10 design credits</b> immediately.</> },
          { label: 'If you send the card', body: 'The $9.99 hold is finalized. Your card is printed and shipped with no extra fees.' },
          { label: "If you don't send", body: <>The hold is released after 5 days. You are only charged <b>$2.00</b> for the 10 AI credits.</> },
        ]}
      />

      <button className="opt-pack-cta is-gold opt-pk-cta">
        <span>Choose Try Risk-Free</span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// SECTION — TRY RISK-FREE DEEP-DIVE (callout strip)
// ============================================================
function RiskFreeCallout({ inline }) {
  return (
    <section className={`opt-trf ${inline ? 'is-inline' : ''}`} data-screen-label="06 TRF Callout">
      <div className="opt-trf-inner">
        <div className="opt-trf-eyebrow">
          <span className="souv-rule-gold" />
          <span>HOW TRY RISK-FREE RESOLVES</span>
          <span className="souv-rule-gold" />
        </div>
        <div className="opt-trf-grid">
          <div className="opt-trf-step">
            <div className="opt-trf-num">01</div>
            <div className="opt-trf-title">$9.99 hold placed</div>
            <div className="opt-trf-body">Stripe authorization for seven days. Ten credits granted immediately.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">02</div>
            <div className="opt-trf-title">Send a card → full charge</div>
            <div className="opt-trf-body">We capture the full $9.99 from the hold on send.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">03</div>
            <div className="opt-trf-title">Don't send → pay-per-use</div>
            <div className="opt-trf-body">After seven days or ten credits used we capture only credits used × $0.20.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// MODAL — Pricing + Referral (hard intercept variant)
// ============================================================
function PricingReceiveModal({ open, onClose, currency }) {
  if (!open) return null;
  return (
    <div className="opt-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="m-title" data-screen-label="07 Modal_Pricing_Referral">
      <div className="opt-modal-scrim" onClick={onClose} />
      <div className="opt-modal">
        <button className="opt-modal-close" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
        <header className="opt-modal-head">
          <div className="souv-eyebrow opt-eyebrow">NO CREDITS YET · ADD ONE TO CONTINUE</div>
          <h2 id="m-title" className="opt-modal-title">
            Pick up a{' '}
            <span className="souv-hero-italic text-metallic-gold">pack,</span>{' '}
            or invite a{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">friend</span>
          </h2>
          <p className="opt-modal-sub">
            One credit equals one action. You can top up here without leaving — when payment
            confirms, you land back on the path you tapped.
          </p>
        </header>

        <div className="opt-modal-body">
          <div className="opt-modal-section">
            <div className="opt-modal-section-title">
              <IconToken />
              <span>AI Credit Packs</span>
            </div>
            <div className="opt-modal-credits">
              {AI_PACKS.map((p) => (
                <button key={p.id} className={`opt-modal-credit ${p.featured ? 'is-featured' : ''}`}>
                  {p.featured && <span className="opt-modal-credit-badge"><IconStar /></span>}
                  <div className="opt-modal-credit-name">{p.name}</div>
                  <div className="opt-modal-credit-tokens">
                    <b>{p.tokens}</b>
                    <em>credits</em>
                  </div>
                  <div className="opt-modal-credit-price">{p.price}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="opt-modal-section">
            <div className="opt-modal-section-title">
              <IconGift />
              <span>Card Packs · credits included</span>
            </div>
            <div className="opt-modal-cards">
              {CARD_PACKS.filter(p => ['trf','tiered','family'].includes(p.id)).map((p) => (
                <button key={p.id} className={`opt-modal-cardpack ${p.featured ? 'is-featured' : ''}`}>
                  {p.featured && <span className="opt-modal-credit-badge"><IconStar /></span>}
                  <div className="opt-modal-cardpack-name">{p.name}</div>
                  <div className="opt-modal-cardpack-stats">
                    <span><b>{p.tokens || p.creditsPerCard}</b> credits</span>
                    <span><b>{p.cards ? p.cards.replace(' physical 5×7','') : `${p.minCards}+`}</b> cards</span>
                  </div>
                  <div className="opt-modal-cardpack-price">{p.price || (p.pricePerCard ? `$${p.pricePerCard}` : '')}<em>{p.priceUnit}</em></div>
                </button>
              ))}
            </div>
          </div>

          <div className="opt-modal-section opt-modal-referral">
            <div className="opt-modal-referral-copy">
              <div className="opt-modal-section-title">
                <IconCommunity />
                <span>Or invite a friend and earn 3 credits</span>
              </div>
              <p className="opt-modal-sub opt-modal-sub-tight">
                Send one invite, get three credits when they sign up. Enough for an image, a song,
                and a retry — instantly.
              </p>
            </div>
            <div className="opt-modal-referral-row">
              <input type="email" className="opt-input" placeholder="friend@example.com" />
              <button type="button" className="souv-cta-flow"><span>Invite</span></button>
            </div>
          </div>
        </div>

        <footer className="opt-modal-foot">
          {currency === 'USD' && (
            <span className="opt-modal-fx">
              Displayed in USD; billed in CAD at the day-of exchange rate.
            </span>
          )}
          <button className="souv-btn-log opt-modal-cancel" onClick={onClose}>
            Not yet — back to options
          </button>
        </footer>
      </div>
    </div>
  );
}

export {
  BackButton,
  OptionsHeader,
  TileGrid,
  ReferralBlock,
  CardPacks,
  CreditPacks,
  RiskFreeCallout,
  TryRiskFreeCard,
  TieredPackCard,
  FamilyPackCard,
  PricingReceiveModal,
};
