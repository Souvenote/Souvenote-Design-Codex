"use client";

import { Button } from "@/components/ui/Button";

interface WelcomePopupProps {
  open: boolean;
  name?: string;
  onClose: () => void;
}

/** Post-signup welcome — celebrates the free trial credits. */
export default function WelcomePopup({ open, name = "there", onClose }: WelcomePopupProps) {
  if (!open) return null;
  return (
    <div className="souv-modal-overlay" onClick={onClose}>
      <div className="souv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ textAlign: "center" }}>
        <button className="souv-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="souv-auth-mark">Souvenote</div>
        <h2 className="souv-modal-title" style={{ marginTop: 8 }}>Welcome, {name}!</h2>
        <p className="souv-modal-sub">
          Your account is ready. We&rsquo;ve dropped <strong style={{ color: "var(--rose-gold-hi)" }}>1 free image</strong> and{" "}
          <strong style={{ color: "var(--rose-gold-hi)" }}>1 free song</strong> into your balance — enough to make your first card.
        </p>
        <Button href="/options" variant="gold" block>
          Create my first card
        </Button>
      </div>
    </div>
  );
}
