import type { Config } from "tailwindcss";

/**
 * Tailwind is wired to the Souvenote design tokens (defined as CSS variables in
 * globals.css). Use utility classes like `text-gold`, `bg-warm`, `font-display`
 * alongside the hand-authored `souv-*` component classes.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "var(--bg-deep)",
          primary: "var(--bg-primary)",
          warm: "var(--bg-warm)",
          cream: "var(--bg-cream)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          hi: "var(--gold-hi)",
          lo: "var(--gold-lo)",
        },
        platinum: {
          hi: "var(--platinum-hi)",
          mid: "var(--platinum-mid)",
          lo: "var(--platinum-lo)",
        },
        rose: {
          DEFAULT: "var(--rose-gold)",
          hi: "var(--rose-gold-hi)",
          lo: "var(--rose-gold-lo)",
        },
      },
      fontFamily: {
        display: "var(--font-display)",
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
        num: "var(--font-num)",
      },
      borderRadius: {
        pill: "var(--r-pill)",
        xl2: "var(--r-2xl)",
      },
      boxShadow: {
        nav: "var(--shadow-nav-scroll)",
        card: "var(--shadow-card)",
        hero: "var(--shadow-hero)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
