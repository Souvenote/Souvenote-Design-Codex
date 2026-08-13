"use client";

import * as React from "react";
import Link from "next/link";
import { claimReferral, previewReferral, type ReferralProgram } from "../lib/api";
import { useAuth } from "./AuthProvider";

export function ReferralClaimPage({ token }: { token: string }) {
  const auth = useAuth();
  const [senderName, setSenderName] = React.useState("A friend");
  const [program, setProgram] = React.useState<ReferralProgram | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [claiming, setClaiming] = React.useState(false);
  const [claimed, setClaimed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    previewReferral(token)
      .then(({ referral }) => {
        if (!cancelled) {
          setSenderName(referral.senderName || "A friend");
          setProgram(referral.program);
        }
      })
      .catch((unknownError) => {
        if (!cancelled) setError(unknownError instanceof Error ? unknownError.message : "This referral is unavailable.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function claim() {
    setClaiming(true);
    setError(null);
    try {
      await claimReferral(token);
      setClaimed(true);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Could not claim this referral.");
    } finally {
      setClaiming(false);
    }
  }

  const returnTo = `/r/${encodeURIComponent(token)}`;
  return (
    <div className="bmc-shell acc-redeem" data-screen-label="Referral invite">
      <div className="acc-redeem-hero">
        <div className="bmc-eyebrow" style={{ justifyContent: "center" }}><span>A friend invited you</span></div>
        <h1 className="bmc-title acc-redeem-title">
          {senderName} sent you a <span className="souv-hero-italic text-metallic-rose-gold">Souvenote invite</span>
        </h1>
        <p className="bmc-lede acc-redeem-lede">
          Start with {program?.inviteeStarterCreditsTotal ?? 10} creation credits. After your first physical card is accepted for printing and delivery, {senderName} earns {program?.referrerRewardCredits ?? 10} credits too.
        </p>
      </div>
      <div className="acc-redeem-cta">
        {loading ? (
          <span className="bmc-cta acc-redeem-btn">Checking invite...</span>
        ) : claimed ? (
          <Link className="bmc-cta acc-redeem-btn" href="/create">Start creating</Link>
        ) : auth.status === "authenticated" ? (
          <button className="bmc-cta acc-redeem-btn" type="button" onClick={claim} disabled={claiming || !program}>
            {claiming ? "Claiming..." : "Claim 10 starter credits"}
          </button>
        ) : (
          <>
            <Link className="bmc-cta acc-redeem-btn" href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Sign up to claim</Link>
            <Link className="bmc-text-link" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account? Log in</Link>
          </>
        )}
      </div>
      {error && <p className="acc-redeem-note" role="alert">{error}</p>}
      <p className="acc-redeem-note">The referral adds 8 bonus credits to the standard 2-credit signup grant, for 10 starter credits total.</p>
    </div>
  );
}
