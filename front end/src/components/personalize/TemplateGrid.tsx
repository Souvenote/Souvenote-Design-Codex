"use client";

import CardListing from "@/components/CardListing";
import type { CardTemplate } from "@/types";

interface TemplateGridProps {
  cards: CardTemplate[];
  emptyLabel?: string;
  onSelect: (card: CardTemplate) => void;
}

/** Responsive grid of selectable card templates for the personalize flow. */
export default function TemplateGrid({ cards, emptyLabel, onSelect }: TemplateGridProps) {
  if (cards.length === 0) {
    return (
      <p className="souv-lede" style={{ textAlign: "center" }}>
        {emptyLabel ?? "No templates here yet — more drops are on the way."}
      </p>
    );
  }
  return (
    <div className="souv-card-grid">
      {cards.map((c) => (
        <CardListing key={c.id} card={c} onSelect={onSelect} />
      ))}
    </div>
  );
}
