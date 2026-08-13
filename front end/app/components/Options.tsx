"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createLocalIdempotencyKey,
  createReferralInvite,
  fetchPricingOffers,
  fetchReferralDashboard,
  type PricingOffer,
} from "../lib/api";
import { StampCorners } from "./Ornaments";
import { useAuth } from "./AuthProvider";
import {
  BIG_SENDER_TIERS,
  type BigSenderTier,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  makeTryRiskFreeCartItem,
} from "./pricingCatalog";
import { MIN_GENERATION_CREDITS } from "./createFlowRules";

// Options.tsx - dedicated to the create-options, pricing, referral, and modal surfaces.
// Independent copy: edits here do NOT affect the "0 Credits · Modal" view (Options.intercept.jsx).
// Tiles · Referral · Card Packs · AI Credit Packs · (optional) Pricing modal.

// ============================================================
// ICONS — single-path strokes, currentColor, viewBox 0 0 24 24
// ============================================================
type CurrencyCode = "CAD";

type BackButtonProps = {
  href?: string;
  label?: string;
};

type OptionTileTone = "gold" | "rose" | "silver" | "bronze";

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

type CreditPack = {
  id: string;
  offerCode: string;
  name: string;
  price: string;
  tokens: string;
  blurb: string;
  accent: string;
  featured?: boolean;
  badge?: string;
};

const FALLBACK_CREDIT_PACKS: CreditPack[] = [
  {
    id: "credit_pack_starter_10",
    offerCode: "credit_pack_starter_10",
    name: "Starter",
    price: "$2.00",
    tokens: "10",
    blurb: "Top off a short session.",
    accent: "platinum",
  },
  {
    id: "credit_pack_creator_80",
    offerCode: "credit_pack_creator_80",
    name: "Creator",
    price: "$10.00",
    tokens: "80",
    blurb: "A full evening of iteration.",
    accent: "gold",
    featured: true,
    badge: "Most popular",
  },
  {
    id: "credit_pack_power_250",
    offerCode: "credit_pack_power_250",
    name: "Power",
    price: "$25.00",
    tokens: "250",
    blurb: "For repeat senders and remixers.",
    accent: "rose",
  },
];

type CartItem = {
  id: string;
  type: "credits" | "pack";
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
  offerCode?: string;
  lockedQuantity?: boolean;
};

type CreditPacksProps = {
  currency: CurrencyCode;
  variant?: "lowCredits";
};

