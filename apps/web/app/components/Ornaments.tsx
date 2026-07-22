import type { CSSProperties, ReactNode } from "react";

// Shared primitives for the Souvenote UI.

type OrnamentDividerProps = {
  className?: string;
};

type RuleGoldProps = {
  style?: CSSProperties;
};

type StampCornersProps = {
  color?: string;
};

type EyebrowProps = {
  children: ReactNode;
  style?: CSSProperties;
};

function OrnamentDivider({ className = "" }: OrnamentDividerProps) {
  return (
    <div className={`souv-orn ${className}`}>
      <span className="r" /><span className="d" /><span className="r" />
    </div>
  );
}

function RuleGold({ style }: RuleGoldProps) {
  return <div className="souv-rule-gold" style={style} />;
}

function StampCorners({ color = "rgba(212,175,55,0.55)" }: StampCornersProps) {
  const base: CSSProperties = {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: color,
    pointerEvents: "none",
  };

  return (
    <>
      <span style={{ ...base, top: 12, left: 12, borderTop: "2px solid", borderLeft: "2px solid" }} />
      <span style={{ ...base, top: 12, right: 12, borderTop: "2px solid", borderRight: "2px solid" }} />
      <span style={{ ...base, bottom: 12, left: 12, borderBottom: "2px solid", borderLeft: "2px solid" }} />
      <span style={{ ...base, bottom: 12, right: 12, borderBottom: "2px solid", borderRight: "2px solid" }} />
    </>
  );
}

function Eyebrow({ children, style }: EyebrowProps) {
  return <div className="souv-eyebrow" style={style}>{children}</div>;
}

export { OrnamentDivider, RuleGold, StampCorners, Eyebrow };
