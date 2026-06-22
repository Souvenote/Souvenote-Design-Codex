"use client";

import * as React from "react";
import Link from "next/link";
import type { DemoUser } from "./DemoUser";
import { getTotalDemoCredits, useDemoBalance } from "./DemoBalance";
import { useCreditBalance } from "../lib/creditBalance";
import { fetchCardDraftAssets, fetchUserCardDrafts } from "../lib/api";
import { useBlankSouvenoteGiftCount } from "./GiftAddon";

type AccountPageProps = {
  user: DemoUser;
};

type ProfileStat = {
  num: string;
  label: string;
  gold?: boolean;
};

type ProfileActivity = {
  ico: React.ReactNode;
  title: React.ReactNode;
  time: string;
};

type ProfileLink = {
  ico: React.ReactNode;
  label: string;
  href: string;
};

type ReferStep = {
  n: number;
  h: string;
  p: string;
};

type ReferShare = {
  label: "Email" | "Instagram" | "Facebook";
  path: string;
};

type ReferStatus = "done" | "pending";

type ReferItem = {
  name: string;
  initials: string;
  status: ReferStatus;
  earn: string;
};

const AccIco = {
  card: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>,
  note: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17V5l11-2v12" /><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="15.5" r="2.5" fill="currentColor" stroke="none" /></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4 3 11l7 3 3 7 8-17z" /><path d="M10 14l4-4" /></svg>,
  gift: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 9V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1M12 6v15M12 6S10.5 3 8.5 3 5.5 5 7 6h5M12 6s1.5-3 3.5-3 2.5 2 1 3h-5" /></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a5.5 5.5 0 0 0-2.5-4.6" /></svg>,
  chev: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>,
};

const PROFILE_ACTIVITY: ProfileActivity[] = [];

const PROFILE_LINKS: ProfileLink[] = [
  { ico: AccIco.card, label: "Saved Cards & Songs", href: "/create/my-cards-and-songs" },
  { ico: AccIco.send, label: "Gift a Souvenote", href: "/gift" },
  { ico: AccIco.gift, label: "Refer a Friend", href: "/refer" },
];

