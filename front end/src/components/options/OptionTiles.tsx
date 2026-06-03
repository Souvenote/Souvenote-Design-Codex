import Link from "next/link";
import CardPatternOverlay from "@/components/CardPatternOverlay";
import { MusicPreviewButton } from "@/components/hero/MusicPreviewButton";
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
    desc: "Need inspiration? Personalize one of our pre-built cards like Horoscope or Comic cards!",
    href: "/personalize",
    surface: "surface-gold-animated",
    badge: "Most popular",
  },
  {
    name: "Build My Card",
    desc: "Have your own idea? Answer a few questions and watch your card come to life.",
    href: "/create",
    surface: "surface-bronze-animated",
  },
  {
    name: "Community Cards",
    desc: "Browse, send, or remix cards shared by the Souvenote community.",
    href: "/cards",
    surface: "surface-rosegold-soft-animated",
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
      {TILES.map((tile) => (
        <Link key={tile.name} href={tile.href} className={`souv-opt-tile ${tile.surface}`}>
          <CardPatternOverlay />
          {tile.badge && (
            <span className="souv-opt-tile-badge">
              <Badge>* {tile.badge}</Badge>
            </span>
          )}
          <div className="souv-opt-tile-name">{tile.name}</div>
          <p className="souv-opt-tile-desc">{tile.desc}</p>
          <MusicPreviewButton label={`Preview ${tile.name} song`} />
        </Link>
      ))}
    </div>
  );
}
