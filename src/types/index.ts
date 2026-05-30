// Shared domain types for the Souvenote frontend.

export type SurfaceMetal =
  | "surface-gold-animated"
  | "surface-silver-animated"
  | "surface-rosegold-animated"
  | "surface-trimetal-animated";

export type AccentMetal = "gold" | "silver" | "rose";

export interface CardTemplate {
  id: number;
  name: string;
  occasion: string;
  surface: SurfaceMetal;
  priceLabel: string;
}

export interface CreditPack {
  id: string;
  name: string;
  price: string;
  credits: string;
  blurb: string;
  featured?: boolean;
  badge?: string;
}

export interface NavLink {
  label: string;
  sub: string;
  href: string;
}

export interface UserSummary {
  name: string;
  email: string;
  initials: string;
}

export interface CreditBalance {
  images: number;
  songs: number;
}
