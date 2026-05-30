import type { CardTemplate, CreditPack, NavLink } from "@/types";

// Mock card templates — swap with a real API/backend when ready.
export const MOCK_CARDS: CardTemplate[] = [
  { id: 1, name: "A Daily Sunday Strip", occasion: "Comic Strip", surface: "surface-gold-animated", priceLabel: "From $11.99 CAD" },
  { id: 2, name: "Stars Aligned For You", occasion: "Horoscope", surface: "surface-rosegold-animated", priceLabel: "From $11.99 CAD" },
  { id: 3, name: "A Day In History", occasion: "On This Day", surface: "surface-silver-animated", priceLabel: "From $11.99 CAD" },
  { id: 4, name: "Once Upon A Card", occasion: "Fairy Tale", surface: "surface-rosegold-animated", priceLabel: "From $11.99 CAD" },
  { id: 5, name: "Find The Birthday", occasion: "Where's Waldo", surface: "surface-trimetal-animated", priceLabel: "From $11.99 CAD" },
  { id: 6, name: "Cards For The Strange", occasion: "Dark Holidays", surface: "surface-silver-animated", priceLabel: "From $11.99 CAD" },
  { id: 7, name: "Anniversary Gold", occasion: "Anniversary", surface: "surface-gold-animated", priceLabel: "From $11.99 CAD" },
  { id: 8, name: "Thank You Notes", occasion: "Gratitude", surface: "surface-silver-animated", priceLabel: "From $11.99 CAD" },
];

export const OCCASIONS = [
  "All",
  "Birthday",
  "Anniversary",
  "Horoscope",
  "On This Day",
  "Fairy Tale",
  "Comic Strip",
  "Dark Holidays",
] as const;

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", price: "$2.00", credits: "10", blurb: "Top off a short session.", badge: undefined },
  { id: "creator", name: "Creator", price: "$10.00", credits: "80", blurb: "A full evening of iteration.", featured: true, badge: "Most popular" },
  { id: "power", name: "Power", price: "$25.00", credits: "250", blurb: "For repeat senders and remixers." },
];

export const NAV_LINKS: NavLink[] = [
  { label: "Build My Card", sub: "Start from scratch — photo, moment, song.", href: "/create" },
  { label: "Personalize a Template", sub: "Curated designs, ready to make yours.", href: "/personalize" },
  { label: "Community Cards", sub: "Cards shared by the Souvenote community.", href: "/cards" },
];
