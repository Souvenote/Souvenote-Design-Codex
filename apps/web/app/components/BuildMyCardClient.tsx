'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { BmcWizard } from './BmcWizard';
import { demoUser } from './DemoUser';
import { useCreditBalance } from '../lib/creditBalance';
import { MIN_GENERATION_CREDITS } from './createFlowRules';
import { goToPricingAfterPurchase } from './PricingReturn';
import { useAuth } from './AuthProvider';
import { AuthGatePrompt } from './AuthGatePrompt';

type BuildStep = 'photo' | 'basics' | 'image' | 'message' | 'song' | 'review';

const validSteps = new Set<BuildStep>(['photo', 'basics', 'image', 'message', 'song', 'review']);

function isBuildStep(value: string): value is BuildStep {
  return validSteps.has(value as BuildStep);
}

export function BuildMyCardClient() {
  const router = useRouter();
  const auth = useAuth();
  const [initialStep, setInitialStep] = React.useState<BuildStep>('photo');
  const [resumeDraftId, setResumeDraftId] = React.useState<string | null>(null);
  const [balanceReady, setBalanceReady] = React.useState(false);
  const [authPromptOpen, setAuthPromptOpen] = React.useState(false);
  const entryGateChecked = React.useRef(false);
  const isAuthenticated = auth.status === 'authenticated';
  const creditBalance = useCreditBalance({ enabled: isAuthenticated, fallbackBalance: 0, userId: auth.user?.id });

  React.useEffect(() => {
    const syncHashStep = () => {
      setResumeDraftId(new URLSearchParams(window.location.search).get('draftId'));
      const hash = window.location.hash.replace('#', '');
      if (isBuildStep(hash)) setInitialStep(hash);
    };
    syncHashStep();
    window.addEventListener('hashchange', syncHashStep);
    return () => window.removeEventListener('hashchange', syncHashStep);
  }, []);

  React.useEffect(() => {
    setBalanceReady(true);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated || !balanceReady || entryGateChecked.current || resumeDraftId) return;
    if (creditBalance.status !== 'ready') return;
    entryGateChecked.current = true;
    if (creditBalance.balance < MIN_GENERATION_CREDITS) {
      router.replace(goToPricingAfterPurchase('/create/build-my-card'));
    }
  }, [balanceReady, creditBalance.balance, creditBalance.status, isAuthenticated, resumeDraftId, router]);

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar
          loggedIn={isAuthenticated}
          user={demoUser}
          credits={{ images: creditBalance.balance, songs: 0 }}
          cardBank={0}
          cartCount={0}
        />
        <main>
          <BmcWizard
            initialStep={initialStep}
            resumeDraftId={resumeDraftId}
            credits={creditBalance.balance}
            creditStatus={creditBalance.status}
            refreshCredits={creditBalance.refresh}
            requireAuthToContinue={!isAuthenticated}
            onAuthRequired={() => setAuthPromptOpen(true)}
          />
          <AuthGatePrompt
            open={authPromptOpen}
            onClose={() => setAuthPromptOpen(false)}
            returnTo="/create/build-my-card"
            title="Save your card before step two"
            body="Build My Card lets you preview the first step, but saving drafts, purchasing cards, and spending generation credits require a Souvenote account."
            primaryLabel="Sign up and continue"
          />
        </main>
        <Footer />
      </div>
    </div>
  );
}