function ProfilePage({ user }: AccountPageProps) {
  const demoBalance = useDemoBalance();
  const creditBalance = useCreditBalance({ fallbackBalance: getTotalDemoCredits(demoBalance) });
  const blankGiftCount = useBlankSouvenoteGiftCount();
  const [cardDraftCount, setCardDraftCount] = React.useState(0);
  const [draftCountStatus, setDraftCountStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let active = true;

    setDraftCountStatus("loading");
    fetchUserCardDrafts()
      .then(async (drafts) => {
        const assetGroups = await Promise.all(drafts.map((draft) => fetchCardDraftAssets(draft.id)));
        const completedCount = assetGroups.filter((assets) => (
          assets.some((asset) => String(asset.assetType || asset.asset_type || "").toLowerCase() === "image")
        )).length;
        if (!active) return;
        setCardDraftCount(completedCount);
        setDraftCountStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCardDraftCount(0);
        setDraftCountStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const profileStats: ProfileStat[] = [
    { num: creditBalance.status === "loading" ? "..." : String(creditBalance.balance), label: creditBalance.status === "error" ? "Credits offline" : "Credits", gold: true },
    { num: draftCountStatus === "loading" ? "..." : String(cardDraftCount), label: draftCountStatus === "error" ? "Cards offline" : "Cards made" },
    { num: "0", label: "Songs made" },
    { num: String(demoBalance.cardBank), label: "Cards in bank" },
    ...(blankGiftCount > 0 ? [{ num: String(blankGiftCount), label: "Blank gifts", gold: true }] : []),
  ];
  const profileActivity: ProfileActivity[] = [
    ...(blankGiftCount > 0 ? [{
      ico: AccIco.gift,
      title: <>Bought <b>{blankGiftCount} blank Souvenote {blankGiftCount === 1 ? "gift" : "gifts"}</b></>,
      time: "Ready now",
    }] : []),
    ...PROFILE_ACTIVITY,
  ];

  return (
    <div className="bmc-shell" data-screen-label="Profile">
      <div className="bmc-head" style={{ marginBottom: 28 }}>
        <div className="bmc-eyebrow"><span>Account</span><span className="dot" />Profile</div>
        <h1 className="bmc-title">Your <span className="souv-hero-italic text-metallic-gold">profile</span></h1>
        <p className="bmc-lede">Everything about your account at a glance: credits, what you&apos;ve made, and quick ways back into the things you do most.</p>
      </div>

      <div className="acc-hero">
        <div className="acc-avatar">{user.initials}</div>
        <div className="acc-hero-info">
          <h2 className="acc-hero-name">{user.name}</h2>
          <div className="acc-hero-meta">
            <span>{user.email}</span>
            <span className="dot" />
            <span>Member since 2025</span>
            <span className="acc-hero-badge">{"\u2605 Founding member"}</span>
          </div>
        </div>
        <div className="acc-hero-actions">
          <Link className="bmc-cta-secondary" href="/account/settings">{AccIco.edit} Edit profile</Link>
        </div>
      </div>

      <div className="acc-stats">
        {profileStats.map((stat) => (
          <div className="acc-stat" key={stat.label}>
            <div className={`acc-stat-num ${stat.gold ? "is-gold" : ""}`}>{stat.num}</div>
            <div className="acc-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {blankGiftCount > 0 && (
        <div className="acc-panel acc-profile-gift-card">
          <div className="acc-profile-gift-copy">
            <div className="acc-panel-title">Blank Souvenote Gift</div>
            <h2 className="acc-profile-gift-title">
              {blankGiftCount} blank {blankGiftCount === 1 ? "Souvenote" : "Souvenotes"} ready to give
            </h2>
            <p>
              This blank gift also appears in Saved Cards &amp; Songs. When you send a card, we&apos;ll remind you to choose
              who should receive it or keep it saved for later.
            </p>
          </div>
          <div className="acc-profile-gift-summary">
            <div className="acc-gift-token" aria-hidden="true">
              <span className="acc-gift-token-label">A Souvenote,<br />on you</span>
            </div>
            <div className="acc-gift-name">Blank Souvenote Gift</div>
            <div className="acc-gift-meta">
              <div className="acc-summary-row"><span className="k">Available</span><span className="v">{blankGiftCount} {blankGiftCount === 1 ? "gift" : "gifts"}</span></div>
              <div className="acc-summary-row"><span className="k">Visible in</span><span className="v">Saved Cards &amp; Songs</span></div>
              <div className="acc-summary-row"><span className="k">Reminder</span><span className="v">Delivery step</span></div>
            </div>
            <Link className="bmc-cta acc-profile-gift-cta" href="/create/my-cards-and-songs">View in Saved Cards &amp; Songs</Link>
          </div>
        </div>
      )}

      <div className="acc-grid-2">
        <div className="acc-panel">
          <div className="acc-panel-title">Recent activity</div>
          <div className="acc-activity">
            {profileActivity.length ? profileActivity.map((activity, index) => (
              <div className="acc-activity-row" key={index}>
                <div className="acc-activity-ico">{activity.ico}</div>
                <div className="acc-activity-main"><div className="acc-activity-title">{activity.title}</div></div>
                <div className="acc-activity-time">{activity.time}</div>
              </div>
            )) : (
              <div className="acc-activity-row">
                <div className="acc-activity-ico">{AccIco.card}</div>
                <div className="acc-activity-main"><div className="acc-activity-title">No activity yet. Create your first card to get started.</div></div>
                <div className="acc-activity-time">New</div>
              </div>
            )}
          </div>
        </div>
        <div className="acc-panel">
          <div className="acc-panel-title">Quick links</div>
          <div className="acc-quicklinks">
            {PROFILE_LINKS.map((link) => (
              <Link className="acc-quicklink" href={link.href} key={link.label}>
                <span className="acc-quicklink-ico">{link.ico}</span>
                <span>{link.label}</span>
                <span className="chev">{AccIco.chev}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const REFER_STEPS: ReferStep[] = [
  { n: 1, h: "Share your link", p: "Send your personal invite link to friends by text, email or social." },
  { n: 2, h: "They make a card", p: "Your friend signs up and creates their first Souvenote card." },
  { n: 3, h: "You both earn", p: "They get 10 credits to start, and you get 10 credits dropped in your account." },
];

const REFER_LIST: ReferItem[] = [];

const REFER_SHARE: ReferShare[] = [
  { label: "Email", path: "M3 5h18v14H3z M3 6l9 7 9-7" },
  { label: "Instagram", path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm4.25 3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.75-.88a1.13 1.13 0 1 1-2.25 0 1.13 1.13 0 0 1 2.25 0z" },
  { label: "Facebook", path: "M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.5V9.7c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5H15c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" },
];

function ReferPage({ user }: AccountPageProps) {
  const [copied, setCopied] = React.useState(false);
  const link = "souvenote.com/r/CAMERON10";

  function copy() {
    navigator.clipboard?.writeText("https://" + link).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="bmc-shell" data-screen-label="Refer a Friend">
      <div className="bmc-head" style={{ marginBottom: 36, maxWidth: "100%", textAlign: "center" }}>
        <div className="bmc-eyebrow" style={{ justifyContent: "center" }}><span>Account</span><span className="dot" />Refer a Friend</div>
      </div>

      <div className="acc-refer-hero">
        <div className="acc-refer-reward"><span className="amt is-shimmer">Give 10</span><span className="x">{"\u00b7"}</span><span className="amt">Get 10</span></div>
        <h1 className="bmc-title" style={{ textAlign: "center", margin: "6px 0 12px" }}>
          Share the <span className="souv-hero-italic text-metallic-rose-gold">love</span>
        </h1>
        <p className="bmc-lede" style={{ margin: "0 auto" }}>
          Invite a friend to Souvenote. They get 10 credits to start, and you earn 10 credits the moment they send a card.
        </p>
      </div>

      <div className="acc-steps">
        {REFER_STEPS.map((step) => (
          <div className="acc-step" key={step.n}>
            <div className="acc-step-num">{step.n}</div>
            <h3>{step.h}</h3>
            <p>{step.p}</p>
          </div>
        ))}
      </div>

      <div className="acc-panel acc-referlink-wrap" style={{ marginBottom: 22 }}>
        <div className="acc-flabel" style={{ textAlign: "center", marginBottom: 12 }}>Your personal invite link</div>
        <div className="acc-referlink">
          <input className="input-dark" readOnly value={link} onFocus={(event) => event.target.select()} />
          <button type="button" className="btn-matte acc-copybtn" onClick={copy}>{copied ? "Copied \u2713" : "Copy link"}</button>
        </div>
        <div className="acc-share-row">
          <span className="lbl">Or share via</span>
          {REFER_SHARE.map((share) => (
            <button type="button" className="acc-share-btn" key={share.label} aria-label={share.label} title={share.label}>
              <svg viewBox="0 0 24 24" fill={share.label === "Email" ? "none" : "currentColor"} stroke={share.label === "Email" ? "currentColor" : "none"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={share.path} /></svg>
            </button>
          ))}
        </div>
      </div>

      <div className="acc-grid-2">
        <div className="acc-panel">
          <div className="acc-panel-title">Your referrals</div>
          {REFER_LIST.length > 0 ? (
            <div className="acc-reftable">
              <div className="acc-reftable-row head"><span>Friend</span><span>Status</span><span>Earned</span></div>
              {REFER_LIST.map((referral) => (
                <div className="acc-reftable-row" key={referral.name}>
                  <div className="acc-reftable-name">
                    <div className="acc-avatar">{referral.initials}</div>
                    <b>{referral.name}</b>
                  </div>
                  <span className={`acc-pill ${referral.status === "done" ? "is-done" : "is-pending"}`}>{referral.status === "done" ? "Joined" : "Invited"}</span>
                  <div className="acc-reftable-earn">{referral.earn}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="acc-refer-empty">
              <p>{"No referrals yet \u2014 share your link above and your friends will show up here as they join."}</p>
            </div>
          )}
        </div>
        <div className="acc-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div className="acc-panel-title" style={{ borderBottom: 0, marginBottom: 6 }}>Credits earned</div>
          <div className="acc-stat-num is-gold" style={{ fontSize: "3.2rem" }}>0</div>
          <p style={{ fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: "0.95rem", margin: "12px 0 0" }}>
            You haven&apos;t earned referral credits yet. Credits are applied automatically to your next card.
          </p>
        </div>
      </div>
    </div>
  );
}

export { ProfilePage, ReferPage, AccIco };
