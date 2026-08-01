'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchCreditPackOffers, fetchPricingOffers, purchaseMockCreditPack, type PricingOffer } from '../lib/api';
import { publishCreditBalanceValue } from '../lib/creditBalance';
import { StampCorners } from './Ornaments';
import { useAuth } from './AuthProvider';
import {
  BIG_SENDER_TIERS,
  type BigSenderTier,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  makeTryRiskFreeCartItem,
} from './pricingCatalog';
import { MIN_GENERATION_CREDITS } from './createFlowRules';
import { creditPackFromOffer, creditPackPurchaseLabel, type CreditPackCard as CreditPack } from './creditPackCatalog';

// Options.tsx - dedicated to the create-options, pricing, referral, and modal surfaces.
// Independent copy: edits here do NOT affect the "0 Credits · Modal" view (Options.intercept.jsx).
// Tiles · Referral · Card Packs · AI Credit Packs · (optional) Pricing modal.

// ============================================================
// ICONS — single-path strokes, currentColor, viewBox 0 0 24 24
// ============================================================
type CurrencyCode = 'CAD';

type BackButtonProps = {
  href?: string;
  label?: string;
};

type OptionsHeaderProps = {
  user?: unknown;
  credits: number;
  lowBalance: boolean;
};

type OptionTileTone = 'gold' | 'rose' | 'silver' | 'bronze';

type OptionTileBase = {
  id: string;
  tone: OptionTileTone;
  title: string;
  sub: string;
  gated: boolean;
  requiresCredits?: boolean;
  badge?: string;
};

type SelectableOptionTile = OptionTileBase & {
  href: string;
  comingSoon?: false;
};

type StaticOptionTile = OptionTileBase & {
  comingSoon: true;
  href?: never;
};

type OptionTile = SelectableOptionTile | StaticOptionTile;

type TileSelectContext = {
  credits: number;
  cardBank: number;
  locked: boolean;
};

type TileGridProps = {
  credits: number;
  cardBank?: number;
  onGated?: (tile: SelectableOptionTile) => void;
  onSelect?: (tile: SelectableOptionTile, context: TileSelectContext) => void;
};

type CardPack = {
  id: string;
  name: string;
  price?: string;
  priceCents?: number;
  noSendFeeCents?: number;
  holdDays?: number;
  priceUnit?: string;
  tokens?: string;
  cards?: string;
  creditsPerCard?: string;
  blurb: string;
  accent: string;
  featured?: boolean;
  badge?: string;
  minCards?: number;
  maxCards?: number;
  tiers?: BigSenderTier[];
  pricePerCard?: number;
};

type CardPacksData = {
  trf: CardPack;
  tiered: CardPack;
  family: CardPack & { pricePerCard: number };
  twentyfive: null;
  community: CardPack;
  saved: CardPack;
};

type CartItem = {
  id: string;
  type: 'credits' | 'pack';
  name: string;
  meta: string;
  sub: string;
  price: number;
  qty: number;
  unitNote: string;
  replaceGroup?: string;
  cardCount?: number;
  creditsPerCard?: number;
  tokens?: string;
  lockedQuantity?: boolean;
};

type CardPacksProps = {
  currency: CurrencyCode;
};

type CreditPacksProps = {
  currency: CurrencyCode;
  variant?: 'lowCredits';
};

type PackCardProps = {
  pack: CardPack | CreditPack;
  kind: 'card' | 'credit';
  compact?: boolean;
  wide?: boolean;
};

type HowItWorksItem = {
  label: string;
  body: React.ReactNode;
};

type HowItWorksProps = {
  items: HowItWorksItem[];
};

type MetaBulletsProps = {
  items: React.ReactNode[];
};

type ScalePickerProps = {
  qty: number;
  setQty: (qty: number | string) => void;
  min: number;
  max: number;
  total: string;
  helper?: React.ReactNode;
};

type TieredPackCardProps = {
  pack: CardPack;
};

type FamilyPackCardProps = {
  pack: CardPack & { pricePerCard: number };
};

type TryRiskFreeCardProps = {
  pack: CardPack;
};

type RiskFreeCalloutProps = {
  inline?: boolean;
};

