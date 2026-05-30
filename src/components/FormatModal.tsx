"use client";

import { useRouter } from "next/navigation";

interface FormatModalProps {
  open: boolean;
  onClose: () => void;
}

const FORMATS = [
  { id: "physical", name: "Physical card", price: "$11.99", note: "Printed & mailed · 5–7 days" },
  { id: "digital", name: "Digital card", price: "$4.99", note: "Instant share · QR + link" },
  { id: "both", name: "Physical + Digital", price: "$13.99", note: "Best of both · save $3" },
  { id: "gift", name: "Gift a pack", price: "From $7.49", note: "Send to friends & family" },
];

/** Choose a delivery format before checkout. */
export default function FormatModal({ open, onClose }: FormatModalProps) {
  const router = useRouter();
  if (!open) return null;
  return (
    <div className="souv-modal-overlay" onClick={onClose}>
      <div className="souv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="souv-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="souv-eyebrow">Choose a format</div>
        <h2 className="souv-modal-title">How should we send it?</h2>
        <p className="souv-modal-sub">Every format includes your generated song, linked by QR code.</p>
        <div className="souv-format-grid">
          {FORMATS.map((f) => (
            <button key={f.id} className="souv-format-opt" onClick={() => router.push("/library")}>
              <div className="souv-format-opt-name">{f.name}</div>
              <div className="souv-format-opt-price">{f.price}</div>
              <div className="souv-format-opt-note">{f.note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
