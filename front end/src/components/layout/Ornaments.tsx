// Shared decorative primitives (server components — no interactivity).
import type { CSSProperties, ReactNode } from "react";

export function OrnamentDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`souv-orn ${className}`}>
      <span className="r" />
      <span className="d" />
      <span className="r" />
    </div>
  );
}

export function RuleGold({ style }: { style?: CSSProperties }) {
  return <div className="souv-rule-gold" style={style} />;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="souv-eyebrow" style={style}>
      {children}
    </div>
  );
}

/** Four engraved corner brackets for metal cards. */
export function StampCorners({ color = "rgba(212,175,55,0.55)" }: { color?: string }) {
  return (
    <>
      <span className="souv-stamp tl" style={{ borderColor: color }} />
      <span className="souv-stamp tr" style={{ borderColor: color }} />
      <span className="souv-stamp bl" style={{ borderColor: color }} />
      <span className="souv-stamp br" style={{ borderColor: color }} />
    </>
  );
}
