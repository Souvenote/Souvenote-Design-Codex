'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { DemoNavbar } from './DemoNavbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { useAuth } from './AuthProvider';

type AccountRouteClientProps = {
  children: ReactNode;
};

export function AccountRouteClient({ children }: AccountRouteClientProps) {
  const auth = useAuth();
  const showAccount = auth.status === 'authenticated';

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <DemoNavbar cartCount={0} />
        <main>
          {showAccount ? (
            children
          ) : (
            <div className="bmc-shell" data-screen-label="Account Sign In">
              <div className="bmc-head" style={{ marginBottom: 28 }}>
                <div className="bmc-eyebrow">
                  <span>Account</span>
                  <span className="dot" />
                  Sign in
                </div>
                <h1 className="bmc-title">
                  Sign in to see your <span className="souv-hero-italic text-metallic-gold">profile</span>
                </h1>
                <p className="bmc-lede">
                  Your saved cards, credits, profile details, gifts, and referral link are tied to your Cognito account.
                </p>
              </div>
              <div className="acc-panel">
                <div className="acc-panel-title">
                  {auth.status === 'loading' ? 'Checking your session' : 'Your account is private'}
                </div>
                <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', margin: '0 0 18px' }}>
                  {auth.status === 'loading'
                    ? 'One moment while Souvenote checks your local session.'
                    : 'Log in or create an account to personalize this page with your cards, credits, and account details.'}
                </p>
                {auth.status !== 'loading' && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link className="bmc-cta" href="/login">
                      Log in
                    </Link>
                    <Link className="bmc-cta-secondary" href="/signup">
                      Create account
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
