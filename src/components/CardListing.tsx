"use client";

import { MusicPreviewButton } from "@/components/hero/MusicPreviewButton";
import { StampCorners } from "@/components/layout/Ornaments";
import type { CardTemplate } from "@/types";

interface CardListingProps {
  card: CardTemplate;
  onSelect?: (card: CardTemplate) => void;
}

/** A single selectable card template tile (hover-flips like the gallery). */
export default function CardListing({ card, onSelect }: CardListingProps) {
  return (
    <div className="souv-card-listing">
      <button
        type="button"
        onClick={() => onSelect?.(card)}
        className="souv-gallery-flip"
        style={{ width: "100%", border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
        aria-label={`Personalize ${card.name}`}
      >
        <div className="souv-gallery-flip-inner">
          <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-front ${card.surface}`}>
            <StampCorners />
            <div className="souv-gallery-surface-center">
              <div className="souv-gallery-occasion">{card.occasion}</div>
            </div>
          </div>
          <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-back ${card.surface}`}>
            <StampCorners />
            <div className="souv-gallery-surface-center">
              <div className="souv-gallery-occasion">{card.occasion}</div>
            </div>
            <MusicPreviewButton label={`Preview ${card.name} song`} />
          </div>
        </div>
      </button>
      <div className="souv-card-listing-meta">
        <div className="souv-card-listing-name">{card.name}</div>
        <div className="souv-card-listing-occasion">{card.occasion}</div>
      </div>
    </div>
  );
}
