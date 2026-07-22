'use client';

import * as React from 'react';
import type { DemoUser } from './DemoUser';
import { useAuth } from './AuthProvider';
import { updateAuthenticatedUser } from '../lib/api';

type AccountUserProps = {
  user?: DemoUser;
};

type RequiredAccountUserProps = {
  user: DemoUser;
};

type GiftDeliveryMethod = 'email' | 'text';

type RedeemGiftPageProps = {
  sender?: string;
};

type AccToggleProps = {
  on?: boolean;
  onChange?: (value: boolean) => void;
};

type SettingsTabId = 'personal' | 'security' | 'notifs' | 'payments' | 'prefs' | 'danger';

type SettingsTab = {
  id: SettingsTabId;
  label: string;
  ico: React.ReactNode;
  danger?: boolean;
};

type NotificationRow = {
  label: string;
  desc: string;
  on: boolean;
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
  return auth.displayUser || fallback || { name: 'Souvenote User', email: 'user@souvenote.com', initials: 'SU' };
}

function splitDisplayName(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: pieces[0] || '',
    lastName: pieces.slice(1).join(' '),
  };
}

// ============================================================
// GIFT A SOUVENOTE
// Polished placeholder only. Gift payments, sends, and redemptions
// are explicitly outside the physical-card MVP.
// ============================================================
function GiftSouvenotePage({ user }: AccountUserProps) {
  const accountUser = useAccountDisplayUser(user);
  const [via, setVia] = React.useState<GiftDeliveryMethod>('email');
  const [name, setName] = React.useState('');

  return (
    <div className="bmc-shell" data-screen-label="Gift a Souvenote">
      <div className="bmc-head" style={{ marginBottom: 28 }}>
        <div className="bmc-eyebrow">
          <span>Account</span>
          <span className="dot" />
          Gift a Souvenote
        </div>
        <h1 className="bmc-title">
          Gift a <span className="souv-hero-italic text-metallic-gold">Souvenote</span>
        </h1>
        <p className="bmc-lede">
          Coming soon. Gift purchases, redemption links, credit grants, and gift fulfillment are not active in this
          build.
        </p>
      </div>

      <form className="acc-gift-grid" onSubmit={(event) => event.preventDefault()}>
        {/* LEFT - what they get + where to send */}
        <div className="acc-gift-main">
          <div className="acc-panel">
            <div className="acc-panel-title">What they'll unlock</div>
            <div className="acc-gift-includes">
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.spark}</span>
                <div>
                  <div className="acc-gift-inc-h">10 creation credits</div>
                  <div className="acc-gift-inc-p">Enough to design a card and add an optional QR-code song.</div>
                </div>
              </div>
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.mail}</span>
                <div>
                  <div className="acc-gift-inc-h">1 physical card send</div>
                  <div className="acc-gift-inc-p">We print and mail the finished card, postage on us.</div>
                </div>
              </div>
              <div className="acc-gift-inc">
                <span className="acc-gift-inc-ico">{GiftIco.heart}</span>
                <div>
                  <div className="acc-gift-inc-h">Theirs to pass on</div>
                  <div className="acc-gift-inc-p">They create it and send it to someone they love.</div>
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
                  className={`bmc-chip ${via === 'email' ? 'is-active' : ''}`}
                  onClick={() => setVia('email')}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`bmc-chip ${via === 'text' ? 'is-active' : ''}`}
                  onClick={() => setVia('text')}
                >
                  Text
                </button>
              </div>
            </div>
            <div className="acc-field" style={{ marginBottom: 0 }}>
              <span className="acc-flabel">{via === 'email' ? 'Their email' : 'Their mobile number'}</span>
              <input
                className="input-dark"
                type={via === 'email' ? 'email' : 'tel'}
                placeholder={via === 'email' ? 'jordan@example.com' : '(555) 012-3456'}
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
                <span className="v">10 credits · 1 physical send</span>
              </div>
              <div className="acc-summary-row">
                <span className="k">Delivery</span>
                <span className="v">{via === 'email' ? 'Email link · instant' : 'Text link · instant'}</span>
              </div>
              <div className="acc-summary-row">
                <span className="k">From</span>
                <span className="v">{accountUser.name}</span>
              </div>
            </div>
            <button type="submit" className="bmc-cta acc-gift-cta" disabled>
              {GiftIco.send} Coming soon
            </button>
            <p className="acc-gift-foot">
              No payment, email, text message, credit, or redemption link will be created.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

