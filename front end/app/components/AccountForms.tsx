"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DemoUser } from "./DemoUser";
import { useAuth } from "./AuthProvider";
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  updateAuthenticatedUser,
  updatePaymentMethod,
  completeMockCardPackCheckout,
  createLocalIdempotencyKey,
  fetchCardPackPurchase,
  fetchOwnedGifts,
  previewGift,
  redeemGift,
  startGiftCheckout,
  type GiftRecord,
  type PaymentMethod,
  type SavePaymentMethodRequest,
} from "../lib/api";

type AccountUserProps = {
  user?: DemoUser;
};

type RequiredAccountUserProps = {
  user: DemoUser;
};

type GiftDeliveryMethod = "email" | "text";

type PendingGiftPurchase = {
  giftId: string;
  purchaseId: string;
};

const PENDING_GIFT_PURCHASE_KEY = "souvenote_pending_gift_purchase";

function readPendingGiftPurchase(): PendingGiftPurchase | null {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(PENDING_GIFT_PURCHASE_KEY) || "null",
    ) as Partial<PendingGiftPurchase> | null;
    return parsed?.giftId && parsed.purchaseId
      ? { giftId: parsed.giftId, purchaseId: parsed.purchaseId }
      : null;
  } catch {
    return null;
  }
}

function writePendingGiftPurchase(pending: PendingGiftPurchase) {
  try {
    window.sessionStorage.setItem(
      PENDING_GIFT_PURCHASE_KEY,
      JSON.stringify(pending),
    );
  } catch {}
}

function clearPendingGiftPurchase() {
  try {
    window.sessionStorage.removeItem(PENDING_GIFT_PURCHASE_KEY);
  } catch {}
}

type RedeemGiftPageProps = {
  sender?: string;
};

type AccToggleProps = {
  on?: boolean;
  onChange?: (value: boolean) => void;
};

type SettingsTabId =
  | "personal"
  | "security"
  | "notifs"
  | "payments"
  | "prefs"
  | "danger";

type SettingsTab = {
  id: SettingsTabId;
  label: string;
  ico: React.ReactNode;
  danger?: boolean;
};

// AccountForms.tsx - GiftSouvenotePage + RedeemGiftPage + SettingsPage
// Self-contained icons so it can load without AccountPages.jsx.

const AfIco = {
  chev: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  send: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 4 3 11l7 3 3 7 8-17z" />
      <path d="M10 14l4-4" />
    </svg>
  ),
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  ),
  bell: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  card: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  cog: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  ),
  trash: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  ),
};

// Gift-flow icons (stroke, currentColor - match the brand icon style).
const GiftIco = {
  spark: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4z" />
    </svg>
  ),
  mail: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </svg>
  ),
  heart: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20s-6.6-4.2-9-8.2C1.2 8.6 2.7 5 6.2 5c2 0 3.2 1.2 3.8 2.2C10.6 6.2 11.8 5 13.8 5c3.5 0 5 3.6 3.2 6.8C15.6 15.8 12 20 12 20z" />
    </svg>
  ),
  gift: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="9" width="17" height="11.5" rx="2" />
      <path d="M2.5 9h19M12 9v11.5" />
      <path d="M12 9S9.5 3.5 7 4.8 9 9 12 9zM12 9s2.5-5.5 5-4.2S15 9 12 9z" />
    </svg>
  ),
  send: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 4 3 11l7 3 3 7 8-17z" />
      <path d="M10 14l4-4" />
    </svg>
  ),
};

function useAccountDisplayUser(fallback?: DemoUser) {
  const auth = useAuth();
  return (
    auth.displayUser ||
    fallback || {
      name: "Souvenote User",
      email: "user@souvenote.com",
      initials: "SU",
    }
  );
}

function splitDisplayName(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: pieces[0] || "",
    lastName: pieces.slice(1).join(" "),
  };
}

