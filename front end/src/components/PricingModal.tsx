"use client";

import { CREDIT_PACKS } from "@/data/mock-cards";
import { Badge, Button } from "@/components/ui/Button";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "You're out of credits" intercept modal — surfaces the AI credit packs
 * before a gated action. Credit counts at 30px, prices gold.
 */
export default function PricingModal({ open, onClose }: PricingModalProps) {
  if (!open) return null;
  return (
    <div className="souv-modal-overlay" onClick={onClose}>
      <div className="souv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="souv-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="souv-eyebrow">No credits — add one before we continue</div>
        <h2 className="souv-modal-title">Pick up a credit pack</h2>
        <p className="souv-modal-sub">1 credit = 1 action for song creation, design generation, and image editing.</p>
        <div className="souv-packs" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {CREDIT_PACKS.map((pack) => (
            <article key={pack.id} className={`souv-pack ${pack.featured ? "is-featured" : ""}`} style={{ padding: "20px 16px" }}>
              {pack.featured && pack.badge && (
                <span className="souv-pack-badge">
                  <Badge>★</Badge>
                </span>
              )}
              <div className="souv-pack-name" style={{ fontSize: 20 }}>{pack.name}</div>
              <div className="souv-pack-credits" style={{ marginTop: 8 }}>{pack.credits}</div>
              <div className="souv-pack-credits-label">Credits</div>
              <div className="souv-pack-price" style={{ fontSize: 22, marginTop: 10 }}>{pack.price}</div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Button href="/pricing" variant="gold" block>
            See all packs
          </Button>
        </div>
      </div>
    </div>
  );
}
