import type { CSSProperties, ReactNode } from 'react';

type CardPalette = {
  bg: string;
  g1: string;
  g2: string;
  ink: string;
  fig: string;
};

type CardArtProps = {
  palette?: CardPaletteName | string;
  glyph?: ReactNode;
  glyphSub?: ReactNode;
  glowIdx?: number;
  figure?: boolean;
  corners?: boolean;
  style?: CSSProperties;
};

const CARD_PALETTES = {
  gold: {
    bg: 'linear-gradient(160deg,#2a2418,#14120c)',
    g1: 'rgba(255,235,180,0.42)',
    g2: 'rgba(212,175,55,0.30)',
    ink: 'rgba(255,245,210,0.94)',
    fig: 'rgba(212,175,55,0.45)',
  },
  rose: {
    bg: 'linear-gradient(160deg,#2a1e1e,#16100f)',
    g1: 'rgba(229,184,177,0.42)',
    g2: 'rgba(200,139,134,0.34)',
    ink: 'rgba(255,235,225,0.95)',
    fig: 'rgba(200,139,134,0.55)',
  },
  silver: {
    bg: 'linear-gradient(160deg,#23262b,#121316)',
    g1: 'rgba(232,234,238,0.34)',
    g2: 'rgba(180,184,193,0.26)',
    ink: 'rgba(242,244,248,0.96)',
    fig: 'rgba(180,184,193,0.40)',
  },
  twilight: {
    bg: 'linear-gradient(160deg,#1d2030,#101018)',
    g1: 'rgba(160,170,225,0.32)',
    g2: 'rgba(200,139,134,0.22)',
    ink: 'rgba(236,239,250,0.95)',
    fig: 'rgba(160,170,220,0.40)',
  },
  ember: {
    bg: 'linear-gradient(160deg,#2d1d16,#16100b)',
    g1: 'rgba(255,200,150,0.42)',
    g2: 'rgba(212,120,80,0.26)',
    ink: 'rgba(255,236,216,0.95)',
    fig: 'rgba(212,130,90,0.48)',
  },
  sage: {
    bg: 'linear-gradient(160deg,#1c241f,#101512)',
    g1: 'rgba(186,214,186,0.32)',
    g2: 'rgba(150,180,150,0.22)',
    ink: 'rgba(236,246,236,0.95)',
    fig: 'rgba(150,185,155,0.40)',
  },
} satisfies Record<string, CardPalette>;

type CardPaletteName = keyof typeof CARD_PALETTES;

const CARD_GLOWS = [
  '70% 50% at 50% 22%',
  '60% 46% at 30% 28%',
  '64% 48% at 70% 24%',
  '72% 52% at 50% 32%',
  '58% 44% at 40% 20%',
];

function getPalette(palette: CardArtProps['palette']): CardPalette {
  return CARD_PALETTES[palette as CardPaletteName] || CARD_PALETTES.gold;
}

function CardArt({
  palette = 'gold',
  glyph = '',
  glyphSub = '',
  glowIdx = 0,
  figure = true,
  corners = true,
  style,
}: CardArtProps) {
  const p = getPalette(palette);
  const glow = CARD_GLOWS[glowIdx % CARD_GLOWS.length] || CARD_GLOWS[0];

  return (
    <div
      className="cardart"
      style={{
        background: `radial-gradient(${glow}, ${p.g1}, transparent 64%), radial-gradient(40% 40% at 30% 78%, ${p.g2}, transparent 70%), ${p.bg}`,
        ...style,
      }}
    >
      {corners && (
        <>
          <span className="cardart-corner tl" />
          <span className="cardart-corner br" />
        </>
      )}
      {glyph && (
        <div className="cardart-glyph" style={{ color: p.ink }}>
          {glyph}
          {glyphSub && <span className="cardart-glyph-sub">{glyphSub}</span>}
        </div>
      )}
      {figure && (
        <div
          className="cardart-fig"
          style={{ background: `radial-gradient(45% 80% at 50% 100%, ${p.fig}, transparent 70%)` }}
        />
      )}
    </div>
  );
}

export { CARD_PALETTES, CardArt };
export type { CardArtProps, CardPaletteName };