function IconTemplate() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9h17" />
      <path d="M9 9v11.5" />
      <circle cx="14.5" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBuild() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h12l4 4v9H4z" />
      <path d="M16 7v4h4" />
      <path d="M8 14h6M8 17h4" />
      <path d="M19 4l1.6 1.6M21 7l-1.6-1.6M19 4l-1.6 1.6M21 7l1.6-1.6" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function IconCommunity() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="9" r="3.2" />
      <circle cx="17" cy="10.5" r="2.6" />
      <path d="M2.5 19c.6-3 3-4.6 5.5-4.6S13 16 13.5 19" />
      <path d="M13.5 17c.6-1.8 2.2-2.8 3.8-2.8 1.8 0 3.3 1 4 2.8" />
    </svg>
  );
}
function IconLibrary() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="6" width="13" height="14" rx="1.5" />
      <path d="M7 6V4.5h13V18" />
      <path d="M7 11h6M7 15h4" />
      <path d="M14.5 17.5l1.2 1.2 2.6-2.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function IconGift() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="8" width="17" height="5" />
      <path d="M5 13v8h14v-8" />
      <path d="M12 8v13" />
      <path d="M12 8s-3-4.5-5-3 .8 4 5 3zM12 8s3-4.5 5-3-.8 4-5 3z" />
    </svg>
  );
}
function IconSparkArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
function IconToken() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// ============================================================
// SHARED — Back button (centered pill beneath page content)
// ============================================================
function BackButton({ href = '/', label = 'Back' }: BackButtonProps) {
  return (
    <div className="opt-back-row" data-screen-label="Back">
      <Link className="opt-back" href={href}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
function OptionsHeader({ user, credits, lowBalance }: OptionsHeaderProps) {
  return (
    <section className="opt-head" data-screen-label="01 Header">
      <div className="opt-head-inner">
        <h1 className="souv-hero-title opt-title">
          Choose how to <span className="souv-hero-italic text-metallic-rose-gold">create your card</span>
        </h1>
        <p className="opt-lede">Every generation path lets you add an optional personalized song by QR code.</p>
      </div>
    </section>
  );
}

// ============================================================
// SECTION — TILE GRID (2×2)
// ============================================================
function TileGrid({ credits, cardBank = 0, onGated = undefined, onSelect = undefined }: TileGridProps) {
  const TILES: OptionTile[] = [
    {
      id: 'personalize',
      tone: 'gold',
      title: 'Personalize a Template',
      sub: 'Need inspiration? Personalize one of our pre-built cards like Horoscope or Comic cards!',
      gated: true,
      requiresCredits: true,
      badge: 'Most popular',
      href: '/create/personalize-a-template',
    },
    {
      id: 'build',
      tone: 'rose',
      title: 'Build My Card',
      sub: 'Have your own idea? Answer a few questions and watch your card come to life.',
      gated: true,
      requiresCredits: true,
      href: '/create/build-my-card',
    },
    {
      id: 'community',
      tone: 'silver',
      title: 'Community Cards',
      sub: 'Browse, send, or remix cards shared by the Souvenote community.',
      gated: false,
      comingSoon: true,
      badge: 'Coming soon',
    },
    {
      id: 'library',
      tone: 'bronze',
      title: 'Saved Cards & Songs',
      sub: 'Resume a draft. Re-send a saved card. Queue another song.',
      gated: false,
      href: '/create/my-cards-and-songs',
    },
  ];

  return (
    <section className="opt-tiles" data-screen-label="02 Tile Grid">
      <div className="opt-tiles-inner">
        {TILES.map((t) => {
          const locked = Boolean(t.requiresCredits && credits < MIN_GENERATION_CREDITS);
          const comingSoon = t.comingSoon;
          const tileClassName = `opt-tile opt-tile-${t.tone} ${locked ? 'is-locked' : ''} ${comingSoon ? 'is-coming-soon' : ''}`;
          const tileContent = (
            <>
              <span className="opt-tile-surface" aria-hidden="true"></span>
              <span className="opt-tile-grain" aria-hidden="true"></span>
              {t.badge && (
                <span className="opt-tile-badge">
                  <IconStar />
                  <em>{t.badge}</em>
                </span>
              )}
              <div className="opt-tile-body">
                <div className="opt-tile-title">{t.title}</div>
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
            </>
          );

          if (comingSoon) {
            return (
              <button key={t.id} type="button" className={tileClassName} disabled aria-label={`${t.title} coming soon`}>
                {tileContent}
              </button>
            );
          }

          const selectableTile = t as SelectableOptionTile;

          return (
            <Link
              key={t.id}
              href={selectableTile.href}
              className={tileClassName}
              onClick={(event) => {
                if (onSelect) {
                  event.preventDefault();
                  onSelect(selectableTile, { credits, cardBank, locked });
                  return;
                }
                if (locked) {
                  event.preventDefault();
                  if (onGated) onGated(selectableTile);
                }
              }}
              aria-label={t.title}
            >
              {tileContent}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function IconMusic() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.6" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

// ============================================================
// SECTION — REFERRAL
// ============================================================
function ReferralBlock() {
  return (
    <section className="opt-referral" data-screen-label="03 Referral">
      <div className="opt-referral-inner">
        <div className="opt-referral-copy">
          <div className="souv-eyebrow opt-eyebrow">REFERRAL</div>
          <h2 className="souv-h1 opt-h2">
            Referrals are <span className="souv-hero-italic text-metallic-rose-gold">coming soon</span>
          </h2>
          <p className="opt-lede opt-referral-lede">
            Referral invitations, links, and reward credits are not active in this build.
          </p>
          <ul className="opt-referral-ticks">
            <li>
              <Tick /> No invitations are sent
            </li>
            <li>
              <Tick /> No rewards are granted
            </li>
            <li>
              <Tick /> Availability will be announced later
            </li>
          </ul>
        </div>
        <form className="opt-referral-form" onSubmit={(event) => event.preventDefault()}>
          <label className="opt-referral-label" htmlFor="ref-email">
            Their email
          </label>
          <div className="opt-referral-row">
            <input id="ref-email" type="email" className="opt-input" placeholder="friend@example.com" disabled />
            <button type="submit" className="souv-cta-flow opt-referral-cta" disabled>
              <span>Coming soon</span>
            </button>
          </div>
          <div className="opt-referral-or">
            <span className="souv-rule-gold" />
            <span>or</span>
            <span className="souv-rule-gold" />
          </div>
          <button type="button" className="souv-btn-log opt-referral-copy-btn" disabled>
            Referral links coming soon
          </button>
          <div className="opt-referral-link">No referral link has been created.</div>
        </form>
      </div>
    </section>
  );
}
function Tick() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

// ============================================================
// SECTION — CARD PACKS
// ============================================================
const CARD_PACKS_DATA: CardPacksData = {
  trf: {
    id: 'trf',
    name: 'Try Risk-Free',
    price: '$9.99',
    priceUnit: 'shipping included',
    tokens: '10',
    cards: '1 physical 5×7',
    creditsPerCard: '10',
    blurb: 'Five-day $9.99 authorization. If you do not send, a fixed $2.00 is charged and the rest is released.',
    accent: 'gold',
  },
  tiered: {
    id: 'tiered',
    name: 'Big Sender',
    priceUnit: 'Sliding Scale · Includes shipping and 10 AI creation credits',
    creditsPerCard: '10',
    minCards: MIN_BIG_SENDER_CARDS,
    maxCards: MAX_BIG_SENDER_CARDS,
    tiers: BIG_SENDER_TIERS,
    blurb:
      'Stock up at your own pace. The more cards you grab, the lower the per-card price. Twelve-month send window.',
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
    blurb:
      'Buy cards to send to others to create their own. You may keep one for yourself. 12-month claim window across every recipient.',
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

function centsToDollars(cents?: number) {
  if (!Number.isFinite(cents)) return null;
  return Number(((cents ?? 0) / 100).toFixed(2));
}

function formatCents(cents?: number) {
  const dollars = centsToDollars(cents);
  return dollars === null ? undefined : `$${dollars.toFixed(2)}`;
}

function formatCardRange(min: number, max: number) {
  if (min === max) return `${min} physical 5x7`;
  return `${min}-${max} physical 5x7`;
}

function formatTierLabel(min: number, max: number) {
  if (min === max) return `${min} ${min === 1 ? 'card' : 'cards'}`;
  return `${min}-${max} cards`;
}

function parseFirstNumber(value: unknown): number | undefined {
  const match = String(value ?? '').match(/\d+/);
  if (!match) return undefined;

  const next = Number(match[0]);
  return Number.isFinite(next) ? Math.floor(next) : undefined;
}

function buildCardPacksData(offers: PricingOffer[]): CardPacksData {
  const tryRiskFreeOffer = offers.find(
    (offer) => offer.id === 'try_risk_free_one_card' || offer.type === 'try_risk_free',
  );
  const bigSenderOffers = offers
    .filter((offer) => offer.type === 'big_sender')
    .sort((a, b) => a.cardCountMin - b.cardCountMin);

  const holdDays = tryRiskFreeOffer?.authorizationDays ?? undefined;
  const noSendFeeCents = tryRiskFreeOffer?.noSendFeeCents ?? undefined;

  const bigSenderTiers = bigSenderOffers.map((offer) => ({
    min: offer.cardCountMin,
    max: offer.cardCountMax,
    pricePerCard: centsToDollars(offer.priceCents) ?? 0,
    label: formatTierLabel(offer.cardCountMin, offer.cardCountMax),
  }));

  const firstBigSender = bigSenderOffers[0];
  const lastBigSender = bigSenderOffers[bigSenderOffers.length - 1];

  return {
    ...CARD_PACKS_DATA,
    trf: tryRiskFreeOffer
      ? {
          ...CARD_PACKS_DATA.trf,
          id: tryRiskFreeOffer.id,
          name: tryRiskFreeOffer.name,
          price: formatCents(tryRiskFreeOffer.priceCents) ?? CARD_PACKS_DATA.trf.price,
          priceCents: tryRiskFreeOffer.priceCents,
          noSendFeeCents,
          holdDays,
          priceUnit: tryRiskFreeOffer.shippingIncluded ? 'shipping included' : CARD_PACKS_DATA.trf.priceUnit,
          tokens: String(tryRiskFreeOffer.creditsPerCard),
          cards: formatCardRange(tryRiskFreeOffer.cardCountMin, tryRiskFreeOffer.cardCountMax),
          creditsPerCard: String(tryRiskFreeOffer.creditsPerCard),
        }
      : CARD_PACKS_DATA.trf,
    tiered: bigSenderOffers.length
      ? {
          ...CARD_PACKS_DATA.tiered,
          id: 'big_sender',
          name: 'Big Sender',
          priceUnit: firstBigSender?.shippingIncluded
            ? 'Sliding Scale - Includes shipping and AI creation credits'
            : CARD_PACKS_DATA.tiered.priceUnit,
          creditsPerCard: firstBigSender
            ? String(firstBigSender.creditsPerCard)
            : CARD_PACKS_DATA.tiered.creditsPerCard,
          minCards: firstBigSender?.cardCountMin,
          maxCards: lastBigSender?.cardCountMax,
          tiers: bigSenderTiers,
        }
      : CARD_PACKS_DATA.tiered,
  };
}

function CardPacks(_props: CardPacksProps) {
  const [pricingOffers, setPricingOffers] = React.useState<PricingOffer[]>([]);
  const [pricingStatus, setPricingStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [pricingError, setPricingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    fetchPricingOffers()
      .then((offers) => {
        if (!active) return;
        setPricingOffers(offers);
        setPricingStatus('ready');
        setPricingError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPricingStatus('error');
        setPricingError(error instanceof Error ? error.message : 'Pricing could not be loaded from the backend.');
      });

    return () => {
      active = false;
    };
  }, []);

  const cardPacksData = React.useMemo(() => {
    if (pricingStatus !== 'ready' || pricingOffers.length === 0) return null;
    return buildCardPacksData(pricingOffers);
  }, [pricingOffers, pricingStatus]);

  return (
    <section className="opt-pricing" data-screen-label="04 Card Packs" id="card-packs">
      <div className="opt-pricing-head">
        <div className="souv-eyebrow opt-eyebrow">PRICING · CARD PACKS</div>
        <h2 className="souv-h1 opt-h2 opt-h2-cardpacks">
          Physical cards,
          <br />
          <span className="souv-hero-italic text-metallic-rose-gold">printed and posted</span>
        </h2>
        <p className="opt-pricing-lede">
          Shipping is always included with your card, along with{' '}
          <span className="text-metallic-rose-gold">10 AI creation credits</span> for image, edit, and optional QR-song
          actions. Snag just one or grab a bulk pack to save.
        </p>
      </div>

      {/* Two larger cards, centred — Try Risk-Free · Big Sender */}
      {pricingStatus === 'loading' && (
        <p className="opt-pricing-state" aria-live="polite">
          Loading live pricing from the local backend...
        </p>
      )}
      {pricingStatus === 'error' && (
        <p className="opt-pricing-state is-error" role="status">
          Could not load live backend pricing. Start the backend to see card pack prices.
          {pricingError ? ` ${pricingError}` : ''}
        </p>
      )}

      {/* No local fallback prices here for now; this makes backend-sourced pricing obvious during local testing. */}
      {cardPacksData && (
        <div className="opt-pricing-grid opt-pricing-grid-2c">
          <TryRiskFreeCard pack={cardPacksData.trf} />
          <TieredPackCard pack={cardPacksData.tiered} />
        </div>
      )}

      <ul className="opt-pricing-notes">
        <li>
          Each card has a 12 month send window and are saved in Saved Cards &amp; Songs so you can send when the time is
          right.
        </li>
      </ul>
    </section>
  );
}

// ============================================================
// SECTION — AI CREDIT PACKS
// ============================================================
function CreditPacks({ variant = undefined }: CreditPacksProps) {
  const lowCredits = variant === 'lowCredits';
  const [packs, setPacks] = React.useState<CreditPack[]>([]);
  const [pricingStatus, setPricingStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [pricingError, setPricingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetchCreditPackOffers()
      .then((offers) => {
        if (!active) return;
        setPacks(offers.map(creditPackFromOffer));
        setPricingStatus('ready');
        setPricingError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPricingStatus('error');
        setPricingError(error instanceof Error ? error.message : 'Credit-pack pricing could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="opt-pricing opt-pricing-ai" data-screen-label="05 Credit Packs" id="credit-packs">
      <div className="opt-pricing-head">
        <div className="souv-eyebrow opt-eyebrow">PRICING · AI CREDITS</div>
        {lowCredits ? (
          <h2 className="souv-h1 opt-h2 opt-h2-topup opt-h2-whoops">
            <span className="souv-hero-italic text-metallic-rose-gold">Whoops!</span> You need more{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">credits</span> to continue generating.
          </h2>
        ) : (
          <>
            <h2 className="souv-h1 opt-h2 opt-h2-topup">
              Top up <span className="souv-hero-italic text-metallic-rose-gold">credits</span>
            </h2>
            <p className="opt-pricing-lede">
              Start with 2 free trial credits, then add a standalone pack whenever you need more.
              <br />
              <span style={{ whiteSpace: 'nowrap' }}>
                1 credit = 1 action for design generation, image editing, or optional QR-song creation.
              </span>
            </p>
          </>
        )}
      </div>
      {pricingStatus === 'loading' && (
        <p className="opt-pricing-state" aria-live="polite">
          Loading standalone credit packs...
        </p>
      )}
      {pricingStatus === 'error' && (
        <p className="opt-pricing-state is-error" role="status">
          Could not load credit-pack pricing from the backend.
          {pricingError ? ` ${pricingError}` : ''}
        </p>
      )}
      <div className="opt-pricing-grid opt-pricing-grid-3">
        {packs.map((p) => (
          <PackCard key={p.id} pack={p} kind="credit" />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// PERSISTENT CART — add a chosen pack, then jump to the cart
// ============================================================
function souvAddToCart(item: CartItem) {
  if (typeof window === 'undefined') return;
  try {
    const key = 'souv_cart';
    let cur = JSON.parse(window.localStorage.getItem(key) || '[]') as CartItem[];
    if (item.replaceGroup) {
      cur = cur.filter((i) => i.replaceGroup !== item.replaceGroup && i.id !== item.id);
    }
    const hit = item.replaceGroup ? null : cur.find((i) => i.id === item.id);
    if (hit) hit.qty += item.qty || 1;
    else cur.push(item);
    window.localStorage.setItem(key, JSON.stringify(cur));
  } catch (e) {
    // Local storage may be unavailable; routing still lets the user continue.
  }
}

function useSouvBuyAndGo() {
  const router = useRouter();
  const auth = useAuth();
  return React.useCallback(
    (item: CartItem) => {
      if (auth.status !== 'authenticated') {
        router.push(`/signup?returnTo=${encodeURIComponent('/pricing')}`);
        return;
      }
      souvAddToCart(item);
      router.push('/cart');
    },
    [auth.status, router],
  );
}

function PackCard({ pack, kind, compact, wide }: PackCardProps) {
  const buyAndGo = useSouvBuyAndGo();
  const router = useRouter();
  const auth = useAuth();
  const [purchaseStatus, setPurchaseStatus] = React.useState<'idle' | 'purchasing' | 'success' | 'error'>('idle');
  const [purchaseMessage, setPurchaseMessage] = React.useState<string | null>(null);
  const isCardPack = kind === 'card';
  const cardPack = isCardPack ? (pack as CardPack) : null;
  const creditPack = kind === 'credit' ? (pack as CreditPack) : null;
  const priceUnit = cardPack?.priceUnit;
  const cardCount = cardPack ? parseFirstNumber(cardPack.cards) : undefined;
  const rawCreditsPerCard = cardPack?.creditsPerCard ?? cardPack?.tokens;
  const creditsPerCard = cardPack
    ? (parseFirstNumber(rawCreditsPerCard) ?? (rawCreditsPerCard ? 0 : undefined))
    : undefined;
  return (
    <article
      className={`opt-pack opt-pack-${pack.accent} ${pack.featured ? 'is-featured' : ''} ${compact ? 'is-compact' : ''} ${wide ? 'is-wide' : ''}`}
    >
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
          {priceUnit && <span className="opt-pack-unit"> {priceUnit}</span>}
        </div>
      </header>
      <div className="opt-pack-rule" />
      <ul className="opt-pack-stats">
        {cardPack && (
          <>
            <li>
              <span>Credits</span>
              <b>{cardPack.tokens}</b>
            </li>
            <li>
              <span>Cards</span>
              <b>{cardPack.cards}</b>
            </li>
            {cardPack.creditsPerCard && (
              <li>
                <span>Per card</span>
                <b>{cardPack.creditsPerCard}</b>
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
      <button
        className={`opt-pack-cta ${pack.featured ? 'is-gold' : ''}`}
        disabled={kind === 'credit' && purchaseStatus === 'purchasing'}
        onClick={async () => {
          if (kind === 'credit' && creditPack) {
            if (auth.status !== 'authenticated') {
              router.push(`/signup?returnTo=${encodeURIComponent('/pricing#credit-packs')}`);
              return;
            }
            setPurchaseStatus('purchasing');
            setPurchaseMessage(null);
            try {
              const result = await purchaseMockCreditPack(creditPack.id);
              publishCreditBalanceValue(result.balance);
              setPurchaseStatus('success');
              setPurchaseMessage(
                `Local mock purchase complete: ${result.purchase.creditsGranted} credits added. New balance: ${result.balance}.`,
              );
            } catch (error: unknown) {
              setPurchaseStatus('error');
              setPurchaseMessage(error instanceof Error ? error.message : 'The credit pack could not be purchased.');
            }
            return;
          }
          buyAndGo({
            id: `${kind}-${pack.id}`,
            type: 'pack',
            name: pack.name,
            meta: `${cardPack?.cards || '1'} cards · shipping included`,
            sub: pack.blurb,
            price: parseFloat(String(pack.price).replace(/[^0-9.]/g, '')) || 0,
            qty: 1,
            unitNote: 'card pack',
            ...(cardCount ? { cardCount } : {}),
            ...(creditsPerCard !== undefined ? { creditsPerCard } : {}),
          });
        }}
      >
        <span>
          {kind === 'credit'
            ? creditPack
              ? creditPackPurchaseLabel(creditPack, purchaseStatus === 'purchasing')
              : 'Add credits'
            : `Choose ${pack.name}`}
        </span>
        <IconSparkArrow />
      </button>
      {kind === 'credit' && purchaseMessage && (
        <p
          className={`opt-pricing-state ${purchaseStatus === 'error' ? 'is-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {purchaseMessage}
        </p>
      )}
    </article>
  );
}

// ============================================================
// SHARED — "How it works" 3-item list (used by all three packs)
// ============================================================
function HowItWorks({ items }: HowItWorksProps) {
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
function MetaBullets({ items }: MetaBulletsProps) {
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
function ScalePicker({ qty, setQty, min, max, total, helper }: ScalePickerProps) {
  return (
    <div className="opt-pack-family-form">
      <label className="opt-pack-family-qty-row">
        <span className="opt-pack-family-label">How many cards?</span>
        <b className="opt-pk-row-total">${total}</b>
        <div className="opt-pack-family-stepper">
          <button type="button" aria-label="Decrease" onClick={() => setQty(qty - 1)} disabled={qty <= min}>
            −
          </button>
          <input
            type="number"
            min={min}
            max={max}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="opt-pack-family-qty"
          />
          <button type="button" aria-label="Increase" onClick={() => setQty(qty + 1)} disabled={qty >= max}>
            +
          </button>
        </div>
      </label>
      {helper && <div className="opt-pk-helper">{helper}</div>}
    </div>
  );
}

// ============================================================
// BIG SENDER — sliding-scale volume pack
//   1–10 : $8.99 · 11–20 : $7.99 · 21–30+ : $6.99
// ============================================================
function TieredPackCard({ pack }: TieredPackCardProps) {
  const buyAndGo = useSouvBuyAndGo();
  const { minCards = MIN_BIG_SENDER_CARDS, maxCards = MAX_BIG_SENDER_CARDS, tiers = BIG_SENDER_TIERS } = pack;
  const [qty, setQty] = React.useState(minCards);

  React.useEffect(() => {
    setQty((current) => clampBigSenderQuantity(current, minCards, maxCards));
  }, [minCards, maxCards]);

  function setQtyClamped(nextRaw: number | string) {
    setQty(clampBigSenderQuantity(nextRaw, minCards, maxCards));
  }

  const pricing = getBigSenderPricing(qty, tiers);
  const displayQty = pricing.qty;
  const total = pricing.totalText;

  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04b Big Sender">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">Big Sender</h3>
        <MetaBullets
          items={[
            'Send multiple different cards',
            'Includes shipping',
            <span key="credits-per-card" className="text-metallic-rose-gold">
              10 AI creation credits per card
            </span>,
          ]}
        />
      </header>

      {/* Cost — all three tier prices, in gold */}
      <div className="opt-pack-tiers opt-pack-tiers-hero" role="list" aria-label="Volume tiers">
        {tiers.map((t) => {
          const active = displayQty >= t.min && displayQty <= t.max;
          return (
            <button
              key={t.label}
              type="button"
              role="listitem"
              className={`opt-pack-tier ${active ? 'is-active' : ''}`}
              onClick={() => setQtyClamped(t.min)}
            >
              <span className="opt-pack-tier-range">{t.label}</span>
              <span className="opt-pack-tier-price">
                ${t.pricePerCard.toFixed(2)}
                <em> / card</em>
              </span>
            </button>
          );
        })}
      </div>

      {/* Scale picker — directly below pricing */}
      <ScalePicker qty={displayQty} setQty={setQtyClamped} min={minCards} max={maxCards} total={total} />

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          {
            label: 'Share the Love',
            body: 'Send a completed card to your loved ones, or gift a Souvenote so someone else can create their own.',
          },
          { label: 'Flexible Sending Options', body: 'Send the same card to everyone, or a unique card to each.' },
          {
            label: 'Always saved',
            body: 'Design now and send later. Your creations will be saved in "Saved Cards & Songs" for 12 months',
          },
        ]}
      />

      <button
        className="opt-pack-cta is-gold opt-pk-cta"
        onClick={() => buyAndGo(makeBigSenderCartItem(displayQty, tiers))}
      >
        <span>
          Reserve {qty} cards · ${total}
        </span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// SHARE THE LOVE — flat per-card family pack
//   $7.49 / card · min 3 · keep 1 for every 3 bought
// ============================================================
function FamilyPackCard({ pack }: FamilyPackCardProps) {
  const buyAndGo = useSouvBuyAndGo();
  const { minCards = 3, maxCards = 30, pricePerCard } = pack;
  const [qty, setQty] = React.useState(minCards);

  function setQtyClamped(nextRaw: number | string) {
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
          {
            label: 'Family Discount',
            body: 'Buy 3 to 30 cards at a deep discount for your family to design their own.',
          },
          {
            label: 'Keep 1 for yourself',
            body: 'For every 3 cards you buy, you can choose to keep 1 for yourself or gift them all.',
          },
          {
            label: 'The Rules',
            body: (
              <>
                Cards include <b>10 AI credits</b> and a 12-month expiry. Gifted cards must go to phone numbers or
                emails not linked to your account.
              </>
            ),
          },
        ]}
      />

      <ScalePicker
        qty={qty}
        setQty={setQtyClamped}
        min={minCards}
        max={maxCards}
        total={total}
        helper={
          <>
            Keep up to <b>{keep}</b> for yourself, gift the rest.
          </>
        }
      />

      <button
        className="opt-pack-cta is-gold opt-pk-cta"
        onClick={() =>
          buyAndGo({
            id: 'pack-family',
            type: 'pack',
            name: 'Share the Love',
            meta: `${qty} cards · shipping included`,
            sub: `Keep up to ${keep} for yourself, gift the rest.`,
            price: parseFloat(total) || 0,
            qty: 1,
            cardCount: qty,
            creditsPerCard: parseFirstNumber(pack.creditsPerCard) ?? 10,
            unitNote: `$${pricePerCard.toFixed(2)} / card`,
          })
        }
      >
        <span>
          Reserve {qty} cards · ${total}
        </span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// TRY RISK-FREE — single-card, hold-based option
// ============================================================
function TryRiskFreeCard({ pack }: TryRiskFreeCardProps) {
  const buyAndGo = useSouvBuyAndGo();
  const holdPrice = pack.price ?? '$9.99';
  const noSendPrice = formatCents(pack.noSendFeeCents) ?? '$2.00';
  const holdDays = pack.holdDays ?? 5;
  const credits = pack.creditsPerCard ?? pack.tokens ?? '10';
  const shippingLabel =
    pack.priceUnit === 'shipping included' ? 'Includes shipping' : (pack.priceUnit ?? 'Includes shipping');
  const cardLabel = pack.cards?.startsWith('1') ? 'Send 1 card' : (pack.cards ?? 'Send 1 card');

  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04a Try Risk-Free">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">{pack.name}</h3>
        <MetaBullets
          items={[
            cardLabel,
            shippingLabel,
            <span key="credits" className="text-metallic-rose-gold">
              {credits} AI creation credits
            </span>,
          ]}
        />
      </header>

      <div className="opt-pk-cost opt-pk-cost-split">
        <div className="opt-pk-cost-line">
          <b>{holdPrice}</b>
          <em>if you love it.</em>
        </div>
        <div className="opt-pk-cost-line">
          <b>{noSendPrice}</b>
          <em>if you don't.</em>
        </div>
      </div>

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          {
            label: 'Unlock instantly',
            body: (
              <>
                A temporary {holdDays}-day hold of <b>{holdPrice}</b> is placed on your card to unlock your{' '}
                <b>{credits} design credits</b> immediately.
              </>
            ),
          },
          {
            label: 'If you send the card',
            body: `The ${holdPrice} hold is finalized. Your card is printed and shipped with no extra fees.`,
          },
          {
            label: "If you don't send",
            body: (
              <>
                The hold is released after {holdDays} days. You are only charged <b>{noSendPrice}</b> for the {credits}{' '}
                AI credits.
              </>
            ),
          },
        ]}
      />

      <button
        className="opt-pack-cta is-gold opt-pk-cta"
        onClick={() =>
          buyAndGo(
            makeTryRiskFreeCartItem({
              name: pack.name,
              priceCents: pack.priceCents,
              creditsPerCard: Number(credits) || 10,
              holdDays,
            }),
          )
        }
      >
        <span>Choose {pack.name}</span>
        <IconSparkArrow />
      </button>
    </article>
  );
}

// ============================================================
// SECTION — TRY RISK-FREE DEEP-DIVE (callout strip)
// ============================================================
function RiskFreeCallout({ inline }: RiskFreeCalloutProps) {
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
            <div className="opt-trf-body">Five-day authorization. Ten provisional credits granted immediately.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">02</div>
            <div className="opt-trf-title">Send a card → full charge</div>
            <div className="opt-trf-body">We capture the full $9.99 from the hold on send.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">03</div>
            <div className="opt-trf-title">Don't send → fixed $2.00</div>
            <div className="opt-trf-body">After five days we charge $2.00 and release the remaining $7.99.</div>
          </div>
        </div>
      </div>
    </section>
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
};
