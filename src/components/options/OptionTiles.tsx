import Link from "next/link";
import { StampCorners } from "@/components/layout/Ornaments";
import CardPatternOverlay from "@/components/CardPatternOverlay";
import { Badge } from "@/components/ui/Button";

interface Tile {
  name: string;
  desc: string;
  href: string;
  surface: string;
  badge?: string;
}

const TILES: Tile[] = [
  {
    name: "Personalize a Template",
    desc: "Need inspiration? Personalize one of our pre-built cards like horoscopes and comic strips.",
    href: "/personalize",
    surface: "surface-gold-animated",
    badge: "Most popular",
  },
  {
    name: "Build My Card",
    desc: "Have your own idea? Answer a few questions and watch your card come to life.",
    href: "/create",
    surface: "surface-trimetal-animated",
  },
  {
    name: "Community Cards",
    desc: "Browse, send, or remix cards shared by the Souvenote community.",
    href: "/cards",
    surface: "surface-rosegold-animated",
  },
  {
    name: "My Cards & Songs",
    desc: "Resume a draft. Re-send a saved card. Queue another song.",
    href: "/library",
    surface: "surface-silver-animated",
  },
];

export function OptionTiles() {
  return (
    <div className="souv-opt-tiles">
      {TILES.map((t) => (
        <Link key={t.name} href={t.href} className={`souv-opt-tile ${t.surface}`}>
          <CardPatternOverlay />
          <StampCorners color="rgba(34,23,6,0.4)" />
          {t.badge && (
            <span className="souv-opt-tile-badge">
              <Badge>★ {t.badge}</Badge>
            </span>
          )}
          <div className="souv-opt-tile-name">{t.name}</div>
          <p className="souv-opt-tile-desc">{t.desc}</p>
          <span className="souv-opt-tile-cta">
            Choose
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
