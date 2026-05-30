"use client";

import { forwardRef } from "react";
import { MusicPreviewButton } from "@/components/hero/MusicPreviewButton";
import { StampCorners } from "@/components/layout/Ornaments";
import type { CardTemplate } from "@/types";

interface CardCarouselProps {
  cards: CardTemplate[];
  activeIndex?: number;
}

/**
 * Horizontal, scroll-snapping rail of card templates. Each card flips on hover
 * to reveal its reverse face. The parent owns scroll position via the ref.
 */
const CardCarousel = forwardRef<HTMLDivElement, CardCarouselProps>(function CardCarousel(
  { cards, activeIndex = 0 },
  ref
) {
  return (
    <div ref={ref} className="souv-gallery-track">
      {cards.map((c, idx) => (
        <div key={c.id} className={`souv-gallery-card ${idx === activeIndex ? "is-active" : ""}`}>
          <div className="souv-gallery-flip">
            <div className="souv-gallery-flip-inner">
              <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-front ${c.surface}`}>
                <StampCorners />
                <div className="souv-gallery-surface-center">
                  <div className="souv-gallery-occasion">{c.occasion}</div>
                </div>
                <MusicPreviewButton label={`Preview ${c.name} song`} />
              </div>
              <div className={`souv-gallery-surface souv-gallery-flip-face souv-gallery-flip-back ${c.surface}`}>
                <StampCorners />
                <div className="souv-gallery-surface-center">
                  <div className="souv-gallery-occasion">{c.occasion}</div>
                </div>
                <MusicPreviewButton label={`Preview ${c.name} song`} />
              </div>
            </div>
          </div>
          <div className="souv-gallery-meta">
            <div className="souv-gallery-name">{c.name}</div>
            <div className="souv-gallery-price">{c.priceLabel}</div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default CardCarousel;