// ============================================================
// REDEEM A GIFTED SOUVENOTE (placeholder only)
// ============================================================
function RedeemGiftPage({ sender = 'A friend' }: RedeemGiftPageProps) {
  const senderFirst = sender.trim().split(' ')[0];
  const STEPS = [
    { n: 1, h: 'Create your account', p: 'Sign up free, and your gift applies the moment you join.' },
    { n: 2, h: 'Design your card', p: 'Use your 10 credits to craft a card and add an optional QR-code song.' },
    { n: 3, h: 'We print & mail it', p: 'Send the finished keepsake to someone you love, on us.' },
  ];
  return (
    <div className="bmc-shell acc-redeem" data-screen-label="Redeem a Gift">
      <div className="acc-redeem-hero">
        <div className="bmc-eyebrow" style={{ justifyContent: 'center' }}>
          <span>A gift for you</span>
        </div>
        <div className="acc-redeem-token" aria-hidden="true">
          {GiftIco.gift}
        </div>
        <h1 className="bmc-title acc-redeem-title">
          {senderFirst} gifted you a <span className="souv-hero-italic text-metallic-rose-gold">Souvenote</span>
        </h1>
        <p className="bmc-lede acc-redeem-lede">
          Gift redemption is coming soon. This preview does not grant credits, create an entitlement, or schedule a
          physical card send.
        </p>
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
        <button type="button" className="bmc-cta acc-redeem-btn" disabled>
          {GiftIco.heart} Coming soon
        </button>
      </div>
      <p className="acc-redeem-note">No gift, credits, or physical-send entitlement is active in this build.</p>
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
      className={`acc-switch ${on ? 'is-on' : ''}`}
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
  { id: 'personal', label: 'Personal info', ico: AfIco.user },
  { id: 'security', label: 'Login & security', ico: AfIco.lock },
  { id: 'notifs', label: 'Notifications', ico: AfIco.bell },
  { id: 'payments', label: 'Payment methods', ico: AfIco.card },
  { id: 'prefs', label: 'Preferences', ico: AfIco.cog },
  { id: 'danger', label: 'Danger zone', ico: AfIco.trash, danger: true },
];

function SettingsPersonal({ user }: RequiredAccountUserProps) {
  const auth = useAuth();
  const fallbackName = splitDisplayName(user.name);
  const profile = auth.user;
  const [firstName, setFirstName] = React.useState(profile?.first_name || fallbackName.firstName);
  const [lastName, setLastName] = React.useState(profile?.last_name || fallbackName.lastName);
  const [phone, setPhone] = React.useState(profile?.phone || '');
  const [birthday, setBirthday] = React.useState(profile?.birthday?.slice(0, 10) || '');
  const [country, setCountry] = React.useState(profile?.country || 'CA');
  const [currency, setCurrency] = React.useState(profile?.currency || 'CAD');
  const [language, setLanguage] = React.useState(profile?.language || 'English');
  const [marketingOptIn, setMarketingOptIn] = React.useState(profile?.marketing_opt_in ?? true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const nextFallback = splitDisplayName(user.name);
    setFirstName(profile?.first_name || nextFallback.firstName);
    setLastName(profile?.last_name || nextFallback.lastName);
    setPhone(profile?.phone || '');
    setBirthday(profile?.birthday?.slice(0, 10) || '');
    setCountry(profile?.country || 'CA');
    setCurrency(profile?.currency || 'CAD');
    setLanguage(profile?.language || 'English');
    setMarketingOptIn(profile?.marketing_opt_in ?? true);
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
        language,
        marketingOptIn,
        preferences: { country, currency },
      });
      await auth.refreshUser();
      setMessage('Profile saved.');
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Profile could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Personal info</h2>
      <p className="acc-set-sub">This is how your account, cards, receipts, and reminders are personalized.</p>
      <div className="acc-row" style={{ paddingTop: 0 }}>
        <div className="acc-row-info" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="acc-avatar" style={{ width: 60, height: 60, fontSize: 22 }}>
            {user.initials}
          </div>
          <div>
            <div className="acc-row-label">Profile photo</div>
            <div className="acc-row-desc">
              Photo upload is saved for the account UI. Card reference photos are managed inside each card flow.
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
            <input className="input-dark" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Last name</span>
            <input className="input-dark" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Login email</span>
          <input className="input-dark" value={profile?.email || user.email} readOnly />
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
              disabled
            >
              <option value="CA">Canada</option>
            </select>
          </div>
          <div className="acc-field">
            <span className="acc-flabel">Currency</span>
            <select
              className="input-dark"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled
            >
              <option value="CAD">CAD</option>
            </select>
          </div>
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Language</span>
          <select className="input-dark" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="English">English</option>
            <option value="Francais">Francais</option>
          </select>
        </div>
        <div className="acc-row">
          <div className="acc-row-info">
            <div className="acc-row-label">Seasonal ideas and reminders</div>
            <div className="acc-row-desc">Occasional emails for gifts, birthdays, and new card styles.</div>
          </div>
          <AccToggle on={marketingOptIn} onChange={setMarketingOptIn} />
        </div>
        {message && <p className="acc-save-state is-success">{message}</p>}
        {error && <p className="acc-save-state is-error">{error}</p>}
        <button type="button" className="bmc-cta" style={{ marginTop: 4 }} onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function SettingsSecurity() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Login & security</h2>
      <p className="acc-set-sub">Keep your account safe.</p>
      <div className="acc-field">
        <span className="acc-flabel">Current password</span>
        <input className="input-dark" type="password" placeholder="Enter current password" />
      </div>
      <div className="acc-field-row">
        <div className="acc-field">
          <span className="acc-flabel">New password</span>
          <input className="input-dark" type="password" placeholder="••••••••" />
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Confirm new</span>
          <input className="input-dark" type="password" placeholder="••••••••" />
        </div>
      </div>
      <button type="button" className="bmc-cta" style={{ marginBottom: 8 }}>
        Update password
      </button>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Two-factor authentication</div>
          <div className="acc-row-desc">Add an extra step at sign-in for more security.</div>
        </div>
        <AccToggle />
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Active sessions</div>
          <div className="acc-row-desc">You're signed in on 2 devices.</div>
        </div>
        <button type="button" className="bmc-cta-secondary">
          Sign out all
        </button>
      </div>
    </div>
  );
}