type PackCardProps = {
  pack: CardPack | CreditPack;
  kind: "card" | "credit";
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

function IconSparkArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
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
// ============================================================
// SHARED — Back button (centered pill beneath page content)
// ============================================================
function BackButton({ href = '/', label = 'Back' }: BackButtonProps) {
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
function OptionsHeader() {
  return (
    <section className="opt-head" data-screen-label="01 Header">
      <div className="opt-head-inner">
        <h1 className="souv-hero-title opt-title">
          Choose how to{' '}
          <span className="souv-hero-italic text-metallic-rose-gold">create your card</span>
        </h1>
        <p className="opt-lede">
          Every generation path lets you add an optional personalized song by QR code.
        </p>
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
            </>
          );

          if (comingSoon) {
            return (
              <button
                key={t.id}
                type="button"
                className={tileClassName}
                disabled
                aria-label={`${t.title} coming soon`}
              >
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
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [referralPath, setReferralPath] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchReferralDashboard()
      .then((dashboard) => setReferralPath(dashboard.referral.path))
      .catch(() => setReferralPath(null));
  }, [auth.status]);

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.status !== "authenticated") {
      router.push("/login?returnTo=/refer");
      return;
    }
    setError(null);
    try {
      await createReferralInvite(email, createLocalIdempotencyKey("referral"));
      setSent(true);
      setEmail('');
      window.setTimeout(() => setSent(false), 2400);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Could not create the invite.");
    }
  }

  function copyReferral() {
    if (!referralPath) {
      router.push(auth.status === "authenticated" ? "/refer" : "/login?returnTo=/refer");
      return;
    }
    navigator.clipboard?.writeText(`${window.location.origin}${referralPath}`).catch(() => {});
    setSent(true);
    window.setTimeout(() => setSent(false), 1800);
  }
  return (
    <section className="opt-referral" data-screen-label="03 Referral">
      <div className="opt-referral-inner">
        <div className="opt-referral-copy">
          <div className="souv-eyebrow opt-eyebrow">REFERRAL</div>
          <h2 className="souv-h1 opt-h2">
            Invite a friend,{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">give 10, get 10</span>
          </h2>
          <p className="opt-lede opt-referral-lede">
            Your friend starts with <em>ten credits</em>. You earn ten after their first physical card is sent.
          </p>
          <ul className="opt-referral-ticks">
            <li><Tick /> +10 credits after their first physical send</li>
            <li><Tick /> No cap, keep inviting</li>
            <li><Tick /> Invite delivery stays mocked until launch providers are enabled</li>
          </ul>
        </div>
        <form
          className="opt-referral-form"
          onSubmit={submitInvite}
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
          {error && <p className="opt-referral-label" role="alert">{error}</p>}
          <button type="button" className="souv-btn-log opt-referral-copy-btn" onClick={copyReferral}>
            Copy My Referral Link
          </button>
          <div className="opt-referral-link" title="Tap copy button">
            {referralPath ? <>souvenote.com<b>{referralPath}</b></> : <b>Sign in to create your secure link</b>}
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
const CARD_PACKS_DATA: CardPacksData = {
  trf: {
    id: 'trf',
    name: 'Try Risk-Free',
    price: '$9.99',
    priceUnit: 'shipping included',
    tokens: '10',
    cards: '1 physical 5×7',
    creditsPerCard: '10',
    blurb: 'A five-day review window starts when payment is authorized. No-send or no action costs a flat CA$2.',
    accent: 'gold',
  },
  tiered: {
    id: 'tiered',
    name: 'Big Sender',
    priceUnit: 'Sliding Scale · Includes printing, delivery, and 10 AI creation credits',
    creditsPerCard: '10',
    minCards: MIN_BIG_SENDER_CARDS,
    maxCards: MAX_BIG_SENDER_CARDS,
    tiers: BIG_SENDER_TIERS,
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

function centsToDollars(cents?: number) {
  if (!Number.isFinite(cents)) return null;
  return Number(((cents ?? 0) / 100).toFixed(2));
}

function formatCents(cents?: number) {
  const dollars = centsToDollars(cents);
  return dollars === null ? undefined : `$${dollars.toFixed(2)}`;
}

function getNumberMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatCardRange(min: number, max: number) {
  if (min === max) return `${min} physical 5x7`;
  return `${min}-${max} physical 5x7`;
}

function formatTierLabel(min: number, max: number) {
  if (min === max) return `${min} ${min === 1 ? "card" : "cards"}`;
  return `${min}-${max} cards`;
}

function parseFirstNumber(value: unknown): number | undefined {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return undefined;

  const next = Number(match[0]);
  return Number.isFinite(next) ? Math.floor(next) : undefined;
}

function buildCardPacksData(offers: PricingOffer[]): CardPacksData {
  const tryRiskFreeOffer = offers.find(
    (offer) => offer.id === "try_risk_free_one_card" || offer.type === "try_risk_free",
  );
  const bigSenderOffers = offers
    .filter((offer) => offer.type === "big_sender")
    .sort((a, b) => a.cardCountMin - b.cardCountMin);

  const holdDays = getNumberMetadata(tryRiskFreeOffer?.metadata, "hold_days");
  const noSendFeeCents = getNumberMetadata(
    tryRiskFreeOffer?.metadata,
    "no_send_fee_cents",
  );

  const bigSenderTiers = bigSenderOffers.map((offer) => ({
    offerCode: offer.id,
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
          priceUnit: tryRiskFreeOffer.shippingIncluded
            ? "shipping included"
            : CARD_PACKS_DATA.trf.priceUnit,
          tokens: String(tryRiskFreeOffer.creditsPerCard),
          cards: formatCardRange(
            tryRiskFreeOffer.cardCountMin,
            tryRiskFreeOffer.cardCountMax,
          ),
          creditsPerCard: String(tryRiskFreeOffer.creditsPerCard),
        }
      : CARD_PACKS_DATA.trf,
    tiered: bigSenderOffers.length
      ? {
          ...CARD_PACKS_DATA.tiered,
          id: "big_sender",
          name: "Big Sender",
          priceUnit: firstBigSender?.shippingIncluded
            ? "Sliding Scale - Includes printing, delivery, and AI creation credits"
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

function CardPacks() {
  const [pricingOffers, setPricingOffers] = React.useState<PricingOffer[]>([]);
  const [pricingStatus, setPricingStatus] = React.useState<
    "loading" | "ready" | "fallback"
  >("loading");

  React.useEffect(() => {
    let active = true;

    fetchPricingOffers()
      .then((offers) => {
        if (!active) return;
        setPricingOffers(offers);
        setPricingStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPricingStatus("fallback");
      });

    return () => {
      active = false;
    };
  }, []);

  const cardPacksData = React.useMemo(() => {
    if (pricingStatus === "ready" && pricingOffers.length > 0) {
      return buildCardPacksData(pricingOffers);
    }
    return CARD_PACKS_DATA;
  }, [pricingOffers, pricingStatus]);

  return (
    <section className="opt-pricing" data-screen-label="04 Card Packs" id="card-packs">
      <div className="opt-pricing-head">
        <div className="souv-eyebrow opt-eyebrow">PRICING · CARD PACKS</div>
        <h2 className="souv-h1 opt-h2 opt-h2-cardpacks">
          Physical cards,<br />
          <span className="souv-hero-italic text-metallic-rose-gold">printed and posted</span>
        </h2>
        <p className="opt-pricing-lede">
          Shipping is always included with your card, along with <span className="text-metallic-rose-gold">10 AI creation credits</span> for image, edit, and optional QR-song actions.
          Snag just one or grab a bulk pack to save.
        </p>
      </div>

      {/* Two larger cards, centred — Try Risk-Free · Big Sender */}
      {pricingStatus === "fallback" && (
        <p className="opt-pricing-state" role="status">
          Showing standard CAD pricing while live pricing reconnects.
        </p>
      )}

      <div className="opt-pricing-grid opt-pricing-grid-2c">
        <TryRiskFreeCard pack={cardPacksData.trf} />
        <TieredPackCard pack={cardPacksData.tiered} />
      </div>

      <ul className="opt-pricing-notes">
        <li>Each card is saved in Saved Cards &amp; Songs so you can send when the time is right.</li>
      </ul>

      <p className="opt-pricing-fx">All prices shown and billed in CAD.</p>
    </section>
  );
}

// ============================================================
// SECTION — AI CREDIT PACKS
// ============================================================
function creditPackText(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildCreditPacks(offers: PricingOffer[]): CreditPack[] {
  return offers
    .filter((offer) => offer.type === "credit_pack")
    .sort((a, b) => a.priceCents - b.priceCents)
    .map((offer) => {
      const accent = creditPackText(offer.metadata, "accent", "platinum");
      const displayName = offer.name.replace(/\s+Credits$/i, "");
      return {
        id: offer.id,
        offerCode: offer.id,
        name: displayName,
        price: formatCents(offer.priceCents) ?? "$0.00",
        tokens: String(offer.creditAmount ?? offer.creditsPerCard),
        blurb: creditPackText(
          offer.metadata,
          "blurb",
          "Add creation credits to your account.",
        ),
        accent: ["platinum", "gold", "rose"].includes(accent)
          ? accent
          : "platinum",
        featured: offer.metadata?.featured === true,
        badge: creditPackText(offer.metadata, "badge", "Most popular"),
      };
    });
}

function CreditPacks({ currency, variant = undefined }: CreditPacksProps) {
  const lowCredits = variant === 'lowCredits';
  const [creditPacks, setCreditPacks] = React.useState<CreditPack[]>(
    FALLBACK_CREDIT_PACKS,
  );
  const [pricingStatus, setPricingStatus] = React.useState<
    "loading" | "ready" | "fallback"
  >("loading");

  React.useEffect(() => {
    let active = true;
    fetchPricingOffers()
      .then((offers) => {
        if (!active) return;
        const packs = buildCreditPacks(offers);
        if (!packs.length) {
          throw new Error(
            "The backend pricing catalog did not include credit packs.",
          );
        }
        setCreditPacks(packs);
        setPricingStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCreditPacks(FALLBACK_CREDIT_PACKS);
        setPricingStatus("fallback");
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
            <span className="souv-hero-italic text-metallic-rose-gold">Whoops!</span>{' '}
            You need more{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">credits</span>{' '}
            to continue generating.
          </h2>
        ) : (
          <>
            <h2 className="souv-h1 opt-h2 opt-h2-topup">
              Top up{' '}
              <span className="souv-hero-italic text-metallic-rose-gold">credits</span>
            </h2>
            <p className="opt-pricing-lede">
              Bring your card to life.<br />
              <span className="opt-pricing-credit-note">
                1 credit = 1 action for design generation, image editing, or optional QR-song creation.
              </span>
            </p>
          </>
        )}
      </div>
      {pricingStatus === "fallback" && (
        <p className="opt-pricing-state" role="status">
          Showing standard CAD pricing while live pricing reconnects.
        </p>
      )}
      <div className="opt-pricing-grid opt-pricing-grid-3">
        {creditPacks.map((pack) => (
          <PackCard key={pack.id} pack={pack} kind="credit" />
        ))}
      </div>
      <p className="opt-pricing-fx">
        All prices are shown and billed in {currency}.
      </p>
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
  return React.useCallback((item: CartItem) => {
    if (auth.status !== "authenticated") {
      router.push(`/signup?returnTo=${encodeURIComponent("/pricing")}`);
      return;
    }
    souvAddToCart(item);
    router.push('/cart');
  }, [auth.status, router]);
}

function PackCard({ pack, kind, compact, wide }: PackCardProps) {
  const buyAndGo = useSouvBuyAndGo();
  const isCardPack = kind === 'card';
  const cardPack = isCardPack ? pack as CardPack : null;
  const priceUnit = cardPack?.priceUnit;
  const cardCount = cardPack ? parseFirstNumber(cardPack.cards) : undefined;
  const rawCreditsPerCard = cardPack?.creditsPerCard ?? cardPack?.tokens;
  const creditsPerCard = cardPack
    ? parseFirstNumber(rawCreditsPerCard) ?? (rawCreditsPerCard ? 0 : undefined)
    : undefined;
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
      <button className={`opt-pack-cta ${pack.featured ? 'is-gold' : ''}`} onClick={() => buyAndGo({
        id: `${kind}-${pack.id}`,
        type: kind === 'credit' ? 'credits' : 'pack',
        name: kind === 'credit' ? `${pack.name} credits` : pack.name,
        meta: kind === 'credit' ? `${pack.tokens} AI credits · image, edit, or QR song actions` : `${cardPack?.cards || '1'} cards · shipping included`,
        sub: pack.blurb,
        price: parseFloat(String(pack.price).replace(/[^0-9.]/g, '')) || 0,
        qty: 1,
        unitNote: kind === 'credit' ? 'one-time top-up' : 'card pack',
        ...(kind === 'credit'
          ? {
              tokens: pack.tokens,
              offerCode: (pack as CreditPack).offerCode,
              replaceGroup: "credit-pack",
              lockedQuantity: true,
            }
          : {}),
        ...(cardCount ? { cardCount } : {}),
        ...(creditsPerCard !== undefined ? { creditsPerCard } : {}),
      })}>
        <span>Choose {pack.name}</span>
        <IconSparkArrow />
      </button>
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
        <MetaBullets items={['Send multiple different cards', 'Printing and standard delivery included', <span key="credits-per-card" className="text-metallic-rose-gold">10 AI creation credits per card</span>]} />
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
              <span className="opt-pack-tier-price">${t.pricePerCard.toFixed(2)}<em> / card</em></span>
            </button>
          );
        })}
      </div>

      {/* Scale picker — directly below pricing */}
      <ScalePicker
        qty={displayQty}
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
          { label: 'Saved to your account', body: 'Design now and send later. Your creations will be saved in "Saved Cards & Songs".' },
        ]}
      />

      <button className="opt-pack-cta is-gold opt-pk-cta" onClick={() => buyAndGo(makeBigSenderCartItem(displayQty, tiers))}>
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

      <button className="opt-pack-cta is-gold opt-pk-cta" onClick={() => buyAndGo({
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
      })}>
        <span>Reserve {qty} cards · ${total}</span>
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
  const holdPrice = pack.price ?? "$9.99";
  const noSendPrice = formatCents(pack.noSendFeeCents) ?? "$2.00";
  const holdDays = pack.holdDays ?? 5;
  const credits = pack.creditsPerCard ?? pack.tokens ?? "10";
  const shippingLabel = pack.priceUnit === "shipping included"
    ? "Includes shipping"
    : pack.priceUnit ?? "Includes shipping";
  const cardLabel = pack.cards?.startsWith("1")
    ? "Send 1 card"
    : pack.cards ?? "Send 1 card";

  return (
    <article className="opt-pack opt-pack-unified opt-pack-gold" data-screen-label="04a Try Risk-Free">
      <header className="opt-pk-head">
        <h3 className="opt-pk-name">{pack.name}</h3>
        <MetaBullets items={[cardLabel, shippingLabel, <span key="credits" className="text-metallic-rose-gold">{credits} AI creation credits</span>]} />
      </header>

      <div className="opt-pk-cost opt-pk-cost-split">
        <div className="opt-pk-cost-line"><b>{holdPrice}</b><em>if you love it.</em></div>
        <div className="opt-pk-cost-line"><b>{noSendPrice}</b><em>if you don't.</em></div>
      </div>

      <div className="opt-pk-rule" />

      <HowItWorks
        items={[
          { label: 'Unlock instantly', body: <>A temporary {holdDays}-day hold of <b>{holdPrice}</b> is placed on your card to unlock your <b>{credits} design credits</b> immediately.</> },
          { label: 'If you send the card', body: `The ${holdPrice} hold is finalized. Your card is printed and shipped with no extra fees.` },
          { label: "If you don't send", body: <>The hold is released after {holdDays} days. You are only charged <b>{noSendPrice}</b> for the {credits} AI credits.</> },
        ]}
      />

      <button className="opt-pack-cta is-gold opt-pk-cta" onClick={() => buyAndGo(makeTryRiskFreeCartItem({
        name: pack.name,
        priceCents: pack.priceCents,
        creditsPerCard: Number(credits) || 10,
        holdDays,
      }))}>
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
  const [pack, setPack] = React.useState<CardPack>(CARD_PACKS_DATA.trf);

  React.useEffect(() => {
    let active = true;

    fetchPricingOffers()
      .then((offers) => {
        if (!active) return;
        setPack(buildCardPacksData(offers).trf);
      })
      .catch(() => {
        // The checked-in CAD catalog is the intentional offline fallback.
      });

    return () => {
      active = false;
    };
  }, []);

  const holdPrice = pack.price ?? "$9.99";
  const noSendPrice = formatCents(pack.noSendFeeCents) ?? "$2.00";
  const holdDays = pack.holdDays ?? 5;
  const credits = pack.creditsPerCard ?? pack.tokens ?? "10";

  return (
    <section
      className={`opt-trf ${inline ? 'is-inline' : ''}`}
      data-screen-label="06 TRF Callout"
      id="try-risk-free-details"
      aria-labelledby="try-risk-free-heading"
    >
      <div className="opt-trf-inner">
        <div className="opt-trf-head">
          <div className="opt-trf-eyebrow">
            <span className="souv-rule-gold" />
            <span>TRY RISK-FREE, STEP BY STEP</span>
            <span className="souv-rule-gold" />
          </div>
          <h2 className="souv-h1 opt-trf-heading" id="try-risk-free-heading">
            Create first.{' '}
            <span className="souv-hero-italic text-metallic-rose-gold">
              Decide within {holdDays} days.
            </span>
          </h2>
          <p className="opt-trf-lede">
            Your card is never printed until you choose to send it. The temporary hold simply unlocks your creative credits and review window.
          </p>
        </div>
        <div className="opt-trf-grid">
          <div className="opt-trf-step">
            <div className="opt-trf-num">01</div>
            <div className="opt-trf-title">{holdPrice} hold placed</div>
            <div className="opt-trf-body">Your {holdDays}-day review window begins when payment is authorized, and {credits} creation credits unlock immediately.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">02</div>
            <div className="opt-trf-title">Send a card → full charge</div>
            <div className="opt-trf-body">Choose to send and we capture the full {holdPrice}. Printing and shipping are included.</div>
          </div>
          <div className="opt-trf-step">
            <div className="opt-trf-num">03</div>
            <div className="opt-trf-title">Don&apos;t send → creative fee only</div>
            <div className="opt-trf-body">Choose not to send—or take no action for {holdDays} days—and we charge {noSendPrice} for the credits, then release the rest of the hold.</div>
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