function cleanLast4(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function paymentMethodLabel(method: PaymentMethod) {
  return `${method.brand.toUpperCase()} ending in ${method.last4}`;
}

function paymentMethodExpiry(method: PaymentMethod) {
  return `${String(method.exp_month).padStart(2, "0")} / ${method.exp_year}`;
}

// ============================================================
// GIFT A SOUVENOTE
// The signed-in user buys a $6.99 gift and sends a redemption link.
// The recipient redeems it for a full card pack (10 credits + 1
// physical send) and creates a card for someone *they* love.
// ============================================================
function GiftSouvenotePage({ user }: AccountUserProps) {
  const accountUser = useAccountDisplayUser(user);
  const [via, setVia] = React.useState<GiftDeliveryMethod>("email");
  const [name, setName] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [redemptionPath, setRedemptionPath] = React.useState<string | null>(null);
  const firstName = name.trim().split(" ")[0] || "them";

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") !== "gift") return;
    if (params.get("checkout") === "cancel") {
      setError("Gift checkout was canceled. Nothing was charged.");
      window.history.replaceState({}, "", "/gift");
      return;
    }
    if (params.get("checkout") !== "success") return;
    const pending = readPendingGiftPurchase();
    if (!pending) {
      setError(
        "Payment is being confirmed. Your funded gift will appear on this page shortly.",
      );
      window.history.replaceState({}, "", "/gift");
      return;
    }

    let active = true;
    let timeoutId: number | undefined;
    const checkPurchase = async (attempt: number) => {
      try {
        const result = await fetchCardPackPurchase(pending.purchaseId);
        if (!active) return;
        if (result.purchase.status === "paid") {
          const gifts = await fetchOwnedGifts();
          if (!active) return;
          const gift = gifts.find((candidate) => candidate.id === pending.giftId);
          if (!gift?.redemptionPath) {
            throw new Error(
              "Payment is confirmed, but the private gift link is still being prepared. Refresh this page in a moment.",
            );
          }
          setName(gift.recipientName);
          if (gift.deliveryMethod) setVia(gift.deliveryMethod);
          setRedemptionPath(gift.redemptionPath);
          setSent(true);
          setError(null);
          setSubmitting(false);
          clearPendingGiftPurchase();
          window.history.replaceState({}, "", "/gift");
          return;
        }
        if (
          ["payment_failed", "payment_canceled", "checkout_expired"].includes(
            result.purchase.status,
          )
        ) {
          throw new Error(
            `Gift checkout ended with status ${result.purchase.status}.`,
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
      } catch (unknownError) {
        if (!active) return;
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "Gift payment could not be confirmed.",
        );
        setSubmitting(false);
      }
    };

    setSubmitting(true);
    void checkPurchase(0);
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="bmc-shell" data-screen-label="Gift a Souvenote">
      <div className="bmc-head" style={{ marginBottom: 28 }}>
        <div className="bmc-eyebrow">
          <span>Account</span>
          <span className="dot" />
          Gift a Souvenote
        </div>
        <h1 className="bmc-title">
          Gift a{" "}
          <span className="souv-hero-italic text-metallic-gold">Souvenote</span>
        </h1>
        <p className="bmc-lede">
          Give someone the whole experience. They'll receive a full card pack of
          ten creation credits and a physical card send, enough to make a card
          and add an optional QR-code song for someone <em>they</em> love. Your
          treat.
        </p>
      </div>

      <form
        className="acc-gift-grid"
        onSubmit={async (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          try {
            const started = await startGiftCheckout(
              {
                recipientName: name,
                recipientContact: contact,
                deliveryMethod: via,
                personalMessage: message,
              },
              createLocalIdempotencyKey("gift"),
            );
            writePendingGiftPurchase({
              giftId: started.gift!.id,
              purchaseId: started.purchase.id,
            });
            if (started.checkoutSession.providerMode === "mock") {
              const completed = await completeMockCardPackCheckout(
                started.purchase.id,
                started.checkoutSession.id,
              );
              setRedemptionPath(completed.gift?.redemptionPath || started.gift?.redemptionPath || null);
              setSent(true);
              clearPendingGiftPurchase();
            } else if (started.checkoutSession.checkoutUrl) {
              window.location.assign(started.checkoutSession.checkoutUrl);
            } else {
              throw new Error("Checkout did not return a payment link.");
            }
          } catch (unknownError) {
            setError(unknownError instanceof Error ? unknownError.message : "Could not send this gift.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {/* LEFT - what they get + where to send */}
        <div className="acc-gift-main">
          <div className="acc-panel">
            <div className="acc-panel-title">What they'll unlock</div>
            <div className="acc-gift-includes">
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.spark}</span>
                <div>
                  <div className="acc-gift-inc-h">10 creation credits</div>
                  <div className="acc-gift-inc-p">
                    Enough to design a card and add an optional QR-code song.
                  </div>
                </div>
              </div>
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.mail}</span>
                <div>
                  <div className="acc-gift-inc-h">1 physical card send</div>
                  <div className="acc-gift-inc-p">
                    We print and mail the finished card, postage on us.
                  </div>
                </div>
              </div>
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.heart}</span>
                <div>
                  <div className="acc-gift-inc-h">Theirs to pass on</div>
                  <div className="acc-gift-inc-p">
                    They create it and send it to someone they love.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="acc-panel">
            <div className="acc-panel-title">Where should we send it?</div>
            <div className="acc-field">
              <span className="acc-flabel">Recipient name</span>
              <input
                className="input-dark"
                placeholder="Jordan Avery"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="acc-field">
              <span className="acc-flabel">Send the redemption link by</span>
              <div className="bmc-chip-row">
                <button
                  type="button"
                  className={`bmc-chip ${via === "email" ? "is-active" : ""}`}
                  onClick={() => setVia("email")}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`bmc-chip ${via === "text" ? "is-active" : ""}`}
                  onClick={() => setVia("text")}
                >
                  Text
                </button>
              </div>
            </div>
            <div className="acc-field" style={{ marginBottom: 0 }}>
              <span className="acc-flabel">
                {via === "email" ? "Their email" : "Their mobile number"}
              </span>
              <input
                className="input-dark"
                type={via === "email" ? "email" : "tel"}
                placeholder={
                  via === "email" ? "jordan@example.com" : "(555) 012-3456"
                }
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                required
              />
            </div>
            <div className="acc-field" style={{ marginTop: 18, marginBottom: 0 }}>
              <span className="acc-flabel">Personal note (optional)</span>
              <textarea
                className="input-dark"
                rows={3}
                maxLength={500}
                placeholder="A little something for you..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* RIGHT - sticky gift summary */}
        <aside className="acc-gift-aside">
          <div className="acc-panel acc-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">
                A Souvenote,
                <br />
                on you
              </span>
            </div>
            <div className="acc-gift-price">
              <span className="cur">$</span>6.99<span className="cad">CAD</span>
            </div>
            <div className="acc-gift-name">Gift a Souvenote</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row">
                <span className="k">Includes</span>
                <span className="v">10 credits · print &amp; standard delivery</span>
              </div>
              <div className="acc-summary-row">
                <span className="k">Delivery</span>
                <span className="v">
                  {via === "email"
                    ? "Email link · instant"
                    : "Text link · instant"}
                </span>
              </div>
              <div className="acc-summary-row">
                <span className="k">From</span>
                <span className="v">{accountUser.name}</span>
              </div>
            </div>
            <button
              type="submit"
              className={`bmc-cta acc-gift-cta ${sent ? "is-sent" : ""}`}
              disabled={submitting || sent}
            >
              {sent ? (
                <>Gift on its way ✓</>
              ) : submitting ? (
                <>Preparing gift...</>
              ) : (
                <>{GiftIco.send} Send gift · $6.99</>
              )}
            </button>
            {error && <p className="acc-gift-foot" role="alert">{error}</p>}
            {sent ? (
              <>
                <p className="acc-gift-foot">
                  {firstName}&apos;s gift is funded and its {via} delivery is recorded in mock mode.
                  They&apos;ll receive 10 credits and one prepaid printed-and-delivered card when they redeem it.
                </p>
                {redemptionPath && (
                  <Link className="bmc-text-link" href={redemptionPath}>
                    Open redemption link
                  </Link>
                )}
              </>
            ) : (
              <p className="acc-gift-foot">
                Gift checkout is settled separately so its private claim link
                stays tied to the intended recipient.
              </p>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

// ============================================================
// REDEEM A GIFTED SOUVENOTE  (recipient's landing page)
// Reached from the link in the gift email/text. Sign up to
// redeem, then land on the options page with the pack applied.
// ============================================================
function RedeemGiftPage({ sender = "A friend" }: RedeemGiftPageProps) {
  const searchParams = useSearchParams();
  const auth = useAuth();
  const token = searchParams.get("token")?.trim() || "";
  const [gift, setGift] = React.useState<GiftRecord | null>(null);
  const [loading, setLoading] = React.useState(Boolean(token));
  const [redeeming, setRedeeming] = React.useState(false);
  const [redeemed, setRedeemed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      setError("This gift link is missing its redemption token.");
      return;
    }
    previewGift(token)
      .then((nextGift) => {
        if (!cancelled) {
          setGift(nextGift);
          setRedeemed(nextGift.status === "redeemed");
        }
      })
      .catch((unknownError) => {
        if (!cancelled) setError(unknownError instanceof Error ? unknownError.message : "This gift is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  async function redeem() {
    if (!token) return;
    setRedeeming(true);
    setError(null);
    try {
      const result = await redeemGift(token);
      setGift(result.gift);
      setRedeemed(true);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Could not redeem this gift.");
    } finally {
      setRedeeming(false);
    }
  }

  const normalizedSender = gift?.senderName?.trim() || sender.trim() || "A friend";
  const senderDisplay =
    normalizedSender.toLowerCase() === "a friend"
      ? normalizedSender
      : normalizedSender.split(/\s+/)[0];
  const STEPS = [
    {
      n: 1,
      h: "Create your account",
      p: "Sign up free, and your gift applies the moment you join.",
    },
    {
      n: 2,
      h: "Design your card",
      p: "Use your 10 credits to craft a card and add an optional QR-code song.",
    },
    {
      n: 3,
      h: "We print & mail it",
      p: "Send the finished keepsake to someone you love, on us.",
    },
  ];
  return (
    <div className="bmc-shell acc-redeem" data-screen-label="Redeem a Gift">
      <div className="acc-redeem-hero">
        <div className="bmc-eyebrow" style={{ justifyContent: "center" }}>
          <span>A gift for you</span>
        </div>
        <div className="acc-redeem-token" aria-hidden="true">
          {GiftIco.gift}
        </div>
        <h1 className="bmc-title acc-redeem-title">
          {senderDisplay} gifted you a{" "}
          <span className="souv-hero-italic text-metallic-rose-gold">
            Souvenote
          </span>
        </h1>
        <p className="bmc-lede acc-redeem-lede">
          There's a full card pack waiting in your name: ten creation credits
          and one physical card with printing and standard delivery already paid.
          Make a card, add an optional QR-code song for someone you love, and
          we&apos;ll mail it for you.
        </p>
        {gift?.personalMessage && <p className="acc-redeem-note">“{gift.personalMessage}”</p>}
      </div>

      <div className="acc-steps acc-redeem-steps">
        {STEPS.map((s) => (
          <div className="acc-step" key={s.n}>
            <div className="acc-step-num">{s.n}</div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </div>
        ))}
      </div>

      <div className="acc-redeem-cta">
        {loading ? (
          <span className="bmc-cta acc-redeem-btn">Checking gift...</span>
        ) : redeemed ? (
          <Link className="bmc-cta acc-redeem-btn" href="/create">
            {GiftIco.heart} Start creating
          </Link>
        ) : auth.status === "authenticated" ? (
          <button className="bmc-cta acc-redeem-btn" type="button" onClick={redeem} disabled={redeeming || !gift}>
            {GiftIco.heart} {redeeming ? "Redeeming..." : "Redeem my gift"}
          </button>
        ) : (
          <>
            <Link
              className="bmc-cta acc-redeem-btn"
              href={`/signup?returnTo=${encodeURIComponent(`/gift/redeem?token=${token}`)}`}
            >
              {GiftIco.heart} Sign up to redeem
            </Link>
            <Link
              className="bmc-text-link"
              href={`/login?returnTo=${encodeURIComponent(`/gift/redeem?token=${token}`)}`}
            >
              Already have an account? Log in
            </Link>
          </>
        )}
      </div>
      {error && <p className="acc-redeem-note" role="alert">{error}</p>}
      <p className="acc-redeem-note">
        {redeemed
          ? <>Your account now has <b>10 gift credits</b> and <b>one prepaid physical send</b>.</>
          : <>Redeem after signing in to add <b>10 credits</b> and <b>one prepaid physical send</b> to your account.</>}
      </p>
    </div>
  );
}

// ============================================================
// ACCOUNT SETTINGS
// ============================================================
function AccToggle({ on: initial = false, onChange }: AccToggleProps) {
  const [on, setOn] = React.useState(initial);
  React.useEffect(() => {
    setOn(initial);
  }, [initial]);
  return (
    <button
      type="button"
      className={`acc-switch ${on ? "is-on" : ""}`}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        onChange?.(next);
      }}
    />
  );
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: "personal", label: "Personal info", ico: AfIco.user },
  { id: "security", label: "Login & security", ico: AfIco.lock },
  { id: "notifs", label: "Notifications", ico: AfIco.bell },
  { id: "payments", label: "Payment methods", ico: AfIco.card },
  { id: "prefs", label: "Preferences", ico: AfIco.cog },
  { id: "danger", label: "Danger zone", ico: AfIco.trash, danger: true },
];

function SettingsPersonal({ user }: RequiredAccountUserProps) {
  const auth = useAuth();
  const fallbackName = splitDisplayName(user.name);
  const profile = auth.user;
  const [firstName, setFirstName] = React.useState(
    profile?.first_name || fallbackName.firstName,
  );
  const [lastName, setLastName] = React.useState(
    profile?.last_name || fallbackName.lastName,
  );
  const [phone, setPhone] = React.useState(profile?.phone || "");
  const [birthday, setBirthday] = React.useState(
    profile?.birthday?.slice(0, 10) || "",
  );
  const [country, setCountry] = React.useState("CA");
  const currency = "CAD";
  const [language, setLanguage] = React.useState(
    profile?.language || "English",
  );
  const [marketingOptIn, setMarketingOptIn] = React.useState(
    profile?.marketing_opt_in ?? false,
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const nextFallback = splitDisplayName(user.name);
    setFirstName(profile?.first_name || nextFallback.firstName);
    setLastName(profile?.last_name || nextFallback.lastName);
    setPhone(profile?.phone || "");
    setBirthday(profile?.birthday?.slice(0, 10) || "");
    setCountry("CA");
    setLanguage(profile?.language || "English");
    setMarketingOptIn(profile?.marketing_opt_in ?? false);
  }, [profile, user.name]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateAuthenticatedUser({
        firstName,
        lastName,
        phone,
        birthday,
        country,
        currency,
        language,
        marketingOptIn,
      });
      await auth.refreshUser();
      setMessage("Profile saved.");
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Personal info</h2>
      <p className="acc-set-sub">
        This is how your account, cards, receipts, and reminders are
        personalized.
      </p>
      <div className="acc-row" style={{ paddingTop: 0 }}>
        <div
          className="acc-row-info"
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          <div
            className="acc-avatar"
            style={{ width: 60, height: 60, fontSize: 22 }}
          >
            {user.initials}
          </div>
          <div>
            <div className="acc-row-label">Profile photo</div>
            <div className="acc-row-desc">
              Photo upload is saved for the account UI. Card reference photos
              are managed inside each card flow.
            </div>
          </div>
        </div>
        <button type="button" className="bmc-cta-secondary">
          Upload
        </button>
      </div>
      <div style={{ paddingTop: 22 }}>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">First name</span>
            <input
              className="input-dark"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Last name</span>
            <input
              className="input-dark"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Login email</span>
          <input
            className="input-dark"
            value={profile?.email || user.email}
            readOnly
          />
        </div>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">Phone</span>
            <input
              className="input-dark"
              placeholder="(555) 012-3456"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Birthday</span>
            <input
              className="input-dark"
              type="date"
              value={birthday}
              onChange={(event) => setBirthday(event.target.value)}
            />
          </div>
        </div>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">Country</span>
            <select
              className="input-dark"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              <option value="CA">Canada</option>
            </select>
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Currency</span>
            <input
              className="input-dark"
              value={currency}
              readOnly
              aria-label="Billing currency"
            />
          </div>
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Language</span>
          <select
            className="input-dark"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="English">English</option>
            <option value="Francais">Francais</option>
          </select>
        </div>
        <div className="acc-row">
          <div className="acc-row-info">
            <div className="acc-row-label">Seasonal ideas and reminders</div>
            <div className="acc-row-desc">
              Occasional emails for gifts, birthdays, and new card styles.
            </div>
          </div>
          <AccToggle on={marketingOptIn} onChange={setMarketingOptIn} />
        </div>
        {message && <p className="acc-save-state is-success">{message}</p>}
        {error && <p className="acc-save-state is-error">{error}</p>}
        <button
          type="button"
          className="bmc-cta"
          style={{ marginTop: 4 }}
          onClick={saveProfile}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function SettingsSecurity() {
  const auth = useAuth();

  function signOutCurrentSession() {
    const redirectingToCognito = auth.logout({ hostedUi: true });
    if (!redirectingToCognito) {
      window.location.assign("/");
    }
  }

  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Login & security</h2>
      <p className="acc-set-sub">
        Cognito owns passwords, recovery, social sign-in, and multifactor
        authentication.
      </p>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Password</div>
          <div className="acc-row-desc">
            Use the verified Cognito recovery flow to choose a new password.
          </div>
        </div>
        <Link href="/forgot" className="bmc-cta-secondary">
          Reset password
        </Link>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Two-factor authentication</div>
          <div className="acc-row-desc">
            This control becomes available only after MFA is configured in the
            Cognito user pool.
          </div>
        </div>
        <span className="acc-pill is-pending">Provider setup</span>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Current session</div>
          <div className="acc-row-desc">
            Sign out this browser. Global session revocation is not exposed
            until a reviewed Cognito workflow is available.
          </div>
        </div>
        <button
          type="button"
          className="bmc-cta-secondary"
          onClick={signOutCurrentSession}
        >
          Sign out this device
        </button>
      </div>
    </div>
  );
}

function SettingsNotifs() {
  const auth = useAuth();
  const rows = [
    {
      label: "Order updates",
      desc: "Essential paid-order, shipping, and delivery messages are sent from the transactional outbox.",
      status: "Always on",
      ready: true,
    },
    {
      label: "Card reminders",
      desc: "Reminder scheduling and preference storage are not enabled in the MVP.",
      status: "Not enabled",
      ready: false,
    },
    {
      label: "New features",
      desc: "A separate product-announcement preference has not been approved.",
      status: "Not enabled",
      ready: false,
    },
    {
      label: "Promotions & offers",
      desc: "Use Seasonal ideas and reminders in Personal details to change the stored marketing preference.",
      status: auth.user?.marketing_opt_in ? "Enabled" : "Off",
      ready: Boolean(auth.user?.marketing_opt_in),
    },
  ];

  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Notifications</h2>
      <p className="acc-set-sub">
        Only preferences with durable backend behavior are interactive.
      </p>
      {rows.map((row) => (
        <div className="acc-row" key={row.label}>
          <div className="acc-row-info">
            <div className="acc-row-label">{row.label}</div>
            <div className="acc-row-desc">{row.desc}</div>
          </div>
          <span className={`acc-pill ${row.ready ? "is-done" : "is-pending"}`}>
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function SettingsPayments() {
  const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [brand, setBrand] = React.useState("Visa");
  const [last4, setLast4] = React.useState("");
  const [expMonth, setExpMonth] = React.useState("01");
  const [expYear, setExpYear] = React.useState(
    String(new Date().getFullYear() + 1),
  );
  const [billingName, setBillingName] = React.useState("");
  const [billingPostalCode, setBillingPostalCode] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setBrand("Visa");
    setLast4("");
    setExpMonth("01");
    setExpYear(String(new Date().getFullYear() + 1));
    setBillingName("");
    setBillingPostalCode("");
    setIsDefault(methods.length === 0);
  }, [methods.length]);

  const loadMethods = React.useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const next = await fetchPaymentMethods();
      setMethods(next);
      setStatus("ready");
    } catch (unknownError) {
      setStatus("error");
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Payment methods could not be loaded.",
      );
    }
  }, []);

  React.useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  function editMethod(method: PaymentMethod) {
    setEditingId(method.id);
    setBrand(method.brand);
    setLast4(method.last4);
    setExpMonth(String(method.exp_month).padStart(2, "0"));
    setExpYear(String(method.exp_year));
    setBillingName(method.billing_name || "");
    setBillingPostalCode(method.billing_postal_code || "");
    setIsDefault(method.is_default);
    setMessage(null);
    setError(null);
  }

  async function saveMethod() {
    const cleanDigits = cleanLast4(last4);
    if (cleanDigits.length !== 4) {
      setError("Enter the last four digits from the card.");
      return;
    }

    const payload: SavePaymentMethodRequest = {
      brand,
      last4: cleanDigits,
      expMonth: Number(expMonth),
      expYear: Number(expYear),
      billingName,
      billingPostalCode,
      isDefault,
    };

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (editingId) {
        await updatePaymentMethod(editingId, payload);
        setMessage("Payment method updated.");
      } else {
        await createPaymentMethod(payload);
        setMessage("Payment method saved.");
      }
      await loadMethods();
      resetForm();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Payment method could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeMethod(method: PaymentMethod) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await deletePaymentMethod(method.id);
      await loadMethods();
      setMessage(`${paymentMethodLabel(method)} removed.`);
      if (editingId === method.id) resetForm();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Payment method could not be removed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Payment methods</h2>
      <p className="acc-set-sub">
        Saved payment methods use vault metadata only. Full card numbers are
        handled by the payment provider at checkout.
      </p>

      {status === "loading" && (
        <p className="acc-save-state">Loading payment methods...</p>
      )}
      {status === "error" && (
        <p className="acc-save-state is-error">
          {error || "Payment methods could not be loaded."}
        </p>
      )}

      {status === "ready" && methods.length === 0 && (
        <div className="acc-pay-empty">
          <div className="acc-pay-empty-title">
            No saved payment methods yet
          </div>
          <p>
            Add a card summary now, or save a vaulted payment method after
            checkout once Stripe is connected.
          </p>
        </div>
      )}

      {methods.map((method) => (
        <div className="acc-pay" key={method.id}>
          <div className="acc-pay-brand">
            {method.brand.slice(0, 4).toUpperCase()}
          </div>
          <div className="acc-pay-info">
            <div className="acc-pay-num">Card ending in {method.last4}</div>
            <div className="acc-pay-exp">
              Expires {paymentMethodExpiry(method)}
              {method.is_default ? " - Default" : ""}
            </div>
            {method.billing_name && (
              <div className="acc-pay-exp">
                Billing name: {method.billing_name}
              </div>
            )}
          </div>
          <div className="acc-pay-actions">
            <button
              type="button"
              className="bmc-cta-secondary"
              onClick={() => editMethod(method)}
            >
              Edit
            </button>
            <button
              type="button"
              className="acc-pay-remove"
              onClick={() => void removeMethod(method)}
              disabled={saving}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="acc-pay-form">
        <div className="acc-panel-title">
          {editingId ? "Edit payment method" : "Add payment method"}
        </div>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">Brand</span>
            <select
              className="input-dark"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            >
              <option>Visa</option>
              <option>Mastercard</option>
              <option>Amex</option>
              <option>Discover</option>
              <option>Other</option>
            </select>
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Last four digits</span>
            <input
              className="input-dark"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(event) => setLast4(cleanLast4(event.target.value))}
              placeholder="1234"
            />
          </div>
        </div>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">Expiry month</span>
            <select
              className="input-dark"
              value={expMonth}
              onChange={(event) => setExpMonth(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) =>
                String(index + 1).padStart(2, "0"),
              ).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Expiry year</span>
            <select
              className="input-dark"
              value={expYear}
              onChange={(event) => setExpYear(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) =>
                String(new Date().getFullYear() + index),
              ).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="acc-field-row">
          <div className="acc-field">
            <span className="acc-flabel">Billing name</span>
            <input
              className="input-dark"
              value={billingName}
              onChange={(event) => setBillingName(event.target.value)}
            />
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Postal / ZIP</span>
            <input
              className="input-dark"
              value={billingPostalCode}
              onChange={(event) => setBillingPostalCode(event.target.value)}
            />
          </div>
        </div>
        <div className="acc-row">
          <div className="acc-row-info">
            <div className="acc-row-label">Default payment method</div>
            <div className="acc-row-desc">
              Use this first for card packs, credits, and shipped cards.
            </div>
          </div>
          <AccToggle on={isDefault} onChange={setIsDefault} />
        </div>
        {message && <p className="acc-save-state is-success">{message}</p>}
        {error && <p className="acc-save-state is-error">{error}</p>}
        <div className="acc-pay-form-actions">
          <button
            type="button"
            className="bmc-cta"
            onClick={saveMethod}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save payment method"
                : "Add payment method"}
          </button>
          {editingId && (
            <button
              type="button"
              className="bmc-cta-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPrefs() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Preferences</h2>
      <p className="acc-set-sub">
        Current launch behavior and account preferences.
      </p>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Currency</div>
          <div className="acc-row-desc">
            Souvenote launches in Canada. All prices are shown and billed in
            Canadian dollars.
          </div>
        </div>
        <span className="acc-pill is-done">CAD</span>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Language</div>
          <div className="acc-row-desc">
            The stored profile language is managed from Personal details.
          </div>
        </div>
        <span className="acc-pill is-done">Profile backed</span>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Save my spot automatically</div>
          <div className="acc-row-desc">
            Authenticated drafts are always saved by the backend in the current
            MVP.
          </div>
        </div>
        <span className="acc-pill is-done">Always on</span>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Show prices with tax</div>
          <div className="acc-row-desc">
            Tax display follows Stripe Checkout; a separate estimate preference
            is not implemented.
          </div>
        </div>
        <span className="acc-pill is-pending">Checkout managed</span>
      </div>
    </div>
  );
}

function SettingsDanger() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Danger zone</h2>
      <p className="acc-set-sub">
        Destructive account actions stay disabled until reviewed, audited
        support workflows exist.
      </p>
      <div className="acc-danger">
        <div className="acc-row" style={{ paddingTop: 0 }}>
          <div className="acc-row-info">
            <div className="acc-row-label">Deactivate account</div>
            <div className="acc-row-desc">
              No deactivation mutation is exposed by the backend.
            </div>
          </div>
          <button type="button" className="acc-btn-danger" disabled>
            Unavailable
          </button>
        </div>
        <div className="acc-row">
          <div className="acc-row-info">
            <div className="acc-row-label">Delete account</div>
            <div className="acc-row-desc">
              Deletion requires an approved identity, retention, and provider
              cleanup workflow.
            </div>
          </div>
          <button type="button" className="acc-btn-danger" disabled>
            Unavailable
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ user }: AccountUserProps) {
  const accountUser = useAccountDisplayUser(user);
  const [tab, setTab] = React.useState<SettingsTabId>("personal");
  return (
    <div className="bmc-shell" data-screen-label="Account Settings">
      <div className="bmc-head" style={{ marginBottom: 28 }}>
        <div className="bmc-eyebrow">
          <span>Account</span>
          <span className="dot" />
          Settings
        </div>
        <h1 className="bmc-title">
          Account{" "}
          <span className="souv-hero-italic text-metallic-silver">
            settings
          </span>
        </h1>
        <p className="bmc-lede">
          Manage your details, security, notifications and how you pay.
        </p>
      </div>

      <div className="acc-settings">
        <nav className="acc-tabs">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              className={`acc-tab ${tab === t.id ? "is-active" : ""} ${t.danger ? "is-danger" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.ico}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="acc-panel">
          {tab === "personal" && <SettingsPersonal user={accountUser} />}
          {tab === "security" && <SettingsSecurity />}
          {tab === "notifs" && <SettingsNotifs />}
          {tab === "payments" && <SettingsPayments />}
          {tab === "prefs" && <SettingsPrefs />}
          {tab === "danger" && <SettingsDanger />}
        </div>
      </div>
    </div>
  );
}

export { GiftSouvenotePage, RedeemGiftPage, SettingsPage };
