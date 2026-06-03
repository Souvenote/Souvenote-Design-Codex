"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/layout/Footer";
import OccasionFilter from "@/components/OccasionFilter";
import TemplateGrid from "@/components/personalize/TemplateGrid";
import PersonalizationWizard from "@/components/PersonalizationWizard";
import { MOCK_CARDS, OCCASIONS } from "@/data/mock-cards";
import type { CardTemplate } from "@/types";

export default function PersonalizePage() {
  const [active, setActive] = useState<string>("All");
  const [selected, setSelected] = useState<CardTemplate | null>(null);

  const cards = active === "All" ? MOCK_CARDS : MOCK_CARDS.filter((c) => c.occasion === active);

  return (
    <>
      <Navbar loggedIn user={{ name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" }} credits={{ images: 7, songs: 3 }} />
      <main className="souv-app-main">
        <section className="souv-section">
          <div className="souv-section-head">
            <div className="souv-eyebrow">Personalize a Template</div>
            <h1 className="souv-h1">
              Curated designs, <span className="souv-hero-italic text-metallic-rose-gold">ready to make yours.</span>
            </h1>
            <p className="souv-lede">Pick a starting point, then add your photo, recipient, and message.</p>
          </div>

          <OccasionFilter occasions={OCCASIONS} active={active} onChange={setActive} />

          <TemplateGrid
            cards={cards}
            emptyLabel={`No templates for “${active}” yet — more drops are on the way.`}
            onSelect={setSelected}
          />
        </section>
      </main>
      <Footer />
      <PersonalizationWizard card={selected} onClose={() => setSelected(null)} />
    </>
  );
}
