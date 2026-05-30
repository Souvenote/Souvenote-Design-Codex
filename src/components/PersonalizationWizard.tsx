"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { CardTemplate } from "@/types";

interface PersonalizationWizardProps {
  card: CardTemplate | null;
  onClose: () => void;
}

const STEPS = [
  { key: "photo", label: "Add a photo", field: "Upload or describe the photo for your card" },
  { key: "recipient", label: "Who's it for?", field: "Recipient's name" },
  { key: "message", label: "Your message", field: "Write up to 500 characters" },
];

/** Lightweight multi-step wizard for turning a template into a personal card. */
export default function PersonalizationWizard({ card, onClose }: PersonalizationWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  if (!card) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      router.push("/review");
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="souv-modal-overlay" onClick={onClose}>
      <div className="souv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="souv-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="souv-eyebrow">
          {card.name} · Step {step + 1} of {STEPS.length}
        </div>
        <h2 className="souv-modal-title">{current.label}</h2>
        <p className="souv-modal-sub">Generate when ready · costs 1 credit per generation. Message edits are always free.</p>

        <div className="souv-field">
          <label htmlFor="wizard-field">{current.field}</label>
          {current.key === "message" ? (
            <textarea id="wizard-field" className="souv-input" rows={4} placeholder="Dear..." />
          ) : (
            <input id="wizard-field" className="souv-input" placeholder={current.field} />
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button variant="gold" block onClick={next}>
            {isLast ? "Generate & review" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
