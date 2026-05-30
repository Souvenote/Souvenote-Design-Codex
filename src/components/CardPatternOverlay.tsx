/**
 * Subtle engraved pattern overlay for metal card faces — a faint diagonal
 * hatch that catches the light. Absolutely positioned; drop inside a relative
 * card container.
 */
export default function CardPatternOverlay({ opacity = 0.12 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity,
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(34,23,6,0.4) 0px, rgba(34,23,6,0.4) 1px, transparent 1px, transparent 9px)",
        mixBlendMode: "soft-light",
        borderRadius: "inherit",
      }}
    />
  );
}
