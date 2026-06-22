"use client";

import * as React from "react";
import Link from "next/link";
import { useCreditBalance } from "../lib/creditBalance";
import type { CreditBalanceStatus } from "../lib/creditBalance";
import type { DemoCredits, DemoUser } from "./DemoUser";

type NavLink = {
  label: string;
  stackedLabel?: [string, string];
  sub: string;
  href: string;
};

type CurrencyCode = "CAD" | "USD";

type CurrencyOption = {
  code: CurrencyCode;
  flag: string;
};

type CreditsTickerProps = {
  credits?: number;
  cardBank?: number;
  status?: CreditBalanceStatus;
};

type CurrencySelectProps = {
  currency: CurrencyCode;
  setCurrency: React.Dispatch<React.SetStateAction<CurrencyCode>>;
  open: boolean;
  setOpen: (open: boolean) => void;
};

type NavRightProps = {
  loggedIn: boolean;
  user: DemoUser;
  creditBalance: number;
  creditStatus: CreditBalanceStatus;
  cardBank: number;
  cartCount: number;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currency: CurrencyCode;
  setCurrency: React.Dispatch<React.SetStateAction<CurrencyCode>>;
  currencyOpen: boolean;
  setCurrencyOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type NavbarProps = {
  loggedIn?: boolean;
  user?: DemoUser;
  credits?: DemoCredits;
  cardBank?: number;
  cartCount?: number;
  followUserOnScroll?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { label: "Personalize a Template", stackedLabel: ["Personalize", "a Template"], sub: "Curated designs, ready to make yours.", href: "/create/personalize-a-template" },
  { label: "Build My Card", stackedLabel: ["Build", "My Card"], sub: "Start from scratch: photo, moment, optional QR song.", href: "/create/build-my-card" },
  { label: "Saved Cards & Songs", stackedLabel: ["Saved", "Cards & Songs"], sub: "Saved cards, drafts, songs, and send-ready creations.", href: "/create/my-cards-and-songs" },
  { label: "Pricing", sub: "Card packs, credits, and what shipping covers.", href: "/pricing" },
];

const CURRENCIES: CurrencyOption[] = [
  { code: "CAD", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  { code: "USD", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
];

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h2.4l2.3 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.96-1.6L21 9H6" />
      <circle cx="10" cy="21" r="1.4" />
      <circle cx="17" cy="21" r="1.4" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CreditsTicker({ credits = 0, cardBank = 0, status = "idle" }: CreditsTickerProps) {
  const loading = status === "loading";
  const error = status === "error";
  const creditLabel = loading ? "Loading" : error ? "Offline" : "Credits";
  const creditValue = loading ? "..." : credits;
  const linkTitle = error
    ? "Credit balance unavailable. Showing local mock balance."
    : "View Saved Cards & Songs";

  return (
    <div className="souv-balance-wrap">
      <Link
        className={`souv-credits souv-credits-stack souv-credits-link ${loading ? "is-loading" : ""} ${error ? "is-error" : ""}`}
        href="/create/my-cards-and-songs"
        title={linkTitle}
        aria-label={linkTitle}
      >
        <span className="souv-credit"><em>{creditLabel}</em><b>{creditValue}</b></span>
        <span className="souv-credit souv-credit-bank">
          <em>Cards</em><b>{cardBank}</b>
        </span>
      </Link>
      <div className="souv-cardbank-pop">
        <div className="souv-cardbank-pop-card">
          <div className="souv-cardbank-pop-arrow" />
          <div className="souv-rule-gold" />
          <Link className="souv-cardbank-sendlink" href="/create/my-cards-and-songs">Saved Cards &amp; Songs</Link>
        </div>
      </div>
    </div>
  );
}

function CurrencySelect({ currency, setCurrency, open, setOpen }: CurrencySelectProps) {
  const active = CURRENCIES.find((option) => option.code === currency) || CURRENCIES[0];

  return (
    <div className="souv-iconbtn-wrap">
      <button
        className={`souv-currency ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Change currency"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="souv-currency-code">{active.code}</span>
        <svg className="souv-currency-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div className="souv-overlay" onClick={() => setOpen(false)} />
          <div className="souv-popmenu souv-popmenu-currency" role="listbox">
            {CURRENCIES.map((option) => (
              <div
                key={option.code}
                role="option"
                aria-selected={option.code === currency}
                className={`souv-popmenu-item souv-currency-option ${option.code === currency ? "is-active" : ""}`}
                onClick={() => {
                  setCurrency(option.code);
                  setOpen(false);
                }}
              >
                <span className="souv-currency-flag" aria-hidden="true">{option.flag}</span>
                <span>{option.code}</span>
                {option.code === currency && (
                  <svg className="souv-currency-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NavRight({
  loggedIn,
  user,
  creditBalance,
  creditStatus,
  cardBank,
  cartCount,
  profileOpen,
  setProfileOpen,
  menuOpen,
  setMenuOpen,
  currency,
  setCurrency,
  currencyOpen,
  setCurrencyOpen,
}: NavRightProps) {
  if (!loggedIn) {
    return (
      <div className="souv-nav-right">
        <Link className="souv-nav-login" href="/login">Log In</Link>
        <Link className="souv-cta-flow" href="/signup"><span>Start for Free</span></Link>
      </div>
    );
  }

  return (
    <div className="souv-nav-right">
      <CreditsTicker credits={creditBalance} cardBank={cardBank} status={creditStatus} />
      <span className="souv-nav-sep" />

      <CurrencySelect
        currency={currency}
        setCurrency={setCurrency}
        open={currencyOpen}
        setOpen={(value) => {
          setCurrencyOpen(value);
          if (value) {
            setProfileOpen(false);
            setMenuOpen(false);
          }
        }}
      />
      <span className="souv-nav-sep" />

      <div className="souv-iconbtn-wrap">
        <button
          className={`souv-iconbtn ${profileOpen ? "is-open" : ""}`}
          onClick={() => {
            setProfileOpen(!profileOpen);
            setMenuOpen(false);
            setCurrencyOpen(false);
          }}
          aria-label="Account"
        >
          <IconUser />
        </button>
        {profileOpen && (
          <>
            <div className="souv-overlay" onClick={() => setProfileOpen(false)} />
            <div className="souv-popmenu souv-popmenu-wide">
              <div className="souv-popmenu-userhead">
                <div className="souv-popmenu-avatar">{user.initials}</div>
                <div>
                  <div className="souv-popmenu-name">{user.name}</div>
                  <div className="souv-popmenu-email">{user.email}</div>
                </div>
              </div>
              <div className="souv-popmenu-sep" />
              <Link href="/account/profile" className="souv-popmenu-item">Profile</Link>
              <Link href="/create/my-cards-and-songs" className="souv-popmenu-item">Saved Cards &amp; Songs</Link>
              <div className="souv-popmenu-sep" />
              <Link href="/pricing" className="souv-popmenu-item">Top Up Cards/Credits</Link>
              <Link href="/gift" className="souv-popmenu-item souv-popmenu-item-send">Gift a Souvenote</Link>
              <Link href="/refer" className="souv-popmenu-item">Refer a Friend</Link>
              <Link href="/account/settings" className="souv-popmenu-item">Account Settings</Link>
              <div className="souv-popmenu-sep" />
              <Link href="/" className="souv-popmenu-logout">Sign Out</Link>
            </div>
          </>
        )}
      </div>

      <div className="souv-iconbtn-wrap">
        <Link className="souv-iconbtn" aria-label="Cart" href="/cart">
          <IconCart />
          {cartCount > 0 && <span className="souv-cart-badge">{cartCount}</span>}
        </Link>
      </div>

      <div className="souv-iconbtn-wrap">
        <button
          className={`souv-iconbtn ${menuOpen ? "is-open" : ""}`}
          onClick={() => {
            setMenuOpen(!menuOpen);
            setProfileOpen(false);
            setCurrencyOpen(false);
          }}
          aria-label="Menu"
        >
          <IconMenu />
        </button>
        {menuOpen && (
          <>
            <div className="souv-overlay" onClick={() => setMenuOpen(false)} />
            <div className="souv-popmenu">
              <Link href="/faq" className="souv-popmenu-item">FAQ</Link>
              <Link href="/contact" className="souv-popmenu-item">Contact Us</Link>
              <div className="souv-popmenu-sep" />
              <Link href="/legal/cookie-policy" className="souv-popmenu-item">Cookie Policy</Link>
              <Link href="/legal/refund-policy" className="souv-popmenu-item">Refund Policy</Link>
              <Link href="/legal/terms-of-service" className="souv-popmenu-item">Terms of Service</Link>
              <Link href="/legal/privacy-policy" className="souv-popmenu-item">Privacy Policy</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Navbar({
  loggedIn = false,
  user = { name: "Amelia Hart", email: "amelia@souvenote.com", initials: "AH" },
  credits = { images: 0, songs: 0 },
  cardBank = 1,
  cartCount = 0,
  followUserOnScroll = false,
}: NavbarProps) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>("CAD");
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const logoSrc = loggedIn ? "/assets/LogoMark.png" : "/assets/WordmarkLobster.png";
  const localCreditBalance = (credits.images ?? 0) + (credits.songs ?? 0);
  const creditBalance = useCreditBalance({
    enabled: loggedIn,
    fallbackBalance: localCreditBalance,
  });

  return (
    <header className={`souv-nav ${followUserOnScroll ? "is-follow-user-on-scroll" : ""}`}>
      <Link href="/" className={`souv-nav-logo ${loggedIn ? "is-mark" : "is-wordmark"}`} aria-label="Souvenote home">
        <img src={logoSrc} alt="Souvenote" />
      </Link>

      <nav className="souv-nav-links">
        {NAV_LINKS.map((link, index) => (
          <React.Fragment key={link.label}>
            {index > 0 && <span className="souv-nav-dot">{"\u00b7"}</span>}
            <div
              className="souv-nav-link-wrap"
              onMouseEnter={() => setHovered(link.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <Link href={link.href} className={`souv-nav-link ${hovered === link.label ? "is-hover" : ""}`} aria-label={link.label}>
                {link.stackedLabel ? (
                  <span className="souv-nav-label-stack">
                    <span>{link.stackedLabel[0]}</span>
                    <span>{link.stackedLabel[1]}</span>
                  </span>
                ) : (
                  link.label
                )}
                <span className="souv-nav-underline" />
              </Link>
              {hovered === link.label && (
                <div className="souv-nav-popover">
                  <div className="souv-nav-popover-arrow" />
                  <div className="souv-rule-gold" />
                  <div className="souv-nav-popover-body">
                    <div className="souv-nav-popover-title">{link.label}</div>
                    <div className="souv-nav-popover-rule" />
                    <div className="souv-nav-popover-sub">{link.sub}</div>
                  </div>
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </nav>

      <NavRight
        loggedIn={loggedIn}
        user={user}
        creditBalance={creditBalance.balance}
        creditStatus={loggedIn && creditBalance.status === "idle" ? "loading" : creditBalance.status}
        cardBank={cardBank}
        cartCount={cartCount}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        currency={currency}
        setCurrency={setCurrency}
        currencyOpen={currencyOpen}
        setCurrencyOpen={setCurrencyOpen}
      />
    </header>
  );
}

export { Navbar };
export type { NavbarProps };
