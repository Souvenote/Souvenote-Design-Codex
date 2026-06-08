"use client";

import * as React from "react";
import Link from "next/link";

// Navbar.jsx — floating glass navbar.
// Build My Card · Personalize a Template · Community Cards · Business · Gifts
// Two states: loggedIn=false (default → Get Started CTA)
//             loggedIn=true  → Credits ticker · Profile · Cart · Menu

const NAV_LINKS = [
  { label: 'Personalize a Template', sub: 'Curated designs, ready to make yours.', href: '/create/personalize-a-template' },
  { label: 'Build My Card',          sub: 'Start from scratch: photo, moment, song.', href: '/create/build-my-card' },
  { label: 'Community Cards',        sub: 'Cards shared by the Souvenote community.', href: '/create/community-cards' },
];

// --- icons ---------------------------------------------------------------
function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 17 L9 12 L13 15.5 L17 11 L20.5 14.5" />
    </svg>
  );
}
function IconNote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17V5l11-2v12" />
      <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="15.5" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
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

// --- ticker (stacked: combined credits + card bank) --------------------
function CreditsTicker({ credits = 0, cardBank = 0 }) {
  return (
    <div className="souv-credits souv-credits-stack" title="Your balance">
      <span className="souv-credit"><em>Credits</em><b>{credits}</b></span>
      <div className="souv-cardbank-wrap">
        <span className="souv-credit souv-credit-bank">
          <em>Cards</em><b>{cardBank}</b>
        </span>
        <div className="souv-cardbank-pop">
          <div className="souv-cardbank-pop-card">
            <div className="souv-cardbank-pop-arrow" />
            <div className="souv-rule-gold" />
            <Link className="souv-cardbank-sendlink" href="#todo-gift-a-souvenote">Gift a Souvenote</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 4 3 11l7 3 3 7 8-17z" />
      <path d="M10 14l4-4" />
    </svg>
  );
}

// --- currency selector (between credits and profile) -------------------
function CurrencySelect({ currency, setCurrency, open, setOpen }) {
  const CURRENCIES = [
    { code: 'CAD', flag: '🇨🇦' },
    { code: 'USD', flag: '🇺🇸' },
  ];
  const active = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  return (
    <div className="souv-iconbtn-wrap">
      <button
        className={`souv-currency ${open ? 'is-open' : ''}`}
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
            {CURRENCIES.map(c => (
              <div
                key={c.code}
                role="option"
                aria-selected={c.code === currency}
                className={`souv-popmenu-item souv-currency-option ${c.code === currency ? 'is-active' : ''}`}
                onClick={() => { setCurrency(c.code); setOpen(false); }}
              >
                <span className="souv-currency-flag" aria-hidden="true">{c.flag}</span>
                <span>{c.code}</span>
                {c.code === currency && (
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

// --- right cluster: logged-out vs logged-in -----------------------------
function NavRight({ loggedIn, user, credits, cardBank, cartCount, profileOpen, setProfileOpen, menuOpen, setMenuOpen, currency, setCurrency, currencyOpen, setCurrencyOpen }) {
  if (!loggedIn) {
    return (
      <div className="souv-nav-right">
        <Link className="souv-cta-flow" href="/signup"><span>Get Started</span></Link>
      </div>
    );
  }
  return (
    <div className="souv-nav-right">
      <CreditsTicker credits={(credits.images ?? 0) + (credits.songs ?? 0)} cardBank={cardBank} />
      <span className="souv-nav-sep" />

      {/* Currency */}
      <CurrencySelect
        currency={currency}
        setCurrency={setCurrency}
        open={currencyOpen}
        setOpen={(v) => { setCurrencyOpen(v); if (v) { setProfileOpen(false); setMenuOpen(false); } }}
      />
      <span className="souv-nav-sep" />

      {/* Profile */}
      <div className="souv-iconbtn-wrap">
        <button
          className={`souv-iconbtn ${profileOpen ? 'is-open' : ''}`}
          onClick={() => { setProfileOpen(!profileOpen); setMenuOpen(false); setCurrencyOpen(false); }}
          aria-label="Account"
        ><IconUser /></button>
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
              <Link href="#todo-profile" className="souv-popmenu-item">Profile</Link>
              <Link href="/create/my-cards-and-songs" className="souv-popmenu-item">My Cards &amp; Songs</Link>
              <div className="souv-popmenu-sep" />
              <div className="souv-popmenu-item">Top up Credits</div>
              <Link href="#todo-gift-a-souvenote" className="souv-popmenu-item souv-popmenu-item-send">Gift a Souvenote</Link>
              <Link href="#todo-refer-a-friend" className="souv-popmenu-item">Refer a Friend</Link>
              <Link href="#todo-account-settings" className="souv-popmenu-item">Account Settings</Link>
              <div className="souv-popmenu-sep" />
              <div className="souv-popmenu-logout">Sign Out</div>
            </div>
          </>
        )}
      </div>

      {/* Cart */}
      <div className="souv-iconbtn-wrap">
        <button className="souv-iconbtn" aria-label="Cart">
          <IconCart />
          {cartCount > 0 && <span className="souv-cart-badge">{cartCount}</span>}
        </button>
      </div>

      {/* Hamburger */}
      <div className="souv-iconbtn-wrap">
        <button
          className={`souv-iconbtn ${menuOpen ? 'is-open' : ''}`}
          onClick={() => { setMenuOpen(!menuOpen); setProfileOpen(false); setCurrencyOpen(false); }}
          aria-label="Menu"
        ><IconMenu /></button>
        {menuOpen && (
          <>
            <div className="souv-overlay" onClick={() => setMenuOpen(false)} />
            <div className="souv-popmenu">
              <Link href="/pricing" className="souv-popmenu-item">Pricing</Link>
              <Link href="#todo-faq" className="souv-popmenu-item">FAQ</Link>
              <Link href="#todo-contact" className="souv-popmenu-item">Contact Us</Link>
              <div className="souv-popmenu-sep" />
              <Link href="#todo-cookie-policy" className="souv-popmenu-item">Cookie Policy</Link>
              <Link href="#todo-refund-policy" className="souv-popmenu-item">Refund Policy</Link>
              <Link href="#todo-terms" className="souv-popmenu-item">Terms of Service</Link>
              <Link href="#todo-privacy" className="souv-popmenu-item">Privacy Policy</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Navbar({
  loggedIn = false,
  user = { name: 'Amelia Hart', email: 'amelia@souvenote.com', initials: 'AH' },
  credits = { images: 0, songs: 0 },
  cardBank = 1,
  cartCount = 0,
}) {
  const [hovered, setHovered] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [currency, setCurrency] = React.useState('CAD');
  const [currencyOpen, setCurrencyOpen] = React.useState(false);

  return (
    <header className={`souv-nav ${loggedIn ? 'is-loggedin' : ''}`}>
      {/* Logo */}
      <Link href="/" className="souv-nav-logo" aria-label="Souvenote — home">
        <img src="/assets/LogoMark.png" alt="Souvenote" />
      </Link>

      {/* Links — center */}
      <nav className="souv-nav-links">
        {NAV_LINKS.map((link, i) => (
          <React.Fragment key={link.label}>
            {i > 0 && <span className="souv-nav-dot">·</span>}
            <div
              className="souv-nav-link-wrap"
              onMouseEnter={() => setHovered(link.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <Link href={link.href} className={`souv-nav-link ${hovered === link.label ? 'is-hover' : ''}`}>
                {link.label}
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

      {/* Right cluster */}
      <NavRight
        loggedIn={loggedIn}
        user={user}
        credits={credits}
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
