"use client";

import { useRef, useState } from "react";
import CardCarousel from "@/components/CardCarousel";
import { MOCK_CARDS } from "@/data/mock-cards";

export default function GallerySection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollByCards(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".souv-gallery-card");
    const step = card ? card.offsetWidth + 24 : 284;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
    setActive((i) => Math.min(MOCK_CARDS.length - 1, Math.max(0, i + dir)));
  }

  return (
    <section className="souv-gallery">
      <div className="souv-gallery-head">
        <div className="souv-gallery-rail">
          <div className="souv-gallery-rail-line" />
          <h2 className="souv-h1">
            <span className="souv-hero-italic text-metallic-silver">Explore the</span>{" "}
            <span className="souv-hero-italic text-metallic-rose-gold">possibilities</span>
          </h2>
          <p className="souv-gallery-sub">Hover any card to see it spin — every drop is a fresh occasion.</p>
          <div className="souv-gallery-controls">
            <button className="souv-chev" onClick={() => scrollByCards(-1)} aria-label="Previous">‹</button>
            <button className="souv-chev" onClick={() => scrollByCards(1)} aria-label="Next">›</button>
          </div>
        </div>
        <div className="souv-gallery-track-wrap">
          <CardCarousel ref={trackRef} cards={MOCK_CARDS} activeIndex={active} />
        </div>
      </div>
    </section>
  );
}
