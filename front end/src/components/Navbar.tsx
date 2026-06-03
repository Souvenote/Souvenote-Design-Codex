"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NAV_LINKS } from "@/data/mock-cards";
import type { CreditBalance, UserSummary } from "@/types";

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

interface NavbarProps {
  loggedIn?: boolean;
  user?: UserSummary;
  credits?: CreditBalance;
  cartCount?: number;
}

export default function Navbar({
  loggedIn = false,
  user = { name: "Amelia Hart", email: "amelia@souvenote.com", initials: "AH" },
  credits = { images: 0, songs: 0 },
  cartCount = 0,
}: NavbarProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const totalCredits = (credits.images ?? 0) + (credits.songs ?? 0);
  const orderedLinks = [NAV_LINKS[1], NAV_LINKS[0], NAV_LINKS[2]].filter(Boolean);

  return (
    <header className={`souv-nav ${loggedIn ? "is-loggedin" : ""}`}>
      <Link href="/" className="souv-nav-logo">
        <Image src="/assets/MainLogo.png" alt="Souvenote" width={142} height={42} priority />
      </Link>

      <nav className="souv-nav-links">
        {orderedLinks.map((link, i) => (
          <span key={link.label} style={{ display: "inline-flex", alignItems: "center", gap: 28 }}>
            {i > 0 && <span className="souv-nav-dot">·</span>}
            <span
              className="souv-nav-link-wrap"
              onMouseEnter={() => setHovered(link.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <Link href={link.href} className={`souv-nav-link ${hovered === link.label ? "is-hover" : ""}`}>
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
            </span>
          </span>
        ))}
      </nav>

      {!loggedIn ? (
        <div className="souv-nav-right">
          <Link href="/signup" className="souv-cta-flow">
            <span>Get Started</span>
          </Link>
        </div>
      ) : (
        <div className="souv-nav-right">
          <div className="souv-credits" title="Your credits">
            <span className="souv-credit">
              <em>Credits</em>
              <b>{totalCredits}</b>
            </span>
            <span className="souv-credit">
              <em>Cards</em>
              <b>{cartCount || 1}</b>
            </span>
          </div>
          <span className="souv-nav-sep" />
          <button className="souv-currency-pill" type="button">CAD <span>v</span></button>
          <span className="souv-nav-sep" />

          <div className="souv-iconbtn-wrap">
            <button
              className={`souv-iconbtn ${profileOpen ? "is-open" : ""}`}
              onClick={() => {
                setProfileOpen(!profileOpen);
                setMenuOpen(false);
              }}
              aria-label="Account"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <IconUser />
            </button>
            {profileOpen && (
              <>
                <div className="souv-overlay" onClick={() => setProfileOpen(false)} />
                <div className="souv-popmenu souv-account-menu" role="menu">
                  <div className="souv-popmenu-userhead">
                    <div className="souv-popmenu-avatar">{user.initials}</div>
                    <div>
                      <div className="souv-popmenu-name">{user.name}</div>
                      <div className="souv-popmenu-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="souv-popmenu-sep" />
                  <Link href="/profile" className="souv-popmenu-item" role="menuitem">Profile</Link>
                  <Link href="/library" className="souv-popmenu-item" role="menuitem">My Cards &amp; Songs</Link>
                  <Link href="/calendar" className="souv-popmenu-item" role="menuitem">Calendar</Link>
                  <Link href="/trust-circle" className="souv-popmenu-item" role="menuitem">Trust Circle</Link>
                  <div className="souv-popmenu-sep" />
                  <Link href="/pricing" className="souv-popmenu-item" role="menuitem">Top up Credits</Link>
                  <Link href="/create" className="souv-popmenu-item" role="menuitem">Send a Blank Card</Link>
                  <Link href="/refer" className="souv-popmenu-item" role="menuitem">Refer a Friend</Link>
                  <Link href="/account" className="souv-popmenu-item" role="menuitem">Account Settings</Link>
                  <div className="souv-popmenu-sep" />
                  <button className="souv-popmenu-logout" type="button" role="menuitem">Sign Out</button>
                </div>
              </>
            )}
          </div>

          <div className="souv-iconbtn-wrap">
            <button className="souv-iconbtn" aria-label="Cart">
              <IconCart />
              {cartCount > 0 && <span className="souv-cart-badge">{cartCount}</span>}
            </button>
          </div>

          <div className="souv-iconbtn-wrap">
            <button
              className={`souv-iconbtn ${menuOpen ? "is-open" : ""}`}
              onClick={() => {
                setMenuOpen(!menuOpen);
                setProfileOpen(false);
              }}
              aria-label="Menu"
            >
              <IconMenu />
            </button>
            {menuOpen && (
              <>
                <div className="souv-overlay" onClick={() => setMenuOpen(false)} />
                <div className="souv-popmenu">
                  <Link href="/pricing" className="souv-popmenu-item">Pricing</Link>
                  <Link href="/options" className="souv-popmenu-item">Create a Card</Link>
                  <div className="souv-popmenu-item">Contact Us</div>
                  <div className="souv-popmenu-sep" />
                  <div className="souv-popmenu-item">Terms of Service</div>
                  <div className="souv-popmenu-item">Privacy Policy</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