function SettingsNotifs() {
  const ROWS: NotificationRow[] = [
    { label: 'Order updates', desc: 'Shipping, delivery and printing status.', on: true },
    { label: 'Card reminders', desc: 'Nudges before birthdays and saved-card expiry.', on: true },
    { label: 'New features', desc: 'Occasional notes about what\u2019s new.', on: false },
    { label: 'Promotions & offers', desc: 'Deals, seasonal credits and referrals.', on: false },
  ];
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Notifications</h2>
      <p className="acc-set-sub">Choose what lands in your inbox.</p>
      {ROWS.map((r) => (
        <div className="acc-row" key={r.label}>
          <div className="acc-row-info">
            <div className="acc-row-label">{r.label}</div>
            <div className="acc-row-desc">{r.desc}</div>
          </div>
          <AccToggle on={r.on} />
        </div>
      ))}
    </div>
  );
}

function SettingsPayments() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Payment methods</h2>
      <p className="acc-set-sub">
        Coming soon with the approved Stripe test integration. Souvenote does not collect payment details here.
      </p>
      <div className="acc-pay-empty">
        <div className="acc-pay-empty-title">Payment methods are not active</div>
        <p>Stripe-hosted test components will be added in Section 5 after separate approval.</p>
      </div>
      <button type="button" className="bmc-cta" style={{ marginTop: 8 }} disabled>
        Coming soon
      </button>
    </div>
  );
}

function SettingsPrefs() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Preferences</h2>
      <p className="acc-set-sub">Tailor how Souvenote works for you.</p>
      <div className="acc-field-row">
        <div className="acc-field">
          <span className="acc-flabel">Currency</span>
          <select className="input-dark" disabled>
            <option>CAD (Canadian Dollar)</option>
          </select>
        </div>
        <div className="acc-field">
          <span className="acc-flabel">Language</span>
          <select className="input-dark">
            <option>English</option>
            <option>Français</option>
          </select>
        </div>
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Save my spot automatically</div>
          <div className="acc-row-desc">Keep drafts in Saved Cards & Songs for 30 days.</div>
        </div>
        <AccToggle on={true} />
      </div>
      <div className="acc-row">
        <div className="acc-row-info">
          <div className="acc-row-label">Show prices with tax</div>
          <div className="acc-row-desc">Display estimated tax on all prices.</div>
        </div>
        <AccToggle />
      </div>
    </div>
  );
}

function SettingsDanger() {
  return (
    <div className="acc-set-group">
      <h2 className="acc-set-h">Danger zone</h2>
      <p className="acc-set-sub">Irreversible actions. Please be sure.</p>
      <div className="acc-danger">
        <div className="acc-row" style={{ paddingTop: 0 }}>
          <div className="acc-row-info">
            <div className="acc-row-label">Deactivate account</div>
            <div className="acc-row-desc">Hide your profile and pause emails. You can reactivate anytime.</div>
          </div>
          <button type="button" className="acc-btn-danger">
            Deactivate
          </button>
        </div>
        <div className="acc-row">
          <div className="acc-row-info">
            <div className="acc-row-label">Delete account</div>
            <div className="acc-row-desc">Permanently remove your account, cards and songs. This can't be undone.</div>
          </div>
          <button type="button" className="acc-btn-danger">
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ user }: AccountUserProps) {
  const accountUser = useAccountDisplayUser(user);
  const [tab, setTab] = React.useState<SettingsTabId>('personal');
  return (
    <div className="bmc-shell" data-screen-label="Account Settings">
      <div className="bmc-head" style={{ marginBottom: 28 }}>
        <div className="bmc-eyebrow">
          <span>Account</span>
          <span className="dot" />
          Settings
        </div>
        <h1 className="bmc-title">
          Account <span className="souv-hero-italic text-metallic-silver">settings</span>
        </h1>
        <p className="bmc-lede">Manage your details, security, notifications and how you pay.</p>
      </div>

      <div className="acc-settings">
        <nav className="acc-tabs">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              className={`acc-tab ${tab === t.id ? 'is-active' : ''} ${t.danger ? 'is-danger' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.ico}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="acc-panel">
          {tab === 'personal' && <SettingsPersonal user={accountUser} />}
          {tab === 'security' && <SettingsSecurity />}
          {tab === 'notifs' && <SettingsNotifs />}
          {tab === 'payments' && <SettingsPayments />}
          {tab === 'prefs' && <SettingsPrefs />}
          {tab === 'danger' && <SettingsDanger />}
        </div>
      </div>
    </div>
  );
}

export { GiftSouvenotePage, RedeemGiftPage, SettingsPage };
